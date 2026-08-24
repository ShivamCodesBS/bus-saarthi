import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { RoutesService } from './routes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/routes')
@UseGuards(JwtAuthGuard)
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  findAll() {
    return this.routesService.findAll();
  }

  @Get(':routeId')
  findOne(@Param('routeId') routeId: string) {
    return this.routesService.findOne(routeId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge)
  create(@Body() body: any) {
    return this.routesService.create(body);
  }

  @Put(':routeId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge)
  update(@Param('routeId') routeId: string, @Body() body: any) {
    return this.routesService.update(routeId, body);
  }

  @Delete(':routeId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge)
  remove(@Param('routeId') routeId: string) {
    return this.routesService.remove(routeId);
  }
}
