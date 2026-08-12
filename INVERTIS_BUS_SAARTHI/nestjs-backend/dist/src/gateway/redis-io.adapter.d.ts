import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { INestApplicationContext } from '@nestjs/common';
export declare class RedisIoAdapter extends IoAdapter {
    private configService;
    private adapterConstructor;
    private readonly logger;
    private redisAvailable;
    constructor(app: INestApplicationContext, configService: ConfigService);
    connectToRedis(): Promise<void>;
    createIOServer(port: number, options?: ServerOptions): any;
}
