import { LoggerService } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SystemLog } from './entities/system-log.entity';
export declare class DbLoggerService implements LoggerService {
    private readonly systemLogRepository;
    private eventEmitter;
    constructor(systemLogRepository: Repository<SystemLog>, eventEmitter: EventEmitter2);
    log(message: any, context?: string): void;
    error(message: any, trace?: string, context?: string): void;
    warn(message: any, context?: string): void;
    debug(message: any, context?: string): void;
    verbose(message: any, context?: string): void;
    fatal(message: any, context?: string): void;
    private saveLog;
}
