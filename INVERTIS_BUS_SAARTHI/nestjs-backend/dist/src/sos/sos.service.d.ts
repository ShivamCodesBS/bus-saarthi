import { Repository } from 'typeorm';
import { SosAlert } from './entities/sos-alert.entity';
import { User } from '../users/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
export declare class SosService {
    private sosRepository;
    private usersRepository;
    private configService;
    private eventEmitter;
    private redisClient;
    private inMemoryCooldown;
    private readonly logger;
    private useRedis;
    constructor(sosRepository: Repository<SosAlert>, usersRepository: Repository<User>, configService: ConfigService, eventEmitter: EventEmitter2);
    private initRedis;
    trigger(loginId: string): Promise<{
        status: string;
        message: string;
    }>;
    cancel(loginId: string): Promise<{
        status: string;
        message: string;
    }>;
}
