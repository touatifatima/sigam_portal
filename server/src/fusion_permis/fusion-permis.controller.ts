import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  BadRequestException,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { FusionPermisService } from './fusion-permis.service';
import { SessionService } from 'src/session/session.service';

@Controller('api/fusion-permis')
export class FusionPermisController {
  constructor(
    private readonly fusionPermisService: FusionPermisService,
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

  @Post('fusionner')
  async fusionner(
    @Req() req: any,
    @Body()
    body: {
      id_principal: number;
      id_secondaire: number;
      motif_fusion: string;
      utilisateurId?: number;
    },
  ) {
    const userId = await this.resolveAuthenticatedUserId(req);
    return this.fusionPermisService.fusionner(
      body.id_principal,
      body.id_secondaire,
      body.motif_fusion,
      userId,
    );
  }

  // Compatibilité avec les anciens écrans qui appellent fusionner en GET
  @Get('fusionner')
  async fusionnerGet(
    @Req() req: any,
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
    const userId = await this.resolveAuthenticatedUserId(req);
    return this.fusionPermisService.fusionner(
      principal,
      secondaire,
      motifFusion || '',
      userId,
    );
  }

  // Alias pour compatibilité avec l'ancien appel frontend "fusionnerContinuer"
  @Post('fusionnerContinuer')
  async fusionnerContinuer(
    @Req() req: any,
    @Body()
    body: {
      id_principal: number;
      id_secondaire: number;
      motif_fusion?: string;
      utilisateurId?: number;
    },
  ) {
    const userId = await this.resolveAuthenticatedUserId(req);
    return this.fusionPermisService.fusionner(
      body.id_principal,
      body.id_secondaire,
      body.motif_fusion || '',
      userId,
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
