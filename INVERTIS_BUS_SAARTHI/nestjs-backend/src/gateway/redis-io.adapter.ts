import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { INestApplicationContext, Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: any;
  private readonly logger = new Logger('RedisIoAdapter');
  private redisAvailable = false;

  constructor(app: INestApplicationContext, private configService: ConfigService) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisUrl = this.configService.get<string>('redis.url') || 'redis://localhost:6379';

    try {
      const { createClient } = await import('redis');
      const { createAdapter } = await import('@socket.io/redis-adapter');

      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();

      // Catch error events to prevent unhandled rejections crashing the app
      pubClient.on('error', (err) => this.logger.debug(`Redis pubClient error: ${err.message}`));
      subClient.on('error', (err) => this.logger.debug(`Redis subClient error: ${err.message}`));

      // Set a short timeout so it doesn't hang on startup
      await Promise.race([
        Promise.all([pubClient.connect(), subClient.connect()]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis connection timeout')), 3000),
        ),
      ]);

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.redisAvailable = true;
      this.logger.log('✅ Redis adapter connected successfully');
    } catch (err) {
      this.logger.warn(
        `⚠️  Redis not available (${err.message}). Falling back to in-memory Socket.IO adapter. This is fine for local development.`,
      );
      this.redisAvailable = false;
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.redisAvailable && this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
