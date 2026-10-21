import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    const vapidPublicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(
        'mailto:admin@invertisbus.com',
        vapidPublicKey,
        vapidPrivateKey,
      );
    } else {
      this.logger.warn('VAPID keys missing. Push notifications disabled.');
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

  async sendPushNotification(loginId: string, payload: any) {
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
        if (err.statusCode === 410) {
          // Unsubscribed
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

    // Emit event so WebSocket Gateway can push it in real-time to all connected users
    this.eventEmitter.emit('broadcast.created', broadcastPayload);

    const payload = {
      title: title || 'Bus Saarthi Broadcast',
      body: message,
      icon: '/icons/bus-192x192.png',
    };

    const allSubs = await this.prisma.pushSubscription.findMany();

    for (const sub of allSubs) {
      try {
        await webpush.sendNotification(
          sub.subscription as any,
          JSON.stringify(payload),
        );
      } catch (err: any) {
        if (err.statusCode === 410) {
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
}
