import { Injectable, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { login_id, password, role } = loginDto;

    const user = await this.usersRepository.findOne({
      where: { loginId: login_id },
      select: { id: true, loginId: true, name: true, password: true, role: true, routeId: true, feeStatus: true, profilePic: true, designation: true, locationLat: true, locationLng: true, wakeAlarm: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid login ID or password');
    }

    if (role && user.role !== role) {
      throw new HttpException(`Invalid role. User is not a ${role}`, HttpStatus.FORBIDDEN);
    }

    const isMatch = await bcrypt.compare(password, user.password!);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid login ID or password');
    }

    // Update last login
    user.lastLogin = new Date();
    await this.usersRepository.save(user);

    const payload = {
      id: user.id,
      login_id: user.loginId,
      role: user.role,
      name: user.name,
      route_id: user.routeId,
    };

    const access_token = this.jwtService.sign(payload);

    return {
      status: 'success',
      token: access_token,
      user: {
        login_id: user.loginId,
        name: user.name,
        role: user.role,
        route_id: user.routeId,
        fee_status: user.feeStatus,
        profile_pic: user.profilePic,
        designation: user.designation,
      },
    };
  }
}
