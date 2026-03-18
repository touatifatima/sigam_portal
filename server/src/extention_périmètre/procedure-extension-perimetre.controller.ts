import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { StatutProcedure } from '@prisma/client';
import { CreateExtensionDto } from './create-extension.dto';
import { ProcedureExtensionPerimetreService } from './procedure-extension-perimetre.service';

@Controller('api/procedures')
export class ProcedureExtensionPerimetreController {
  constructor(
    private readonly extensionService: ProcedureExtensionPerimetreService,
  ) {}

  @Get('extension/perimetre/latest')
  async getLatestPerimeter(@Query('permisId') permisId?: string) {
    if (!permisId) {
      throw new BadRequestException('permisId requis');
    }
    return this.extensionService.getLatestAcceptedPerimeter(Number(permisId));
  }

  @Get('extension/perimetre/list')
  async listPerimeters(@Query('permisId') permisId?: string) {
    if (!permisId) {
      throw new BadRequestException('permisId requis');
    }
    return this.extensionService.listPerimetersByPermis(Number(permisId));
  }

  @Post('extension/:id/perimetres')
  async saveExtensionPerimeter(
    @Param('id') id: string,
    @Body() body: { points: any[]; commentaires?: string },
  ) {
    if (!body?.points || !Array.isArray(body.points) || body.points.length < 3) {
      throw new BadRequestException('Au moins trois points sont requis');
    }
    return this.extensionService.saveExtensionPerimeter(Number(id), body);
  }

  @Post('extension/start')
  async startExtension(@Body() dto: CreateExtensionDto) {
    return this.extensionService.startExtensionWithOriginalData(
      dto.permisId,
      dto.date_demande,
      StatutProcedure.EN_COURS,
    );
  }
}

