import { Module } from '@nestjs/common';

import { TelemetryService } from './telemetry.service';
import { TelemetryController } from './telemetry.controller';
import { TelemetryProcessor } from './telemetry.processor';
import { QueueModule } from '../queue/queue.module';

@Module({
  // QueueModule registers the BullMQ `telemetry` queue that TelemetryService
  // injects with @InjectQueue, and provides the connection config for the
  // TelemetryProcessor worker below.
  imports: [QueueModule],
  controllers: [TelemetryController],
  providers: [TelemetryService, TelemetryProcessor],
  exports: [TelemetryService],
})
export class TelemetryModule {}
