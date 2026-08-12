import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SystemLog } from './entities/system-log.entity';
import * as os from 'os';

@Injectable()
export class HealthService implements OnModuleInit {
  private metricsInterval: NodeJS.Timeout;

  constructor(
    @InjectRepository(SystemLog)
    private systemLogRepository: Repository<SystemLog>,
    private eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    this.metricsInterval = setInterval(() => {
      this.eventEmitter.emit('system.metrics', this.getMetrics());
    }, 5000);
  }

  onModuleDestroy() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }

  getMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const uptime = process.uptime(); // Node process uptime
    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    return {
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercentage: ((usedMem / totalMem) * 100).toFixed(2),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0].model,
        loadAverage: loadAvg,
      },
      process: {
        uptime,
        memoryUsage: process.memoryUsage(),
      },
      os: {
        platform: os.platform(),
        release: os.release(),
        uptime: os.uptime(), // System uptime
      }
    };
  }

  async getLogs(page = 1, limit = 50, level?: string) {
    const query = this.systemLogRepository.createQueryBuilder('log');
    
    if (level) {
      query.where('log.level = :level', { level });
    }
    
    query.orderBy('log.createdAt', 'DESC')
         .skip((page - 1) * limit)
         .take(limit);

    const [logs, total] = await query.getManyAndCount();

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
