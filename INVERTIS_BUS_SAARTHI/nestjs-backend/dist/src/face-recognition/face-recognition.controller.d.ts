import { FaceRecognitionService } from './face-recognition.service';
export declare class FaceRecognitionController {
    private readonly faceRecognitionService;
    constructor(faceRecognitionService: FaceRecognitionService);
    enrollFace(passengerId: string, file: Express.Multer.File): Promise<{
        status: string;
        faceId: string | undefined;
        s3Key: string;
    }>;
    recognizeFace(file: Express.Multer.File): Promise<{
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
    deleteFace(passengerId: string): Promise<{
        status: string;
        message: string;
    }>;
}
