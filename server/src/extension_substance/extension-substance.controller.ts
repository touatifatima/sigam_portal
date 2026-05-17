import {
  BadRequestException,
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
import { ExtensionSubstanceService } from './extension-substance.service';
import { SessionService } from 'src/session/session.service';

@Controller('api/procedures/extension-substance')
export class ExtensionSubstanceController {
  constructor(
    private readonly service: ExtensionSubstanceService,
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

  @Post('start')
  async start(
    @Req() req: any,
    @Body() body: { permisId?: number; date_demande?: string | null; utilisateurId?: number | null },
  ) {
    if (!Number.isFinite(Number(body?.permisId))) {
      throw new BadRequestException('permisId invalide');
    }
    const userId = await this.resolveAuthenticatedUserId(req);
    return this.service.start(
      Number(body.permisId),
      body.date_demande ?? undefined,
      userId,
    );
  }

  @Get(':id/substances')
  async getSubstances(@Param('id', ParseIntPipe) id_proc: number) {
    return this.service.getSubstancesForStep1(id_proc);
  }

  @Post(':id/substances')
  async saveSubstances(
    @Param('id', ParseIntPipe) id_proc: number,
    @Body() body: { substances?: Array<{ id_substance?: number; priorite?: 'principale' | 'secondaire' }> },
  ) {
    return this.service.saveAddedSubstances(id_proc, body?.substances ?? []);
  }
}
