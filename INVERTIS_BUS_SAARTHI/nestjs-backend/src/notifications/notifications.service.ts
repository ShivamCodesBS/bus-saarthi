import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSubscription } from './entities/push-subscription.entity';
import { Broadcast } from './entities/broadcast.entity';
import * as webpush from 'web-push';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(PushSubscription)
    private pushSubRepository: Repository<PushSubscription>,
    @InjectRepository(Broadcast)
    private broadcastRepository: Repository<Broadcast>,
    private configService: ConfigService,
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

  async subscribe(loginId: string, subscription: any, deviceType: string = 'web') {
    let sub = await this.pushSubRepository.findOne({ where: { loginId, deviceType } });
    
    if (sub) {
      sub.subscription = subscription;
    } else {
      sub = this.pushSubRepository.create({ loginId, subscription, deviceType });
    }
    
    await this.pushSubRepository.save(sub);
    return { status: 'success' };
  }

  async sendPushNotification(loginId: string, payload: any) {
    const subs = await this.pushSubRepository.find({ where: { loginId } });
    
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
      } catch (err) {
        if (err.statusCode === 410) {
          // Unsubscribed
          await this.pushSubRepository.remove(sub);
        } else {
          this.logger.error(`Failed to send push to ${loginId}:`, err);
        }
      }
    }
  }

  async broadcastMessage(message: string, title?: string) {
    const broadcast = this.broadcastRepository.create({ message, title });
    await this.broadcastRepository.save(broadcast);

    const payload = {
      title: title || 'Bus Saarthi Broadcast',
      body: message,
      icon: '/icons/bus-192x192.png',
    };

    const allSubs = await this.pushSubRepository.find();
    
    for (const sub of allSubs) {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
      } catch (err) {
        if (err.statusCode === 410) {
          await this.pushSubRepository.remove(sub);
        }
      }
    }

    return { status: 'success', message: 'Broadcast sent' };
  }

  async getRecentBroadcasts() {
    const broadcasts = await this.broadcastRepository.find({
      order: { timestamp: 'DESC' } as any,
      take: 20,
    });
    return broadcasts;
  }
}
