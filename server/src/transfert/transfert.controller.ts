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
  Query,
  Req,
} from '@nestjs/common';
import { CreateDetenteurDto } from './create-detenteur.dto';
import { StartTransfertDto } from './start-transfert.dto';
import { TransfertService } from './transfert.service';
import { SessionService } from 'src/session/session.service';

@Controller('api/procedures/transfert')
export class TransfertController {
  constructor(
    private readonly service: TransfertService,
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

  @Get('detenteurs/search')
  async searchDetenteurs(
    @Query('q') q?: string,
    @Query('excludeDetenteurId') excludeDetenteurId?: string,
  ) {
    const excludeId = Number(excludeDetenteurId);
    return this.service.searchDetenteurs(
      q,
      Number.isFinite(excludeId) ? excludeId : undefined,
    );
  }

  @Get('detenteurs/:id/preview')
  async getDetenteurPreview(@Param('id', ParseIntPipe) id: number) {
    return this.service.getDetenteurPreview(id);
  }

  @Post('detenteurs')
  async createDetenteur(@Body() payload: CreateDetenteurDto) {
    return this.service.createDetenteurFromDto(payload);
  }

  @Post('start')
  async startTransfert(@Req() req: any, @Body() payload: StartTransfertDto) {
    const userId = await this.resolveAuthenticatedUserId(req);
    return this.service.startTransfert({
      ...payload,
      utilisateurId: userId,
    });
  }

  @Get(':id/receiver')
  async getReceiverForProcedure(@Param('id', ParseIntPipe) idProc: number) {
    return this.service.getReceiverForProcedure(idProc);
  }

  @Get('permis/:permisId/history')
  async getHistoryByPermis(@Param('permisId') permisIdOrCode: string) {
    const permisId = await this.service.resolvePermisId(permisIdOrCode);
    return this.service.getHistoryByPermis(permisId);
  }

  @Get('permis/:permisId/details')
  async getPermisDetails(@Param('permisId') permisIdOrCode: string) {
    const permisId = await this.service.resolvePermisId(permisIdOrCode);
    return this.service.getPermisDetails(permisId);
  }

  @Get('detenteur/:id')
  async getDetenteurFull(@Param('id', ParseIntPipe) id: number) {
    return this.service.getDetenteurFull(id);
  }

  @Post('validate')
  async validatePayload(@Body() payload: StartTransfertDto) {
    if (!Number.isFinite(Number(payload?.permisId))) {
      throw new BadRequestException('permisId invalide');
    }
    return { ok: true };
  }
}
