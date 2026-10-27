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
      
      // Set HttpOnly cookie with token
      res.cookie('access_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 1 day
        path: '/',
      });
      
      // Don't send token in response body
      return { status: 'success', user: result.user };
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
