import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * The signed-in user's own record. This MUST be declared before
   * `:loginId`, otherwise Nest matches "me" as a login id.
   */
  @Get('me')
  findMe(@Request() req: any) {
    const loginId = req.user?.loginId || req.user?.login_id;
    return this.usersService.findByLoginId(loginId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':loginId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  findOne(@Param('loginId') loginId: string) {
    return this.usersService.findByLoginId(loginId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  create(@Body() body: CreateUserDto, @Request() req: any) {
    return this.usersService.create(body, req.user.role);
  }

  @Post('bulk')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  bulkCreate(@Body() body: { users: any[] }, @Request() req: any) {
    if (!body.users || !Array.isArray(body.users)) {
      throw new ForbiddenException('Invalid payload: expected an array of users');
    }
    return this.usersService.bulkCreate(body.users, req.user.role);
  }

  @Put(':loginId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  update(
    @Param('loginId') loginId: string,
    @Body() body: UpdateUserDto,
    @Request() req: any,
  ) {
    return this.usersService.update(loginId, body, req.user.role);
  }

  @Delete(':loginId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  remove(@Param('loginId') loginId: string, @Request() req: any) {
    return this.usersService.remove(loginId, req.user.role);
  }

  /**
   * Password change. A user may change their own password; a full admin may
   * reset someone else's.
   */
  @Put(':loginId/password')
  changePassword(
    @Param('loginId') loginId: string,
    @Body() body: { current_password: string; new_password: string },
    @Request() req: any,
  ) {
    const requester = req.user?.loginId || req.user?.login_id;
    return this.usersService.changePassword(
      loginId,
      body.current_password,
      body.new_password,
      requester,
      req.user?.role,
    );
  }

  /**
   * Wake Alarm — passenger sets their alarm location & threshold.
   *
   * Declared before `:loginId` routes so "me" is not parsed as a login id.
   */
  @Put('me/wake-alarm')
  setWakeAlarm(
    @Request() req: any,
    @Body()
    body: {
      lat: number;
      lng: number;
      thresholdKm: number;
      subscription?: any;
      firedAt?: string | null;
    },
  ) {
    const loginId = req.user?.loginId || req.user?.login_id;
    return this.usersService.setWakeAlarm(loginId, {
      lat: body.lat,
      lng: body.lng,
      thresholdKm: body.thresholdKm,
      subscription: body.subscription ?? null,
      firedAt: body.firedAt,
    });
  }

  @Delete('me/wake-alarm')
  cancelWakeAlarm(@Request() req: any) {
    const loginId = req.user?.loginId || req.user?.login_id;
    return this.usersService.cancelWakeAlarm(loginId);
  }
}
