import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as os from 'os';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger } from '@nestjs/common';

@Injectable()
export class HealthService implements OnModuleInit, OnModuleDestroy {
  private metricsInterval: NodeJS.Timeout;
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private cache: CacheService,
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

  /**
   * A real health check: it actually talks to the database and reports
   * whether the cache is connected, instead of always claiming "UP".
   */
  async check() {
    const startedAt = Date.now();
    let database = 'down';
    let databaseLatencyMs: number | null = null;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
      databaseLatencyMs = Date.now() - startedAt;
    } catch {
      database = 'down';
    }

    const redis = this.cache.isAvailable ? 'up' : 'down';

    // The service is only "up" when the database is reachable — without it
    // nothing can be served.
    const healthy = database === 'up';

    return {
      status: healthy ? 'UP' : 'DEGRADED',
      service: 'bus-saarthi-api',
      version: '2.0',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: database,
          latencyMs: databaseLatencyMs,
        },
        redis: {
          status: redis,
          // Redis is optional — the app runs without it.
          required: false,
        },
      },
    };
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

  // SEC-07: SystemLog TTL/cleanup job - runs daily at 3 AM
  // Deletes logs older than the configured retention period (default 90 days)
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldLogs() {
    const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS || '90', 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const result = await this.prisma.systemLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });
      this.logger.log(
        `Cleaned up ${result.count} system logs older than ${retentionDays} days`,
      );
    } catch (error) {
      this.logger.error(`Failed to cleanup old logs: ${error.message}`);
    }
  }
}
