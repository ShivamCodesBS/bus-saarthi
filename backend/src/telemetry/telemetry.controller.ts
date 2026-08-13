import { Controller, Post, Get, Body, Param, UseGuards, Query } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { TelemetryBatchDto } from './dto/telemetry-batch.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('internal/telemetry')
  @Roles(UserRole.DRIVER, UserRole.ADMIN) // Usually sent by driver app
  handleTelemetry(@Body() batchDto: TelemetryBatchDto) {
    return this.telemetryService.addBatchToQueue(batchDto);
  }

  @Get('route_status/:routeId')
  getRouteStatus(@Param('routeId') routeId: string) {
    return this.telemetryService.getLatestStatus(routeId);
  }

  @Get('telemetry/history/:routeId')
  @Roles(UserRole.ADMIN) // Admin only endpoint
  getTelemetryHistory(
    @Param('routeId') routeId: string,
    @Query('date') date: string
  ) {
    if (!date) {
      date = new Date().toISOString().split('T')[0]; // Default to today
    }
    return this.telemetryService.getTelemetryHistory(routeId, date);
  }
}
