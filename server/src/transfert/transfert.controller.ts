import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CreateDetenteurDto } from './create-detenteur.dto';
import { StartTransfertDto } from './start-transfert.dto';
import { TransfertService } from './transfert.service';

@Controller('api/procedures/transfert')
export class TransfertController {
  constructor(private readonly service: TransfertService) {}

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
  async startTransfert(@Body() payload: StartTransfertDto) {
    return this.service.startTransfert(payload);
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
