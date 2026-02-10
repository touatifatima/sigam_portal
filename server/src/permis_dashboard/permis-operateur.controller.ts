import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { Permisdashboard2Service } from './permis.service';
import { SessionService } from '../session/session.service';

@Controller('operateur/permis')
export class PermisOperateurController {
  constructor(
    private readonly permisService: Permisdashboard2Service,
    private readonly sessionService: SessionService,
  ) {}

  private async resolveDetenteurId(req: Request): Promise<number> {
    const token = req.cookies?.auth_token;
    if (!token) {
      throw new UnauthorizedException('Session invalide');
    }
    const session = await this.sessionService.validateSession(token);
    const user: any = session?.user;
    if (!user) {
      throw new UnauthorizedException('Utilisateur non authentifie');
    }
    const detenteurId = user.detenteurId ?? user.detenteur?.id_detenteur ?? null;
    if (!detenteurId) {
      throw new BadRequestException('detenteurId manquant pour cet utilisateur');
    }
    return detenteurId;
  }

  @Get()
  async getMesPermis(@Req() req: Request) {
    const detenteurId = await this.resolveDetenteurId(req);
    return this.permisService.findByDetenteur(detenteurId);
  }

  @Get(':id')
  async getPermisDetails(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const detenteurId = await this.resolveDetenteurId(req);
    const permis: any = await this.permisService.findOneWithDetails(id);
    const ownerId = permis?.id_detenteur ?? permis?.detenteur?.id_detenteur ?? null;
    if (!ownerId || ownerId !== detenteurId) {
      throw new NotFoundException(`Permis ${id} non trouve`);
    }
    return permis;
  }

  @Get(':id/documents')
  async getPermisDocuments(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const detenteurId = await this.resolveDetenteurId(req);
    const permis: any = await this.permisService.findOneWithDetails(id);
    const ownerId = permis?.id_detenteur ?? permis?.detenteur?.id_detenteur ?? null;
    if (!ownerId || ownerId !== detenteurId) {
      throw new NotFoundException(`Permis ${id} non trouve`);
    }
    return this.permisService.getAllDocumentsForPermis(id);
  }

  @Get(':id/obligations')
  async getPermisObligations(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const detenteurId = await this.resolveDetenteurId(req);
    const permis: any = await this.permisService.findOneWithDetails(id);
    const ownerId = permis?.id_detenteur ?? permis?.detenteur?.id_detenteur ?? null;
    if (!ownerId || ownerId !== detenteurId) {
      throw new NotFoundException(`Permis ${id} non trouve`);
    }
    return this.permisService.getObligationsForPermis(id);
  }

  @Get(':id/historique')
  async getPermisHistorique(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const detenteurId = await this.resolveDetenteurId(req);
    const permis: any = await this.permisService.findOneWithDetails(id);
    const ownerId = permis?.id_detenteur ?? permis?.detenteur?.id_detenteur ?? null;
    if (!ownerId || ownerId !== detenteurId) {
      throw new NotFoundException(`Permis ${id} non trouve`);
    }
    return this.permisService.getHistorique(id);
  }
}
