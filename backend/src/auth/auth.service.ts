import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const USER_SELECT = {
  id: true,
  loginId: true,
  name: true,
  password: true,
  role: true,
  routeId: true,
  feeStatus: true,
  profilePic: true,
  designation: true,
  phone: true,
  email: true,
  subject: true,
  gradeClass: true,
  locationLat: true,
  locationLng: true,
  wakeAlarm: true,
  tokenVersion: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { login_id, password, role } = loginDto;

    let user = await this.prisma.user.findUnique({
      where: { loginId: login_id },
      select: USER_SELECT,
    });

    // Fallback: allow signing in with a registered phone number, but never
    // select an arbitrary account if legacy data contains duplicate numbers.
    if (!user) {
      const phoneMatches = await this.prisma.user.findMany({
        where: { phone: login_id },
        select: USER_SELECT,
        take: 2,
      });
      if (phoneMatches.length > 1) {
        throw new ConflictException(
          'This phone number is linked to multiple accounts. Sign in with your login ID or contact the transport office.',
        );
      }
      user = phoneMatches[0] ?? null;
    }

    if (!user) {
      throw new UnauthorizedException('Invalid login ID or password');
    }

    // A user account with no password hash can never authenticate.
    if (!user.password) {
      throw new UnauthorizedException(
        'This account has no password set. Please contact the transport office.',
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid login ID or password');
    }

    // The login screen lets the user pick a role. If they picked one, it must
    // match the role actually stored on the account — otherwise a passenger
    // could tick "Admin" and land in the admin dashboard.
    if (role && role !== user.role) {
      throw new UnauthorizedException(
        `This account is registered as "${this.humanRole(user.role)}", not "${this.humanRole(role as UserRole)}".`,
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    return {
      status: 'success',
      user: {
        login_id: user.loginId,
        name: user.name,
        role: user.role,
        route_id: user.routeId,
        fee_status: user.feeStatus,
        profile_pic: user.profilePic,
        designation: user.designation,
        email: user.email,
        phone: user.phone,
        subject: user.subject,
        grade_class: user.gradeClass,
      },
    };
  }

  // Generate JWT token for HttpOnly cookie
  generateToken(user: { login_id: string; name: string; role: UserRole; route_id: string | null }): string {
    const payload = {
      login_id: user.login_id,
      role: user.role,
      name: user.name,
      route_id: user.route_id,
      tokenVersion: 0, // Will be validated on each request via cache
    };
    return this.jwtService.sign(payload);
  }

  private humanRole(role: UserRole): string {
    switch (role) {
      case UserRole.transport_incharge:
        return 'Transport Incharge';
      case UserRole.tech_admin:
        return 'Tech Admin';
      default:
        return role.charAt(0).toUpperCase() + role.slice(1);
    }
  }
}
