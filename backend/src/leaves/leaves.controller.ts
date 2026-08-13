import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Post('leave')
  @Roles(UserRole.PASSENGER)
  toggleLeave(@Request() req, @Body() body: { date: string, cancel?: boolean }) {
    if (body.cancel) {
      return this.leavesService.cancelLeave(req.user.loginId, body.date);
    }
    return this.leavesService.markLeave(req.user.loginId, body.date);
  }
}
