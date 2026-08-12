import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    findAll(): Promise<import("./entities/user.entity").User[]>;
    findOne(loginId: string): Promise<import("./entities/user.entity").User>;
    create(body: any): Promise<{
        status: string;
        message: string;
        user: any;
    }>;
    bulkCreate(body: {
        users: any[];
    }): Promise<{
        status: string;
        results: {
            successful: number;
            failed: number;
            errors: string[];
        };
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
    changePassword(loginId: string, body: {
        current_password: string;
        new_password: string;
    }, req: any): Promise<{
        status: string;
        message: string;
    }>;
}
