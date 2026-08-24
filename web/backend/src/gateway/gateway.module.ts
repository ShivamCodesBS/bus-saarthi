import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'fallback_secret',
      signOptions: { expiresIn: '1d' },
    }),
    NotificationsModule,
    UsersModule,
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class GatewayModule {}
