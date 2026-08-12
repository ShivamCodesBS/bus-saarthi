import { Repository } from 'typeorm';
import { Grievance } from './entities/grievance.entity';
import { GrievanceUpvote } from './entities/grievance-upvote.entity';
export declare class GrievancesService {
    private grievanceRepository;
    private upvoteRepository;
    constructor(grievanceRepository: Repository<Grievance>, upvoteRepository: Repository<GrievanceUpvote>);
    create(loginId: string, text: string, type: string, mediaUrl?: string): Promise<{
        status: string;
        message: string;
    }>;
    findAll(): Promise<Grievance[]>;
    upvote(id: string, loginId: string): Promise<{
        status: string;
        upvotes: number;
    }>;
    resolve(id: string): Promise<{
        status: string;
    }>;
    remove(id: string): Promise<{
        status: string;
        message: string;
    }>;
}
