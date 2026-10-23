import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class SosService {
  private readonly logger = new Logger(SosService.name);
  private inMemoryCooldown = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private cache: CacheService,
  ) {}

  async trigger(loginId: string) {
    // Cooldown logic (1 minute). Redis is used when available so the cooldown
    // holds across every running instance of the backend; the in-process map
    // is the fallback for single-instance deployments.
    const cooldownKey = `sos:cooldown:${loginId}`;
    const inCooldown = await this.cache.getRaw(cooldownKey);
    if (inCooldown) {
      throw new BadRequestException(
        'SOS alert already triggered recently. Please wait.',
      );
    }

    if (this.cache.isAvailable) {
      await this.cache.setEx(cooldownKey, 60, 'true');
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
    // The route is the stable identity. If the user has no route we do not
    // attribute the alert to an arbitrary route (the old code silently used
    // route "4", which produced phantom alerts on the wrong bus).
    const routeId = user?.routeId || 'unknown';
    const passengerName = user?.name || user?.loginId || loginId;

    await this.prisma.sosAlert.create({
      data: {
        loginId,
        passenger: passengerName,
        route: routeId,
      },
    });

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const fullTimestamp = now.toISOString();
    this.eventEmitter.emit('sos.triggered', {
      login_id: loginId,
      passenger: passengerName,
      route: routeId,
      time: timeFormatted,
      timestamp: fullTimestamp,
    });

    return {
      status: 'success',
      message:
        routeId === 'unknown'
          ? 'SOS alert broadcasted to the transport office'
          : 'SOS alert broadcasted to route ' + routeId,
      data: {
        login_id: loginId,
        passenger: passengerName,
        route: routeId,
        time: timeFormatted,
        timestamp: fullTimestamp,
      },
    };
  }

  async cancel(loginId: string) {
    await this.cache.del(`sos:cooldown:${loginId}`);
    this.inMemoryCooldown.delete(loginId);

    try {
      await this.prisma.sosAlert.deleteMany({
        where: { loginId },
      });
    } catch (e) {
      this.logger.warn(
        `Failed to delete sosAlert records for ${loginId}: ${e.message}`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { loginId },
      select: { routeId: true },
    });

    this.eventEmitter.emit('sos.cancelled', {
      login_id: loginId,
      route: user?.routeId || 'unknown',
    });
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
        passenger: a.passenger || a.loginId || 'Student',
        route: a.route,
        time: new Date(a.time).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        timestamp: a.time.toISOString(),
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
            time: new Date(active.time).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            timestamp: active.time.toISOString(),
          }
        : null,
    };
  }
}
