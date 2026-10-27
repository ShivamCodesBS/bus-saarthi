import { Module, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

const logger = new Logger('QueueModule');

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: configService.get('REDIS_PORT') || 6379,
        },
      }),
      inject: [ConfigService],
    }),
    // `enableOfflineQueue: false` makes commands reject immediately when
    // Redis is unreachable instead of buffering forever — TelemetryService
    // catches that rejection and writes the batch straight to the database
    // (Render boots without a Redis; without this every telemetry write
    // would hang until the request timeout).
    // NOTE: @nestjs/bullmq merges queue options with the shared config via a
    // shallow spread, so `connection` here must repeat host/port.
    BullModule.registerQueueAsync({
      name: 'telemetry',
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: configService.get('REDIS_PORT') || 6379,
          enableOfflineQueue: false,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {
  constructor() {
    logger.log('Queue module loaded with BullMQ/Redis');
  }
}
