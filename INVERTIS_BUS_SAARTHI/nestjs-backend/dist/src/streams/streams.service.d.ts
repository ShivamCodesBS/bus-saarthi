export declare class StreamsService {
    private readonly logger;
    private activeStreams;
    validateBus(busId: string): Promise<boolean>;
    setStreamActive(busId: string, isActive: boolean): Promise<void>;
    getActiveStreams(): string[];
}
