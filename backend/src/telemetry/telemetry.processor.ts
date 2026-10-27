import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { TelemetryService } from './telemetry.service';

@Processor('telemetry', { concurrency: 5 })
export class TelemetryProcessor extends WorkerHost {
  constructor(
    private telemetryService: TelemetryService,
  ) { super(); }

  async process(job: Job) {
    const { route_id, data } = job.data;
    return this.telemetryService.processBatch(String(route_id), data);
  }
}
