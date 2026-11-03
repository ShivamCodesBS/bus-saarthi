import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
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
  findAll(@Query('type') routeType?: string) {
    return this.routesService.findAll(routeType);
  }

  @Get('by-stop')
  getRoutesByStop(@Query('stop') stopName: string) {
    if (!stopName) {
      return { status: 'error', message: 'stop query parameter is required' };
    }
    return this.routesService.getRoutesByStop(stopName);
  }

  @Get('stops')
  getAllStops() {
    return this.routesService.getAllStops();
  }

  @Get('stops/categorized')
  getStopsByCategory(@Query('route_id') routeId?: string) {
    return this.routesService.getStopsByCategory(routeId);
  }

  @Get(':routeId')
  findOne(@Param('routeId') routeId: string) {
    return this.routesService.findOne(routeId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  create(@Body() body: any) {
    return this.routesService.create(body);
  }

  @Put(':routeId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  update(@Param('routeId') routeId: string, @Body() body: any) {
    return this.routesService.update(routeId, body);
  }

  @Delete(':routeId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.transport_incharge, UserRole.tech_admin)
  remove(@Param('routeId') routeId: string) {
    return this.routesService.remove(routeId);
  }
}
