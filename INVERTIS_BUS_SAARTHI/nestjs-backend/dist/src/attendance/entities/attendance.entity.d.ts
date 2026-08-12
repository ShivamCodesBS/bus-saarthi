import { FeeStatus } from '../../users/entities/user.entity';
import type { User } from '../../users/entities/user.entity';
export declare class Attendance {
    id: string;
    passengerId: string;
    passenger: User;
    routeId: string;
    name: string;
    feeStatus: FeeStatus;
    confidence: number;
    timestamp: Date;
}
