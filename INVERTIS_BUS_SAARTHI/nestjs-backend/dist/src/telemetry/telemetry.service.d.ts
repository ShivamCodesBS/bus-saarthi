import { Repository } from 'typeorm';
import { TelemetryBatchDto } from './dto/telemetry-batch.dto';
import { Telemetry } from './entities/telemetry.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { Route } from '../routes/entities/route.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
export declare class TelemetryService {
    private telemetryRepository;
    private attendanceRepository;
    private routeRepository;
    private eventEmitter;
    constructor(telemetryRepository: Repository<Telemetry>, attendanceRepository: Repository<Attendance>, routeRepository: Repository<Route>, eventEmitter: EventEmitter2);
    addBatchToQueue(batchDto: TelemetryBatchDto): Promise<{
        status: string;
        received: number;
    }>;
    getLatestStatus(routeId: string): Promise<{
        status: string;
        data: {
            filled: number;
            total: number;
            status: string;
        };
    }>;
    getTelemetryHistory(routeId: string, dateStr: string): Promise<{
        routeId: string;
        date: string;
        speedLimit: number;
        stats: {
            maxSpeed: number;
            avgSpeed: number;
            violations: number;
        };
        violationsData: any[];
        data: any[];
    }>;
}
