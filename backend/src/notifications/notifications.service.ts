import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
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
    const rawServiceAccount =
      this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_BASE64') ||
      this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');

    if (rawServiceAccount) {
      try {
        let serviceAccount: any;
        let str = String(rawServiceAccount).trim();

        // Strip surrounding quotes if env var added them
        if (
          (str.startsWith('"') && str.endsWith('"')) ||
          (str.startsWith("'") && str.endsWith("'"))
        ) {
          str = str.slice(1, -1).trim();
        }

        if (str.startsWith('{')) {
          serviceAccount = JSON.parse(str);
        } else {
          // Base64 encoded — remove any whitespace or line breaks
          const cleanB64 = str.replace(/\s+/g, '');
          const decoded = Buffer.from(cleanB64, 'base64').toString('utf-8');
          serviceAccount = JSON.parse(decoded);
        }

        if (
          serviceAccount?.private_key &&
          typeof serviceAccount.private_key === 'string'
        ) {
          serviceAccount.private_key = serviceAccount.private_key.replace(
            /\\n/g,
            '\n',
          );
        }

        if (!getApps().length) {
          initializeApp({ credential: cert(serviceAccount) });
        }
        this.fcmEnabled = true;
        this.logger.log('FCM enabled — Android push notifications active.');
      } catch (err: any) {
        this.logger.error(
          `Firebase service account failed to init — FCM disabled. ${err?.message}`,
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
      if (!this.fcmEnabled) {
        this.logger.warn('FCM is not initialized — Android push skipped.');
        return true;
      }
      const token = subscription?.token ?? subscription?.fcmToken;
      if (!token || typeof token !== 'string') {
        this.logger.warn(
          'Android subscription has no FCM token — dropping record.',
        );
        return false;
      }

      // Determine appropriate Android notification channel based on type
      let msgType = payload.type || payload.data?.type || '';
      if (!msgType && payload.tag) {
        if (payload.tag.includes('wake-alarm')) msgType = 'wake_alarm';
        else if (payload.tag.includes('merge')) msgType = 'merge';
        else if (payload.tag.includes('cancel')) msgType = 'route_cancel';
        else if (payload.tag.includes('broadcast')) msgType = 'broadcast';
        else if (payload.tag.includes('sos')) msgType = 'sos';
      }
      if (!msgType) msgType = 'general';

      let channelId = 'bus_saarthi_general_v2';
      if (msgType === 'sos') channelId = 'bus_saarthi_sos';
      else if (String(msgType).startsWith('wake_alarm'))
        channelId = 'bus_saarthi_wake_alarm';
      else if (String(msgType).startsWith('grievance'))
        channelId = 'bus_saarthi_grievance_v2';
      else if (msgType === 'merge' || msgType === 'route_cancel')
        channelId = 'bus_saarthi_route_v2';
      else if (msgType === 'broadcast') channelId = 'bus_saarthi_broadcast_v2';

      const title = payload.title ?? 'Bus Saarthi';
      const body = payload.body ?? '';

      // Send both notification (for native Android notification panel display)
      // and data (for in-app routing/handling)
      await getMessaging().send({
        token,
        notification: {
          title,
          body,
        },
        data: Object.fromEntries(
          Object.entries({
            title,
            body,
            type: msgType,
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
            ...payload.data,
          }).map(([k, v]) => [k, String(v)]),
        ),
        android: {
          priority: 'high' as const,
          ttl: 86400 * 1000,
          notification: {
            channelId,
            priority: 'max' as const,
            defaultSound: true,
            defaultVibrateTimings: true,
            visibility: 'public' as const,
            sound:
              channelId === 'bus_saarthi_wake_alarm' ||
              channelId === 'bus_saarthi_sos'
                ? 'alarm'
                : 'default',
          },
        },
      });
      return true;
    }

    await webpush.sendNotification(subscription, JSON.stringify(payload));
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
      type: payload.type,
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
    const senderName = sender || 'Administration';
    const broadcast = await this.prisma.broadcast.create({
      data: { message, title, sender: senderName },
    });

    const broadcastPayload = {
      id: broadcast.id,
      title: title || 'Notice',
      message,
      sender: senderName,
      timestamp: broadcast.timestamp,
    };

    this.eventEmitter.emit('broadcast.created', broadcastPayload);

    const payload = {
      title: title || 'Bus Saarthi Broadcast',
      body: message,
      icon: '/icons/bus-192x192.png',
      tag: 'broadcast',
      type: 'broadcast',
      data: {
        type: 'broadcast',
        broadcastId: broadcast.id,
        sender: broadcastPayload.sender,
      },
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
        } else {
          this.logger.warn(
            `Failed to deliver broadcast push to ${sub.loginId}: ${err?.message}`,
          );
        }
      }
    }

    return {
      status: 'success',
      message: 'Broadcast sent',
      data: broadcastPayload,
    };
  }

  async getRecentBroadcasts() {
    return this.prisma.broadcast.findMany({
      orderBy: { timestamp: 'desc' },
      take: 20,
    });
  }

  async getBroadcastHistory(options: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.search) {
      where.OR = [
        { message: { contains: options.search, mode: 'insensitive' } },
        { title: { contains: options.search, mode: 'insensitive' } },
        { sender: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [broadcasts, total] = await Promise.all([
      this.prisma.broadcast.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.broadcast.count({ where }),
    ]);

    return {
      status: 'success',
      data: broadcasts.map((b) => ({
        id: b.id,
        title: b.title || 'Notice',
        message: b.message,
        sender: b.sender || 'Administration',
        timestamp: b.timestamp.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deleteBroadcast(id: string) {
    await this.prisma.broadcast.delete({
      where: { id },
    });
    return { status: 'success', message: 'Broadcast deleted' };
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
