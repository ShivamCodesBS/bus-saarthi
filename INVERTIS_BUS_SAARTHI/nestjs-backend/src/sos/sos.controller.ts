import { Controller, Post, Request, UseGuards } from '@nestjs/common';
import { SosService } from './sos.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

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
  cancel(@Request() req: any) {
    return this.sosService.cancel(req.user.loginId);
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
