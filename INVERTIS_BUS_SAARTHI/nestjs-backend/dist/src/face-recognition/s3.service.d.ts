import { ConfigService } from '@nestjs/config';
export declare class S3Service {
    private configService;
    private client;
    private readonly logger;
    constructor(configService: ConfigService);
    generateKey(passengerId: string, suffix?: string): string;
    uploadImage(buffer: Buffer, key: string, mimeType: string): Promise<string>;
    deleteImage(key: string): Promise<void>;
    getPresignedUrl(key: string): Promise<string | null>;
}
