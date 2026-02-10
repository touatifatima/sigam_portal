// src/auth/auth.controller.ts
import { Controller, Post, Body, Get, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
  ) {} 
  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.validateUser(body.email, body.password);
    if (!result.user) {
      if (result.error === 'EMAIL_NOT_VERIFIED') {
        return { error: 'Email non vérifié' };
      }
      return { error: 'Invalid credentials' };
    }

    const { token, user: userData } = await this.authService.login(result.user);

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: '/',
      ...(process.env.NODE_ENV === 'production'
        ? { domain: '.yourdomain.com' }
        : {}), // ❌ no domain in localhost
    });

    // ⚠️ Don't return token, only user info
    return { user: userData };
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const token = req.cookies?.auth_token;
    if (token) {
      await this.authService.logout(token);
    }

    res.clearCookie('auth_token', {
      path: '/',
      ...(process.env.NODE_ENV === 'production'
        ? { domain: '.yourdomain.com' }
        : {}),
    });

    return { message: 'Logged out successfully' };
  }

  @Post('register')
  async register(@Body() body) {
    return this.authService.register(body);
  }

  @Post('verify-email')
  async verifyEmail(
    @Body() body: { email: string; code: string },
    @Res({ passthrough: true }) res: Response
  ) {
    const { token, user } = await this.authService.verifyEmail(body.email, body.code);
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
      ...(process.env.NODE_ENV === 'production'
        ? { domain: '.yourdomain.com' }
        : {}),
    });
    return { user };
  }

  @Post('resend-verification')
  async resendVerification(@Body() body: { email: string }) {
    return this.authService.resendVerification(body.email);
  }

  // ✅ New endpoint: get session from cookie
  @Get('me')
  async me(@Req() req: Request) {
    const token = req.cookies?.auth_token;
    if (!token) {
      return { user: null };
    }

    const user = await this.authService.verifyToken(token);
    return { user };
  }

  @Post('verify')
async verify(@Body() body: { token: string }) {
  return {
    user: await this.authService.verifyToken(body.token),
  };
}
}
