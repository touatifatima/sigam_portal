import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { OperatorAccessService } from './operator-access.service';
import type { CookieOptions } from 'express';

@Controller('operator')
export class OperatorAccessController {
  constructor(private readonly operatorAccessService: OperatorAccessService) {}

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

  private setAuthCookie(req: Request, res: Response, token: string) {
    res.cookie('auth_token', token, this.buildAuthCookieOptions(req));
  }

  @Get('access')
  async getAccessContext(@Query('codeqr') codeqr: string) {
    return this.operatorAccessService.getAccessContext(codeqr);
  }

  @Post('access/login')
  async loginWithCodeQr(
    @Body() body: { codeqr: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.operatorAccessService.loginWithCodeQr(body);
    this.setAuthCookie(req, res, result.token);

    return {
      token: result.token,
      user: result.user,
      permit: result.permit,
      detenteur: result.detenteur,
    };
  }

  @Post('create-access')
  async createAccess(@Body() body: { codeqr: string; email: string; password: string }) {
    return this.operatorAccessService.createAccess(body);
  }

  @Post('verify-access')
  async verifyAccess(
    @Body() body: { codeqr: string; email: string; code: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.operatorAccessService.verifyAccess(body);
    this.setAuthCookie(req, res, result.token);

    return {
      token: result.token,
      user: result.user,
      permit: result.permit,
      detenteur: result.detenteur,
      message: result.message,
    };
  }

  @Get('dashboard')
  async getDashboardContext(
    @Query('codeqr') codeqr: string,
    @Req() req: Request,
  ) {
    return this.operatorAccessService.getDashboardContext({
      codeqr,
      authToken: req.cookies?.auth_token,
    });
  }
}
