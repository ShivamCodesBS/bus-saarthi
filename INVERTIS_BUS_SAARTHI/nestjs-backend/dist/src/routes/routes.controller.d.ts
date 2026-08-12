import { RoutesService } from './routes.service';
export declare class RoutesController {
    private readonly routesService;
    constructor(routesService: RoutesService);
    findAll(): Promise<import("./entities/route.entity").Route[]>;
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
        users: import("../users/entities/user.entity").User[];
    }>;
    create(body: any): Promise<{
        status: string;
        message: string;
        route: import("./entities/route.entity").Route[];
    }>;
    update(routeId: string, body: any): Promise<{
        status: string;
        message: string;
        route: import("./entities/route.entity").Route;
    }>;
    remove(routeId: string): Promise<{
        status: string;
        message: string;
    }>;
}
