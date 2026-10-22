import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('push/subscribe')
  subscribe(@Request() req: any, @Body() body: any) {
    // Accept both device_type (snake_case from frontend) and deviceType (camelCase)
    const deviceType = body.device_type || body.deviceType || 'web';
    return this.notificationsService.subscribe(
      req.user.loginId || req.user.login_id,
      body.subscription,
      deviceType,
    );
  }

  // GET recent broadcasts/notifications
  @Get('notifications')
  getNotifications(@Request() req: any) {
    return this.notificationsService.getRecentBroadcasts();
  }

  /**
   * The signed-in user's own in-app notification feed.
   */
  @Get('notifications/inbox')
  getInbox(@Request() req: any, @Query('limit') limit?: string) {
    return this.notificationsService.getMyNotifications(
      req.user.loginId || req.user.login_id,
      limit ? parseInt(limit, 10) : 30,
    );
  }

  @Get('notifications/unread-count')
  getUnreadCount(@Request() req: any) {
    return this.notificationsService.getUnreadCount(
      req.user.loginId || req.user.login_id,
    );
  }

  @Post('notifications/read')
  markRead(@Request() req: any, @Body() body: { ids?: string[] }) {
    return this.notificationsService.markNotificationsRead(
      req.user.loginId || req.user.login_id,
      body.ids,
    );
  }

  @Post('broadcast')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  broadcast(
    @Request() req: any,
    @Body() body: { message: string; title?: string; sender?: string },
  ) {
    const sender =
      body.sender || req.user?.name || req.user?.loginId || 'Administration';
    return this.notificationsService.broadcastMessage(
      body.message,
      body.title,
      sender,
    );
  }
}
