import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FusionPermisService } from './fusion-permis.service';

@Controller('api/fusion-permis')
export class FusionPermisController {
  constructor(private readonly fusionPermisService: FusionPermisService) {}

  @Post('fusionner')
  async fusionner(
    @Body()
    body: {
      id_principal: number;
      id_secondaire: number;
      motif_fusion: string;
    },
  ) {
    return this.fusionPermisService.fusionner(
      body.id_principal,
      body.id_secondaire,
      body.motif_fusion,
    );
  }

  // Compatibilité avec les anciens écrans qui appellent fusionner en GET
  @Get('fusionner')
  async fusionnerGet(
    @Query('id_principal') idPrincipal: string,
    @Query('id_secondaire') idSecondaire: string,
    @Query('motif_fusion') motifFusion?: string,
  ) {
    const principal = Number(idPrincipal);
    const secondaire = Number(idSecondaire);
    if (!Number.isFinite(principal) || !Number.isFinite(secondaire)) {
      throw new BadRequestException(
        'id_principal et id_secondaire sont obligatoires',
      );
    }
    return this.fusionPermisService.fusionner(
      principal,
      secondaire,
      motifFusion || '',
    );
  }

  // Alias pour compatibilité avec l'ancien appel frontend "fusionnerContinuer"
  @Post('fusionnerContinuer')
  async fusionnerContinuer(
    @Body()
    body: {
      id_principal: number;
      id_secondaire: number;
      motif_fusion?: string;
    },
  ) {
    return this.fusionPermisService.fusionner(
      body.id_principal,
      body.id_secondaire,
      body.motif_fusion || '',
    );
  }

  @Get('documents')
  async getDocuments(
    @Query('id_permis') id_permis: number,
    @Query('id_typePermis') id_typePermis: number,
  ) {
    return this.fusionPermisService.getDocumentsForFusion(
      id_permis,
      id_typePermis,
    );
  }

  @Get('check')
  async checkExisting(
    @Query('id_principal') id_principal: number,
    @Query('id_secondaire') id_secondaire: number,
  ) {
    if (!id_principal || !id_secondaire) {
      return { exists: false };
    }
    return this.fusionPermisService.findExistingFusion(
      Number(id_principal),
      Number(id_secondaire),
    );
  }

  @Post('union')
  async unionPerimeters(
    @Body()
    body: {
      id_permis_A: number;
      id_permis_B: number;
      id_proc_fusion?: number | null;
      id_permis_resultant?: number | null;
      id_proc_A?: number | null;
      id_proc_B?: number | null;
      source?: string;
      pointsA?: {
        x: number;
        y: number;
        z?: number;
        zone?: number | null;
        hemisphere?: string | null;
        system?: string | null;
      }[];
      pointsB?: {
        x: number;
        y: number;
        z?: number;
        zone?: number | null;
        hemisphere?: string | null;
        system?: string | null;
      }[];
    },
  ) {
    return this.fusionPermisService.fusionnerGeometries(body);
  }
}
