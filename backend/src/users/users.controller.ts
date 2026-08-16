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

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':loginId')
  findOne(@Param('loginId') loginId: string) {
    return this.usersService.findByLoginId(loginId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge)
  create(@Body() body: CreateUserDto) {
    return this.usersService.create(body);
  }

  @Post('bulk')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge)
  bulkCreate(@Body() body: { users: any[] }) {
    if (!body.users || !Array.isArray(body.users)) {
      throw new Error('Invalid payload: expected an array of users');
    }
    return this.usersService.bulkCreate(body.users);
  }

  @Put(':loginId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge)
  update(@Param('loginId') loginId: string, @Body() body: UpdateUserDto) {
    return this.usersService.update(loginId, body);
  }

  @Delete(':loginId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge)
  remove(@Param('loginId') loginId: string) {
    return this.usersService.remove(loginId);
  }

  // Password change — any authenticated user can change their own password
  @Put(':loginId/password')
  changePassword(
    @Param('loginId') loginId: string,
    @Body() body: { current_password: string; new_password: string },
    @Request() req: any,
  ) {
    return this.usersService.changePassword(
      loginId,
      body.current_password,
      body.new_password,
    );
  }
}
