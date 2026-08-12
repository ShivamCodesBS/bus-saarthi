import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(loginDto: LoginDto): Promise<{
        status: string;
        token: string;
        user: {
            login_id: string;
            name: string;
            role: import("../users/entities/user.entity").UserRole;
            route_id: string;
            fee_status: import("../users/entities/user.entity").FeeStatus;
            profile_pic: string;
            designation: string;
        };
    }>;
}
