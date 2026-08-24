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
    return this.parentsService.getParentWithChildren(req.user.login_id);
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
    return this.parentsService.getChildAttendance(
      req.user.login_id,
      childLoginId,
    );
  }

  /**
   * GET /api/parents/child/:loginId/status
   * Returns today's boarding status for a linked child
   */
  @Get('child/:loginId/status')
  async getChildStatus(@Request() req, @Param('loginId') childLoginId: string) {
    return this.parentsService.getChildTodayStatus(
      req.user.login_id,
      childLoginId,
    );
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
    return this.parentsService.markChildLeave(
      req.user.login_id,
      childLoginId,
      date,
    );
  }

  /**
   * POST /api/parents/create-and-link
   * Admin-only: Create parent account and link to student
   */
  @Post('create-and-link')
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
   * Admin: get all parent-child links
   */
  @Get('links')
  async getAllLinks() {
    return this.parentsService.getAllLinks();
  }
}
