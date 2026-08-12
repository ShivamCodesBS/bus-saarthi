import { UserRole } from '../../users/entities/user.entity';
export declare class LoginDto {
    login_id: string;
    password: string;
    role?: UserRole;
}
