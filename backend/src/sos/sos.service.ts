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
    // Cooldown logic (1 minute). SET NX EX is atomic — the old get-then-set
    // let two rapid triggers race past the check together.
    const cooldownKey = `sos:cooldown:${loginId}`;
    const acquired = await this.cache.setIfNotExists(cooldownKey, 60);

    if (!this.cache.isAvailable) {
      const now = Date.now();
      const lastTrigger = this.inMemoryCooldown.get(loginId);
      if (lastTrigger && now - lastTrigger < 60000) {
        throw new BadRequestException(
          'SOS alert already triggered recently. Please wait.',
        );
      }
      this.inMemoryCooldown.set(loginId, now);
    } else if (!acquired) {
      throw new BadRequestException(
        'SOS alert already triggered recently. Please wait.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { loginId } });
    // The route is the stable identity. If the user has no route we do not
    // attribute the alert to an arbitrary route (the old code silently used
    // route "4", which produced phantom alerts on the wrong bus).
    const routeId = user?.routeId || 'unknown';
    const passengerName = user?.name || user?.loginId || loginId;

    const alert = await this.prisma.sosAlert.create({
      data: {
        loginId,
        passenger: passengerName,
        route: routeId,
        status: 'active',
      },
    });

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const fullTimestamp = now.toISOString();
    this.eventEmitter.emit('sos.triggered', {
      id: alert.id,
      login_id: loginId,
      passenger: passengerName,
      route: routeId,
      status: 'active',
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
        id: alert.id,
        login_id: loginId,
        passenger: passengerName,
        route: routeId,
        status: 'active',
        time: timeFormatted,
        timestamp: fullTimestamp,
      },
    };
  }

  async cancel(loginId: string, cancelledBy?: string) {
    await this.cache.del(`sos:cooldown:${loginId}`);
    this.inMemoryCooldown.delete(loginId);

    const cancelledByUser = cancelledBy || loginId;
    const cancelledAt = new Date();

    try {
      await this.prisma.sosAlert.updateMany({
        where: {
          loginId,
          status: 'active',
        },
        data: {
          status: 'cancelled',
          resolvedBy: cancelledByUser,
          resolvedAt: cancelledAt,
        },
      });
    } catch (e: any) {
      this.logger.warn(
        `Failed to update sosAlert records for ${loginId}: ${e.message}`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { loginId },
      select: { routeId: true },
    });

    this.eventEmitter.emit('sos.cancelled', {
      login_id: loginId,
      route: user?.routeId || 'unknown',
      cancelled_by: cancelledByUser,
      cancelled_at: cancelledAt.toISOString(),
      status: 'cancelled',
    });

    this.logger.log(`SOS cancelled for ${loginId} by ${cancelledByUser}`);
    return { status: 'success', message: 'SOS alert cancelled' };
  }

  async resolve(alertId: string, resolvedBy: string, notes?: string) {
    const alert = await this.prisma.sosAlert.findUnique({
      where: { id: alertId },
    });
    if (!alert) {
      throw new BadRequestException('SOS alert not found');
    }

    const resolvedAt = new Date();
    await this.prisma.sosAlert.update({
      where: { id: alertId },
      data: {
        status: 'resolved',
        resolvedBy,
        resolvedAt,
        notes: notes || null,
      },
    });

    await this.cache.del(`sos:cooldown:${alert.loginId}`);
    this.inMemoryCooldown.delete(alert.loginId);

    this.eventEmitter.emit('sos.cancelled', {
      alert_id: alertId,
      login_id: alert.loginId,
      route: alert.route,
      cancelled_by: resolvedBy,
      cancelled_at: resolvedAt.toISOString(),
      status: 'resolved',
      notes,
    });

    this.logger.log(
      `SOS ${alertId} resolved for ${alert.loginId} by ${resolvedBy}`,
    );
    return { status: 'success', message: 'SOS alert resolved successfully' };
  }

  async getActiveAlerts() {
    const alerts = await this.prisma.sosAlert.findMany({
      where: {
        status: 'active',
      },
      orderBy: { time: 'desc' },
      take: 50,
    });

    return {
      status: 'success',
      data: alerts.map((a) => ({
        id: a.id,
        login_id: a.loginId,
        passenger: a.passenger || a.loginId || 'Student',
        route: a.route,
        status: a.status || 'active',
        time: new Date(a.time).toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
        timestamp: a.time.toISOString(),
      })),
    };
  }

  async getHistory(options: {
    status?: string;
    route?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.status && options.status !== 'all') {
      where.status = options.status;
    }
    if (options.route && options.route !== 'all') {
      where.route = options.route;
    }
    if (options.search) {
      where.OR = [
        { passenger: { contains: options.search, mode: 'insensitive' } },
        { loginId: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [alerts, total, activeCount, resolvedCount, cancelledCount] =
      await Promise.all([
        this.prisma.sosAlert.findMany({
          where,
          orderBy: { time: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.sosAlert.count({ where }),
        this.prisma.sosAlert.count({ where: { status: 'active' } }),
        this.prisma.sosAlert.count({ where: { status: 'resolved' } }),
        this.prisma.sosAlert.count({ where: { status: 'cancelled' } }),
      ]);

    return {
      status: 'success',
      data: alerts.map((a) => ({
        id: a.id,
        login_id: a.loginId,
        passenger: a.passenger || a.loginId || 'Student',
        route: a.route,
        status: a.status || 'active',
        resolved_by: a.resolvedBy,
        resolved_at: a.resolvedAt ? a.resolvedAt.toISOString() : null,
        notes: a.notes,
        time: new Date(a.time).toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
        timestamp: a.time.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        active: activeCount,
        resolved: resolvedCount,
        cancelled: cancelledCount,
        totalAll: activeCount + resolvedCount + cancelledCount,
      },
    };
  }

  async getMyStatus(loginId: string) {
    const active = await this.prisma.sosAlert.findFirst({
      where: {
        loginId,
        status: 'active',
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
            status: active.status || 'active',
            time: new Date(active.time).toLocaleTimeString('en-IN', {
              timeZone: 'Asia/Kolkata',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            }),
            timestamp: active.time.toISOString(),
          }
        : null,
    };
  }
}
