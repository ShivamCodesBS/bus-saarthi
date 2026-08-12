"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const jwt_1 = require("@nestjs/jwt");
const user_entity_1 = require("../users/entities/user.entity");
let EventsGateway = class EventsGateway {
    jwtService;
    server;
    logger = new common_1.Logger('EventsGateway');
    constructor(jwtService) {
        this.jwtService = jwtService;
    }
    afterInit(server) {
        this.logger.log('WebSocket Gateway Initialized');
    }
    handleConnection(client, ...args) {
        this.logger.log(`Client connected: ${client.id}`);
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }
    handleSubscribeRoute(payload, client) {
        const routeId = typeof payload === 'object' ? payload.route_id : payload;
        client.join(`route_${routeId}`);
        this.logger.log(`Client ${client.id} joined route_${routeId}`);
        return { event: 'subscribed', data: routeId };
    }
    handleUnsubscribeRoute(payload, client) {
        const routeId = typeof payload === 'object' ? payload.route_id : payload;
        client.leave(`route_${routeId}`);
        this.logger.log(`Client ${client.id} left route_${routeId}`);
        return { event: 'unsubscribed', data: routeId };
    }
    handleJoinAdmin(payload, client) {
        try {
            const token = payload?.token || client.handshake.auth?.token;
            if (!token)
                throw new Error('No token');
            const decoded = this.jwtService.verify(token);
            if (decoded.role !== user_entity_1.UserRole.TECH_ADMIN && decoded.role !== user_entity_1.UserRole.ADMIN) {
                throw new Error('Unauthorized role');
            }
            client.join('admin_room');
            this.logger.log(`Client ${client.id} joined admin_room`);
            return { event: 'subscribed', data: 'admin_room' };
        }
        catch (error) {
            this.logger.warn(`Failed admin join for client ${client.id}: ${error.message}`);
            client.disconnect();
        }
    }
    handleSystemMetrics(metrics) {
        this.server.to('admin_room').emit('live_metrics', metrics);
    }
    handleSystemLog(log) {
        this.server.to('admin_room').emit('new_log', log);
    }
    handleLiveTelemetry(payload) {
        const formattedPayload = {
            route_id: payload.route_id,
            location: {
                lat: payload.lat,
                lng: payload.lng,
            },
            speed: payload.mpu_speed_kmh || payload.gps_speed_knots * 1.852,
            heading: payload.heading_deg,
            comfort: 'Smooth',
            timestamp: payload.timestamp
        };
        this.server.to(`route_${payload.route_id}`).emit('live_telemetry', formattedPayload);
    }
    handleAttendanceMarked(payload) {
        this.server.to(`route_${payload.route_id}`).emit('live_attendance', payload);
        this.server.to('admin_room').emit('global_attendance', payload);
    }
};
exports.EventsGateway = EventsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], EventsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join_route'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], EventsGateway.prototype, "handleSubscribeRoute", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('unsubscribe_route'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], EventsGateway.prototype, "handleUnsubscribeRoute", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('join_admin'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], EventsGateway.prototype, "handleJoinAdmin", null);
__decorate([
    (0, event_emitter_1.OnEvent)('system.metrics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EventsGateway.prototype, "handleSystemMetrics", null);
__decorate([
    (0, event_emitter_1.OnEvent)('system.log'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EventsGateway.prototype, "handleSystemLog", null);
__decorate([
    (0, event_emitter_1.OnEvent)('telemetry.live'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EventsGateway.prototype, "handleLiveTelemetry", null);
__decorate([
    (0, event_emitter_1.OnEvent)('attendance.marked'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EventsGateway.prototype, "handleAttendanceMarked", null);
exports.EventsGateway = EventsGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], EventsGateway);
//# sourceMappingURL=events.gateway.js.map