import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { OperatorAccessService } from '../operator_access/operator-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from '../session/session.service';

const INVESTISSEUR_ROLE_NAMES = ['investisseur', 'investor', 'user', 'utilisateur'];

const ACTION_TEMPLATES: Record<
  string,
  { label: string; description: string; restrictedByStatus?: boolean }
> = {
  option: {
    label: 'Option-2025',
    description: 'Demander une option sur le perimetre',
  },
  renouvellement: {
    label: 'Renouvellement',
    description: 'Renouveler le permis avant expiration',
  },
  extension: {
    label: 'Extension',
    description: 'Demander une extension du permis',
    restrictedByStatus: true,
  },
  modification: {
    label: 'Modification',
    description: 'Modifier les caracteristiques du permis',
  },
  fusion: {
    label: 'Fusion',
    description: 'Fusionner avec un autre permis',
    restrictedByStatus: true,
  },
  division: {
    label: 'Division',
    description: 'Diviser le perimetre en plusieurs permis',
  },
  transfert: {
    label: 'Transfert',
    description: 'Transferer le permis a un tiers',
  },
  cession: {
    label: 'Cession',
    description: 'Ceder les droits du permis',
  },
  renonciation: {
    label: 'Renonciation',
    description: 'Renoncer au permis',
  },
  retrait: {
    label: 'Retrait',
    description: 'Demander le retrait du permis',
  },
  regularisation: {
    label: 'Regularisation',
    description: 'Regulariser une situation',
  },
};

