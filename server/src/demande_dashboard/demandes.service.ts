import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { mergeTypeSpecificFields } from '../demandes/demande/demande-type-helpers';

type SortOrder = 'asc' | 'desc';

@Injectable()
export class DemandesService {
  constructor(private prisma: PrismaService) {}

  private isNumericId(value: string): boolean {
    return /^\d+$/.test(value);
  }

  async resolveDemandeId(idOrCode: string): Promise<number | null> {
    const candidate = String(idOrCode ?? '').trim();
    if (!candidate) return null;

    if (this.isNumericId(candidate)) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    const demande = await this.prisma.demandePortail.findFirst({
      where: { short_code: candidate } as any,
      select: { id_demande: true },
    });

    return demande?.id_demande ?? null;
  }

  private toFiniteNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private computeMontantPayeTotal(demande: any): number | null {
    const paiements = Array.isArray(demande?.facture?.paiements)
      ? demande.facture.paiements
      : [];
    if (!paiements.length) return null;

    const total = paiements.reduce((sum: number, p: any) => {
      const montant = this.toFiniteNumber(p?.montant_paye);
      return sum + (montant ?? 0);
    }, 0);
    return Number.isFinite(total) ? total : null;
  }

  private attachComputedFields(demande: any) {
    const detenteur = this.extractDetenteur(demande);
    const montantPayeTotal = this.computeMontantPayeTotal(demande);
    return {
      ...demande,
      detenteur,
      montant_paye_total: montantPayeTotal,
    };
  }

  private extractDetenteur(demande: any) {
    const fromProcedurePermis =
      demande.procedure?.permisProcedure?.find((link: any) => !!link?.permis?.detenteur)
        ?.permis?.detenteur ?? null;
    return (
      demande.detenteurdemande?.[0]?.detenteur ??
      demande.utilisateur?.detenteur ??
      fromProcedurePermis ??
      null
    );
  }

  private applySocieteFilter(
    where: Prisma.demandePortailWhereInput,
    societe?: string,
  ) {
    if (!societe?.trim()) return;
    const q = societe.trim();
    const societeClause: Prisma.demandePortailWhereInput = {
      OR: [
        {
          detenteurdemande: {
            some: {
              detenteur: {
                nom_societeFR: { contains: q, mode: 'insensitive' },
              },
            },
          },
        },
        {
          utilisateur: {
            detenteur: {
              nom_societeFR: { contains: q, mode: 'insensitive' },
            },
          },
        },
      ],
    };
    const prevAnd = (where as any).AND;
    const andClauses = Array.isArray(prevAnd)
      ? prevAnd
      : prevAnd
      ? [prevAnd]
      : [];
    (where as any).AND = [...andClauses, societeClause];
  }

