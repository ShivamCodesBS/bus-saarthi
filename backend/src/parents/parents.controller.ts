import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ParentsService } from './parents.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/parents')
@UseGuards(JwtAuthGuard)
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  /**
   * GET /api/parents/me
   * Returns parent profile + all linked children with today's boarding status
   */
  @Get('me')
  async getMe(@Request() req) {
    const parentLoginId = req.user?.loginId || req.user?.login_id;
    return this.parentsService.getParentWithChildren(parentLoginId);
  }

  /**
   * GET /api/parents/grievances
   * Every grievance raised by any linked child, newest and most-urgent first.
   */
  @Get('grievances')
  async getGrievances(@Request() req) {
    const parentLoginId = req.user?.loginId || req.user?.login_id;
    return this.parentsService.getChildGrievances(parentLoginId);
  }

  /**
   * GET /api/parents/child/:loginId/grievances
   * Grievances for one specific linked child.
   */
  @Get('child/:loginId/grievances')
  async getChildGrievances(
    @Request() req,
    @Param('loginId') childLoginId: string,
  ) {
    const parentLoginId = req.user?.loginId || req.user?.login_id;
    return this.parentsService.getChildGrievancesFor(
      parentLoginId,
      childLoginId,
    );
  }

  /**
   * GET /api/parents/child/:loginId/attendance
   * Returns attendance history + monthly % for a linked child
   */
  @Get('child/:loginId/attendance')
  async getChildAttendance(
    @Request() req,
    @Param('loginId') childLoginId: string,
  ) {
    const parentLoginId = req.user?.loginId || req.user?.login_id;
    return this.parentsService.getChildAttendance(parentLoginId, childLoginId);
  }

  /**
   * GET /api/parents/child/:loginId/status
   * Returns today's boarding status for a linked child
   */
  @Get('child/:loginId/status')
  async getChildStatus(@Request() req, @Param('loginId') childLoginId: string) {
    const parentLoginId = req.user?.loginId || req.user?.login_id;
    return this.parentsService.getChildTodayStatus(parentLoginId, childLoginId);
  }

  /**
   * POST /api/parents/child/:loginId/leave
   * Mark leave for a child (parent acting on behalf of student)
   */
  @Post('child/:loginId/leave')
  async markChildLeave(
    @Request() req,
    @Param('loginId') childLoginId: string,
    @Body('date') date: string,
  ) {
    const parentLoginId = req.user?.loginId || req.user?.login_id;
    return this.parentsService.markChildLeave(
      parentLoginId,
      childLoginId,
      date,
    );
  }

  /**
   * POST /api/parents/create-and-link
   * Staff-only: create a parent account and link it to a student.
   */
  @Post('create-and-link')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  async createAndLink(
    @Body()
    body: {
      child_login_id: string;
      parent_name: string;
      parent_phone: string;
      parent_password: string;
      nickname?: string;
    },
  ) {
    return this.parentsService.createParentAndLink(
      body.child_login_id,
      body.parent_name,
      body.parent_phone,
      body.parent_password,
      body.nickname,
    );
  }

  /**
   * GET /api/parents/links
   * Staff: get all parent-child links
   */
  @Get('links')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  async getAllLinks() {
    return this.parentsService.getAllLinks();
  }
}
