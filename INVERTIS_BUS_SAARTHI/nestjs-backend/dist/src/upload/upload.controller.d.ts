import { UploadService } from './upload.service';
export declare class UploadController {
    private readonly uploadService;
    constructor(uploadService: UploadService);
    uploadFile(file: Express.Multer.File): Promise<unknown>;
    uploadProfilePic(file: Express.Multer.File, req: any): Promise<any>;
}
