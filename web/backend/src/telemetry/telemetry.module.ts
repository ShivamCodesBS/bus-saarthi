import { Module } from '@nestjs/common';

import { TelemetryService } from './telemetry.service';
import { TelemetryController } from './telemetry.controller';

@Module({
  controllers: [TelemetryController],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
