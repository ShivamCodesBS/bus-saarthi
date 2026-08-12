import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SystemLog } from './entities/system-log.entity';
export declare class HealthService implements OnModuleInit {
    private systemLogRepository;
    private eventEmitter;
    private metricsInterval;
    constructor(systemLogRepository: Repository<SystemLog>, eventEmitter: EventEmitter2);
    onModuleInit(): void;
    onModuleDestroy(): void;
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
    getLogs(page?: number, limit?: number, level?: string): Promise<{
        data: SystemLog[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
}
