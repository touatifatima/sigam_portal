import {
  Controller,
  Post,
  Body,
  Put,
  Param,
  Get,
  ParseIntPipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { DemandeService } from './demande.service';
import { RequirePermissions } from 'src/auth/require-permissions.dto';
import { UpdateDemandeDto } from './update-demande.dto';
import { Req } from '@nestjs/common';
import { SessionService } from 'src/session/session.service';


@Controller('demandes')
export class DemandesController {
  constructor(
    private readonly demandeService: DemandeService,
    private readonly sessionService: SessionService,
  ) {}

  @Put(':id')
  async updateDemande(
    @Param('id') id: string,
    @Body() updateDemandeDto: UpdateDemandeDto,
  ) {
    return this.demandeService.update(+id, updateDemandeDto);
  }
////////////// Get demandes for the currently authenticated user
  @Get('mes-demandes')
  async getMesDemandes(@Req() req: any) {
    const token = req.cookies?.auth_token;
    if (!token) {
      throw new HttpException('Non authentifie', HttpStatus.UNAUTHORIZED);
    }
    const session = await this.sessionService.validateSession(token);
    if (!session?.user?.id) {
      throw new HttpException('Session invalide', HttpStatus.UNAUTHORIZED);
    }
    return this.demandeService.findByUserId(session.user.id);
  }

  @Get(':id')
  async getDemande(@Param('id', ParseIntPipe) id: number) {
    return this.demandeService.findById(id);
  }

  @Put(':id/expert')
  async attachExpertToDemande(
    @Param('id') id: string,
    @Body()
    body: {
      nom_expert: string;
      num_agrement: string;
      etat_agrement: string;
      specialisation: string;
      date_agrement: Date;
    },
  ) {
    const id_demande = parseInt(id, 10);
    const expert = await this.demandeService.createOrFindExpert(body);
    const updated = await this.demandeService.attachExpertToDemande(
      id_demande,
      expert.id_expert,
    );
    return updated;
  }

  @Post()
  async createDemande(
    @Body()
    body: {
      id: number;
      id_typepermis: number;
      objet_demande: string;
      code_demande?: string;
      id_detenteur?: number;
      nom_responsable?: string;
    },
  ) {
    const userId = body.id;
    const demande = await this.demandeService.createDemande({
      id_typepermis: body.id_typepermis,
      objet_demande: body.objet_demande,
      code_demande: body.code_demande,
      id_detenteur: body.id_detenteur,
      nom_responsable: body.nom_responsable,
      utilisateurId: userId,
    });

    return demande;
  }

  // Final deposit: set official date_demande and final code
  @Post(':id/deposer')
  async deposer(@Param('id', ParseIntPipe) id: number) {
    return this.demandeService.deposerDemande(id);
  }

  @Post('generate-code')
  @RequirePermissions('create_demande')
  async generateCode(@Body() body: { id_typepermis: number }) {
    return this.demandeService.generateCode(body.id_typepermis);
  }
}
