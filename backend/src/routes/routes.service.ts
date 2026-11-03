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

  async findAll(routeType?: string) {
    const cacheKey = routeType ? `routes:all:${routeType}` : 'routes:all';
    const routes = await this.cache.remember(cacheKey, 60, async () => {
      const where = routeType ? { routeType: routeType as any } : {};
      const dbRoutes = await this.prisma.route.findMany({
        where,
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
          // Parse stops to get categorized stops
          stops_data: this.parseStops(r.stops),
          stops: this.formatStopsForDisplay(r.stops),
        };
      });
    });
    return { status: 'success', data: routes, route_type: routeType || 'all' };
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
      stops_data: this.parseStops(route.stops),
      stops: this.formatStopsForDisplay(route.stops),
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

  /**
   * Get all routes that pass through a specific stop
   * Useful for students to see all buses that go through their stop
   */
  async getRoutesByStop(stopName: string) {
    const routes = await this.prisma.route.findMany({
      include: { bus: true },
      orderBy: { routeId: 'asc' },
    });

    const matchingRoutes = routes.filter((r) => {
      const stops = this.parseStops(r.stops);
      return stops.some(
        (s) => s.name.toLowerCase().includes(stopName.toLowerCase()),
      );
    });

    return {
      status: 'success',
      stop_name: stopName,
      data: matchingRoutes.map((r) => {
        const stops = this.parseStops(r.stops);
        const matchingStops = stops.filter((s) =>
          s.name.toLowerCase().includes(stopName.toLowerCase()),
        );
        const liveBus = r.bus?.busNumber || r.busNumber;
        return {
          route_id: r.routeId,
          route_name: r.routeName,
          bus_number: liveBus,
          route_type: r.routeType,
          city: r.city,
          matching_stops: matchingStops,
          all_stops: stops,
          driver_id: r.driverId,
        };
      }),
    };
  }

  /**
   * Get all unique stops from all routes
   */
  async getAllStops() {
    const routes = await this.prisma.route.findMany({
      select: { stops: true },
    });

    const stopSet = new Map<string, { name: string; category: string; count: number }>();

    routes.forEach((r) => {
      const stops = this.parseStops(r.stops);
      stops.forEach((s) => {
        const existing = stopSet.get(s.name);
        if (existing) {
          existing.count += 1;
        } else {
          stopSet.set(s.name, { name: s.name, category: s.type, count: 1 });
        }
      });
    });

    return {
      status: 'success',
      data: Array.from(stopSet.values()).sort((a, b) => b.count - a.count),
    };
  }

  /**
   * Get stops by category (pickup, dropoff, main, etc.)
   */
  async getStopsByCategory(routeId?: string) {
    const where = routeId ? { routeId } : {};
    const routes = await this.prisma.route.findMany({
      where,
      select: { routeId: true, routeName: true, stops: true },
    });

    const categorizedStops: Record<string, any[]> = {
      pickup: [],
      dropoff: [],
      main: [],
      intermediate: [],
      terminal: [],
      other: [],
    };

    routes.forEach((r) => {
      const stops = this.parseStops(r.stops);
      stops.forEach((s) => {
        const category = s.type || 'other';
        if (categorizedStops[category]) {
          categorizedStops[category].push({
            stop_name: s.name,
            order: s.order,
            route_id: r.routeId,
            route_name: r.routeName,
            time: s.time,
          });
        }
      });
    });

    return { status: 'success', data: categorizedStops };
  }

  async create(body: any) {
    const existing = await this.prisma.route.findUnique({
      where: { routeId: body.route_id },
    });
    if (existing)
      throw new ConflictException(`Route ${body.route_id} already exists`);

    // Validate and process stops
    const stopsData = this.processStopsInput(body.stops);

    // Link (or create) the Bus entity that serves this route.
    const busId = await this.resolveBusId(body.bus_number);

    const route = await this.prisma.route.create({
      data: {
        routeId: body.route_id,
        routeName: body.route_name,
        busNumber: body.bus_number,
        busId,
        driverId: body.driver_id,
        stops: JSON.stringify(stopsData),
        city: body.city || 'Bareilly',
        routeType: body.route_type || 'local',
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

    const stopsData =
      body.stops !== undefined ? this.processStopsInput(body.stops) : undefined;

    const updatedRoute = await this.prisma.route.update({
      where: { routeId },
      data: {
        routeName: body.route_name,
        busNumber: body.bus_number,
        busId,
        driverId: body.driver_id,
        stops: stopsData ? JSON.stringify(stopsData) : undefined,
        city: body.city,
        routeType: body.route_type,
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

    // A route with students attached must not be deleted
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

  async getLiveBus(routeId: string) {
    const route = await this.prisma.route.findUnique({
      where: { routeId },
      select: { busNumber: true, routeName: true, bus: { select: { busNumber: true } } },
    });
    if (!route) return null;
    return {
      busNumber: route.bus?.busNumber ?? route.busNumber,
      routeName: route.routeName,
    };
  }

  /**
   * Find the Bus record for a bus number, creating it if needed
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

  /**
   * Parse stops from JSON string to array
   */
  private parseStops(stopsJson: string): any[] {
    if (!stopsJson) return [];
    try {
      const parsed = JSON.parse(stopsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Fallback for legacy comma-separated format
      return stopsJson.split(',').map((s, i) => ({
        name: s.trim(),
        type: 'main',
        order: i,
      }));
    }
  }

  /**
   * Process stops input - handle both array and legacy string formats
   */
  private processStopsInput(stops: any): any[] {
    if (!stops) return [];

    // If already an array
    if (Array.isArray(stops)) {
      return stops.map((s, i) => ({
        name: typeof s === 'string' ? s.trim() : s.name?.trim(),
        type: s.type || 'main',
        order: s.order ?? i,
        time: s.time || null,
      }));
    }

    // If it's a JSON string
    if (typeof stops === 'string') {
      try {
        const parsed = JSON.parse(stops);
        if (Array.isArray(parsed)) {
          return parsed.map((s, i) => ({
            name: typeof s === 'string' ? s.trim() : s.name?.trim(),
            type: s.type || 'main',
            order: s.order ?? i,
            time: s.time || null,
          }));
        }
      } catch {
        // Fallback for comma-separated format
        return stops.split(',').map((s, i) => ({
          name: s.trim(),
          type: 'main',
          order: i,
        }));
      }
    }

    return [];
  }

  /**
   * Format stops for display (comma-separated list)
   */
  private formatStopsForDisplay(stopsJson: string): string {
    const stops = this.parseStops(stopsJson);
    return stops.map((s) => s.name).join(', ');
  }

  private async invalidate() {
    await this.cache.delByPattern('routes:*');
  }
}
