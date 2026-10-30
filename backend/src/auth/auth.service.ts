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
import * as crypto from 'crypto';

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

// Token expiration constants
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const REFRESH_TOKEN_EXPIRY_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // Expose prisma for controller usage (e.g., finding user by login_id from token)
  getPrisma() {
    return this.prisma;
  }

  // Generate a cryptographically secure random refresh token
  private generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  // Generate access token (short-lived)
  generateAccessToken(user: {
    login_id: string;
    name: string;
    role: UserRole;
    route_id: string | null;
  }): string {
    const payload = {
      login_id: user.login_id,
      role: user.role,
      name: user.name,
      route_id: user.route_id,
      tokenVersion: 0, // Will be validated on each request via cache
    };
    return this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_EXPIRY });
  }

  // Generate and store refresh token (long-lived)
  async generateAndStoreRefreshToken(
    userId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = this.generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken: await bcrypt.hash(token, 10),
        refreshTokenExpiresAt: expiresAt,
      },
    });

    return { token, expiresAt };
  }

  // Verify refresh token and rotate if valid
  async verifyAndRotateRefreshToken(
    userId: string,
    providedToken: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    refreshTokenExpiresAt: Date;
  } | null> {
    // Use a transaction to ensure atomic check-and-rotate
    // This prevents race conditions where two concurrent refresh requests
    // could both succeed with the same refresh token
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          refreshToken: true,
          refreshTokenExpiresAt: true,
          loginId: true,
          name: true,
          role: true,
          routeId: true,
        },
      });

      if (!user || !user.refreshToken || !user.refreshTokenExpiresAt) {
        return null;
      }

      // Check expiration
      if (new Date() > user.refreshTokenExpiresAt) {
        return null;
      }

      // Verify token hash
      const isValid = await bcrypt.compare(providedToken, user.refreshToken);
      if (!isValid) {
        return null;
      }

      // Generate new tokens (rotation) - all within the same transaction
      const newAccessToken = this.generateAccessToken({
        login_id: user.loginId,
        name: user.name,
        role: user.role,
        route_id: user.routeId,
      });

      // Generate and store new refresh token
      const token = this.generateRefreshToken();
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

      await tx.user.update({
        where: { id: userId },
        data: {
          refreshToken: await bcrypt.hash(token, 10),
          refreshTokenExpiresAt: expiresAt,
        },
      });

      return {
        accessToken: newAccessToken,
        refreshToken: token,
        refreshTokenExpiresAt: expiresAt,
      };
    });
  }

  // Revoke refresh token (logout, password change, etc.)
  async revokeRefreshToken(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken: null,
        refreshTokenExpiresAt: null,
        tokenVersion: { increment: 1 }, // Also invalidate access tokens
      },
    });
  }

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
        `This account is registered as "${this.humanRole(user.role)}", not "${this.humanRole(role)}".`,
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate both access and refresh tokens
    const accessToken = this.generateAccessToken({
      login_id: user.loginId,
      name: user.name,
      role: user.role,
      route_id: user.routeId,
    });

    const { token: refreshToken, expiresAt } =
      await this.generateAndStoreRefreshToken(user.id);

    return {
      status: 'success',
      accessToken: accessToken,
      refreshToken: refreshToken,
      refreshTokenExpiresAt: expiresAt.toISOString(),
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

  // Generate JWT token for HttpOnly cookie (legacy method - kept for compatibility)
  generateToken(user: {
    login_id: string;
    name: string;
    role: UserRole;
    route_id: string | null;
  }): string {
    return this.generateAccessToken(user);
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
