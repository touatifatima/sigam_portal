// src/auth/auth.controller.ts
import { Controller, Post, Body, Get, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Request, Response } from 'express';
import type { CookieOptions } from 'express';

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

  private buildAuthCookieOptions(req: Request): CookieOptions {
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    const isHttps =
      req.secure || forwardedProto === 'https' || req.protocol === 'https';

    const domain = (process.env.COOKIE_DOMAIN || '').trim();
    return {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
      ...(domain ? { domain } : {}),
    };
  }

  @Post('login')
  async login(
    @Body() body: { email: string; password: string; recaptchaToken: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.verifyRecaptchaToken(
      body.recaptchaToken,
      'login',
      this.extractClientIp(req),
    );

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

    res.cookie('auth_token', token, this.buildAuthCookieOptions(req));

    return { token, user: userData };
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

    const cookieOptions = this.buildAuthCookieOptions(req);
    res.clearCookie('auth_token', {
      path: cookieOptions.path,
      ...(cookieOptions.domain ? { domain: cookieOptions.domain } : {}),
    });

    return { message: 'Logged out successfully' };
  }

  @Post('register')
  async register(@Body() body: any, @Req() req: Request) {
    await this.authService.verifyRecaptchaToken(
      body?.recaptchaToken,
      'register',
      this.extractClientIp(req),
    );

    return this.authService.register(body);
  }

  @Post('verify-email')
  async verifyEmail(
    @Body() body: { email: string; code: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.authService.verifyEmail(body.email, body.code);
    res.cookie('auth_token', token, this.buildAuthCookieOptions(req));
    return { token, user };
  }

  @Post('resend-verification')
  async resendVerification(@Body() body: { email: string }) {
    return this.authService.resendVerification(body.email);
  }

  @Post('forgot-password')
  async forgotPassword(
    @Body() body: { email: string; recaptchaToken: string },
    @Req() req: Request,
  ) {
    await this.authService.verifyRecaptchaToken(
      body.recaptchaToken,
      'forgot_password',
      this.extractClientIp(req),
    );

    return this.authService.forgotPassword(body.email, this.extractClientIp(req));
  }

  @Post('reset-password')
  async resetPassword(
    @Body()
    body: {
      token: string;
      password: string;
      confirmPassword: string;
      recaptchaToken: string;
    },
    @Req() req: Request,
  ) {
    await this.authService.verifyRecaptchaToken(
      body.recaptchaToken,
      'reset_password',
      this.extractClientIp(req),
    );

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

  @Get('profile-update/status')
  async profileUpdateStatus(@Req() req: Request) {
    const token = req.cookies?.auth_token;
    return this.authService.getProfileUpdateStatus(token);
  }

  @Post('profile-update/request')
  async requestProfileUpdate(
    @Body()
    body: {
      Prenom?: string;
      nom?: string;
      email?: string;
      telephone?: string | null;
      password?: string;
      confirmPassword?: string;
    },
    @Req() req: Request,
  ) {
    const token = req.cookies?.auth_token;
    return this.authService.requestProfileUpdate(token, body);
  }

  @Get('profile-update/request')
  profileUpdateRequestHelp() {
    return {
      message:
        "Endpoint actif. Utilisez POST /auth/profile-update/request pour lancer l'envoi OTP.",
    };
  }

  @Post('profile-update/resend')
  async resendProfileUpdateOtp(@Req() req: Request) {
    const token = req.cookies?.auth_token;
    return this.authService.resendProfileUpdateOtp(token);
  }

  @Post('profile-update/verify')
  async verifyProfileUpdate(
    @Body() body: { code: string },
    @Req() req: Request,
  ) {
    const token = req.cookies?.auth_token;
    return this.authService.verifyProfileUpdate(token, body);
  }

  @Post('verify')
  async verify(@Body() body: { token: string }) {
    return {
      user: await this.authService.verifyToken(body.token),
    };
  }
}
