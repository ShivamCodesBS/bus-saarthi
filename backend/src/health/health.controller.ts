import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { HealthService } from './health.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * A real health check — it queries the database and reports whether the
   * optional cache is connected. Render uses this to decide if the instance
   * is serving traffic.
   */
  @Get()
  async check() {
    return this.healthService.check();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('metrics')
  @Roles(UserRole.tech_admin)
  getMetrics() {
    return this.healthService.getMetrics();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('logs')
  @Roles(UserRole.tech_admin)
  getLogs(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('level') level: string,
  ) {
    return this.healthService.getLogs(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
      level,
    );
  }
}
