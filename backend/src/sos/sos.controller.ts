import {
  Controller,
  Post,
  Get,
  Request,
  UseGuards,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { SosService } from './sos.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/sos')
@UseGuards(JwtAuthGuard)
export class SosController {
  constructor(private readonly sosService: SosService) {}

  // POST /api/sos/trigger (correct)
  @Post('trigger')
  trigger(@Request() req: any) {
    return this.sosService.trigger(req.user.loginId);
  }

  @Post('cancel')
  cancel(@Request() req: any, @Body() body: any) {
    // Passengers cancel their own alert. Staff may cancel on behalf of a
    // student by passing the student's loginId in the body.
    if (
      req.user.role === UserRole.admin ||
      req.user.role === UserRole.transport_incharge ||
      req.user.role === UserRole.tech_admin
    ) {
      const target = body?.login_id || body?.loginId;
      if (!target) {
        throw new BadRequestException(
          'Pass the student loginId to cancel their SOS',
        );
      }
      // Pass the staff member's loginId as cancelledBy for audit trail
      return this.sosService.cancel(target, req.user.loginId);
    }
    return this.sosService.cancel(req.user.loginId);
  }

  /**
   * The live SOS list shows passenger names, so it is staff-only. A passenger
   * can read their own alert state through /api/sos/my-status.
   */
  @Get('active')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  getActive() {
    return this.sosService.getActiveAlerts();
  }

  @Get('my-status')
  getMyStatus(@Request() req: any) {
    return this.sosService.getMyStatus(req.user.loginId);
  }
}

// Separate controller to handle /api/sos (legacy alias from old frontend)
import { Controller as Ctrl } from '@nestjs/common';

@Ctrl('api')
@UseGuards(JwtAuthGuard)
export class SosAliasController {
  constructor(private readonly sosService: SosService) {}

  // POST /api/sos — alias for trigger
  @Post('sos')
  triggerAlias(@Request() req: any) {
    return this.sosService.trigger(req.user.loginId);
  }
}
