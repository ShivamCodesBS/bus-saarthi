import { Repository } from 'typeorm';
import { PushSubscription } from './entities/push-subscription.entity';
import { Broadcast } from './entities/broadcast.entity';
import { ConfigService } from '@nestjs/config';
export declare class NotificationsService {
    private pushSubRepository;
    private broadcastRepository;
    private configService;
    private readonly logger;
    constructor(pushSubRepository: Repository<PushSubscription>, broadcastRepository: Repository<Broadcast>, configService: ConfigService);
    subscribe(loginId: string, subscription: any, deviceType?: string): Promise<{
        status: string;
    }>;
    sendPushNotification(loginId: string, payload: any): Promise<void>;
    broadcastMessage(message: string, title?: string): Promise<{
        status: string;
        message: string;
    }>;
    getRecentBroadcasts(): Promise<Broadcast[]>;
}
