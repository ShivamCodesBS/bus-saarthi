import { Global, Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

import { DbLoggerService } from './db-logger.service';

@Global()
@Module({
  controllers: [HealthController],
  providers: [HealthService, DbLoggerService],
  // HealthService is exported so the root controller can report the service
  // status instead of the Nest scaffold's "Hello World!".
  exports: [DbLoggerService, HealthService],
})
export class HealthModule {}
