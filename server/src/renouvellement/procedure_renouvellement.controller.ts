import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  ValidationPipe,
} from '@nestjs/common';
import { ProcedureRenouvellementService } from './procedure_renouvellemnt.service';
import { CreateRenewalDto } from './create-renouvellement.dto';
import { PaymentService } from 'src/demandes/paiement/payment.service';
import { StatutProcedure } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { SessionService } from 'src/session/session.service';

@Controller('api/procedures')
export class ProcedureRenouvellementController {
  constructor(
    private readonly proceduresService: ProcedureRenouvellementService,
    private readonly paymentService: PaymentService,
    private readonly prisma: PrismaService,
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

  @Get(':id/renouvellement')
  async getRenewalData(@Param('id') id: string) {
    return this.proceduresService.getRenewalData(+id);
  }

  // Dernier périmètre accepté pour le permis lié
  @Get('renouvellement/perimetre/latest')
  async getLatestPerimeter(@Query('permisId') permisId?: string) {
    if (!permisId) {
      throw new BadRequestException('permisId requis');
    }
    return this.proceduresService.getLatestAcceptedPerimeter(Number(permisId));
  }

  // Liste des perimetres (toutes procedures du permis)
  @Get('renouvellement/perimetre/list')
  async listPerimeters(@Query('permisId') permisId?: string) {
    if (!permisId) {
      throw new BadRequestException('permisId requis');
    }
    return this.proceduresService.listPerimetersByPermis(Number(permisId));
  }

  // Enregistrer un nouveau périmètre pour la procédure de renouvellement
  @Post('renouvellement/:id/perimetres')
  async saveRenewalPerimeter(
    @Param('id') id: string,
    @Body() body: { points: any[]; commentaires?: string },
  ) {
    if (!body?.points || !Array.isArray(body.points) || body.points.length < 3) {
      throw new BadRequestException('Au moins trois points sont requis');
    }
    return this.proceduresService.saveRenewalPerimeter(Number(id), body);
  }

  @Post('renouvellement/:id/finalize-permis')
  async finalizeRenewalPermis(@Param('id') id: string) {
    return this.proceduresService.finalizeRenewalPermis(Number(id));
  }

  @Post(':id/renouvellement')
  async createOrUpdateRenewal(
    @Param('id') id: string,
    @Body() renewalData: any,
  ) {
    return this.proceduresService.createOrUpdateRenewal(+id, renewalData);
  }

  @Get('type/:id/permit-type-details')
  async getPermitTypeDetails(@Param('id') id: string) {
    return this.proceduresService.getPermitTypeDetails(+id);
  }

  @Get(':id/renewals')
  async getPermisRenewals(@Param('id') id: string) {
    return this.proceduresService.getPermisRenewals(+id);
  }

  @Get(':id')
  async getProcedure(@Param('id') id: string) {
    return this.proceduresService.getProcedureWithType(+id);
  }

  @Post('renouvellement/start')
  async startRenewal(@Req() req: any, @Body() dto: CreateRenewalDto) {
    const userId = await this.resolveAuthenticatedUserId(req);
    return this.proceduresService.startRenewalWithOriginalData(
      dto.permisId,
      dto.date_demande,
      StatutProcedure.EN_COURS,
      userId,
    );
  }

  @Post('renouvellement/check-payments')
  async checkPayments(@Body() body: { permisId: number }) {
    const { isPaid, missing } =
      await this.paymentService.checkAllObligationsPaid(body.permisId);

    const permit = await this.prisma.permisPortail.findUnique({
      where: { id: body.permisId },
      include: {
        typePermis: true,
        permisProcedure: {
          include: {
            procedure: {
              include: {
                demandes: {
                  include: {
                    renouvellement: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!permit) {
      throw new NotFoundException('Permis non trouvé');
    }

    const procedures =
      permit.permisProcedure
        ?.map((relation) => relation.procedure)
        .filter(
          (procedure): procedure is NonNullable<typeof procedure> =>
            !!procedure,
        ) ?? [];

    const renewalCount = procedures.reduce((count, procedure) => {
      const demandes = procedure.demandes || [];
      return (
        count + demandes.filter((demande) => demande.renouvellement).length
      );
    }, 0);

    if (renewalCount >= permit.typePermis.nbr_renouv_max!) {
      throw new BadRequestException(
        `Nombre maximum de renouvellements (${permit.typePermis.nbr_renouv_max}) atteint pour ce permis`,
      );
    }

    if (!isPaid) {
      const message = missing
        .map((m) => `- Obligation ${m}`)
        .join('\n');
      throw new BadRequestException({ message: `Renouvellement bloque :\n${message}`, unpaid: missing, });
    }

    return {
      ok: true,
      currentRenewals: renewalCount,
      maxRenewals: permit.typePermis.nbr_renouv_max,
    };
  }

  @Get(':id/permis')
  async getProcedurePermis(@Param('id') id: string) {
    return this.proceduresService.getPermisForProcedure(+id);
  }
}
