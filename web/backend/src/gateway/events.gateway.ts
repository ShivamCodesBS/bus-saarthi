import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { haversineDistance } from '../common/utils/haversine.util';

@WebSocketGateway({
  cors: {
    origin: '*', // Adjust to your needs
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('EventsGateway');

  // Track online users: loginId -> socketId
  private onlineUsers = new Map<string, string>();

  constructor(
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
    private usersService: UsersService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway Initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Remove from online users map
    for (const [loginId, socketId] of this.onlineUsers.entries()) {
      if (socketId === client.id) {
        this.onlineUsers.delete(loginId);
        break;
      }
    }
  }

  @SubscribeMessage('join_route')
  handleSubscribeRoute(
    @MessageBody() payload: any,
    @ConnectedSocket() client: Socket,
  ) {
    const routeId = typeof payload === 'object' ? payload.route_id : payload;
    client.join(`route_${routeId}`);

    // Track user's socket if they include loginId
    const loginId = payload?.login_id || payload?.loginId;
    if (loginId) {
      this.onlineUsers.set(loginId, client.id);
    }

    this.logger.log(`Client ${client.id} joined route_${routeId}`);
    return { event: 'subscribed', data: routeId };
  }

  @SubscribeMessage('unsubscribe_route')
  handleUnsubscribeRoute(
    @MessageBody() payload: any,
    @ConnectedSocket() client: Socket,
  ) {
    const routeId = typeof payload === 'object' ? payload.route_id : payload;
    client.leave(`route_${routeId}`);
    this.logger.log(`Client ${client.id} left route_${routeId}`);
    return { event: 'unsubscribed', data: routeId };
  }

  @SubscribeMessage('join_admin')
  handleJoinAdmin(
    @MessageBody() payload: any,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const token = payload?.token || client.handshake.auth?.token;
      if (!token) throw new Error('No token');

      const decoded = this.jwtService.verify(token);
      if (
        decoded.role !== UserRole.tech_admin &&
        decoded.role !== UserRole.admin
      ) {
        throw new Error('Unauthorized role');
      }

      client.join('admin_room');
      this.logger.log(`Client ${client.id} joined admin_room`);
      return { event: 'subscribed', data: 'admin_room' };
    } catch (error) {
      this.logger.warn(
        `Failed admin join for client ${client.id}: ${error.message}`,
      );
      client.disconnect();
    }
  }

  /**
   * Handles GPS/sensor data emitted directly from the Flutter bus app via Socket.
   * This is the primary telemetry path when the bus phone is connected.
   * It runs wake alarm checks just like the HTTP telemetry endpoint.
   */
  @SubscribeMessage('mobile_sensor_data')
  async handleMobileSensorData(
    @MessageBody() payload: any,
    @ConnectedSocket() client: Socket,
  ) {
    const lat = payload?.lat ?? payload?.latitude;
    const lng = payload?.lng ?? payload?.longitude;
    const routeId = payload?.route_id ?? payload?.routeId;
    if (!lat || !lng || !routeId) return;

    // Broadcast live location to all route subscribers (web dashboard, etc.)
    const formattedPayload = {
      route_id: String(routeId),
      location: { lat, lng },
      speed: payload?.mpu_speed_kmh || (payload?.gps_speed_knots ?? 0) * 1.852,
      heading: payload?.heading_deg,
      comfort: 'Smooth',
      timestamp: payload?.timestamp || new Date().toISOString(),
    };
    this.server.to(`route_${routeId}`).emit('live_telemetry', formattedPayload);

    // Run wake alarm engine on every GPS update from bus
    await this.checkWakeAlarms(lat, lng, routeId);
  }

  @OnEvent('system.metrics')
  handleSystemMetrics(metrics: any) {
    this.server.to('admin_room').emit('live_metrics', metrics);
  }

  @OnEvent('system.log')
  handleSystemLog(log: any) {
    this.server.to('admin_room').emit('new_log', log);
  }

  @OnEvent('telemetry.live')
  async handleLiveTelemetry(payload: any) {
    // Map backend DTO to frontend format
    const formattedPayload = {
      route_id: payload.route_id,
      location: {
        lat: payload.lat,
        lng: payload.lng,
      },
      speed: payload.mpu_speed_kmh || payload.gps_speed_knots * 1.852,
      heading: payload.heading_deg,
      comfort: 'Smooth', // Mock since hardware doesn't send this yet
      timestamp: payload.timestamp,
    };
    this.server
      .to(`route_${payload.route_id}`)
      .emit('live_telemetry', formattedPayload);

    // Check wake alarms for all users on this route
    if (payload.lat && payload.lng) {
      await this.checkWakeAlarms(payload.lat, payload.lng, payload.route_id);
    }
  }

  @OnEvent('attendance.marked')
  handleAttendanceMarked(payload: any) {
    this.server
      .to(`route_${payload.route_id}`)
      .emit('live_attendance', payload);
    this.server.to('admin_room').emit('global_attendance', payload);
  }

  @OnEvent('merge.executed')
  handleMergeExecuted(payload: any) {
    const { mergeEvent, cancelledRoute, targetRoute, cancelledStudentCount } = payload;
    
    // Broadcast to admin room (Transport Incharge & Admin dashboards)
    this.server.to('admin_room').emit('merge_executed', payload);

    // Broadcast to students/drivers on the cancelled route
    this.server.to(`route_${mergeEvent.cancelledRouteId}`).emit('your_route_merged', {
      mergeEventId: mergeEvent.id,
      cancelledRouteId: mergeEvent.cancelledRouteId,
      newRouteId: mergeEvent.targetRouteId,
      newBusNumber: targetRoute.busNumber,
      newRouteName: targetRoute.routeName,
      reason: mergeEvent.reason,
      message: `Your bus (${cancelledRoute.busNumber}) has been cancelled. Please board Bus ${targetRoute.busNumber} (${targetRoute.routeName}).`,
    });

    // Broadcast to students/drivers on the target route
    this.server.to(`route_${mergeEvent.targetRouteId}`).emit('students_incoming', {
      fromRoute: cancelledRoute.routeName,
      fromBus: cancelledRoute.busNumber,
      fromRouteId: mergeEvent.cancelledRouteId,
      count: cancelledStudentCount,
      message: `${cancelledStudentCount} students from ${cancelledRoute.routeName} (Bus ${cancelledRoute.busNumber}) are merged into your bus.`,
    });
  }

  @OnEvent('merge.undone')
  handleMergeUndone(payload: any) {
    const { merge } = payload;
    
    this.server.to('admin_room').emit('merge_undone', payload);
    this.server.to(`route_${merge.cancelledRouteId}`).emit('route_restored', {
      cancelledRouteId: merge.cancelledRouteId,
      message: `Your original bus route (${merge.cancelledRouteName}) has been restored.`,
    });
    this.server.to(`route_${merge.targetRouteId}`).emit('students_removed', {
      fromRouteId: merge.cancelledRouteId,
      message: `Merge with ${merge.cancelledRouteName} was undone.`,
    });
  }

  /**
   * Server-side wake alarm engine.
   * Runs on every telemetry event. Compares bus location vs saved user location.
   * Fires Web Push if bus is within user's set threshold km.
   * User's phone GPS does NOT need to be on — we use their saved location.
   */
  private async checkWakeAlarms(busLat: number, busLng: number, routeId: string) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const activeAlarms = await this.usersService.getActiveWakeAlarms();

      for (const u of activeAlarms) {
        const alarm = u.wakeAlarm as any;
        if (!alarm?.lat || !alarm?.lng) continue;
        if (alarm.firedAt === today) continue; // Already fired today, don't spam

        // haversineDistance returns meters — convert to km
        const distanceMeters = haversineDistance(busLat, busLng, alarm.lat, alarm.lng);
        const distanceKm = distanceMeters / 1000;

        if (distanceKm <= alarm.thresholdKm) {
          this.logger.log(
            `Wake alarm triggered for ${u.loginId}: bus is ${distanceKm.toFixed(2)}km away`,
          );

          // 1. Send Web Push Notification (works even if app/browser is closed)
          await this.notificationsService.sendPushNotification(u.loginId, {
            title: '🚌 Your Bus is Near!',
            body: `Bus is only ${distanceKm.toFixed(1)}km away from your location. Get ready!`,
            icon: '/icons/bus-192x192.png',
            badge: '/icons/bus-72x72.png',
            tag: 'wake-alarm',
            requireInteraction: true,
          });

          // 2. If user's browser tab is currently open, also emit socket event
          const socketId = this.onlineUsers.get(u.loginId);
          if (socketId) {
            this.server.to(socketId).emit('wake_alarm_trigger', {
              distanceKm: parseFloat(distanceKm.toFixed(2)),
              message: `Bus is ${distanceKm.toFixed(1)}km away!`,
            });
          }

          // 3. Mark alarm as fired for today — preserves push subscription
          await this.usersService.markAlarmFired(u.loginId, today);
        }
      }
    } catch (err) {
      this.logger.error('Wake alarm check failed:', err);
    }
  }
}
