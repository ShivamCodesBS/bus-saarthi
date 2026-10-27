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

  // Per-route throttle for the wake-alarm engine (it otherwise runs a
  // users-table query on every single GPS point).
  private lastWakeAlarmCheck = new Map<string, number>();
  private static WAKE_ALARM_CHECK_INTERVAL_MS = 5000;

  constructor(
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
    private usersService: UsersService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway Initialized');
  }

  /**
   * Verify the JWT the client passed in `auth.token` (or the Authorization
   * header). Authenticated sockets are auto-joined to `user_<login_id>` so
   * targeted events (personal notifications, profile updates, grievance
   * updates on your own complaint) reach every tab without the client having
   * to join anything. Anonymous sockets are allowed — the deployed Flutter
   * bus app and public route tracking connect without a JWT.
   */
  handleConnection(client: Socket, ...args: any[]) {
    const token =
      client.handshake?.auth?.token ||
      client.handshake?.headers?.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return;

    try {
      const decoded: any = this.jwtService.verify(token);
      const loginId = decoded?.login_id || decoded?.loginId;
      if (loginId) {
        client.data.loginId = loginId;
        client.data.role = decoded.role;
        client.join(`user_${loginId}`);
      }
    } catch {
      this.logger.warn(
        `Client ${client.id} presented an invalid token — treated as anonymous`,
      );
    }
  }

  handleDisconnect(client: Socket) {
    // Rooms are cleaned up automatically by socket.io.
  }

  @SubscribeMessage('join_route')
  handleSubscribeRoute(
    @MessageBody() payload: any,
    @ConnectedSocket() client: Socket,
  ) {
    const routeId = typeof payload === 'object' ? payload.route_id : payload;
    client.join(`route_${routeId}`);

    // Sockets that authenticated on connection are already in their
    // `user_<login_id>` room. Anonymous clients may still identify
    // themselves here for backward compatibility.
    const loginId =
      client.data?.loginId || payload?.login_id || payload?.loginId;
    if (loginId && !client.data?.loginId) {
      client.join(`user_${loginId}`);
    }

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
        decoded.role !== UserRole.admin &&
        decoded.role !== UserRole.transport_incharge
      ) {
        throw new Error('Unauthorized role');
      }

      client.join('admin_room');
      return { event: 'subscribed', data: 'admin_room' };
    } catch (error) {
      this.logger.warn(`Failed admin join for client ${client.id}: ${error.message}`);
      // Tell the client instead of silently killing the connection —
      // a silent disconnect looks exactly like "the dashboard is broken".
      client.emit('admin_join_failed', { message: error.message });
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
      speed:
        typeof payload?.mpu_speed_kmh === 'number'
          ? payload.mpu_speed_kmh
          : typeof payload?.speed === 'number'
            ? payload.speed
            : (payload?.gps_speed_knots ?? 0) * 1.852,
      heading: payload?.heading_deg ?? payload?.heading,
      comfort: payload?.comfort || 'Smooth',
      timestamp: payload?.timestamp || new Date().toISOString(),
    };
    this.server.to(`route_${routeId}`).emit('live_telemetry', formattedPayload);

    // Run wake alarm engine on GPS updates from bus (throttled per route)
    this.maybeCheckWakeAlarms(lat, lng, routeId);
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
    const lat = payload.lat ?? payload.latitude;
    const lng = payload.lng ?? payload.longitude;
    // Map backend DTO to frontend format
    const formattedPayload = {
      route_id: String(payload.route_id),
      location: {
        lat,
        lng,
      },
      speed:
        typeof payload?.mpu_speed_kmh === 'number'
          ? payload.mpu_speed_kmh
          : typeof payload?.speed === 'number'
            ? payload.speed
            : (payload?.gps_speed_knots ? payload.gps_speed_knots * 1.852 : 0),
      heading: payload.heading_deg ?? payload.heading,
      comfort: payload.comfort || 'Smooth',
      timestamp: payload.timestamp || new Date().toISOString(),
    };
    this.server
      .to(`route_${payload.route_id}`)
      .emit('live_telemetry', formattedPayload);

    // Check wake alarms for all users on this route
    if (lat && lng) {
      this.maybeCheckWakeAlarms(lat, lng, payload.route_id);
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
      newBusNumber: targetRoute?.busNumber,
      newRouteName: targetRoute?.routeName,
      reason: mergeEvent.reason,
      message: `Your bus (${cancelledRoute?.busNumber || mergeEvent.cancelledRouteName || 'assigned'}) has been cancelled. Please board Bus ${targetRoute?.busNumber || 'the replacement'} (${targetRoute?.routeName || 'replacement route'}).`,
    });

    // Broadcast to students/drivers on the target route
    this.server.to(`route_${mergeEvent.targetRouteId}`).emit('students_incoming', {
      fromRoute: cancelledRoute?.routeName,
      fromBus: cancelledRoute?.busNumber,
      fromRouteId: mergeEvent.cancelledRouteId,
      count: cancelledStudentCount,
      message: `${cancelledStudentCount ?? 'Some'} students from ${cancelledRoute?.routeName || 'another route'} (Bus ${cancelledRoute?.busNumber || '—'}) are merged into your bus.`,
    });
  }

  @OnEvent('merge.undone')
  handleMergeUndone(payload: any) {
    // Support both field names for backward compatibility
    const mergeEvent = payload.mergeEvent || payload.merge;
    
    this.server.to('admin_room').emit('merge_undone', payload);
    this.server.to(`route_${mergeEvent.cancelledRouteId}`).emit('route_restored', {
      cancelledRouteId: mergeEvent.cancelledRouteId,
      message: `Your original bus route (${mergeEvent.cancelledRouteName}) has been restored.`,
    });
    this.server.to(`route_${mergeEvent.targetRouteId}`).emit('students_removed', {
      fromRouteId: mergeEvent.cancelledRouteId,
      message: `Merge with ${mergeEvent.cancelledRouteName} was undone.`,
    });
  }

  @OnEvent('bus.cancelled')
  handleBusCancelled(payload: any) {
    const { mergeEvent, cancelledRoute, cancelledStudentCount } = payload;
    
    this.server.to('admin_room').emit('bus_cancelled', payload);

    // Broadcast to students/drivers on the cancelled route
    this.server.to(`route_${mergeEvent.cancelledRouteId}`).emit('your_route_cancelled', {
      mergeEventId: mergeEvent.id,
      cancelledRouteId: mergeEvent.cancelledRouteId,
      reason: mergeEvent.reason,
      message: `Your bus (${cancelledRoute.busNumber}) has been cancelled today. No replacement bus is available.`,
    });
  }

  @OnEvent('sos.triggered')
  handleSosTriggered(payload: any) {
    this.logger.warn(
      `🚨 SOS Alert triggered by ${payload.login_id} (Route ${payload.route})`,
    );
    // Broadcast to admin room (Admin Dashboard and Transport Incharge)
    this.server.to('admin_room').emit('sos_alert', payload);
    // Broadcast to specific bus route subscribers.
    // NOTE: we must NOT also `this.server.emit(...)` globally — the admin
    // dashboards are members of `admin_room` AND of `route_<id>`, so a global
    // broadcast delivered the same alert to them three times.
    if (payload.route && payload.route !== 'unknown') {
      this.server.to(`route_${payload.route}`).emit('sos_alert', payload);
    }
  }

  @OnEvent('sos.cancelled')
  handleSosCancelled(payload: any) {
    this.logger.log(`SOS Alert cancelled for ${payload.login_id}`);
    this.server.to('admin_room').emit('sos_cancelled', payload);
    if (payload.route && payload.route !== 'unknown') {
      this.server.to(`route_${payload.route}`).emit('sos_cancelled', payload);
    }
    // Deliver to the user's own sockets so the student's SOS button
    // resets even if they are not in the route room.
    this.server.to(`user_${payload.login_id}`).emit('sos_cancelled', payload);
  }

  @OnEvent('broadcast.created')
  handleBroadcastCreated(payload: any) {
    this.logger.log(`📢 Broadcasting announcement globally: ${payload.title || 'Notice'}`);
    this.server.emit('global_broadcast', payload);
  }

  @OnEvent('grievance.created')
  handleGrievanceCreated(grievance: any) {
    // Route rooms are joined by any student on that bus — never leak the
    // reporter's real name/login there. The admin room gets the full record.
    this.server.to(`route_${grievance.route}`).emit('new_grievance', this.maskGrievance(grievance));
    this.server.to('admin_room').emit('new_grievance', grievance);
  }

  @OnEvent('grievance.updated')
  handleGrievanceUpdated(grievance: any) {
    this.server.to(`route_${grievance.route}`).emit('grievance_updated', this.maskGrievance(grievance));
    this.server.to('admin_room').emit('grievance_updated', grievance);
    if (grievance.loginId) {
      // The reporter may follow their own complaint from another tab.
      this.server.to(`user_${grievance.loginId}`).emit('grievance_updated', grievance);
    }
  }

  /**
   * Strip identity fields before broadcasting a grievance to a route room.
   * The login id is always removed; the reporter's name survives only when
   * they chose NOT to post anonymously (that is what the toggle means).
   */
  private maskGrievance(grievance: any) {
    if (!grievance || typeof grievance !== 'object') return grievance;
    const { loginId, login_id, realName, ...rest } = grievance;
    if (grievance.isAnonymous) {
      // When anonymous, strip realName entirely from route-room payload
      return rest;
    }
    // Not anonymous: keep realName (already in rest)
    return rest;
  }

  /**
   * Deliver a personal in-app notification to the user's open tabs.
   * The persistent record lives in the `notifications` table; this is the
   * real-time half of it.
   */
  @OnEvent('notification.created')
  handleNotificationCreated(payload: any) {
    if (!payload?.login_id) return;
    // One emit to the user's room covers every tab and device. The payload
    // carries the created notification row (id, created_at) so the client
    // can mark it read later.
    this.server.to(`user_${payload.login_id}`).emit('notification', payload);
  }

  /**
   * Handle user profile updates and broadcast to the user's open tabs.
   * This ensures the admin dashboard, profile page, and other tabs
   * all stay in sync when an admin updates a user's details.
   */
  @OnEvent('user.updated')
  handleUserUpdated(payload: any) {
    if (!payload?.loginId) return;
    const { loginId, name, profilePic } = payload;

    // The user's room reaches every tab/device of that user.
    this.server.to(`user_${loginId}`).emit('profile_update', {
      login_id: loginId,
      name,
      profile_pic: profilePic,
    });
  }

  /**
   * Throttled entry point — GPS can arrive several times per second, but the
   * alarm check hits the users table, so it runs at most once every few
   * seconds per route.
   */
  private maybeCheckWakeAlarms(busLat: number, busLng: number, routeId: string) {
    const now = Date.now();
    const last = this.lastWakeAlarmCheck.get(String(routeId)) || 0;
    if (now - last < EventsGateway.WAKE_ALARM_CHECK_INTERVAL_MS) return;
    this.lastWakeAlarmCheck.set(String(routeId), now);
    void this.checkWakeAlarms(busLat, busLng, routeId);
  }

  /**
   * Server-side wake alarm engine.
   * Runs on telemetry events (throttled). Compares bus location vs saved user location.
   * Fires Web Push if bus is within user's set threshold km.
   * User's phone GPS does NOT need to be on — we use their saved location.
   */
  private async checkWakeAlarms(busLat: number, busLng: number, routeId: string) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const activeAlarms = await this.usersService.getActiveWakeAlarms();

      for (const u of activeAlarms) {
        // Only trigger wake alarm if this bus is on user's route
        if (routeId && u.routeId && String(u.routeId) !== String(routeId)) {
          continue;
        }

        const alarm = u.wakeAlarm as any;
        if (!alarm?.lat || !alarm?.lng) continue;
        if (alarm.firedAt === today) continue; // Already fired today, don't spam

        // haversineDistance returns meters — convert to km
        const distanceMeters = haversineDistance(busLat, busLng, alarm.lat, alarm.lng);
        const distanceKm = distanceMeters / 1000;

        if (distanceKm <= alarm.thresholdKm) {
          // 1. Send Web Push Notification (works even if app/browser is closed)
          await this.notificationsService.sendPushNotification(u.loginId, {
            title: '🚌 Your Bus is Near!',
            body: `Bus is only ${distanceKm.toFixed(1)}km away from your location. Get ready!`,
            icon: '/icons/bus-192x192.png',
            badge: '/icons/bus-72x72.png',
            tag: 'wake-alarm',
            requireInteraction: true,
          }).catch(() => {});

          // 2. If the user has a tab open, ring the in-app alarm
          this.server.to(`user_${u.loginId}`).emit('wake_alarm_trigger', {
            distanceKm: parseFloat(distanceKm.toFixed(2)),
            message: `Bus is ${distanceKm.toFixed(1)}km away!`,
          });

          // 3. Mark alarm as fired for today — preserves push subscription
          await this.usersService.markAlarmFired(u.loginId, today);
        }
      }
    } catch (err) {
      this.logger.error('Wake alarm check failed:', err);
    }
  }
}
