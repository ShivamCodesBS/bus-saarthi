import { LeavesService } from './leaves.service';
export declare class LeavesController {
    private readonly leavesService;
    constructor(leavesService: LeavesService);
    toggleLeave(req: any, body: {
        date: string;
        cancel?: boolean;
    }): Promise<{
        status: string;
        message: string;
    }>;
}
