import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private pushEnabled = false;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    private cache: CacheService,
  ) {
    const vapidPublicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(
        'mailto:admin@invertisbus.com',
        vapidPublicKey,
        vapidPrivateKey,
      );
      this.pushEnabled = true;
    } else {
      this.logger.warn(
        'VAPID keys missing. Web push disabled — in-app notifications still work.',
      );
    }
  }

  async subscribe(
    loginId: string,
    subscription: any,
    deviceType: string = 'web',
  ) {
    const existingSub = await this.prisma.pushSubscription.findFirst({
      where: { loginId, deviceType },
    });

    if (existingSub) {
      await this.prisma.pushSubscription.update({
        where: { id: existingSub.id },
        data: { subscription },
      });
    } else {
      await this.prisma.pushSubscription.create({
        data: { loginId, subscription, deviceType },
      });
    }

    return { status: 'success' };
  }

  /**
   * Persist an in-app notification and push it to the user's devices.
   *
   * The in-app record is the source of truth: the user can read the message
   * later even if the browser was closed when the push arrived.
   */
  async notifyUser(
    loginId: string,
    grievanceId: string | null,
    payload: { title: string; body: string; type: string },
  ) {
    let created: { id: string; createdAt: Date } | null = null;
    try {
      created = await this.prisma.notification.create({
        data: {
          loginId,
          title: payload.title,
          body: payload.body,
          type: payload.type,
          grievanceId: grievanceId ?? null,
        },
        select: { id: true, createdAt: true },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to store notification: ${err?.message}`);
    }

    // Real-time delivery to the user's open tabs. The payload carries the
    // row's id/created_at so the client can render and mark it read.
    this.eventEmitter.emit('notification.created', {
      login_id: loginId,
      id: created?.id,
      created_at: created?.createdAt,
      ...payload,
    });

    // Push is fire-and-forget — a slow/broken push provider must not stall
    // whatever the user is waiting on.
    void this.sendPushNotification(loginId, {
      title: payload.title,
      body: payload.body,
      icon: '/icons/bus-192x192.png',
      badge: '/icons/bus-72x72.png',
      tag: payload.type,
      data: { grievanceId, type: payload.type },
    }).catch(() => {});

    return { status: 'success' };
  }

  async sendPushNotification(loginId: string, payload: any) {
    if (!this.pushEnabled) return;

    const subs = await this.prisma.pushSubscription.findMany({
      where: { loginId },
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          sub.subscription as any,
          JSON.stringify(payload),
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // The browser unsubscribed — drop the dead record.
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
        } else {
          this.logger.error(`Failed to send push to ${loginId}:`, err);
        }
      }
    }
  }

  async broadcastMessage(message: string, title?: string, sender?: string) {
    const broadcast = await this.prisma.broadcast.create({
      data: { message, title },
    });

    const broadcastPayload = {
      id: broadcast.id,
      title: title || 'Notice',
      message,
      sender: sender || 'Administration',
      timestamp: broadcast.timestamp,
    };

    this.eventEmitter.emit('broadcast.created', broadcastPayload);

    const payload = {
      title: title || 'Bus Saarthi Broadcast',
      body: message,
      icon: '/icons/bus-192x192.png',
    };

    const allSubs = await this.prisma.pushSubscription.findMany();

    for (const sub of allSubs) {
      if (!this.pushEnabled) break;
      try {
        await webpush.sendNotification(
          sub.subscription as any,
          JSON.stringify(payload),
        );
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    }

    return { status: 'success', message: 'Broadcast sent', data: broadcastPayload };
  }

  async getRecentBroadcasts() {
    return this.prisma.broadcast.findMany({
      orderBy: { timestamp: 'desc' },
      take: 20,
    });
  }

  /**
   * In-app notification feed for the signed-in user.
   */
  async getMyNotifications(loginId: string, limit = 30) {
    const notifications = await this.prisma.notification.findMany({
      where: { loginId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const unreadCount = await this.prisma.notification.count({
      where: { loginId, read: false },
    });

    return {
      status: 'success',
      unread_count: unreadCount,
      data: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        grievance_id: n.grievanceId,
        read: n.read,
        created_at: n.createdAt,
      })),
    };
  }

  async markNotificationsRead(loginId: string, ids?: string[]) {
    const result = await this.prisma.notification.updateMany({
      where: {
        loginId,
        read: false,
        ...(ids?.length ? { id: { in: ids } } : {}),
      },
      data: { read: true },
    });
    return { status: 'success', updated: result.count };
  }

  /**
   * Unread count only — cheap enough to poll.
   */
  async getUnreadCount(loginId: string) {
    const count = await this.prisma.notification.count({
      where: { loginId, read: false },
    });
    return { status: 'success', unread_count: count };
  }
}
