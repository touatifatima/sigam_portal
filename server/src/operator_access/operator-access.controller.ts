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

@Controller('operator')
export class OperatorAccessController {
  constructor(private readonly operatorAccessService: OperatorAccessService) {}

  private setAuthCookie(res: Response, token: string) {
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
  }

  @Get('access')
  async getAccessContext(@Query('codeqr') codeqr: string) {
    return this.operatorAccessService.getAccessContext(codeqr);
  }

  @Post('access/login')
  async loginWithCodeQr(
    @Body() body: { codeqr: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.operatorAccessService.loginWithCodeQr(body);
    this.setAuthCookie(res, result.token);

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
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.operatorAccessService.verifyAccess(body);
    this.setAuthCookie(res, result.token);

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
