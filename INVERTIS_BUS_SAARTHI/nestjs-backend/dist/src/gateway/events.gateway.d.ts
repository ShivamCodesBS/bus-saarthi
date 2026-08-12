import { OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
export declare class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private jwtService;
    server: Server;
    private logger;
    constructor(jwtService: JwtService);
    afterInit(server: Server): void;
    handleConnection(client: Socket, ...args: any[]): void;
    handleDisconnect(client: Socket): void;
    handleSubscribeRoute(payload: any, client: Socket): {
        event: string;
        data: any;
    };
    handleUnsubscribeRoute(payload: any, client: Socket): {
        event: string;
        data: any;
    };
    handleJoinAdmin(payload: any, client: Socket): {
        event: string;
        data: string;
    } | undefined;
    handleSystemMetrics(metrics: any): void;
    handleSystemLog(log: any): void;
    handleLiveTelemetry(payload: any): void;
    handleAttendanceMarked(payload: any): void;
}
