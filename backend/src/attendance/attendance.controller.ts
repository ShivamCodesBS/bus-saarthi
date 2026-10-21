import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { SyncAttendanceDto } from './dto/sync-attendance.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtOrHardwareGuard } from '../common/guards/jwt-or-hardware.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('api')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('sync/attendance')
  @UseGuards(JwtOrHardwareGuard)
  @HttpCode(HttpStatus.OK)
  syncAttendance(@Body() syncDto: SyncAttendanceDto) {
    return this.attendanceService.syncAttendance(syncDto);
  }

  // GET attendance for a specific route: /api/attendance/:routeId
  @Get('attendance/:routeId')
  @UseGuards(JwtAuthGuard)
  getAttendanceByRoute(@Param('routeId') routeId: string) {
    return this.attendanceService.getAttendanceForRoute(routeId);
  }

  // GET all today's attendance (for Admin/Transport Incharge dashboard)
  @Get('attendance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  getAllAttendance() {
    return this.attendanceService.getAllAttendanceToday();
  }

  // GET attendance records for a specific user (for Profile page)
  @Get('attendance/user/:loginId')
  @UseGuards(JwtAuthGuard)
  getAttendanceByUser(@Param('loginId') loginId: string) {
    return this.attendanceService.getAttendanceForUser(loginId);
  }
}
