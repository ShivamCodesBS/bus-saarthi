import { Repository } from 'typeorm';
import { Route } from './entities/route.entity';
import { User } from '../users/entities/user.entity';
export declare class RoutesService {
    private routesRepository;
    private usersRepository;
    constructor(routesRepository: Repository<Route>, usersRepository: Repository<User>);
    findAll(): Promise<Route[]>;
    findOne(routeId: string): Promise<{
        driver: any;
        id: string;
        routeId: string;
        routeName: string;
        busNumber: string;
        driverId: string;
        stops: string;
        city: string;
        vehicleModel: string;
        registrationNumber: string;
        seatingCapacity: number;
        insuranceExpiry: Date;
        speedLimit: number;
        createdAt: Date;
        users: User[];
    }>;
    create(body: any): Promise<{
        status: string;
        message: string;
        route: Route[];
    }>;
    update(routeId: string, body: any): Promise<{
        status: string;
        message: string;
        route: Route;
    }>;
    remove(routeId: string): Promise<{
        status: string;
        message: string;
    }>;
}
