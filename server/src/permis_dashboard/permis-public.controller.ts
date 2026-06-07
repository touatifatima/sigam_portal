import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SessionService } from 'src/session/session.service';

@Controller('permis')
export class PermisPublicController {
  constructor(
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

  private async requireAuthenticatedUser(req: any) {
    const token = this.extractAuthToken(req);
    if (!token) {
      throw new UnauthorizedException('Session invalide.');
    }

    const session = await this.sessionService.validateSession(token);
    if (!session?.user) {
      throw new UnauthorizedException('Session expiree ou invalide.');
    }

    return session.user;
  }

  private normalizeCodeQr(value: string) {
    return String(value || '').trim();
  }

  private extractCodePermisCandidate(value: string) {
    const raw = this.normalizeCodeQr(value);
    if (!raw) return '';

    try {
      const parsed = new URL(raw);
      const fromQuery =
        parsed.searchParams.get('codeqr') ||
        parsed.searchParams.get('code_permis') ||
        parsed.searchParams.get('code');
      if (fromQuery) return this.normalizeCodeQr(fromQuery);
      const lastPath = parsed.pathname.split('/').filter(Boolean).pop();
      return this.normalizeCodeQr(lastPath || raw);
    } catch {
      return raw;
    }
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

  private mapPosterieurePermit(permis: any) {
    return {
      id: permis.id,
      short_code: permis.short_code,
      code_permis: permis.code_permis,
      qr_code: permis.qr_code,
      id_detenteur: permis.id_detenteur,
      detenteur: permis.detenteur,
      type_permis: permis.typePermis,
      statut: permis.statut,
      date_octroi: permis.date_octroi,
      date_expiration: permis.date_expiration,
    };
  }

  private async findPermitForPosterieureScan(codeqr: string) {
    const normalized = this.normalizeCodeQr(codeqr);
    if (!normalized) {
      throw new BadRequestException('Le code QR ou le code permis est requis.');
    }

    const candidate = this.extractCodePermisCandidate(normalized);
    const permis = await this.prisma.permisPortail.findFirst({
      where: {
        OR: [
          { qr_code: normalized },
          ...(candidate && candidate !== normalized ? [{ qr_code: candidate }] : []),
          ...(candidate ? [{ code_permis: candidate }] : []),
        ],
      },
      orderBy: { id: 'desc' },
      include: this.getPosterieurePermisInclude(),
    });

    if (!permis) {
      throw new NotFoundException('Aucun permis trouve pour ce code.');
    }

    return permis;
  }

  @Get('verify-posterieure')
  async verifyPosterieurePermit(@Req() req: any, @Query('codeqr') codeqr: string) {
    await this.requireAuthenticatedUser(req);
    const permis = await this.findPermitForPosterieureScan(codeqr);

    return {
      permit: this.mapPosterieurePermit(permis),
    };
  }

  @Get('posterieure-fusion-candidates')
  async getPosterieureFusionCandidates(
    @Req() req: any,
    @Query('permisId') permisIdRaw: string,
  ) {
    await this.requireAuthenticatedUser(req);

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

  @Get('type')
  async getPermisByType(@Query('type') type: string) {
    if (!type) {
      throw new BadRequestException('Le paramètre type est requis');
    }

    const permis = await this.prisma.permisPortail.findMany({
      where: {
        typePermis: { code_type: type.toUpperCase() },
      },
      include: {
        detenteur: true,
        typePermis: true,
        permisProcedure: {
          include: {
            procedure: {
              include: {
                demandes: {
                  include: {
                    detenteurdemande: {
                      include: { detenteur: true },
                      take: 1,
                    },
                  },
                  orderBy: { date_demande: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: {
        date_octroi: 'desc',
      },
    });

    return permis.map((p) => {
      const demandeCourante =
        p.permisProcedure?.[0]?.procedure?.demandes?.[0] ?? null;
      const procDates = (p.permisProcedure || [])
        .map((rel) => rel?.date_octroi_proc)
        .filter((d) => d != null)
        .map((d) => (d instanceof Date ? d : new Date(d)))
        .filter((d) => !isNaN(d.getTime()));
      const latestProcDate =
        procDates.length > 0
          ? new Date(Math.max(...procDates.map((d) => d.getTime())))
          : null;

      return {
        id: p.id,
        code_permis: p.code_permis,
        titulaire:
          p.detenteur?.nom_societeFR ??
          demandeCourante?.detenteurdemande?.[0]?.detenteur?.nom_societeFR ??
          null,
        // La superficie peut être portée par la demande la plus récente
        superficie: (p as any).superficie ?? demandeCourante?.superficie ?? null,
        localisation: p.lieu_ditFR ?? null,
        ressources: null,
        date_octroi:
          latestProcDate || p.date_octroi || demandeCourante?.date_demande || null,
        date_expiration: p.date_expiration || null,
        type: p.typePermis?.code_type ?? null,
      };
    });
  }
}
