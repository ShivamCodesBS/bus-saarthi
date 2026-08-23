import { Module } from '@nestjs/common';
import { MergeController } from './merge.controller';
import { MergeService } from './merge.service';
import { MergeScheduler } from './merge.scheduler';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [MergeController],
  providers: [MergeService, MergeScheduler],
  exports: [MergeService],
})
export class MergeModule {}
