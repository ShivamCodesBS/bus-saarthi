import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { SyncAttendanceDto } from './dto/sync-attendance.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('sync/attendance')
  syncAttendance(@Body() syncDto: SyncAttendanceDto) {
    return this.attendanceService.syncAttendance(syncDto);
  }

  // GET attendance for a specific route: /api/attendance/:routeId
  @Get('attendance/:routeId')
  getAttendanceByRoute(@Param('routeId') routeId: string) {
    return this.attendanceService.getAttendanceForRoute(routeId);
  }

  // GET all today's attendance (for Admin/Transport Incharge dashboard)
  @Get('attendance')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge)
  getAllAttendance() {
    return this.attendanceService.getAllAttendanceToday();
  }

  // GET attendance records for a specific user (for Profile page)
  @Get('attendance/user/:loginId')
  getAttendanceByUser(@Param('loginId') loginId: string) {
    return this.attendanceService.getAttendanceForUser(loginId);
  }
}
