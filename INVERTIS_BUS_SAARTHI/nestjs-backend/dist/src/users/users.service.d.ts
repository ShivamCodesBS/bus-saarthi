import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
export declare class UsersService {
    private usersRepository;
    constructor(usersRepository: Repository<User>);
    findByLoginId(loginId: string): Promise<User>;
    findAll(): Promise<User[]>;
    create(body: any): Promise<{
        status: string;
        message: string;
        user: any;
    }>;
    update(loginId: string, body: any): Promise<{
        status: string;
        message: string;
        user: any;
    }>;
    remove(loginId: string): Promise<{
        status: string;
        message: string;
    }>;
    bulkCreate(users: any[]): Promise<{
        status: string;
        results: {
            successful: number;
            failed: number;
            errors: string[];
        };
    }>;
    changePassword(loginId: string, currentPassword: string, newPassword: string): Promise<{
        status: string;
        message: string;
    }>;
}
