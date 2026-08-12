import { Grievance } from './grievance.entity';
import { User } from '../../users/entities/user.entity';
export declare class GrievanceUpvote {
    grievanceId: string;
    loginId: string;
    grievance: Grievance;
    user: User;
}