  private baseInclude = {
    wilaya: { select: { id_wilaya: true, nom_wilayaFR: true } },
    daira: { select: { id_daira: true, nom_dairaFR: true } },
    commune: { select: { id_commune: true, nom_communeFR: true } },
    procedure: {
      select: {
        id_proc: true,
        statut_proc: true,
        date_fin_proc: true,
        permisProcedure: {
          take: 3,
          orderBy: { id_procedurePermis: 'desc' },
          select: {
            permis: {
              select: {
                id: true,
                id_detenteur: true,
                detenteur: {
                  select: {
                    id_detenteur: true,
                    nom_societeFR: true,
                    nom_societeAR: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    },
    detenteurdemande: {
      include: {
        detenteur: {
          select: {
            id_detenteur: true,
            nom_societeFR: true,
            email: true,
            pays: { select: { id_pays: true, nom_pays: true } },
            nationaliteRef: { select: { id_nationalite: true, libelle: true } },
          },
        },
      },
    },
    expertMinier: {
      select: { id_expert: true, nom_expert: true, num_agrement: true },
    },
    utilisateur: {
      select: {
        id: true,
        username: true,
        email: true,
        nom: true,
        Prenom: true,
        detenteur: {
          select: {
            id_detenteur: true,
            nom_societeFR: true,
            nom_societeAR: true,
            email: true,
          },
        },
      },
    },
    typePermis: { select: { id: true, code_type: true, lib_type: true } },
    typeProcedure: { select: { id: true, libelle: true } },
    facture: {
      select: {
        id_facture: true,
        montant_total: true,
        statut: true,
        paiements: {
          select: {
            id: true,
            montant_paye: true,
            etat_paiement: true,
            date_paiement: true,
          },
          orderBy: { date_paiement: 'desc' },
        },
      },
    },
    demInitial: true,
    modification: true,
    renouvellement: true,
  } satisfies Prisma.demandePortailInclude;

  async findMany(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    societe?: string;
    statut?: string;
    wilayaId?: number;
    typePermisId?: number;
    typeProcId?: number;
    demandeId?: number; // Add this parameter
    fromDate?: string;
    toDate?: string;
    sortBy?: string;
    sortOrder?: SortOrder;
  }) {
    const {
      page = 1,
      pageSize = 20,
      search,
      societe,
      statut,
      wilayaId,
      typePermisId,
      typeProcId,
      demandeId, // Extract this parameter
      fromDate,
      toDate,
      sortBy = 'date_demande',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.demandePortailWhereInput = {};

    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { code_demande: { contains: q, mode: 'insensitive' } },
        { lieu_ditFR: { contains: q, mode: 'insensitive' } },
        {
          detenteurdemande: {
            some: {
              detenteur: {
                nom_societeFR: { contains: q, mode: 'insensitive' },
              },
            },
          },
        },
        { expertMinier: { nom_expert: { contains: q, mode: 'insensitive' } } },
      ];
    }

    this.applySocieteFilter(where, societe);

    if (statut) where.statut_demande = statut;
    if (wilayaId) where.id_wilaya = wilayaId;
    if (typePermisId) where.id_typePermis = typePermisId;
    if (typeProcId) where.id_typeProc = typeProcId;

    // Add the demandeId filter
    if (demandeId) {
      where.id_demande = demandeId;
    }

    if (fromDate || toDate) {
      where.date_demande = {};
      if (fromDate) (where.date_demande as any).gte = new Date(fromDate);
      if (toDate) (where.date_demande as any).lte = new Date(toDate);
    }

    // safe orderBy: whitelist keys
    const orderable: Record<string, true> = {
      id_demande: true,
      code_demande: true,
      date_demande: true,
      statut_demande: true,
      date_instruction: true,
      date_fin_instruction: true,
    };
    const orderBy: Prisma.demandePortailOrderByWithRelationInput = orderable[sortBy]
      ? { [sortBy]: sortOrder }
      : { date_demande: 'desc' };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.demandePortail.count({ where }),
      this.prisma.demandePortail.findMany({
        where,
        include: this.baseInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const enrichedItems = items.map((demande) =>
      this.attachComputedFields(mergeTypeSpecificFields(demande)),
    );

    return {
      page,
      pageSize,
      total,
      pages: Math.ceil(total / pageSize),
      items: enrichedItems,
    };
  }

  async stats(params: {
    societe?: string;
    statut?: string;
    wilayaId?: number;
    typePermisId?: number;
    typeProcId?: number;
    demandeId?: number; // Add this parameter
    fromDate?: string;
    toDate?: string;
  }) {
    const where: Prisma.demandePortailWhereInput = {};

    this.applySocieteFilter(where, params.societe);

    if (params.statut) where.statut_demande = params.statut;
    if (params.wilayaId) where.id_wilaya = params.wilayaId;
    if (params.typePermisId) where.id_typePermis = params.typePermisId;
    if (params.typeProcId) where.id_typeProc = params.typeProcId;

    // Add the demandeId filter
    if (params.demandeId) {
      where.id_demande = params.demandeId;
    }

    if (params.fromDate || params.toDate) {
      where.date_demande = {};
      if (params.fromDate)
        (where.date_demande as any).gte = new Date(params.fromDate);
      if (params.toDate)
        (where.date_demande as any).lte = new Date(params.toDate);
    }

    const total = await this.prisma.demandePortail.count({ where });

    const byStatut = await this.prisma.demandePortail.groupBy({
      by: ['statut_demande'],
      where,
      _count: { _all: true },
    });

    const last7 = await this.prisma.demandePortail.count({
      where: {
        ...where,
        date_demande: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
      },
    });

    const avgInstruction = await this.prisma.demandePortail.aggregate({
      _avg: {
        superficie: true,
      },
      where: {
        date_instruction: { not: null },
        date_fin_instruction: { not: null },
      },
    });

    // Compute date diffs client-side (small extra query)
    const completed = await this.prisma.demandePortail.findMany({
      where: {
        ...where,
        date_instruction: { not: null },
        date_fin_instruction: { not: null },
      },
      select: { date_instruction: true, date_fin_instruction: true },
      take: 1000, // safety cap; adjust as needed
    });
    const diffs = completed.map(
      (d) => +d.date_fin_instruction! - +d.date_instruction!,
    );
    const avgInstructionDays = diffs.length
      ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length / 86400000)
      : null;

    return {
      total,
      last7,
      byStatut,
      avgInstructionDays,
    };
  }

  async findByResponsable(nom_responsable: string) {
    if (!nom_responsable?.trim()) {
      return [];
    }

    const items = await this.prisma.demandePortail.findMany({
      where: {
        Nom_Prenom_Resp_Enregist: nom_responsable.trim(),
      },
      include: this.baseInclude,
      orderBy: { date_demande: 'desc' },
    });

    return items.map((demande) => {
      return this.attachComputedFields(mergeTypeSpecificFields(demande));
    });
  }
  async getDemandeById(id: number) {
    return this.prisma.demandePortail
      .findUnique({
        where: { id_demande: id },
        include: {
          wilaya: true,
          daira: true,
          commune: true,
          detenteurdemande: {
            include: {
              detenteur: { include: { pays: true, nationaliteRef: true } },
            },
          },
          expertMinier: true,
          utilisateur: {
            select: {
              id: true,
              username: true,
              email: true,
              nom: true,
              Prenom: true,
              detenteur: {
                select: {
                  id_detenteur: true,
                  nom_societeFR: true,
                  nom_societeAR: true,
                  email: true,
                },
              },
            },
          },
          typePermis: true,
          typeProcedure: true,
          facture: {
            select: {
              id_facture: true,
              montant_total: true,
              statut: true,
              paiements: {
                select: {
                  id: true,
                  montant_paye: true,
                  etat_paiement: true,
                  date_paiement: true,
                },
                orderBy: { date_paiement: 'desc' },
              },
            },
          },
          procedure: {
            include: {
              ProcedureEtape: {
                include: { etape: true },
                orderBy: { date_debut: 'asc' },
              },
            },
          },
          dossiersFournis: true,
          CahierCharge: true,
          demInitial: true,
          modification: true,
          renouvellement: true,
        },
      })
      .then((demande) => {
        if (!demande) return demande;
        return this.attachComputedFields(mergeTypeSpecificFields(demande));
      });
  }
  async findOne(id: number) {
    const demande = await this.prisma.demandePortail.findUnique({
      where: { id_demande: id },
      include: this.baseInclude,
    });

    if (!demande) return demande;
    return this.attachComputedFields(mergeTypeSpecificFields(demande));
  }

  async exportCSV(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    societe?: string;
    statut?: string;
    wilayaId?: number;
    typePermisId?: number;
    typeProcId?: number;
    demandeId?: number; // Add this parameter
    fromDate?: string;
    toDate?: string;
    sortBy?: string;
    sortOrder?: SortOrder;
  }) {
    const all = await this.findMany({ ...params, page: 1, pageSize: 10000 }); // cap export
    const headers = [
      'id_demande',
      'code_demande',
      'date_demande',
      'statut_demande',
      'intitule_projet',
      'wilaya',
      'daira',
      'commune',
      'type_permis',
      'type_procedure',
      'detenteur',
      'expert',
      'superficie',
      'budget_prevu',
      'montant_produit',
    ];
    const rows = all.items.map((d) => {
      const detenteur = this.extractDetenteur(d);
      const record = d as any;
      return [
        d.id_demande,
        d.code_demande ?? '',
        d.date_demande ? new Date(d.date_demande).toISOString() : '',
        d.statut_demande ?? '',
        record.intitule_projet ?? '',
        d.wilaya?.nom_wilayaFR ?? '',
        d.daira?.nom_dairaFR ?? '',
        d.commune?.nom_communeFR ?? '',
        d.typePermis?.lib_type ?? '',
        d.typeProcedure?.libelle ?? '',
        detenteur?.nom_societeFR ?? '',
        d.expertMinier?.nom_expert ?? '',
        d.superficie ?? '',
        record.budget_prevu ?? '',
        record.montant_produit ?? '',
      ].join(',');
    });
    return [headers.join(','), ...rows].join('\n');
  }
}
