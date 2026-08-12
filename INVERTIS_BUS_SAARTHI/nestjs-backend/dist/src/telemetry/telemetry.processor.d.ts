import type { Job } from 'bull';
import { Repository } from 'typeorm';
import { Telemetry } from './entities/telemetry.entity';
import { TelemetryBatchDto } from './dto/telemetry-batch.dto';
export declare class TelemetryProcessor {
    private telemetryRepository;
    constructor(telemetryRepository: Repository<Telemetry>);
    handleBatch(job: Job<TelemetryBatchDto>): Promise<void>;
}
