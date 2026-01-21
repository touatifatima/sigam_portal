import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Body,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FactureService } from './facture.service';

type GenerateInvestisseurFactureDto = {
  id_demande: number;
};

@Controller('api/facture')
export class FactureController {
  constructor(private readonly factureService: FactureService) {}

  @Post('investisseur/generer')
  async genererInvestisseur(
    @Body() body: GenerateInvestisseurFactureDto,
  ) {
    const idDemande = Number(body?.id_demande);
    if (!Number.isFinite(idDemande)) {
      throw new BadRequestException('id_demande invalide');
    }
    return this.factureService.generateInvestisseurFacture(idDemande);
  }

  @Get('demande/:idDemande')
  async getByDemande(
    @Param('idDemande', ParseIntPipe) idDemande: number,
  ) {
    return this.factureService.getFactureByDemande(idDemande);
  }

  @Post(':idFacture/emettre')
  async emettre(
    @Param('idFacture', ParseIntPipe) idFacture: number,
  ) {
    return this.factureService.emettreFacture(idFacture);
  }

  @Get(':idFacture/pdf')
  async downloadPdf(
    @Param('idFacture', ParseIntPipe) idFacture: number,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.factureService.generateFacturePdf(
      idFacture,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  }
}
