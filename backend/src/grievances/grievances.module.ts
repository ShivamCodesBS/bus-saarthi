import { Module } from '@nestjs/common';

import { GrievancesService } from './grievances.service';
import { GrievancesController } from './grievances.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [GrievancesController],
  providers: [GrievancesService],
  exports: [GrievancesService],
})
export class GrievancesModule {}
