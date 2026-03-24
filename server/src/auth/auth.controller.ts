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

  private extractClientIp(req: Request) {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
      return forwardedFor[0].split(',')[0].trim();
    }
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      return forwardedFor.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.validateUser(body.email, body.password);
    if (!result.user) {
      if (result.error === 'EMAIL_NOT_VERIFIED') {
        return { error: 'Email non verifie' };
      }
      if (result.error === 'IDENTIFICATION_PENDING') {
        return {
          error: 'IDENTIFICATION_PENDING',
          message:
            "Desole, votre compte est en attente de validation. L'administration ANAM doit encore verifier et confirmer l'identification de votre entreprise. Si cela fait plus d'une semaine, contactez-nous a pom@anam.dz. Merci de votre patience !",
        };
      }
      if (result.error === 'IDENTIFICATION_REJECTED') {
        return {
          error: 'IDENTIFICATION_REJECTED',
          message:
            "Desole, votre compte n'a pas ete valide par l'administration. Veuillez contacter le support ANAM pour plus d'informations.",
        };
      }
      return { error: 'Invalid credentials' };
    }

    const { token, user: userData } = await this.authService.login(result.user);

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
      ...(process.env.NODE_ENV === 'production' ? { domain: '.yourdomain.com' } : {}),
    });

    return { user: userData };
  }

  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.auth_token;
    if (token) {
      await this.authService.logout(token);
    }

    res.clearCookie('auth_token', {
      path: '/',
      ...(process.env.NODE_ENV === 'production' ? { domain: '.yourdomain.com' } : {}),
    });

    return { message: 'Logged out successfully' };
  }

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Post('verify-email')
  async verifyEmail(
    @Body() body: { email: string; code: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.authService.verifyEmail(body.email, body.code);
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
      ...(process.env.NODE_ENV === 'production' ? { domain: '.yourdomain.com' } : {}),
    });
    return { user };
  }

  @Post('resend-verification')
  async resendVerification(@Body() body: { email: string }) {
    return this.authService.resendVerification(body.email);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }, @Req() req: Request) {
    return this.authService.forgotPassword(body.email, this.extractClientIp(req));
  }

  @Post('reset-password')
  async resetPassword(
    @Body() body: { token: string; password: string; confirmPassword: string },
  ) {
    return this.authService.resetPassword(
      body.token,
      body.password,
      body.confirmPassword,
    );
  }

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
