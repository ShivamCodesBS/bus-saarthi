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
      req.user.loginId,
      body.text,
      body.type,
      body.mediaUrl,
      body.category,
      body.realName,
    );
  }

  // Both /api/grievances and /api/admin/grievances return same data
  @Get('grievances')
  findAll(@Request() req: any) {
    return this.grievancesService.findAll(req.user?.loginId);
  }

  // Alias for Admin Dashboard: /api/admin/grievances
  @Get('admin/grievances')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge)
  findAllAdmin(@Request() req: any) {
    return this.grievancesService.findAll(req.user?.loginId);
  }

  // Upvote — supports both POST (correct) and PUT (legacy frontend)
  @Post('grievance/:id/upvote')
  upvotePost(@Param('id') id: string, @Request() req: any) {
    return this.grievancesService.upvote(id, req.user.loginId);
  }

  @Put('grievance/:id/upvote')
  upvotePut(@Param('id') id: string, @Request() req: any) {
    return this.grievancesService.upvote(id, req.user.loginId);
  }

  // Resolve — supports both PATCH (correct) and PUT (legacy frontend)
  @Patch('grievance/:id/resolve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge)
  resolveAdmin(@Param('id') id: string) {
    return this.grievancesService.resolve(id);
  }

  @Put('grievance/:id/resolve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge)
  resolvePut(@Param('id') id: string) {
    return this.grievancesService.resolve(id);
  }

  // Delete grievance
  @Delete('grievance/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge)
  remove(@Param('id') id: string) {
    return this.grievancesService.remove(id);
  }
}
