import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PushSubscription } from './entities/push-subscription.entity';
import { Broadcast } from './entities/broadcast.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PushSubscription, Broadcast])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
