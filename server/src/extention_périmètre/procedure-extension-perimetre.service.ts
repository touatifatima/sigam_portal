import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatutCoord, StatutProcedure } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { buildDemandeCode } from 'src/demandes/utils/demande-code';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class ProcedureExtensionPerimetreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async startExtensionWithOriginalData(
    permisId: number,
    date_demande: string,
    statut: StatutProcedure,
  ) {
    if (!date_demande || Number.isNaN(Date.parse(date_demande))) {
      throw new BadRequestException('La date de la demande est invalide.');
    }

    const permis = await this.prisma.permisPortail.findUnique({
      where: { id: permisId },
      include: {
        typePermis: true,
        permisProcedure: {
          include: {
            procedure: {
              include: {
                demandes: { include: { typeProcedure: true } },
              },
            },
          },
        },
      },
    });

    const procedures =
      permis?.permisProcedure
        ?.map((r) => r.procedure)
        .filter((p): p is NonNullable<typeof p> => !!p)
        .sort((a, b) => {
          const da = a.date_debut_proc ? new Date(a.date_debut_proc).getTime() : 0;
          const db = b.date_debut_proc ? new Date(b.date_debut_proc).getTime() : 0;
          return da - db;
        }) ?? [];

    if (!permis || procedures.length === 0) {
      throw new NotFoundException('Aucune procedure initiale trouvee pour ce permis.');
    }

    const initialProcedure = procedures[0];
    const initialDemande = initialProcedure.demandes?.[0];
    if (!initialDemande?.utilisateurId) {
      throw new BadRequestException('utilisateurId introuvable pour la demande initiale.');
    }

    const typeProc = await this.prisma.typeProcedure.findFirst({
      where: { libelle: { contains: 'extension', mode: 'insensitive' } },
    });
    if (!typeProc) {
      throw new NotFoundException('TypeProcedure "extension" introuvable');
    }

    const codeType = permis.typePermis?.code_type ?? 'UNK';
    const procCount = await this.prisma.procedurePortail.count({
      where: { demandes: { some: { id_typePermis: permis.id_typePermis } } },
    });

    const baseNumProc = `PROC-${codeType}-${procCount + 1}`;
    let newProcedure: { id_proc: number; num_proc: string | null } | null = null;
    let attempt = 0;

    while (!newProcedure && attempt < 3) {
      const candidateNum = attempt === 0 ? baseNumProc : `${baseNumProc}-E${attempt}`;
      try {
        newProcedure = await this.prisma.procedurePortail.create({
          data: {
            num_proc: candidateNum,
            date_debut_proc: new Date(),
            statut_proc: statut,
          },
          select: { id_proc: true, num_proc: true },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          attempt += 1;
          if (attempt >= 3) {
            newProcedure = await this.prisma.procedurePortail.create({
              data: {
                num_proc: `PROC-${codeType}-${Date.now()}`,
                date_debut_proc: new Date(),
                statut_proc: statut,
              },
              select: { id_proc: true, num_proc: true },
            });
          }
          continue;
        }
        throw err;
      }
    }

    if (!newProcedure?.id_proc) {
      throw new InternalServerErrorException('Creation de procedure impossible');
    }

    await this.prisma.permisProcedure.create({
      data: { id_permis: permis.id, id_proc: newProcedure.id_proc },
    });

    const parsedDate = new Date(date_demande);
    const detenteurId = Number(permis.id_detenteur);
    const resolvedDetenteurId =
      Number.isFinite(detenteurId) && detenteurId > 0 ? detenteurId : null;
    const newDemande = await this.prisma.demandePortail.create({
      data: {
        utilisateurId: initialDemande.utilisateurId,
        id_proc: newProcedure.id_proc,
        id_typePermis: permis.id_typePermis,
        id_typeProc: typeProc.id,
        code_demande: null,
        statut_demande: 'EN_COURS',
        date_demande: parsedDate,
        date_instruction: new Date(),
        ...(resolvedDetenteurId
          ? {
              detenteurdemande: {
                create: {
                  id_detenteur: resolvedDetenteurId,
                  role_detenteur: 'principal',
                },
              },
            }
          : {}),
      },
    });

    const generatedCode = buildDemandeCode('EXT', codeType, newDemande.id_demande);

    await this.prisma.demandePortail.update({
      where: { id_demande: newDemande.id_demande },
      data: {
        code_demande: generatedCode,
      },
      select: { id_demande: true },
    });

    // L'extension est gérée comme une modification métier:
    // on garde une trace dans dem_modification_portail dès la création.
    await this.prisma.demModification.upsert({
      where: { id_demande: newDemande.id_demande },
      update: {
        type_modification: 'EXTENSION_PERIMETRE',
        type_modif: 'EXTENSION',
        statut_modification: 'EN_COURS',
      },
      create: {
        id_demande: newDemande.id_demande,
        type_modification: 'EXTENSION_PERIMETRE',
        type_modif: 'EXTENSION',
        statut_modification: 'EN_COURS',
      },
    });

    try {
      await this.notificationsService.createAdminNewDemandeNotification({
        demandeId: newDemande.id_demande,
        demandeCode: generatedCode,
        requesterUserId: initialDemande.utilisateurId,
      });
    } catch (error) {
      console.warn(
        'Failed to create admin notification for extension demande',
        error,
      );
    }

    return {
      original_demande_id: initialDemande.id_demande,
      original_proc_id: initialProcedure.id_proc,
      new_proc_id: newProcedure.id_proc,
      new_demande_id: newDemande.id_demande,
    };
  }

  async getLatestAcceptedPerimeter(permisId: number) {
    let proc = await this.prisma.procedurePortail.findFirst({
      where: {
        statut_proc: 'TERMINEE',
        demandes: { some: { statut_demande: 'ACCEPTEE' } },
        permisProcedure: { some: { id_permis: permisId } },
      },
      orderBy: { date_debut_proc: 'desc' },
      include: { demandes: true },
    });

    const toNumberSafe = (value: any): number => {
      if (typeof value === 'number') return value;
      if (value == null) return Number.NaN;
      const raw = String(value).trim();
      if (!raw) return Number.NaN;
      const cleaned = raw.replace(/[\s\u00A0\u202F]/g, '').replace(',', '.');
      const num = Number(cleaned);
      return Number.isFinite(num) ? num : Number.NaN;
    };

    const normalizePoint = (
      raw: any,
      fallback?: { system?: string | null; zone?: number | null; hemisphere?: string | null },
    ) => ({
      id: raw?.id_coordonnees ?? raw?.id ?? null,
      x: toNumberSafe(raw?.x ?? raw?.X),
      y: toNumberSafe(raw?.y ?? raw?.Y),
      z: raw?.z != null ? Number(raw.z) : null,
      zone: raw?.zone ?? fallback?.zone ?? null,
      hemisphere: raw?.hemisphere ?? fallback?.hemisphere ?? null,
      system: raw?.system ?? fallback?.system ?? 'UTM',
    });

    const filterValid = (pts: Array<{ x: number; y: number }>) =>
      pts.filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));

    const loadPoints = async (procId: number) => {
      const provisional = await this.prisma.inscriptionProvisoirePortail.findUnique({
        where: { id_proc: procId },
      });
      const provisionalPoints = Array.isArray(provisional?.points)
        ? filterValid(provisional.points.map((p: any) => normalizePoint(p, provisional)))
        : [];
      if (provisionalPoints.length >= 3) return provisionalPoints;

      const coords = await this.prisma.procedureCoord.findMany({
        where: { id_proc: procId },
        include: { coordonnee: true },
        orderBy: { id_coordonnees: 'asc' },
      });
      return filterValid(
        coords.map((c) =>
          normalizePoint(c.coordonnee, {
            system: c.coordonnee?.system ?? 'UTM',
            zone: c.coordonnee?.zone ?? null,
            hemisphere: (c.coordonnee?.hemisphere as string | null) ?? null,
          }),
        ),
      );
    };

    let points = proc ? await loadPoints(proc.id_proc) : [];
    if (!proc || points.length < 3) {
      const candidates = await this.prisma.procedurePortail.findMany({
        where: { permisProcedure: { some: { id_permis: permisId } } },
        orderBy: { date_debut_proc: 'desc' },
        select: { id_proc: true, num_proc: true, statut_proc: true },
      });
      for (const candidate of candidates) {
        const candidatePoints = await loadPoints(candidate.id_proc);
        if (candidatePoints.length >= 3) {
          proc = candidate as any;
          points = candidatePoints;
          break;
        }
      }
    }

    if (!proc || points.length < 3) {
      throw new NotFoundException(`No perimeter found for permit ${permisId}`);
    }

    const orderedPoints = points.map((pt, idx) => ({ ...pt, order: idx + 1 }));
    const areaHa = this.computeAreaHa(orderedPoints);

    return {
      procedure: {
        id_proc: proc.id_proc,
        num_proc: proc.num_proc,
        statut_proc: proc.statut_proc,
      },
      points: orderedPoints,
      areaHa,
    };
  }

  async listPerimetersByPermis(permisId: number) {
    const procedures = await this.prisma.procedurePortail.findMany({
      where: { permisProcedure: { some: { id_permis: permisId } } },
      orderBy: { id_proc: 'desc' },
    });

    const withCoords = await Promise.all(
      procedures.map(async (proc) => {
        const coords = await this.prisma.procedureCoord.findMany({
          where: { id_proc: proc.id_proc },
          include: { coordonnee: true },
          orderBy: { id_coordonnees: 'asc' },
        });
        const points =
          coords.map((pc, idx) => ({
            id: pc.id_coordonnees,
            x: Number(pc.coordonnee?.x),
            y: Number(pc.coordonnee?.y),
            z: pc.coordonnee?.z,
            zone: pc.coordonnee?.zone ?? null,
            hemisphere: (pc.coordonnee?.hemisphere as 'N' | null) ?? null,
            system: (pc.coordonnee?.system as string) ?? 'UTM',
            order: idx + 1,
          })) || [];

        return {
          id_proc: proc.id_proc,
          num_proc: proc.num_proc,
          statut_proc: proc.statut_proc,
          points,
          areaHa: this.computeAreaHa(points),
        };
      }),
    );

    return withCoords;
  }

  async saveExtensionPerimeter(procId: number, payload: { points: any[]; commentaires?: string }) {
    const link = await this.prisma.permisProcedure.findFirst({
      where: { id_proc: procId },
    });
    if (!link?.id_permis) {
      throw new NotFoundException(`Aucun permis associe a la procedure ${procId}`);
    }

    const normalizedPoints = (payload.points || [])
      .map((pt) => ({
        x: Number(pt.x),
        y: Number(pt.y),
        z: pt.z != null ? Number(pt.z) : 0,
        zone: pt.zone != null ? Number(pt.zone) : null,
        hemisphere: pt.hemisphere ?? 'N',
        system: pt.system ?? 'UTM',
      }))
      .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));

    if (normalizedPoints.length < 3) {
      throw new BadRequestException('Au moins trois points valides sont requis');
    }

    const incomingAreaHa = this.computeAreaHa(normalizedPoints);
    let baseAreaHa: number | null = null;

    try {
      const latest = await this.getLatestAcceptedPerimeter(link.id_permis);
      if (typeof latest?.areaHa === 'number' && Number.isFinite(latest.areaHa)) {
        baseAreaHa = latest.areaHa;
      }
    } catch {}

    if (!baseAreaHa || baseAreaHa <= 0) {
      try {
        const permit = await this.prisma.permisPortail.findUnique({
          where: { id: link.id_permis },
          select: { superficie: true },
        });
        if (typeof permit?.superficie === 'number' && Number.isFinite(permit.superficie)) {
          baseAreaHa = permit.superficie;
        }
      } catch {}
    }

    if (typeof baseAreaHa === 'number' && Number.isFinite(baseAreaHa) && baseAreaHa > 0) {
      const tolerance = Math.max(0.01, baseAreaHa * 0.001);
      if (incomingAreaHa <= baseAreaHa + tolerance) {
        throw new BadRequestException(
          `La superficie etendue (${incomingAreaHa.toFixed(2)} ha) doit etre superieure a la superficie initiale (${baseAreaHa.toFixed(2)} ha).`,
        );
      }
    }

    await this.prisma.procedureCoord.deleteMany({ where: { id_proc: procId } });

    const createdCoords: { x: number; y: number; z: number; zone: number | null; hemisphere: string | null; system: string | null }[] = [];
    for (const pt of normalizedPoints) {
      const coord = await this.prisma.coordonneePortail.create({
        data: {
          x: pt.x,
          y: pt.y,
          z: pt.z,
          zone: pt.zone ?? null,
          hemisphere: pt.hemisphere ?? 'N',
          system: pt.system ?? 'UTM',
        },
      });
      createdCoords.push(coord);
      await this.prisma.procedureCoord.create({
        data: {
          id_proc: procId,
          id_coordonnees: coord.id_coordonnees,
          statut_coord: StatutCoord.NOUVEAU,
        },
      });
    }

    const areaHa = this.computeAreaHa(
      createdCoords.map((c) => ({
        x: Number(c.x),
        y: Number(c.y),
      })),
    );

    try {
      const demande = await this.prisma.demandePortail.findFirst({
        where: { id_proc: procId },
        select: { id_demande: true },
      });
      if (demande?.id_demande) {
        await this.prisma.demandePortail.update({
          where: { id_demande: demande.id_demande },
          data: { superficie: areaHa },
          select: { id_demande: true },
        });
      }
    } catch (err) {
      console.warn('Failed to update demande superficie (extension)', err);
    }

    return {
      message: 'Perimetre d extension enregistre',
      count: createdCoords.length,
      areaHa,
      baseAreaHa,
    };
  }

  private computeAreaHa(points: { x?: number | null; y?: number | null }[]): number {
    const coords = points
      .map((p) => [Number(p.x), Number(p.y)] as [number, number])
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    if (coords.length < 3) return 0;
    const ring =
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1]
        ? coords
        : [...coords, coords[0]];

    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      sum += x1 * y2 - x2 * y1;
    }

    const areaM2 = Math.abs(sum) / 2;
    const areaHa = areaM2 / 10000;
    return Math.round(areaHa * 100) / 100;
  }
}
