import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { TelemetryModule } from '../telemetry/telemetry.module';

@Module({
  imports: [
    // Resolve the secret through ConfigService so the gateway always verifies
    // with the exact secret the auth module signs with, regardless of module
    // import order or .env load timing.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: { expiresIn: '1d' },
      }),
    }),
    NotificationsModule,
    UsersModule,
    TelemetryModule,
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class GatewayModule {}
