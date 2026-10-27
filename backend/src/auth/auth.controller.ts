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

@Controller('api')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(loginDto);

    if (result.status === 'success') {
      // Generate JWT token for HttpOnly cookie
      const token = this.authService.generateToken(result.user);

      // Cross-site deployments (Vercel app -> Render API) only carry cookies
      // marked SameSite=None; localhost dev stays on Lax because None+Secure
      // breaks over plain http.
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('access_token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        path: '/',
      });

      // The token is ALSO returned in the body: the Flutter bus app and the
      // web Login page authenticate every later request with
      // `Authorization: Bearer`, and browsers may refuse to send a cross-site
      // cookie back (third-party cookie blocking), so the cookie can never be
      // the only credential.
      return { status: 'success', token, user: result.user };
    }

    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { path: '/' });
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
