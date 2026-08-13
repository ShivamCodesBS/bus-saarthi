import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelemetryService } from './telemetry.service';
import { TelemetryController } from './telemetry.controller';
import { Telemetry } from './entities/telemetry.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { Route } from '../routes/entities/route.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Telemetry, Attendance, Route]),
  ],
  controllers: [TelemetryController],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
