import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { TelemetryBatchDto } from './dto/telemetry-batch.dto';

@Processor('telemetry')
export class TelemetryProcessor {
  constructor(private prisma: PrismaService) {}

  @Process('processBatch')
  async handleBatch(job: Job<TelemetryBatchDto>) {
    const { route_id, data } = job.data;

    const entities = data.map((item: any) => ({
      routeId: route_id,
      latitude: item.lat,
      longitude: item.lng,
      gpsSpeedKnots: item.gps_speed_knots,
      mpuSpeedKmh: item.mpu_speed_kmh,
      headingDeg: item.heading_deg,
      timestamp: new Date(item.timestamp),
    }));

    if (entities.length > 0) {
      await this.prisma.telemetry.createMany({ data: entities });
    }
  }
}
