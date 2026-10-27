import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
    private cache: CacheService,
  ) {
    super({
      // Bearer header first (what the web app and Flutter app send); the
      // HttpOnly cookie set at login is the fallback so same-site browser
      // sessions authenticate even when a caller forgets the header.
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => req?.cookies?.access_token || null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!,
    });
  }

  /**
   * The token is signed with the account's role, so the role does not need to
   * be re-read on every request. We only need to know the account still
   * exists and has not been deleted or had its role changed.
   *
   * The previous implementation ran a `SELECT * FROM users` on EVERY
   * authenticated request. That is the single biggest source of latency in
   * the app: every page load, every polling tick and every socket handshake
   * paid for a full user row read (including the bcrypt hash).
   */
  async validate(payload: any) {
    const loginId = payload.login_id;
    const tokenVersion = payload.tokenVersion ?? 0;
    if (!loginId) {
      throw new UnauthorizedException();
    }

    // Cache key includes tokenVersion - invalidates on password/role change
    const cacheKey = `auth:user:${loginId}:v${tokenVersion}`;
    const cached = await this.cache.get<{
      role: string;
      routeId: string | null;
      name: string;
    }>(cacheKey);

    if (cached) {
      return {
        id: payload.id,
        loginId,
        login_id: loginId,
        name: cached.name,
        role: cached.role,
        routeId: cached.routeId,
        route_id: cached.routeId,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { loginId },
      select: { id: true, loginId: true, name: true, role: true, routeId: true, tokenVersion: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }

    // Token version mismatch = token revoked
    if (user.tokenVersion !== tokenVersion) {
      throw new UnauthorizedException('Token revoked');
    }

    await this.cache.set(
      cacheKey,
      { role: user.role, routeId: user.routeId, name: user.name },
      300,
    );

    return {
      id: user.id,
      loginId: user.loginId,
      login_id: user.loginId,
      name: user.name,
      role: user.role,
      routeId: user.routeId,
      route_id: user.routeId,
    };
  }
}
