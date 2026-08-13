import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route } from './entities/route.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route)
    private routesRepository: Repository<Route>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll() {
    return this.routesRepository.find();
  }

  async findOne(routeId: string) {
    const route = await this.routesRepository.findOne({ where: { routeId } });
    if (!route) {
      throw new NotFoundException(`Route ${routeId} not found`);
    }
    
    let driver: any = null;
    if (route.driverId) {
      driver = await this.usersRepository.findOne({
        where: { loginId: route.driverId },
        select: { id: true, loginId: true, name: true, phone: true }
      });
    }

    return {
      ...route,
      driver
    };
  }

  async create(body: any) {
    const existing = await this.routesRepository.findOne({ where: { routeId: body.route_id } });
    if (existing) throw new ConflictException(`Route ${body.route_id} already exists`);

    const route = this.routesRepository.create({
      routeId: body.route_id,
      routeName: body.route_name,
      busNumber: body.bus_number,
      driverId: body.driver_id,
      stops: typeof body.stops === 'string' ? body.stops : JSON.stringify(body.stops || []),
      city: body.city || 'Bareilly',
      vehicleModel: body.vehicleModel,
      registrationNumber: body.registrationNumber,
      seatingCapacity: body.seatingCapacity ? parseInt(body.seatingCapacity, 10) : null,
      insuranceExpiry: body.insuranceExpiry ? new Date(body.insuranceExpiry) : null,
    } as any);
    await this.routesRepository.save(route);
    return { status: 'success', message: 'Route created', route };
  }

  async update(routeId: string, body: any) {
    const route = await this.routesRepository.findOne({ where: { routeId } });
    if (!route) throw new NotFoundException(`Route ${routeId} not found`);

    if (body.route_name !== undefined) route.routeName = body.route_name;
    if (body.bus_number !== undefined) route.busNumber = body.bus_number;
    if (body.driver_id !== undefined) route.driverId = body.driver_id;
    if (body.stops !== undefined) route.stops = typeof body.stops === 'string' ? body.stops : JSON.stringify(body.stops);
    if (body.city !== undefined) route.city = body.city;
    if (body.vehicleModel !== undefined) route.vehicleModel = body.vehicleModel;
    if (body.registrationNumber !== undefined) route.registrationNumber = body.registrationNumber;
    if (body.seatingCapacity !== undefined) route.seatingCapacity = parseInt(body.seatingCapacity, 10);
    if (body.insuranceExpiry !== undefined) (route as any).insuranceExpiry = body.insuranceExpiry ? new Date(body.insuranceExpiry) : null;

    await this.routesRepository.save(route);
    return { status: 'success', message: 'Route updated', route };
  }

  async remove(routeId: string) {
    const route = await this.routesRepository.findOne({ where: { routeId } });
    if (!route) throw new NotFoundException(`Route ${routeId} not found`);
    await this.routesRepository.remove(route);
    return { status: 'success', message: 'Route deleted' };
  }
}
