import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MergeService } from './merge.service';
import { CreateMergeDto } from './dto/create-merge.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/merge')
@UseGuards(JwtAuthGuard)
export class MergeController {
  constructor(private readonly mergeService: MergeService) {}

  /**
   * TI/Admin directly creates and executes a merge.
   * Primary flow: Driver calls TI on phone → TI merges from dashboard.
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.transport_incharge, UserRole.admin)
  async createMerge(@Body() dto: CreateMergeDto, @Req() req: any) {
    return this.mergeService.createMerge(dto, req.user.loginId || req.user.login_id);
  }

  /**
   * Driver requests a merge (optional — for tech-savvy drivers).
   * Uses the same logic as TI merge but records the driver as initiator.
   */
  @Post('request')
  @UseGuards(RolesGuard)
  @Roles(UserRole.driver, UserRole.transport_incharge, UserRole.admin)
  async requestMerge(@Body() dto: CreateMergeDto, @Req() req: any) {
    return this.mergeService.createMerge(dto, req.user.loginId || req.user.login_id);
  }

  /**
   * Undo/reverse a merge.
   */
  @Post(':id/undo')
  @UseGuards(RolesGuard)
  @Roles(UserRole.transport_incharge, UserRole.admin)
  async undoMerge(@Param('id') id: string, @Req() req: any) {
    return this.mergeService.undoMerge(id, req.user.loginId || req.user.login_id);
  }

  /**
   * Get all active merges for today.
   */
  @Get('active')
  @UseGuards(RolesGuard)
  @Roles(UserRole.transport_incharge, UserRole.admin, UserRole.driver)
  async getActiveMerges() {
    const merges = await this.mergeService.getActiveMerges();
    return { status: 'success', data: merges };
  }

  /**
   * Get smart merge suggestions (routes with low attendance).
   */
  @Get('suggestions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.transport_incharge, UserRole.admin)
  async getMergeSuggestions() {
    const suggestions = await this.mergeService.getMergeSuggestions();
    return { status: 'success', data: suggestions };
  }

  /**
   * Get merge history with optional date range.
   */
  @Get('history')
  @UseGuards(RolesGuard)
  @Roles(UserRole.transport_incharge, UserRole.admin)
  async getMergeHistory(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const history = await this.mergeService.getMergeHistory(from, to);
    return { status: 'success', data: history };
  }

  /**
   * Get merge analytics for reporting.
   */
  @Get('analytics')
  @UseGuards(RolesGuard)
  @Roles(UserRole.transport_incharge, UserRole.admin)
  async getMergeAnalytics(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!from || !to) {
      return { status: 'error', message: 'Please provide "from" and "to" query params (YYYY-MM-DD)' };
    }
    const analytics = await this.mergeService.getMergeAnalytics(from, to);
    return { status: 'success', data: analytics };
  }

  /**
   * Check if a specific route is cancelled today.
   */
  @Get('check/:routeId')
  async checkRouteMergeStatus(@Param('routeId') routeId: string) {
    const isCancelled = await this.mergeService.isRouteCancelledToday(routeId);
    const activeMerge = isCancelled
      ? await this.mergeService.findActiveMergeForCancelledRoute(routeId)
      : null;
    return {
      status: 'success',
      data: {
        isCancelled,
        merge: activeMerge,
      },
    };
  }
}
