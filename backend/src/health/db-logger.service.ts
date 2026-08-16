import {
  Injectable,
  LoggerService,
  LogLevel as NestLogLevel,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { LogLevel } from '@prisma/client';

@Injectable()
export class DbLoggerService implements LoggerService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  log(message: any, context?: string) {
    this.saveLog(LogLevel.log, message, context);
    console.log(`[INFO] [${context || 'Application'}] ${message}`);
  }

  error(message: any, trace?: string, context?: string) {
    this.saveLog(LogLevel.error, message, context, { trace });
    console.error(`[ERROR] [${context || 'Application'}] ${message}`, trace);
  }

  warn(message: any, context?: string) {
    this.saveLog(LogLevel.warn, message, context);
    console.warn(`[WARN] [${context || 'Application'}] ${message}`);
  }

  debug(message: any, context?: string) {
    // Optional: this.saveLog(LogLevel.debug, message, context);
    console.debug(`[DEBUG] [${context || 'Application'}] ${message}`);
  }

  verbose(message: any, context?: string) {
    // Optional: this.saveLog(LogLevel.verbose, message, context);
    console.log(`[VERBOSE] [${context || 'Application'}] ${message}`);
  }

  fatal(message: any, context?: string) {
    this.saveLog(LogLevel.fatal, message, context);
    console.error(`[FATAL] [${context || 'Application'}] ${message}`);
  }

  private async saveLog(
    level: LogLevel,
    message: any,
    context?: string,
    meta?: any,
  ) {
    // Fire and forget to not block execution
    const newLog = {
      level,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      context,
      meta,
      createdAt: new Date(),
    };

    this.prisma.systemLog
      .create({
        data: newLog as any,
      })
      .catch((err) => {
        console.error('Failed to save log to database', err);
      });

    this.eventEmitter.emit('system.log', newLog);
  }
}
