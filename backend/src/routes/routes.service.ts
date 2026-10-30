import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class RoutesService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async findAll() {
    const routes = await this.cache.remember('routes:all', 60, async () => {
      const dbRoutes = await this.prisma.route.findMany({
        include: { bus: true },
        orderBy: { routeId: 'asc' },
      });
      return dbRoutes.map((r) => {
        const liveBus = r.bus?.busNumber || r.busNumber;
        return {
          ...r,
          route_id: r.routeId,
          route_name: r.routeName,
          bus_number: liveBus,
          busNumber: liveBus,
        };
      });
    });
    return { status: 'success', data: routes };
  }

  async findOne(routeId: string) {
    const route = await this.prisma.route.findUnique({
      where: { routeId },
      include: { bus: true },
    });
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

    const liveBus = route.bus?.busNumber || route.busNumber;
    return {
      ...route,
      route_id: route.routeId,
      route_name: route.routeName,
      bus_number: liveBus,
      busNumber: liveBus,
      driver,
    };
  }

  /**
   * The bus currently serving a route. The route identity is stable; the bus
   * number can change (fleet swap or merge), so it is always resolved live.
   */
  async getLiveBus(routeId: string) {
    const route = await this.prisma.route.findUnique({
      where: { routeId },
      select: {
        busNumber: true,
        routeName: true,
        bus: { select: { busNumber: true } },
      },
    });
    if (!route) return null;
    return {
      busNumber: route.bus?.busNumber ?? route.busNumber,
      routeName: route.routeName,
    };
  }

  async create(body: any) {
    const existing = await this.prisma.route.findUnique({
      where: { routeId: body.route_id },
    });
    if (existing)
      throw new ConflictException(`Route ${body.route_id} already exists`);

    // Link (or create) the Bus entity that serves this route.
    const busId = await this.resolveBusId(body.bus_number);

    const route = await this.prisma.route.create({
      data: {
        routeId: body.route_id,
        routeName: body.route_name,
        busNumber: body.bus_number,
        busId,
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
    await this.invalidate();
    return { status: 'success', message: 'Route created', route };
  }

  async update(routeId: string, body: any) {
    const route = await this.prisma.route.findUnique({ where: { routeId } });
    if (!route) throw new NotFoundException(`Route ${routeId} not found`);

    const busId =
      body.bus_number !== undefined
        ? await this.resolveBusId(body.bus_number)
        : undefined;

    const updatedRoute = await this.prisma.route.update({
      where: { routeId },
      data: {
        routeName: body.route_name,
        busNumber: body.bus_number,
        busId,
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

    await this.invalidate();
    return { status: 'success', message: 'Route updated', route: updatedRoute };
  }

  async remove(routeId: string) {
    const route = await this.prisma.route.findUnique({ where: { routeId } });
    if (!route) throw new NotFoundException(`Route ${routeId} not found`);

    // A route with students attached must not be deleted — the students
    // would be left pointing at a route that no longer exists.
    const studentCount = await this.prisma.user.count({
      where: { routeId, role: 'passenger' },
    });
    if (studentCount > 0) {
      throw new BadRequestException(
        `Cannot delete route ${routeId}: ${studentCount} student(s) are still assigned to it. Move them to another route first.`,
      );
    }

    await this.prisma.route.delete({ where: { routeId } });
    await this.invalidate();
    return { status: 'success', message: 'Route deleted' };
  }

  /**
   * Find the Bus record for a bus number, creating it if this is the first
   * time we see that bus. This is what lets a route reference a bus
   * independently of the bus number string.
   */
  private async resolveBusId(busNumber?: string): Promise<string | undefined> {
    if (!busNumber) return undefined;
    const bus = await this.prisma.bus.upsert({
      where: { busNumber },
      update: {},
      create: { busNumber },
    });
    return bus.id;
  }

  private async invalidate() {
    await this.cache.delByPattern('routes:*');
  }
}
