import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import { CessionService } from './cession.service';
import { StartCessionDto } from './start-cession.dto';
import { SessionService } from 'src/session/session.service';

@Controller('api/procedures/cession')
export class CessionController {
  constructor(
    private readonly service: CessionService,
    private readonly sessionService: SessionService,
  ) {}

  private extractAuthToken(req: any): string | null {
    const cookieToken = req?.cookies?.auth_token;
    if (cookieToken) return cookieToken;

    const authHeader = req?.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length).trim();
    }
    return null;
  }

  private async resolveAuthenticatedUserId(req: any): Promise<number> {
    const token = this.extractAuthToken(req);
    if (!token) {
      throw new HttpException('Non authentifie', HttpStatus.UNAUTHORIZED);
    }
    const session = await this.sessionService.validateSession(token);
    const userId = session?.user?.id ?? session?.userId;
    if (!userId) {
      throw new HttpException('Session invalide', HttpStatus.UNAUTHORIZED);
    }
    return Number(userId);
  }

  @Get('permis/:permisId/actionnaires')
  async getActionnairesForPermis(
    @Param('permisId', ParseIntPipe) permisId: number,
  ) {
    return this.service.getActionnairesForPermis(permisId);
  }

  @Post('start')
  async startCession(@Req() req: any, @Body() payload: StartCessionDto) {
    const userId = await this.resolveAuthenticatedUserId(req);
    return this.service.startCession({
      ...payload,
      utilisateurId: userId,
    });
  }
}
