import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoutesModule } from './routes/routes.module';
import { AttendanceModule } from './attendance/attendance.module';
import { FaceRecognitionModule } from './face-recognition/face-recognition.module';
import { GrievancesModule } from './grievances/grievances.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SosModule } from './sos/sos.module';
import { LeavesModule } from './leaves/leaves.module';
import { GatewayModule } from './gateway/gateway.module';
import { UploadModule } from './upload/upload.module';
import { HealthModule } from './health/health.module';
import { StreamsModule } from './streams/streams.module';
import { ParentsModule } from './parents/parents.module';

import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { MergeModule } from './merge/merge.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    QueueModule,
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    AuthModule,
    UsersModule,
    RoutesModule,
    AttendanceModule,
    FaceRecognitionModule,
    GrievancesModule,
    TelemetryModule,
    NotificationsModule,
    SosModule,
    LeavesModule,
    GatewayModule,
    UploadModule,
    HealthModule,
    StreamsModule,
    ParentsModule,
    ScheduleModule.forRoot(),
    MergeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
