import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private pushEnabled = false;
  private fcmEnabled = false;

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

    // ── FCM (Android app) ──────────────────────────────────────────────
    // The service-account JSON is provided as a single environment string
    // (the whole file content) so it survives platform env-var interfaces.
    const serviceAccountJson = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_JSON',
    );
    if (serviceAccountJson) {
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        if (!getApps().length) {
          initializeApp({ credential: serviceAccount });
        }
        this.fcmEnabled = true;
        this.logger.log('FCM enabled — Android push notifications active.');
      } catch (err: any) {
        this.logger.error(
          `FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON — FCM disabled. ${err?.message}`,
        );
      }
    } else {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT_JSON missing. Android (FCM) push disabled — in-app notifications still work.',
      );
    }
  }

  /**
   * Send a push to one stored subscription, choosing the transport by
   * device type: FCM for Android devices, web-push for browsers.
   * Returns false when the record is dead and should be deleted.
   */
  private async deliverToSubscription(
    deviceType: string,
    subscription: any,
    payload: any,
  ): Promise<boolean> {
    if (deviceType === 'android') {
      const token = subscription?.token ?? subscription?.fcmToken;
      if (!token || typeof token !== 'string') {
        this.logger.warn('Android subscription has no FCM token — dropping record.');
        return false;
      }
      // web-push payload shape and FCM notification shape are close enough;
      // keep the same fields so both platforms show the same content.
      await getMessaging().send({
        token,
        notification: {
          title: payload.title ?? 'Bus Saarthi',
          body: payload.body ?? '',
        },
        data: Object.fromEntries(
          Object.entries(payload.data ?? {}).map(([k, v]) => [k, String(v)]),
        ),
        android: { priority: 'high' as const },
      });
      return true;
    }

    await webpush.sendNotification(subscription as any, JSON.stringify(payload));
    return true;
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
    if (!this.pushEnabled && !this.fcmEnabled) return;

    const subs = await this.prisma.pushSubscription.findMany({
      where: { loginId },
    });

    for (const sub of subs) {
      try {
        const alive = await this.deliverToSubscription(
          sub.deviceType,
          sub.subscription,
          payload,
        );
        if (!alive) {
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // The browser unsubscribed — drop the dead record.
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
        } else if (err.code?.startsWith('messaging/')) {
          // FCM token is invalid or unregistered — drop the dead record.
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
      try {
        const alive = await this.deliverToSubscription(
          sub.deviceType,
          sub.subscription,
          payload,
        );
        if (!alive) {
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
        } else if (err.code?.startsWith('messaging/')) {
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
