import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Telemetry } from './entities/telemetry.entity';
import { TelemetryBatchDto } from './dto/telemetry-batch.dto';

@Processor('telemetry')
export class TelemetryProcessor {
  constructor(
    @InjectRepository(Telemetry)
    private telemetryRepository: Repository<Telemetry>,
  ) {}

  @Process('processBatch')
  async handleBatch(job: Job<TelemetryBatchDto>) {
    const { route_id, data } = job.data;
    
    const entities = data.map(item => this.telemetryRepository.create({
      routeId: route_id,
      latitude: item.lat,
      longitude: item.lng,
      gpsSpeedKnots: item.gps_speed_knots,
      mpuSpeedKmh: item.mpu_speed_kmh,
      headingDeg: item.heading_deg,
      timestamp: new Date(item.timestamp),
    }));

    await this.telemetryRepository.save(entities);
  }
}
