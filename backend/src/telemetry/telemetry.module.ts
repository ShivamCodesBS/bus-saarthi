import { Module, DynamicModule } from '@nestjs/common';

import { TelemetryService } from './telemetry.service';
import { TelemetryController } from './telemetry.controller';
import { TelemetryProcessor } from './telemetry.processor';
import { QueueModule, isTelemetryRedisConfigured } from '../queue/queue.module';

/**
 * Telemetry ingestion. When a TCP Redis is configured (REDIS_HOST), batches
 * flow through the BullMQ queue with a worker for retries; without Redis the
 * same TelemetryService persists batches directly to Postgres — so the module
 * simply does not register the queue/worker in that case.
 */
@Module({})
export class TelemetryModule {
  static register(): DynamicModule {
    const redisConfigured = isTelemetryRedisConfigured();

    return {
      module: TelemetryModule,
      imports: redisConfigured ? [QueueModule.register()] : [],
      controllers: [TelemetryController],
      providers: redisConfigured
        ? [TelemetryService, TelemetryProcessor]
        : [TelemetryService],
      exports: [TelemetryService],
    };
  }
}
