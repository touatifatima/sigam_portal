import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRenewalDto } from './create-renouvellement.dto';
import { PaymentService } from 'src/demandes/paiement/payment.service';
import { Prisma, ProcedureRenouvellement, StatutCoord, StatutProcedure } from '@prisma/client';
import { ProcedureEtapeService } from '../procedure_etape/procedure-etape.service';
import { StatutPermis } from './types';
import { buildDemandeCode } from 'src/demandes/utils/demande-code';

@Injectable()
export class ProcedureRenouvellementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly procedureEtapeService: ProcedureEtapeService,
  ) {}

  async startRenewalWithOriginalData(
    permisId: number,
    date_demande: string,
    statut: StatutProcedure,
  ) {
    const now = new Date();

    if (!date_demande || isNaN(Date.parse(date_demande))) {
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
                demandes: {
                  include: { typeProcedure: true },
                },
              },
            },
          },
        },
      },
    });

    const procedures =
      permis?.permisProcedure
        ?.map((relation) => relation.procedure)
        .filter((proc): proc is NonNullable<typeof proc> => !!proc)
        .sort((a, b) => {
          const dateA = a.date_debut_proc
            ? new Date(a.date_debut_proc).getTime()
            : 0;
          const dateB = b.date_debut_proc
            ? new Date(b.date_debut_proc).getTime()
            : 0;
          return dateA - dateB;
        }) ?? [];

    if (!permis || procedures.length === 0) {
      throw new NotFoundException(
        'Aucune procedure initiale trouvee pour ce permis.',
      );
    }

    const initialProcedure = procedures[0];
    const initialDemande = initialProcedure.demandes[0];

    const typeProc = await this.prisma.typeProcedure.findFirst({
      where: { libelle: { contains: 'renouvellement', mode: 'insensitive' } },
    });

    if (!typeProc) {
      throw new NotFoundException('TypeProcedure "renouvellement" introuvable');
    }

    // Generate codes based on permit type
    const codeType = permis.typePermis?.code_type ?? 'UNK';

    const procCount = await this.prisma.procedurePortail.count({
      where: {
        demandes: {
          some: {
            id_typePermis: permis.id_typePermis,
          },
        },
      },
    });

    const baseNumProc = `PROC-${codeType}-${procCount + 1}`;
    let newProcedure: { id_proc: number; num_proc: string | null } | null = null;
    let attempt = 0;
    while (!newProcedure && attempt < 3) {
      const candidateNum =
        attempt === 0 ? baseNumProc : `${baseNumProc}-R${attempt}`;
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
      data: {
        id_permis: permis.id,
        id_proc: newProcedure.id_proc,
      },
    });

    const parsedDate = new Date(date_demande);

    if (!initialDemande?.utilisateurId) {
      throw new BadRequestException('utilisateurId introuvable pour la demande initiale.');
    }

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
      },
    });

    await this.prisma.demandePortail.update({
      where: { id_demande: newDemande.id_demande },
      data: {
        code_demande: buildDemandeCode('RNV', codeType, newDemande.id_demande),
      },
      select: { id_demande: true },
    });

    await this.prisma.procedureRenouvellement.create({
      data: {
        id_demande: newDemande.id_demande,
      },
    });

    return {
      original_demande_id: initialDemande?.id_demande,
      original_proc_id: initialProcedure?.id_proc,
      new_proc_id: newProcedure.id_proc,
      new_demande_id: newDemande.id_demande,
    };
  }

  async getPermisForProcedure(procedureId: number) {
    const relation = await this.prisma.permisProcedure.findFirst({
      where: { id_proc: procedureId },
      include: {
        permis: {
          include: {
            typePermis: true,
            statut: true,
          },
        },
      },
    });
    return relation?.permis || null;
  }

  async createOrUpdateRenewal(procedureId: number, renewalData: any) {
    const procedure = await this.prisma.procedurePortail.findUnique({
      where: { id_proc: procedureId },
      include: {
        permisProcedure: {
          include: {
            permis: {
              include: {
                typePermis: true,
              },
            },
          },
        },
        demandes: true,
      },
    });

    if (!procedure) throw new NotFoundException('Procedure not found');

    const permit = procedure.permisProcedure?.[0]?.permis;
    if (!permit) throw new NotFoundException('Permit not found');

    const permitType = permit.typePermis;
    if (!permitType) throw new NotFoundException('Permit type not found');

    const demande = procedure.demandes[0];
    if (!demande) throw new NotFoundException('Demande not found');

    const startDate = new Date(renewalData.date_debut_validite);
    const endDate = new Date(renewalData.date_fin_validite);
    const decisionDate = this.normalizeOptionalDate(
      renewalData.date_decision,
      'date_decision',
    );

    const updatePayload = {
      num_decision: renewalData.num_decision,
      ...(decisionDate !== undefined ? { date_decision: decisionDate } : {}),
      date_debut_validite: startDate,
      date_fin_validite: endDate,
      commentaire: renewalData.commentaire,
    };

    const createPayload = {
      id_demande: demande.id_demande,
      ...updatePayload,
    };

    return this.prisma.$transaction(async (tx) => {
      const permitSnapshot = await tx.permisPortail.findUnique({
        where: { id: permit.id },
        select: { nombre_renouvellements: true },
      });
      const currentRenewalCount = permitSnapshot?.nombre_renouvellements ?? 0;

      if (currentRenewalCount >= (permitType.nbr_renouv_max ?? 0)) {
        throw new BadRequestException(
          `Maximum renewals (${permitType.nbr_renouv_max ?? 0}) reached`,
        );
      }

      let renewalRecord: ProcedureRenouvellement | null = null;
      const updateResult = await tx.procedureRenouvellement.updateMany({
        where: {
          id_demande: demande.id_demande,
          date_debut_validite: null,
          date_fin_validite: null,
        },
        data: updatePayload,
      });

      if (updateResult.count === 1) {
        renewalRecord = await tx.procedureRenouvellement.findUnique({
          where: { id_demande: demande.id_demande },
        });
      } else {
        try {
          renewalRecord = await tx.procedureRenouvellement.create({
            data: createPayload,
          });
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
          ) {
            throw new ConflictException(
              'Renouvellement deja confirme pour cette procedure.',
            );
          }
          throw err;
        }
      }

      if (!renewalRecord) {
        throw new InternalServerErrorException(
          'Failed to persist renewal confirmation.',
        );
      }

      await tx.permisPortail.update({
        where: { id: permit.id },
        data: {
          date_expiration: endDate,
          nombre_renouvellements: currentRenewalCount + 1,
        },
      });

      return renewalRecord;
    });
  }

  async getPermitTypeDetails(permitTypeId: number) {
    const permitType = await this.prisma.typePermis.findUnique({
      where: { id: permitTypeId },
    });

    if (!permitType) {
      throw new NotFoundException('Permit type not found');
    }

    return {
      duree_renouv: permitType.duree_renouv,
      nbr_renouv_max: permitType.nbr_renouv_max,
    };
  }

  async getPermisRenewals(permisId: number) {
    return this.prisma.demandePortail.findMany({
      where: {
        procedure: {
          permisProcedure: { some: { id_permis: permisId } },
        },
        renouvellement: { isNot: null },
      },
      include: {
        renouvellement: true,
        procedure: true,
      },
      orderBy: { date_demande: 'desc' },
    });
  }

  async updatePermisStatus(procedureId: number, status: string) {
    const normalizedStatus = status.toUpperCase();

    if (
      !Object.values(StatutPermis).includes(normalizedStatus as StatutPermis)
    ) {
      throw new BadRequestException(
        `Invalid status: ${status}. Valid values are: ${Object.values(StatutPermis).join(', ')}`,
      );
    }

    const relation = await this.prisma.permisProcedure.findFirst({
      where: { id_proc: procedureId },
      include: { permis: { include: { statut: true } } },
    });

    const permit = relation?.permis;

    if (!permit) {
      throw new NotFoundException('Permis not found for this procedure');
    }

    try {
      const statut = await this.prisma.statutPermis.upsert({
        where: { lib_statut: normalizedStatus },
        create: {
          lib_statut: normalizedStatus,
          description: normalizedStatus,
        },
        update: {},
      });

      return this.prisma.permisPortail.update({
        where: { id: permit.id },
        data: {
          id_statut: statut.id,
        },
        include: {
          statut: true,
          permisProcedure: true,
        },
      });
    } catch (error) {
      console.error('Error updating permit status:', error);
      throw new InternalServerErrorException('Failed to update permit status');
    }
  }
  async getRenewalData(procedureId: number) {
    const demande = await this.prisma.demandePortail.findFirst({
      where: { id_proc: procedureId },
      include: {
        renouvellement: {
          include: {
            demande: {
              include: {
                procedure: {
                  include: {
                    permisProcedure: {
                      include: {
                        permis: {
                          include: {
                            typePermis: true,
                            detenteur: true,
                            statut: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!demande || !demande.renouvellement) {
      throw new NotFoundException('Renewal data not found');
    }

    const renewal = demande.renouvellement;
    const linkedPermit =
      renewal.demande.procedure?.permisProcedure?.[0]?.permis;

    return {
      num_decision: renewal.num_decision,
      date_decision: renewal.date_decision?.toISOString().split('T')[0],
      date_debut_validite: renewal.date_debut_validite
        ?.toISOString()
        .split('T')[0],
      date_fin_validite: renewal.date_fin_validite?.toISOString().split('T')[0],
      commentaire: renewal.commentaire,
      permis: linkedPermit,
      nombre_renouvellements: linkedPermit?.nombre_renouvellements,
    };
  }
  async countPreviousRenewals(permisId: number): Promise<number> {
    const permit = await this.prisma.permisPortail.findUnique({
      where: { id: permisId },
      select: { nombre_renouvellements: true },
    });

    if (!permit) {
      throw new NotFoundException('Permit not found');
    }

    return permit.nombre_renouvellements || 0;
  }
  async getProcedureWithType(id: number) {
    const procedure = await this.prisma.procedurePortail.findUnique({
      where: { id_proc: id },
      include: {
        demandes: {
          include: {
            typeProcedure: true, // 🔑 typeProcedure now via demande
          },
        },
      },
    });

    if (!procedure) {
      throw new NotFoundException('Procédure non trouvée');
    }
    return procedure;
  }

  async deleteRenewal(procedureId: number) {
    const demande = await this.prisma.demandePortail.findFirst({
      where: { id_proc: procedureId },
    });

    if (!demande) {
      throw new NotFoundException('Demande not found for this procedure');
    }

    await this.prisma.procedureRenouvellement.deleteMany({
      where: { id_demande: demande.id_demande },
    });
  }

  /**
   * Perimetre le plus recent (procedure TERMINEE + demande ACCEPTEE) pour un permis.
   */
  async getLatestAcceptedPerimeter(permisId: number) {
    // First try latest accepted/terminated procedure
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
      if (value == null) return NaN;
      const raw = String(value).trim();
      if (!raw) return NaN;
      const cleaned = raw.replace(/[\s\u00A0\u202F]/g, '').replace(',', '.');
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : NaN;
    };
    const normalizePoint = (
      raw: any,
      fallback?: { system?: string | null; zone?: number | null; hemisphere?: string | null },
    ) => {
      const x = toNumberSafe(raw?.x ?? raw?.X);
      const y = toNumberSafe(raw?.y ?? raw?.Y);
      return {
        id: raw?.id_coordonnees ?? raw?.id ?? null,
        x,
        y,
        z: raw?.z != null ? Number(raw.z) : null,
        zone: raw?.zone ?? fallback?.zone ?? null,
        hemisphere: raw?.hemisphere ?? fallback?.hemisphere ?? null,
        system: raw?.system ?? fallback?.system ?? 'UTM',
      };
    };
    const filterValid = (pts: Array<{ x: number; y: number }>) =>
      pts.filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));

    const loadPoints = async (procId: number) => {
      const provisional = await this.prisma.inscriptionProvisoirePortail.findUnique({
        where: { id_proc: procId },
      });
      const provisionalPoints = Array.isArray(provisional?.points)
        ? filterValid(
            provisional.points.map((p: any) => normalizePoint(p, provisional)),
          )
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

    // Fallback: walk procedures from newest to oldest until one has coordinates
    if (!proc || points.length < 3) {
      const candidateProcs = await this.prisma.procedurePortail.findMany({
        where: { permisProcedure: { some: { id_permis: permisId } } },
        orderBy: { date_debut_proc: 'desc' },
        select: { id_proc: true, num_proc: true, statut_proc: true },
      });

      for (const p of candidateProcs) {
        const candidatePoints = await loadPoints(p.id_proc);
        if (candidatePoints.length >= 3) {
          proc = p as any;
          points = candidatePoints;
          break;
        }
      }
    }

    if (!proc || points.length < 3) {
      throw new NotFoundException(`No perimeter found for permit ${permisId}`);
    }

    const orderedPoints = points.map((pt, idx) => ({
      ...pt,
      order: idx + 1,
    }));

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

  /**
   * Enregistre un nouveau périmètre pour une procédure de renouvellement sans écraser les anciens.
   */
  async saveRenewalPerimeter(procId: number, payload: { points: any[]; commentaires?: string }) {
    const link = await this.prisma.permisProcedure.findFirst({
      where: { id_proc: procId },
    });
    if (!link?.id_permis) {
      throw new NotFoundException(
        `Aucun permis associé à la procédure ${procId}`,
      );
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
    let maxAreaHa: number | null = null;
    try {
      const permit = await this.prisma.permisPortail.findUnique({
        where: { id: link.id_permis },
        select: { superficie: true },
      });
      if (typeof permit?.superficie === 'number' && Number.isFinite(permit.superficie)) {
        maxAreaHa = permit.superficie;
      }
    } catch {}

    if (!maxAreaHa || maxAreaHa <= 0) {
      try {
        const latest = await this.getLatestAcceptedPerimeter(link.id_permis);
        if (typeof latest?.areaHa === 'number' && Number.isFinite(latest.areaHa)) {
          maxAreaHa = latest.areaHa;
        }
      } catch {}
    }

    if (typeof maxAreaHa === 'number' && Number.isFinite(maxAreaHa)) {
      const tolerance = Math.max(0.01, maxAreaHa * 0.002);
      if (incomingAreaHa > maxAreaHa + tolerance) {
        throw new BadRequestException(
          `La superficie saisie (${incomingAreaHa.toFixed(2)} ha) depasse la superficie du permis (${maxAreaHa.toFixed(2)} ha).`,
        );
      }
    }
    // Nettoyer les coordonnées existantes de cette procédure uniquement
    await this.prisma.procedureCoord.deleteMany({ where: { id_proc: procId } });

    const createdCoords: {
      x: number;
      y: number;
      z: number;
      zone: number | null;
      hemisphere: string | null;
      system: string | null;
    }[] = [];
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
      createdCoords.map((c, idx) => ({
        x: Number(c.x),
        y: Number(c.y),
        z: c.z,
        zone: c.zone,
        hemisphere: (c.hemisphere as 'N' | null) ?? null,
        system: c.system ?? 'UTM',
        order: idx + 1,
      })),
    );

    if (areaHa != null && !Number.isNaN(areaHa)) {
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
        console.warn('Failed to update demande superficie', err);
      }
    }

    return {
      message: 'Perimetre de renouvellement enregistre',
      count: createdCoords.length,
      areaHa,
    };
  }

  async listPerimetersByPermis(permisId: number) {
    const procedures = await this.prisma.procedurePortail.findMany({
      where: {
        permisProcedure: {
          some: { id_permis: permisId },
        },
      },
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

        const areaHa = this.computeAreaHa(points);

        return {
          id_proc: proc.id_proc,
          num_proc: proc.num_proc,
          statut_proc: proc.statut_proc,
          points,
          areaHa,
        };
      }),
    );

    return withCoords;
  }

  async finalizeRenewalPermis(procId: number) {
    if (!Number.isFinite(procId)) {
      throw new BadRequestException('Procedure invalide');
    }

    const demande = await this.prisma.demandePortail.findFirst({
      where: { id_proc: procId },
      select: { id_demande: true, superficie: true },
    });

    if (!demande) {
      throw new NotFoundException(`Demande introuvable pour la procedure ${procId}`);
    }

    const link = await this.prisma.permisProcedure.findFirst({
      where: { id_proc: procId },
      select: { id_permis: true },
    });

    if (!link?.id_permis) {
      throw new NotFoundException(`Aucun permis associe a la procedure ${procId}`);
    }

    const numericSuperficie =
      typeof demande.superficie === 'number' && Number.isFinite(demande.superficie)
        ? demande.superficie
        : null;

    if (numericSuperficie != null) {
      await this.prisma.permisPortail.update({
        where: { id: link.id_permis },
        data: { superficie: numericSuperficie },
        select: { id: true },
      });
    }

    return { ok: true, permisId: link.id_permis, superficie: numericSuperficie };
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

  private normalizeOptionalDate(
    value: unknown,
    fieldName: string,
  ): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === 'string' && value.trim() === '') return undefined;

    const parsed = new Date(value as string);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} invalide`);
    }
    return parsed;
  }
}
