import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { RekognitionService } from './rekognition.service';
import { S3Service } from './s3.service';
export declare class FaceRecognitionService {
    private usersRepository;
    private rekognitionService;
    private s3Service;
    constructor(usersRepository: Repository<User>, rekognitionService: RekognitionService, s3Service: S3Service);
    enrollFace(loginId: string, imageBuffer: Buffer, mimeType: string): Promise<{
        status: string;
        faceId: string | undefined;
        s3Key: string;
    }>;
    recognizeFace(imageBuffer: Buffer): Promise<{
        status: string;
        detail: string;
        passenger?: undefined;
        confidence?: undefined;
    } | {
        status: string;
        passenger: {
            login_id: string;
            name: string;
            fee_status: import("../users/entities/user.entity").FeeStatus;
            route_id: string;
        };
        confidence: number | undefined;
        detail?: undefined;
    }>;
    deleteFace(loginId: string): Promise<{
        status: string;
        message: string;
    }>;
}
