import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class SosService {
  private redisClient: any;
  private inMemoryCooldown = new Map<string, number>();
  private readonly logger = new Logger(SosService.name);
  private useRedis = false;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    this.initRedis();
  }

  private async initRedis() {
    try {
      this.redisClient = createClient({
        url:
          this.configService.get<string>('redis.url') ||
          'redis://localhost:6379',
        socket: { reconnectStrategy: false }
      });
      this.redisClient.on('error', (err: any) => {
        this.logger.debug(`Redis SOS client error: ${err.message}`);
      });
      await this.redisClient.connect();
      this.useRedis = true;
      this.logger.log('Redis connected for SOS cooldowns');
    } catch (err) {
      this.logger.warn(
        `Redis not available for SOS cooldowns. Falling back to in-memory map.`,
      );
      this.useRedis = false;
    }
  }

  async trigger(loginId: string) {
    // Cooldown logic (1 minute)
    if (this.useRedis) {
      const cooldownKey = `sos:cooldown:${loginId}`;
      const inCooldown = await this.redisClient.get(cooldownKey);
      if (inCooldown) {
        throw new BadRequestException(
          'SOS alert already triggered recently. Please wait.',
        );
      }
      await this.redisClient.setEx(cooldownKey, 60, 'true');
    } else {
      const now = Date.now();
      const lastTrigger = this.inMemoryCooldown.get(loginId);
      if (lastTrigger && now - lastTrigger < 60000) {
        throw new BadRequestException(
          'SOS alert already triggered recently. Please wait.',
        );
      }
      this.inMemoryCooldown.set(loginId, now);
    }

    const user = await this.prisma.user.findUnique({ where: { loginId } });
    const routeId = user?.routeId || '4';

    await this.prisma.sosAlert.create({
      data: {
        loginId,
        passenger: user?.name,
        route: routeId,
      },
    });

    // Notify Gateway
    const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.eventEmitter.emit('sos.triggered', {
      login_id: loginId,
      passenger: user?.name || 'Anonymous',
      route: routeId,
      time: timeFormatted,
    });

    return {
      status: 'success',
      message: 'SOS alert broadcasted to route ' + routeId,
      data: {
        login_id: loginId,
        passenger: user?.name,
        route: routeId,
        time: timeFormatted,
      },
    };
  }

  async cancel(loginId: string) {
    if (this.useRedis) {
      const cooldownKey = `sos:cooldown:${loginId}`;
      await this.redisClient.del(cooldownKey);
    } else {
      this.inMemoryCooldown.delete(loginId);
    }

    try {
      await this.prisma.sosAlert.deleteMany({
        where: { loginId },
      });
    } catch (e) {
      this.logger.warn(`Failed to delete sosAlert records for ${loginId}: ${e.message}`);
    }

    this.eventEmitter.emit('sos.cancelled', { login_id: loginId });
    return { status: 'success', message: 'SOS alert cancelled' };
  }

  async getActiveAlerts() {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const alerts = await this.prisma.sosAlert.findMany({
      where: {
        time: { gte: twelveHoursAgo },
      },
      orderBy: { time: 'desc' },
      take: 20,
    });

    return {
      status: 'success',
      data: alerts.map((a) => ({
        id: a.id,
        login_id: a.loginId,
        passenger: a.passenger || 'Anonymous',
        route: a.route,
        time: new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })),
    };
  }

  async getMyStatus(loginId: string) {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const active = await this.prisma.sosAlert.findFirst({
      where: {
        loginId,
        time: { gte: twelveHoursAgo },
      },
      orderBy: { time: 'desc' },
    });

    return {
      status: 'success',
      active: !!active,
      alert: active
        ? {
            id: active.id,
            route: active.route,
            time: new Date(active.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        : null,
    };
  }
}
