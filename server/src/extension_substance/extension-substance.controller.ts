import {
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
  async start(@Body('permisId', ParseIntPipe) permisId: number) {
    return this.service.start(permisId);
  }

  @Get(':id/substances')
  async list(@Param('id', ParseIntPipe) id_proc: number) {
    return this.service.listSubstances(id_proc);
  }
}
