import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { SystemLog } from './entities/system-log.entity';
import { DbLoggerService } from './db-logger.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SystemLog])],
  controllers: [HealthController],
  providers: [HealthService, DbLoggerService],
  exports: [DbLoggerService],
})
export class HealthModule {}
