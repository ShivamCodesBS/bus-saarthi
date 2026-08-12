import { Repository } from 'typeorm';
import { Attendance } from './entities/attendance.entity';
import { SyncAttendanceDto } from './dto/sync-attendance.dto';
import { User } from '../users/entities/user.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
export declare class AttendanceService {
    private attendanceRepository;
    private usersRepository;
    private eventEmitter;
    constructor(attendanceRepository: Repository<Attendance>, usersRepository: Repository<User>, eventEmitter: EventEmitter2);
    syncAttendance(syncDto: SyncAttendanceDto): Promise<{
        synced: number;
        skipped: number;
        errors: number;
        status: string;
    }>;
    getAllAttendanceToday(): Promise<Attendance[]>;
    getAttendanceForRoute(routeId: string): Promise<Attendance[]>;
    getAttendanceForUser(loginId: string): Promise<Attendance[]>;
}
