import { Module, Logger, DynamicModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

const logger = new Logger('QueueModule');

/**
 * True when a real TCP Redis has been explicitly configured for BullMQ via
 * REDIS_HOST (+ optional REDIS_PORT / REDIS_PASSWORD / REDIS_TLS).
 *
 * This deliberately does NOT fall back to `redis.host` from redis.config —
 * that config carries a hardcoded Upstash default, and pointing the queue at
 * a Redis nobody configured (or whose free-tier quota is exhausted) is how
 * the queue ended up spamming ECONNREFUSED against localhost. No REDIS_HOST
 * means no BullMQ: telemetry then persists directly to Postgres (see
 * TelemetryService.addBatchToQueue) with no connections and no noise.
 */
export function isTelemetryRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_HOST);
}

/**
 * Registers the BullMQ `telemetry` queue. A no-op dynamic module unless
 * REDIS_HOST is set — when it is, the connection is built from
 * REDIS_HOST / REDIS_PORT (default 6379) / REDIS_PASSWORD / REDIS_TLS=true.
 */
@Module({})
export class QueueModule {
  static register(): DynamicModule {
    if (!isTelemetryRedisConfigured()) {
      logger.log('REDIS_HOST not set — telemetry queue disabled, telemetry persists directly');
      return { module: QueueModule, imports: [], providers: [], exports: [] };
    }

    logger.log(`Telemetry queue enabled for ${process.env.REDIS_HOST}:${process.env.REDIS_PORT || 6379}`);
    return {
      module: QueueModule,
      imports: [
        BullModule.forRootAsync({
          useFactory: (configService: ConfigService) => ({
            connection: {
              host: configService.get('REDIS_HOST'),
              port: parseInt(configService.get('REDIS_PORT') || '6379', 10),
              password: configService.get('REDIS_PASSWORD') || undefined,
              // Upstash's TCP endpoint requires TLS; Render Redis does not.
              tls: configService.get('REDIS_TLS') === 'true' ? {} : undefined,
              // Required for the worker's blocking commands; producers are
              // additionally guarded by the bounded probe in TelemetryService.
              enableOfflineQueue: false,
            },
          }),
          inject: [ConfigService],
        }),
        BullModule.registerQueueAsync({ name: 'telemetry' }),
      ],
      exports: [BullModule],
    };
  }
}
