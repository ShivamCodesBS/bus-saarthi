import { Global, Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

import { DbLoggerService } from './db-logger.service';

@Global()
@Module({
  controllers: [HealthController],
  providers: [HealthService, DbLoggerService],
  exports: [DbLoggerService],
})
export class HealthModule {}
