import { TelemetryService } from './telemetry.service';
import { TelemetryBatchDto } from './dto/telemetry-batch.dto';
export declare class TelemetryController {
    private readonly telemetryService;
    constructor(telemetryService: TelemetryService);
    handleTelemetry(batchDto: TelemetryBatchDto): Promise<{
        status: string;
        received: number;
    }>;
    getRouteStatus(routeId: string): Promise<{
        status: string;
        data: {
            filled: number;
            total: number;
            status: string;
        };
    }>;
    getTelemetryHistory(routeId: string, date: string): Promise<{
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
