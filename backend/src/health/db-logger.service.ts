import { Injectable, LoggerService, LogLevel as NestLogLevel } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SystemLog, LogLevel } from './entities/system-log.entity';

@Injectable()
export class DbLoggerService implements LoggerService {
  constructor(
    @InjectRepository(SystemLog)
    private readonly systemLogRepository: Repository<SystemLog>,
    private eventEmitter: EventEmitter2,
  ) {}

  log(message: any, context?: string) {
    this.saveLog(LogLevel.INFO, message, context);
    console.log(`[INFO] [${context || 'Application'}] ${message}`);
  }

  error(message: any, trace?: string, context?: string) {
    this.saveLog(LogLevel.ERROR, message, context, { trace });
    console.error(`[ERROR] [${context || 'Application'}] ${message}`, trace);
  }

  warn(message: any, context?: string) {
    this.saveLog(LogLevel.WARN, message, context);
    console.warn(`[WARN] [${context || 'Application'}] ${message}`);
  }

  debug(message: any, context?: string) {
    // Optional: this.saveLog(LogLevel.DEBUG, message, context);
    console.debug(`[DEBUG] [${context || 'Application'}] ${message}`);
  }

  verbose(message: any, context?: string) {
    // Optional: this.saveLog(LogLevel.VERBOSE, message, context);
    console.log(`[VERBOSE] [${context || 'Application'}] ${message}`);
  }

  fatal(message: any, context?: string) {
    this.saveLog(LogLevel.FATAL, message, context);
    console.error(`[FATAL] [${context || 'Application'}] ${message}`);
  }

  private async saveLog(level: LogLevel, message: any, context?: string, meta?: any) {
    // Fire and forget to not block execution
    const newLog = {
      level,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      context,
      meta,
      createdAt: new Date(),
    };
    
    this.systemLogRepository.save(newLog).catch(err => {
      console.error('Failed to save log to database', err);
    });

    this.eventEmitter.emit('system.log', newLog);
  }
}
