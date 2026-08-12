import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('push/subscribe')
  subscribe(@Request() req: any, @Body() body: any) {
    // Accept both device_type (snake_case from frontend) and deviceType (camelCase)
    const deviceType = body.device_type || body.deviceType || 'web';
    return this.notificationsService.subscribe(req.user.loginId, body.subscription, deviceType);
  }

  // GET recent broadcasts/notifications
  @Get('notifications')
  getNotifications(@Request() req: any) {
    return this.notificationsService.getRecentBroadcasts();
  }

  @Post('broadcast')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TRANSPORT_INCHARGE)
  broadcast(@Body() body: { message: string; title?: string }) {
    return this.notificationsService.broadcastMessage(body.message, body.title);
  }
}
