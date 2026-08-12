import { HealthService } from './health.service';
export declare class HealthController {
    private readonly healthService;
    constructor(healthService: HealthService);
    check(): {
        status: string;
        uptime: number;
        timestamp: string;
    };
    getMetrics(): {
        memory: {
            total: number;
            free: number;
            used: number;
            usagePercentage: string;
        };
        cpu: {
            cores: number;
            model: string;
            loadAverage: number[];
        };
        process: {
            uptime: number;
            memoryUsage: NodeJS.MemoryUsage;
        };
        os: {
            platform: NodeJS.Platform;
            release: string;
            uptime: number;
        };
    };
    getLogs(page: string, limit: string, level: string): Promise<{
        data: import("./entities/system-log.entity").SystemLog[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
}
