import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SosAlert } from './entities/sos-alert.entity';
import { User } from '../users/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class SosService {
  private redisClient;
  private inMemoryCooldown = new Map<string, number>();
  private readonly logger = new Logger(SosService.name);
  private useRedis = false;

  constructor(
    @InjectRepository(SosAlert) private sosRepository: Repository<SosAlert>,
    @InjectRepository(User) private usersRepository: Repository<User>,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    this.initRedis();
  }

  private async initRedis() {
    try {
      this.redisClient = createClient({ url: this.configService.get<string>('redis.url') || 'redis://localhost:6379' });
      this.redisClient.on('error', (err) => {
        // Prevent unhandled promise rejection
        this.logger.debug(`Redis SOS client error: ${err.message}`);
      });
      await this.redisClient.connect();
      this.useRedis = true;
      this.logger.log('Redis connected for SOS cooldowns');
    } catch (err) {
      this.logger.warn(`Redis not available for SOS cooldowns. Falling back to in-memory map.`);
      this.useRedis = false;
    }
  }

  async trigger(loginId: string) {
    // Cooldown logic (1 minute)
    if (this.useRedis) {
      const cooldownKey = `sos:cooldown:${loginId}`;
      const inCooldown = await this.redisClient.get(cooldownKey);
      if (inCooldown) {
        throw new BadRequestException('SOS alert already triggered recently. Please wait.');
      }
      await this.redisClient.setEx(cooldownKey, 60, 'true');
    } else {
      const now = Date.now();
      const lastTrigger = this.inMemoryCooldown.get(loginId);
      if (lastTrigger && now - lastTrigger < 60000) {
        throw new BadRequestException('SOS alert already triggered recently. Please wait.');
      }
      this.inMemoryCooldown.set(loginId, now);
    }

    const user = await this.usersRepository.findOne({ where: { loginId } });
    const routeId = user?.routeId || '4';

    const alert = this.sosRepository.create({
      loginId,
      passenger: user?.name,
      route: routeId,
    });
    await this.sosRepository.save(alert);

    // Notify Gateway
    this.eventEmitter.emit('sos.triggered', {
      login_id: loginId,
      passenger: user?.name,
      route: routeId,
    });

    return { status: 'success', message: 'SOS alert broadcasted to route ' + routeId };
  }

  async cancel(loginId: string) {
    if (this.useRedis) {
      const cooldownKey = `sos:cooldown:${loginId}`;
      await this.redisClient.del(cooldownKey);
    } else {
      this.inMemoryCooldown.delete(loginId);
    }

    this.eventEmitter.emit('sos.cancelled', { login_id: loginId });
    return { status: 'success', message: 'SOS alert cancelled' };
  }
}
