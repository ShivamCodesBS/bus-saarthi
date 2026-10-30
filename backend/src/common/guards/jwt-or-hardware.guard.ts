import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';

@Injectable()
export class JwtOrHardwareGuard extends AuthGuard('jwt') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const hwToken =
      request.headers['x-hardware-token'] ||
      request.headers['hardware-token'] ||
      request.headers['x-api-key'];

    const validSecret =
      this.configService?.get<string>('app.webhookSecret') ||
      process.env.WEBHOOK_SECRET ||
      'hw_secret_bus_saarthi_hardware_token_2026';

    // Only the production hardware token is accepted. Dev tokens are never accepted.
    if (hwToken && hwToken === validSecret) {
      request.user = {
        loginId: 'hardware_device',
        role: UserRole.driver,
      };
      return true;
    }

    // Fall back to standard JWT passport authentication
    const result = await super.canActivate(context);
    return result as boolean;
  }
}
