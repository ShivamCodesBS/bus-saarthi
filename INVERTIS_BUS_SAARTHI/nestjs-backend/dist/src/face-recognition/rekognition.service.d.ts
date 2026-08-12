import { ConfigService } from '@nestjs/config';
export declare class RekognitionService {
    private configService;
    private client;
    private readonly logger;
    constructor(configService: ConfigService);
    validateFaceImage(imageBuffer: Buffer): Promise<import("@aws-sdk/client-rekognition").FaceDetail>;
    indexFace(imageBuffer: Buffer, externalImageId: string): Promise<string | undefined>;
    searchFacesByImage(imageBuffer: Buffer): Promise<{
        faceId: string | undefined;
        externalImageId: string | undefined;
        confidence: number | undefined;
    } | null>;
    deleteFace(faceId: string): Promise<void>;
}
