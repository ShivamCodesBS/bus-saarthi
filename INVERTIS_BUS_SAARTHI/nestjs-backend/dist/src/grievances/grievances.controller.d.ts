import { GrievancesService } from './grievances.service';
export declare class GrievancesController {
    private readonly grievancesService;
    constructor(grievancesService: GrievancesService);
    create(req: any, body: any): Promise<{
        status: string;
        message: string;
    }>;
    findAll(): Promise<import("./entities/grievance.entity").Grievance[]>;
    findAllAdmin(): Promise<import("./entities/grievance.entity").Grievance[]>;
    upvotePost(id: string, req: any): Promise<{
        status: string;
        upvotes: number;
    }>;
    upvotePut(id: string, req: any): Promise<{
        status: string;
        upvotes: number;
    }>;
    resolveAdmin(id: string): Promise<{
        status: string;
    }>;
    resolvePut(id: string): Promise<{
        status: string;
    }>;
    remove(id: string): Promise<{
        status: string;
        message: string;
    }>;
}
