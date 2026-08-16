import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as os from 'os';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService implements OnModuleInit {
  private metricsInterval: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
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
      },
    };
  }

  async getLogs(page = 1, limit = 50, level?: any) {
    const whereClause = level ? { level } : {};

    const [logs, total] = await Promise.all([
      this.prisma.systemLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.systemLog.count({ where: whereClause }),
    ]);

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
