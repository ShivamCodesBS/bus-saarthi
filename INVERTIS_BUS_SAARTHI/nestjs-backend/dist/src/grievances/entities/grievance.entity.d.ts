import { User } from '../../users/entities/user.entity';
import { GrievanceUpvote } from './grievance-upvote.entity';
export declare enum GrievanceStatus {
    PENDING = "pending",
    RESOLVED = "resolved"
}
export declare class Grievance {
    id: string;
    loginId: string;
    user: User;
    route: string;
    text: string;
    realName: string;
    type: string;
    mediaUrl: string;
    status: GrievanceStatus;
    upvotes: number;
    createdAt: Date;
    upvoteRecords: GrievanceUpvote[];
}
