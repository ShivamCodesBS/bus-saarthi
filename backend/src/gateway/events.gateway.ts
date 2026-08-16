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

  constructor(private jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway Initialized');
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_route')
  handleSubscribeRoute(
    @MessageBody() payload: any,
    @ConnectedSocket() client: Socket,
  ) {
    const routeId = typeof payload === 'object' ? payload.route_id : payload;
    client.join(`route_${routeId}`);
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

  @OnEvent('system.metrics')
  handleSystemMetrics(metrics: any) {
    this.server.to('admin_room').emit('live_metrics', metrics);
  }

  @OnEvent('system.log')
  handleSystemLog(log: any) {
    this.server.to('admin_room').emit('new_log', log);
  }

  @OnEvent('telemetry.live')
  handleLiveTelemetry(payload: any) {
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
  }

  @OnEvent('attendance.marked')
  handleAttendanceMarked(payload: any) {
    this.server
      .to(`route_${payload.route_id}`)
      .emit('live_attendance', payload);
    this.server.to('admin_room').emit('global_attendance', payload);
  }
}
