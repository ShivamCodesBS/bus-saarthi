import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private usersRepository;
    private jwtService;
    constructor(usersRepository: Repository<User>, jwtService: JwtService);
    login(loginDto: LoginDto): Promise<{
        status: string;
        token: string;
        user: {
            login_id: string;
            name: string;
            role: UserRole;
            route_id: string;
            fee_status: import("../users/entities/user.entity").FeeStatus;
            profile_pic: string;
            designation: string;
        };
    }>;
}