@Controller('investisseur/access')
export class InvestisseurAccessController {
  constructor(
    private readonly operatorAccessService: OperatorAccessService,
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  private extractAuthToken(req: any): string | null {
    const cookieToken = req?.cookies?.auth_token;
    if (cookieToken) return String(cookieToken);

    const authHeader = req?.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length).trim();
    }
    return null;
  }

  private normalizeRoleName(value?: string | null) {
    return String(value || '').trim().toLowerCase();
  }

  private normalizePermitCode(value?: string | null) {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  private isInvestisseurRole(roleName?: string | null) {
    const normalized = this.normalizeRoleName(roleName);
    if (!normalized) return false;
    if (INVESTISSEUR_ROLE_NAMES.includes(normalized)) return true;
    return normalized.includes('invest');
  }

  private async requireInvestisseur(req: any) {
    const token = this.extractAuthToken(req);
    if (!token) {
      throw new UnauthorizedException('Session invalide.');
    }

    const session = await this.sessionService.validateSession(token);
    const user = session?.user;
    if (!user) {
      throw new UnauthorizedException('Session expiree ou invalide.');
    }
    if (!this.isInvestisseurRole(user.role?.name)) {
      throw new ForbiddenException('Acces reserve aux investisseurs.');
    }

    return user;
  }

  private normalizeSearchValue(value?: string | null) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private resolveActionIdFromTypeProcedure(libelle?: string | null): string | null {
    const lower = this.normalizeSearchValue(libelle);
    if (!lower) return null;
    if (lower.includes('option')) return 'option';
    if (lower.includes('renouv')) return 'renouvellement';
    if (lower.includes('extension') || lower.includes('modif')) return 'extension';
    if (lower.includes('fusion')) return 'fusion';
    if (lower.includes('division')) return 'division';
    if (lower.includes('transfert') || lower.includes('transfer') || lower.includes('transf')) {
      return 'transfert';
    }
    if (lower.includes('cession') || lower.includes('ces')) return 'cession';
    if (lower.includes('renonc')) return 'renonciation';
    if (lower.includes('retrait') || lower.includes('annulation') || lower.includes('annul')) {
      return 'retrait';
    }
    if (lower.includes('regular')) return 'regularisation';
    return null;
  }

  private isPermitStatusActionable(permit: any) {
    const exp = permit?.date_expiration ? new Date(permit.date_expiration) : null;
    if (exp && !Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
      return false;
    }

    const statut = this.normalizeSearchValue(permit?.statut?.lib_statut);
    return !(
      statut.includes('renouvel') ||
      statut.includes('annul') ||
      statut.includes('revoq') ||
      statut.includes('retir')
    );
  }

  private mapPermitForInvestisseur(permit: any, detenteur?: any) {
    const mappedTypePermis = permit?.type_permis || permit?.typePermis || null;
    const mappedStatut = permit?.statut || null;

    return {
      id: permit?.id,
      short_code: permit?.short_code ?? null,
      code_permis: permit?.code_permis ?? null,
      qr_code: permit?.qr_code ?? null,
      id_detenteur: permit?.id_detenteur ?? null,
      type_permis: mappedTypePermis
        ? {
            id: mappedTypePermis.id,
            lib_type: mappedTypePermis.lib_type,
            code_type: mappedTypePermis.code_type,
          }
        : null,
      statut: mappedStatut
        ? {
            id: mappedStatut.id ?? null,
            lib_statut: mappedStatut.lib_statut ?? null,
          }
        : null,
      date_octroi: permit?.date_octroi ?? null,
      date_expiration: permit?.date_expiration ?? null,
      detenteur: detenteur
        ? {
            id_detenteur: detenteur.id_detenteur ?? permit?.id_detenteur ?? null,
            short_code: detenteur.short_code ?? null,
            nom: detenteur.nom ?? null,
            email: detenteur.email ?? null,
            telephone: detenteur.telephone ?? null,
          }
        : null,
    };
  }

  private async resolveActionsForPermit(permit: any) {
    const typePermisId = Number(permit?.type_permis?.id);
    if (!Number.isFinite(typePermisId) || typePermisId <= 0) {
      return [];
    }

    const combinations = await this.prisma.combinaisonPermisProc.findMany({
      where: { id_typePermis: typePermisId },
      include: { typeProc: true },
      orderBy: [{ id_typeProc: 'asc' }],
    });

    const actionableByStatus = this.isPermitStatusActionable(permit);
    const byId = new Map<string, { id: string; label: string; description: string; available: boolean }>();

    combinations.forEach((combination) => {
      const actionId = this.resolveActionIdFromTypeProcedure(combination.typeProc?.libelle);
      if (!actionId || byId.has(actionId)) return;

      const template = ACTION_TEMPLATES[actionId];
      if (!template) return;

      byId.set(actionId, {
        id: actionId,
        label: template.label,
        description: combination.typeProc?.description || template.description,
        available: template.restrictedByStatus ? actionableByStatus : actionId !== 'retrait',
      });
    });

    return Array.from(byId.values());
  }

  private getPosterieurePermisInclude() {
    return {
      detenteur: {
        select: {
          id_detenteur: true,
          nom_societeFR: true,
          nom_societeAR: true,
        },
      },
      typePermis: {
        select: {
          id: true,
          lib_type: true,
          code_type: true,
        },
      },
      statut: {
        select: {
          id: true,
          lib_statut: true,
        },
      },
    } as const;
  }

  @Get()
  async getInvestisseurAccess(
    @Req() req: any,
    @Query('codeqr') codeqr: string,
    @Query('codePermis') codePermis?: string,
  ) {
    await this.requireInvestisseur(req);
    const normalizedCodePermis = this.normalizePermitCode(codePermis);
    if (!normalizedCodePermis) {
      throw new BadRequestException('Le code permis est requis.');
    }

    const context = await this.operatorAccessService.getAccessContext(codeqr);
    const permit = context?.permit;
    const detenteur = context?.detenteur;
    const normalizedPermitCode = this.normalizePermitCode(permit?.code_permis);
    if (!normalizedPermitCode || normalizedPermitCode !== normalizedCodePermis) {
      throw new NotFoundException('Le code QR et le code permis ne correspondent pas.');
    }

    return {
      permit: this.mapPermitForInvestisseur(permit, detenteur),
      actions: await this.resolveActionsForPermit(permit),
    };
  }

  @Get('posterieure-fusion-candidates')
  async getInvestisseurPosterieureFusionCandidates(
    @Req() req: any,
    @Query('permisId') permisIdRaw: string,
  ) {
    const user = await this.requireInvestisseur(req);

    const permisId = Number(permisIdRaw);
    if (!Number.isFinite(permisId) || permisId <= 0) {
      throw new BadRequestException('permisId invalide.');
    }

    const current = await this.prisma.permisPortail.findUnique({
      where: { id: permisId },
      select: { id: true, id_detenteur: true },
    });

    if (!current) {
      throw new NotFoundException(`Permis ${permisId} introuvable.`);
    }
    if (!current.id_detenteur) {
      throw new BadRequestException('Le permis scanne ne possede pas de detenteur.');
    }

    const userDetenteurId =
      Number.isFinite(Number((user as any)?.detenteurId)) && Number((user as any)?.detenteurId) > 0
        ? Number((user as any).detenteurId)
        : null;
    if (userDetenteurId && userDetenteurId !== Number(current.id_detenteur)) {
      throw new ForbiddenException(
        "Le detenteur du compte investisseur ne correspond pas au detenteur du permis scanne.",
      );
    }

    const candidates = await this.prisma.permisPortail.findMany({
      where: {
        id_detenteur: current.id_detenteur,
        id: { not: current.id },
      },
      include: this.getPosterieurePermisInclude(),
      orderBy: { date_octroi: 'desc' },
    });

    return candidates.map((p) => ({
      id: p.id,
      code_permis: String(p.code_permis ?? `PERMIS-${p.id}`),
      type_label: String(p.typePermis?.lib_type ?? p.typePermis?.code_type ?? '--'),
    }));
  }
}
