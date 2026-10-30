import {
  Controller,
  Post,
  Get,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  Request,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GrievancesService } from './grievances.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CreateGrievanceDto } from './dto/create-grievance.dto';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class GrievancesController {
  constructor(private readonly grievancesService: GrievancesService) {}

  @Post('grievance')
  create(@Request() req: any, @Body() body: CreateGrievanceDto) {
    return this.grievancesService.create(
      req.user.loginId || req.user.login_id,
      body.text,
      body.type,
      body.mediaUrl,
      body.category,
      body.realName,
      body.route,
      body.isAnonymous,
    );
  }

  /**
   * Grievance feed.
   *
   * Non-staff callers only ever receive their own complaints, with the
   * reporter's identity stripped. Staff receive the full list. The
   * de-anonymisation is enforced on the server — the dashboards' "real names"
   * view is a genuine permission, not a UI toggle.
   */
  @Get('grievances')
  findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('route') route?: string,
    @Query('mine') mine?: string,
  ) {
    return this.grievancesService.findAll(
      req.user.loginId || req.user.login_id,
      req.user.role,
      {
        status,
        route,
        onlyMine: mine === 'true',
      },
    );
  }

  /** Staff view of the triage queue. */
  @Get('admin/grievances')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  findAllAdmin(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('route') route?: string,
  ) {
    return this.grievancesService.findAll(
      req.user.loginId || req.user.login_id,
      req.user.role,
      { status, route },
    );
  }

  @Get('grievance/:id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.grievancesService.findOne(
      id,
      req.user.loginId || req.user.login_id,
      req.user.role,
    );
  }

  // Upvote — supports both POST (correct) and PUT (legacy frontend)
  @Post('grievance/:id/upvote')
  upvotePost(@Param('id') id: string, @Request() req: any) {
    return this.grievancesService.upvote(
      id,
      req.user.loginId || req.user.login_id,
    );
  }

  @Put('grievance/:id/upvote')
  upvotePut(@Param('id') id: string, @Request() req: any) {
    return this.grievancesService.upvote(
      id,
      req.user.loginId || req.user.login_id,
    );
  }

  /**
   * Staff acknowledges the complaint and starts work on it.
   */
  @Patch('grievance/:id/start')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  start(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { note?: string },
  ) {
    return this.grievancesService.startProgress(
      id,
      req.user.loginId || req.user.login_id,
      body.note,
    );
  }

  /**
   * Staff marks the issue as fixed. The complaint stays open until the
   * complainant confirms it — it does NOT disappear from the queue.
   */
  @Patch('grievance/:id/resolve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  resolveAdmin(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { note?: string; response?: string },
  ) {
    return this.grievancesService.resolve(
      id,
      req.user.loginId || req.user.login_id,
      body.note,
      body.response,
    );
  }

  @Put('grievance/:id/resolve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  resolvePut(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { note?: string; response?: string },
  ) {
    return this.grievancesService.resolve(
      id,
      req.user.loginId || req.user.login_id,
      body.note,
      body.response,
    );
  }

  /**
   * The complainant confirms the fix. This closes the complaint.
   */
  @Patch('grievance/:id/confirm')
  confirm(@Param('id') id: string, @Request() req: any) {
    return this.grievancesService.confirmResolved(
      id,
      req.user.loginId || req.user.login_id,
    );
  }

  /**
   * The complainant rejects the fix. The complaint is reopened and moves to
   * the top of the staff queue.
   */
  @Patch('grievance/:id/reopen')
  reopen(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { reason?: string },
  ) {
    return this.grievancesService.reopen(
      id,
      req.user.loginId || req.user.login_id,
      body.reason,
    );
  }

  /**
   * Staff extends the confirmation window.
   */
  @Patch('grievance/:id/extend')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  extend(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { hours?: number },
  ) {
    return this.grievancesService.extendDeadline(
      id,
      req.user.loginId || req.user.login_id,
      body.hours ?? 24,
    );
  }

  // Delete grievance
  @Delete('grievance/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  remove(@Param('id') id: string) {
    return this.grievancesService.remove(id);
  }
}
