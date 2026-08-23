import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoutesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const routes = await this.prisma.route.findMany();
    return { status: 'success', data: routes };
  }

  async findOne(routeId: string) {
    const route = await this.prisma.route.findUnique({ where: { routeId } });
    if (!route) {
      throw new NotFoundException(`Route ${routeId} not found`);
    }

    let driver: any = null;
    if (route.driverId) {
      driver = await this.prisma.user.findUnique({
        where: { loginId: route.driverId },
        select: { id: true, loginId: true, name: true, phone: true },
      });
    }

    return {
      ...route,
      driver,
    };
  }

  async create(body: any) {
    const existing = await this.prisma.route.findUnique({
      where: { routeId: body.route_id },
    });
    if (existing)
      throw new ConflictException(`Route ${body.route_id} already exists`);

    const route = await this.prisma.route.create({
      data: {
        routeId: body.route_id,
        routeName: body.route_name,
        busNumber: body.bus_number,
        driverId: body.driver_id,
        stops:
          typeof body.stops === 'string'
            ? body.stops
            : JSON.stringify(body.stops || []),
        city: body.city || 'Bareilly',
        vehicleModel: body.vehicleModel,
        registrationNumber: body.registrationNumber,
        seatingCapacity: body.seatingCapacity
          ? parseInt(body.seatingCapacity, 10)
          : null,
        insuranceExpiry: body.insuranceExpiry
          ? new Date(body.insuranceExpiry)
          : null,
      },
    });
    return { status: 'success', message: 'Route created', route };
  }

  async update(routeId: string, body: any) {
    const route = await this.prisma.route.findUnique({ where: { routeId } });
    if (!route) throw new NotFoundException(`Route ${routeId} not found`);

    const updatedRoute = await this.prisma.route.update({
      where: { routeId },
      data: {
        routeName: body.route_name,
        busNumber: body.bus_number,
        driverId: body.driver_id,
        stops:
          body.stops !== undefined
            ? typeof body.stops === 'string'
              ? body.stops
              : JSON.stringify(body.stops)
            : undefined,
        city: body.city,
        vehicleModel: body.vehicleModel,
        registrationNumber: body.registrationNumber,
        seatingCapacity:
          body.seatingCapacity !== undefined
            ? parseInt(body.seatingCapacity, 10)
            : undefined,
        insuranceExpiry:
          body.insuranceExpiry !== undefined
            ? body.insuranceExpiry
              ? new Date(body.insuranceExpiry)
              : null
            : undefined,
      },
    });

    return { status: 'success', message: 'Route updated', route: updatedRoute };
  }

  async remove(routeId: string) {
    const route = await this.prisma.route.findUnique({ where: { routeId } });
    if (!route) throw new NotFoundException(`Route ${routeId} not found`);
    await this.prisma.route.delete({ where: { routeId } });
    return { status: 'success', message: 'Route deleted' };
  }
}
