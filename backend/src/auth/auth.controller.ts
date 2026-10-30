import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
  Get,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import type { Response, Request } from 'express';
import * as jwt from 'jsonwebtoken';

interface JwtPayload {
  login_id: string;
  role: string;
  name: string;
  route_id: string | null;
  tokenVersion?: number;
  id?: string;
}

@Controller('api')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);

    if (result.status === 'success') {
      const isProduction = process.env.NODE_ENV === 'production';

      // Set access token cookie (short-lived, 15 minutes)
      res.cookie('access_token', result.accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 15 * 60 * 1000, // 15 minutes
        path: '/',
      });

      // Set refresh token cookie (long-lived, 30 days)
      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/',
      });

      // The access token is ALSO returned in the body for clients that need it
      // (e.g., Flutter apps that use Authorization: Bearer header)
      return {
        status: 'success',
        token: result.accessToken,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        refreshTokenExpiresAt: result.refreshTokenExpiresAt,
        user: result.user,
      };
    }

    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      return { status: 'error', message: 'Refresh token not found' };
    }

    // Extract user ID from the refresh token (we need to decode it first)
    // For simplicity, we'll use the access token from cookies to get user ID
    const accessToken = req.cookies?.access_token;
    if (!accessToken) {
      return { status: 'error', message: 'Access token not found' };
    }

    // Decode the access token to get user ID (without verification, since it may be expired)
    let payload: JwtPayload | null = null;
    try {
      payload = jwt.decode(accessToken) as JwtPayload | null;
    } catch {
      return { status: 'error', message: 'Invalid access token' };
    }

    if (!payload?.login_id) {
      return { status: 'error', message: 'Invalid token payload' };
    }

    // Find user by login_id
    const user = await this.authService.getPrisma().user.findUnique({
      where: { loginId: payload.login_id },
      select: { id: true },
    });

    if (!user) {
      return { status: 'error', message: 'User not found' };
    }

    // Verify and rotate refresh token
    const tokens = await this.authService.verifyAndRotateRefreshToken(
      user.id,
      refreshToken,
    );

    if (!tokens) {
      // Clear cookies and return error
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/' });
      return { status: 'error', message: 'Invalid or expired refresh token' };
    }

    const isProduction = process.env.NODE_ENV === 'production';

    // Set new access token cookie
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    // Set new refresh token cookie
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });

    return {
      status: 'success',
      token: tokens.accessToken,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response, @Req() req: Request) {
    // Get user ID from access token to revoke refresh token
    const accessToken = req.cookies?.access_token;
    if (accessToken) {
      try {
        const payload = jwt.decode(accessToken) as JwtPayload | null;
        if (payload?.login_id) {
          const user = await this.authService.getPrisma().user.findUnique({
            where: { loginId: payload.login_id },
            select: { id: true },
          });
          if (user) {
            await this.authService.revokeRefreshToken(user.id);
          }
        }
      } catch {
        // Ignore decode errors
      }
    }

    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    return { status: 'success', message: 'Logged out successfully' };
  }

  // Endpoint for frontend to get token for push notifications
  // HttpOnly cookie can't be read by JS, so this returns it for VAPID subscription
  @Get('auth/token')
  @HttpCode(HttpStatus.OK)
  async getToken(@Req() req: Request) {
    const token = req.cookies?.access_token;
    if (!token) {
      return { token: null };
    }
    return { token };
  }
}
