import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { login_id, password } = loginDto;

    let user = await this.prisma.user.findUnique({
      where: { loginId: login_id },
      select: {
        id: true,
        loginId: true,
        name: true,
        password: true,
        role: true,
        routeId: true,
        feeStatus: true,
        profilePic: true,
        designation: true,
        locationLat: true,
        locationLng: true,
        wakeAlarm: true,
      },
    });

    // Fallback: Check if login_id matches a phone number
    if (!user) {
      user = await this.prisma.user.findFirst({
        where: { phone: login_id },
        select: {
          id: true,
          loginId: true,
          name: true,
          password: true,
          role: true,
          routeId: true,
          feeStatus: true,
          profilePic: true,
          designation: true,
          locationLat: true,
          locationLng: true,
          wakeAlarm: true,
        },
      });
    }

    if (!user) {
      throw new UnauthorizedException('Invalid login ID or password');
    }

    const isMatch = await bcrypt.compare(password, user.password!);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid login ID or password');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

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
