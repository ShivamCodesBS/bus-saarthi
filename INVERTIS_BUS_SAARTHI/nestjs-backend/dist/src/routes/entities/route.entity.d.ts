import type { User } from '../../users/entities/user.entity';
export declare class Route {
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
}
