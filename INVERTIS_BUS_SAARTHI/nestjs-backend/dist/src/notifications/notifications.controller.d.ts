import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    subscribe(req: any, body: any): Promise<{
        status: string;
    }>;
    getNotifications(req: any): Promise<import("./entities/broadcast.entity").Broadcast[]>;
    broadcast(body: {
        message: string;
        title?: string;
    }): Promise<{
        status: string;
        message: string;
    }>;
}
