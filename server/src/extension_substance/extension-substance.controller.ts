import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ExtensionSubstanceService } from './extension-substance.service';

@Controller('api/procedures/extension-substance')
export class ExtensionSubstanceController {
  constructor(private readonly service: ExtensionSubstanceService) {}

  @Post('start')
  async start(
    @Body() body: { permisId?: number; date_demande?: string | null },
  ) {
    if (!Number.isFinite(Number(body?.permisId))) {
      throw new BadRequestException('permisId invalide');
    }
    return this.service.start(Number(body.permisId), body.date_demande ?? undefined);
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

