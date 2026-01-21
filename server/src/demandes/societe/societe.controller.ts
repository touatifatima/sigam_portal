import {
  Controller,
  Post,
  Get,
  Body,
  Put,
  Param,
  ParseIntPipe,
  Delete,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { SocieteService } from './societe.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateActionnaireDto } from '../dto/create-actionnaire.dto';
import { EnumTypeFonction } from '@prisma/client';

@Controller('api')
export class SocieteController {
  constructor(
    private readonly societeService: SocieteService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('statuts-juridiques')
  async getAllStatutsJuridiques() {
    return this.prisma.statutJuridiquePortail.findMany({
      orderBy: { code_statut: 'asc' },
    });
  }

  // Detenteur Morale Endpoints
  @Post('detenteur-morale')
  createDetenteur(@Body() data) {
    return this.societeService.createDetenteur(data);
  }

  @Put('detenteur-morale/:id')
  async updateDetenteur(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: any,
  ) {
    // Validate required fields
    if (!data.nom_fr || !data.nom_ar || !parseInt(data.statut_id, 10)) {
      throw new HttpException(
        'Nom FR, Nom AR et Statut sont obligatoires',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.societeService.updateDetenteur(id, {
      nom_fr: data.nom_fr,
      nom_ar: data.nom_ar,
      statut_id: parseInt(data.statut_id, 10),
      tel: data.tel || '',
      email: data.email || '',
      fax: data.fax || '',
      adresse: data.adresse || '',
      id_pays: data.id_pays ? parseInt(data.id_pays, 10) : undefined,
      id_nationalite: data.id_nationalite
        ? parseInt(data.id_nationalite, 10)
        : undefined,
    });
  }

  // Demande Linking (uses detenteurDemande relation)
  @Put('demande/:id/link-detenteur')
  async linkDetenteurToDemande(
    @Param('id', ParseIntPipe) id_demande: number,
    @Body('id_detenteur') id_detenteur: number,
  ) {
    return this.societeService.associateDetenteurWithDemande(
      id_demande,
      id_detenteur,
    );
  }

  // Representant Legal Endpoints
  @Post('representant-legal')
  async createRepresentant(@Body() data) {
    if (!data.id_detenteur) {
      throw new HttpException(
        'id_detenteur is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const personne = await this.societeService.createPersonne(data);
    return this.societeService.linkFonction(
      personne.id_personne,
      data.id_detenteur,
      EnumTypeFonction.Representant,
      'Actif',
      parseFloat(data.taux_participation),
    );
  }

  @Put('representant-legal/:nin')
  async updateRepresentant(@Param('nin') nin: string, @Body() data: any) {
    if (!data.id_detenteur) {
      throw new HttpException(
        'id_detenteur is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.societeService.updateRepresentant(nin, data);
  }

  @Put('representant-legal/by-id/:id_personne')
  async updateRepresentantById(
    @Param('id_personne', ParseIntPipe) id_personne: number,
    @Body() data: any,
  ) {
    if (!data.id_detenteur) {
      throw new HttpException(
        'id_detenteur is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.societeService.updateRepresentantById(id_personne, data);
  }

  // Registre Commerce Endpoints
  @Post('registre-commerce')
  createRegistre(@Body() data) {
    if (!data.id_detenteur) {
      throw new HttpException(
        'id_detenteur is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.societeService.createRegistre(data.id_detenteur, data);
  }
  @Put('registre-commerce/:id')
  updateRegistre(
    @Param('id', ParseIntPipe) id_detenteur: number,
    @Body() data: any,
  ) {
    return this.societeService.updateRegistre(id_detenteur, data);
  }

  // Registres multiples (par ligne)
  @Post('registre-commerce/:id_detenteur/single')
  createRegistreSingle(
    @Param('id_detenteur', ParseIntPipe) id_detenteur: number,
    @Body() data: any,
  ) {
    return this.societeService.createRegistre(id_detenteur, data);
  }

  @Put('registre-commerce/by-id/:id_rc')
  updateRegistreById(
    @Param('id_rc', ParseIntPipe) id_rc: number,
    @Body() data: any,
  ) {
    return this.societeService.updateRegistreById(id_rc, data);
  }

  @Delete('registre-commerce/by-id/:id_rc')
  deleteRegistreById(@Param('id_rc', ParseIntPipe) id_rc: number) {
    return this.societeService.deleteRegistreById(id_rc);
  }

  @Put('actionnaires/:id')
  updateActionnaires(
    @Param('id', ParseIntPipe) id_detenteur: number,
    @Body('actionnaires') actionnaires: CreateActionnaireDto[],
  ) {
    // Validate that each actionnaire has required fields
    for (const [index, actionnaire] of actionnaires.entries()) {
      if (!actionnaire.id_pays) {
        console.error(`Actionnaire ${index + 1} missing id_pays`);
        throw new HttpException(
          `L'actionnaire ${index + 1} doit avoir un pays sélectionné`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    return this.societeService.updateActionnaires(id_detenteur, actionnaires);
  }

  // Actionnaires Endpoints
  @Post('actionnaires')
  createActionnaires(
    @Body('id_detenteur') id_detenteur: number,
    @Body('actionnaires') actionnaires: CreateActionnaireDto[],
  ) {
    return this.societeService.createActionnaires(id_detenteur, actionnaires);
  }

  @Delete('actionnaires/:id_detenteur')
  async deleteActionnaires(@Param('id_detenteur') id_detenteur: number) {
    return this.societeService.deleteActionnaires(+id_detenteur);
  }

  @Get('detenteur-morale/search')
  async searchDetenteurs(@Query('q') query: string) {
    if (!query || query.length < 2) {
      throw new HttpException(
        'Query must be at least 2 characters long',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.societeService.searchDetenteurs(query);
  }

  // Add this endpoint to get complete detenteur data
  @Get('detenteur-morale/:id')
  async getDetenteurById(@Param('id', ParseIntPipe) id: number) {
    return this.societeService.getDetenteurById(id);
  }

  // Add this endpoint to get representant legal
  @Get('representant-legal/:id_detenteur')
  async getRepresentantLegal(
    @Param('id_detenteur', ParseIntPipe) id_detenteur: number,
  ) {
    return this.societeService.getRepresentantLegal(id_detenteur);
  }

  // Add this endpoint to get registre commerce
  @Get('registre-commerce/:id_detenteur')
  async getRegistreCommerce(
    @Param('id_detenteur', ParseIntPipe) id_detenteur: number,
  ) {
    return this.societeService.getRegistreCommerce(id_detenteur);
  }

  // Add this endpoint to get actionnaires
  @Get('actionnaires/:id_detenteur')
  async getActionnaires(
    @Param('id_detenteur', ParseIntPipe) id_detenteur: number,
  ) {
    return this.societeService.getActionnaires(id_detenteur);
  }

  // Single actionnaire CRUD (per-row)
  @Post('actionnaires/:id_detenteur/single')
  createSingleActionnaire(
    @Param('id_detenteur', ParseIntPipe) id_detenteur: number,
    @Body() actionnaire: CreateActionnaireDto,
  ) {
    return this.societeService.createSingleActionnaire(
      id_detenteur,
      actionnaire,
    );
  }

  @Put('actionnaires/:id_detenteur/:id_actionnaire')
  updateSingleActionnaire(
    @Param('id_detenteur', ParseIntPipe) id_detenteur: number,
    @Param('id_actionnaire', ParseIntPipe) id_actionnaire: number,
    @Body() actionnaire: CreateActionnaireDto,
  ) {
    return this.societeService.updateSingleActionnaire(
      id_detenteur,
      id_actionnaire,
      actionnaire,
    );
  }

  @Delete('actionnaires/:id_detenteur/:id_actionnaire')
  deleteSingleActionnaire(
    @Param('id_detenteur', ParseIntPipe) id_detenteur: number,
    @Param('id_actionnaire', ParseIntPipe) id_actionnaire: number,
  ) {
    return this.societeService.deleteSingleActionnaire(
      id_detenteur,
      id_actionnaire,
    );
  }

  // In your SocieteController
  @Put('demande/:id_demande/associate-detenteur')
  async associateDetenteurWithDemande(
    @Param('id_demande', ParseIntPipe) id_demande: number,
    @Body('id_detenteur', ParseIntPipe) id_detenteur: number,
  ) {
    return this.societeService.associateDetenteurWithDemande(
      id_demande,
      id_detenteur,
    );
  }
}