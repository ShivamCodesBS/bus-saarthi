import { Module } from '@nestjs/common';

import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';

import { User } from '@prisma/client';

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
