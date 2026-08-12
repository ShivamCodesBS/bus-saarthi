import { User } from '../../users/entities/user.entity';
export declare class PushSubscription {
    id: string;
    loginId: string;
    user: User;
    subscription: any;
    deviceType: string;
}
