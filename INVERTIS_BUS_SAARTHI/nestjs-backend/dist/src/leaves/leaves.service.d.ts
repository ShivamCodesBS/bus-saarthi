import { Repository } from 'typeorm';
import { Leave } from './entities/leave.entity';
import { User } from '../users/entities/user.entity';
export declare class LeavesService {
    private leaveRepository;
    private usersRepository;
    constructor(leaveRepository: Repository<Leave>, usersRepository: Repository<User>);
    markLeave(loginId: string, dateStr: string): Promise<{
        status: string;
        message: string;
    }>;
    cancelLeave(loginId: string, dateStr: string): Promise<{
        status: string;
        message: string;
    }>;
}
