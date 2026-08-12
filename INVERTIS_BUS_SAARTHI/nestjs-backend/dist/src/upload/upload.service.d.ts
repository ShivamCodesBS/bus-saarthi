import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
export declare class UploadService {
    private configService;
    private usersRepository;
    constructor(configService: ConfigService, usersRepository: Repository<User>);
    uploadFile(file: Express.Multer.File, folder?: string): Promise<unknown>;
    uploadProfilePic(file: Express.Multer.File, loginId: string): Promise<any>;
}
