import { StreamsService } from './streams.service';
export declare class StreamsController {
    private readonly streamsService;
    constructor(streamsService: StreamsService);
    authenticateStream(body: {
        path: string;
        action: string;
    }): Promise<{
        status: string;
    }>;
}
