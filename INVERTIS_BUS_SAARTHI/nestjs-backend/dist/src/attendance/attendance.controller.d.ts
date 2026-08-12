import { AttendanceService } from './attendance.service';
import { SyncAttendanceDto } from './dto/sync-attendance.dto';
export declare class AttendanceController {
    private readonly attendanceService;
    constructor(attendanceService: AttendanceService);
    syncAttendance(syncDto: SyncAttendanceDto): Promise<{
        synced: number;
        skipped: number;
        errors: number;
        status: string;
    }>;
    getAttendanceByRoute(routeId: string): Promise<import("./entities/attendance.entity").Attendance[]>;
    getAllAttendance(): Promise<import("./entities/attendance.entity").Attendance[]>;
    getAttendanceByUser(loginId: string): Promise<import("./entities/attendance.entity").Attendance[]>;
}
