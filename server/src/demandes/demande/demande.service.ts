import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateDemandeDto } from './update-demande.dto';
import { mergeTypeSpecificFields } from './demande-type-helpers';
@Injectable()
export class DemandeService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id_demande: number) {
    const demande = await this.prisma.demandePortail.findUnique({
      where: { id_demande },
      include: {
        procedure: true, // keep procedure (without typeProcedure)
        typeProcedure: true, // now directly from Demande
        detenteurdemande: {
          include: { detenteur: true },
        },
        expertMinier: true,
        demInitial: true,
        modification: true,
        renouvellement: true,
      },
    });

    if (!demande) {
      throw new NotFoundException('Demande introuvable');
    }

    const enriched = mergeTypeSpecificFields(demande);
    const primaryDetenteur = enriched.detenteurdemande?.[0]?.detenteur ?? null;
    const { detenteurdemande, ...rest } = enriched as any;
    return {
      ...rest,
      detenteur: primaryDetenteur,
    };
  }

  async createDemande(data: {
    id_typepermis: number;
    objet_demande: string;
    code_demande?: string;
    id_detenteur?: number;
    nom_responsable?: string | null;
      utilisateurId: number;//
  }) {
    // Get type permis details
    const typePermis = await this.prisma.typePermis.findUnique({
      where: { id: data.id_typepermis },
    });

    if (!typePermis) {
      throw new NotFoundException('Type de permis introuvable');
    }

    // Get the "demande" type procedure, auto-create it if missing
    let typeProcedure = await this.prisma.typeProcedure.findFirst({
      where: { libelle: { equals: 'demande', mode: 'insensitive' } },
    });

    if (!typeProcedure) {
      typeProcedure = await this.prisma.typeProcedure.create({
        data: {
          libelle: 'demande',
          description: 'Procédure par défaut pour la création des demandes',
        },
      });
    }

    // Generate procedure and demande codes based on typePermis.code_type
    const codeType = typePermis.code_type ?? 'UNK';
    // temp code (draft) must stay unique to avoid P2002 on retries/abandons
    const tempCode = data.code_demande || `TEMP-${codeType}-${Date.now()}`;
    // Generate a unique num_proc; fall back to timestamp-based if collision
    const procCount = await this.prisma.procedurePortail.count({
      where: {
        demandes: {
          some: {
            id_typePermis: data.id_typepermis,
          },
        },
      },
    });
    const baseNumProc = `PROC-${codeType}-${procCount + 1}`;
    const generatedNumProc = baseNumProc;

    // Create procedure (⚠️ no more id_typeproc here)
    // Create procedure with manual id to avoid sequence desync collisions
    const maxId = await this.prisma.procedurePortail.aggregate({
      _max: { id_proc: true },
    });
    const baseId = (maxId._max.id_proc ?? 0) + 1;
    let createdProc;
    let attempt = 0;
    while (!createdProc && attempt < 3) {
      const candidateId = baseId + attempt;
      const candidateNumProc = attempt === 0 ? baseNumProc : `${baseNumProc}-R${attempt}`;
      try {
        createdProc = await this.prisma.procedurePortail.create({
          data: {
            id_proc: candidateId,
            num_proc: candidateNumProc,
            date_debut_proc: new Date(),
            statut_proc: 'EN_COURS',
          },
        });
      } catch (error: any) {
        if (error?.code === 'P2002') {
          attempt += 1;
          if (attempt >= 3) {
            // last resort: timestamp num_proc to break uniqueness
            createdProc = await this.prisma.procedurePortail.create({
              data: {
                id_proc: candidateId + 1,
                num_proc: `PROC-${codeType}-${Date.now()}`,
                date_debut_proc: new Date(),
                statut_proc: 'EN_COURS',
              },
            });
          }
        } else {
          throw error;
        }
      }
    }
// avant de créer la demande
if (!data.utilisateurId) {
  throw new BadRequestException('utilisateurId est requis');
}
if (!createdProc?.id_proc) {
  throw new Error('La procédure n’a pas été créée (id_proc manquant)');
}
    // Create demande (with id_typeproc now)
    const demande = await this.prisma.demandePortail.create({
      data: {
        utilisateurId: data.utilisateurId, 
        id_proc: createdProc.id_proc,
        id_typeProc: typeProcedure.id,
        code_demande: tempCode,
        id_typePermis: data.id_typepermis,
        date_demande: null, // real official date only at final deposit
        duree_instruction: 10,
        statut_demande: 'EN_COURS',
        Nom_Prenom_Resp_Enregist: data.nom_responsable ?? null,
        ...(data.id_detenteur
          ? {
              detenteurdemande: {
                create: {
                  id_detenteur: data.id_detenteur,
                  role_detenteur: 'principal',
                },
              },
            }
          : {}),
      },
      include: {
        procedure: true,
        typeProcedure: true,
        detenteurdemande: { include: { detenteur: true } },
      },
    });

    const primaryDetenteur = demande.detenteurdemande?.[0]?.detenteur ?? null;
    return {
      ...demande,
      detenteur: primaryDetenteur,
    };
  }

  async createOrFindExpert(data: {
    nom_expert: string;
    num_agrement: string;
    etat_agrement: string;
    specialisation: string;
    date_agrement: Date;
  }) {
    const existing = await this.prisma.expertMinier.findFirst({
      where: {
        nom_expert: data.nom_expert,
        specialisation: data.specialisation,
        num_agrement: data.num_agrement,
        etat_agrement: data.etat_agrement,
        date_agrement: data.date_agrement,
      },
    });

    if (existing) return existing;

    return this.prisma.expertMinier.create({ data });
  }

  async attachExpertToDemande(id_demande: number, id_expert: number) {
    return this.prisma.demandePortail.update({
      where: { id_demande },
      data: { id_expert },
      include: {
        expertMinier: true,
        procedure: true,
      },
    });
  }

  async generateCode(id_typepermis: number) {
    const typePermis = await this.prisma.typePermis.findUnique({
      where: { id: id_typepermis },
    });

    if (!typePermis) {
      throw new NotFoundException('Type de permis introuvable');
    }

    const codeType = typePermis.code_type ?? 'UNK';

    // Only count officially deposited demandes (date_demande not null)
    const count = await this.prisma.demandePortail.count({
      where: {
        id_typePermis: id_typepermis,
        NOT: { date_demande: null },
      },
    });

    const code_demande = `DEM-${codeType}-${count + 1}`;
    return { code_demande };
  }

  /**
   * Final deposit: set official date_demande, compute final code_demande
   * based only on already deposited demandes (date_demande not null),
   * and set statut_demande to EN_ATTENTE. Wrapped in a transaction.
   */
  async deposerDemande(id_demande: number) {
    return this.prisma.$transaction(async (tx) => {
      const demande = await tx.demandePortail.findUnique({
        where: { id_demande },
        include: { typePermis: true },
      });
      if (!demande) {
        throw new NotFoundException('Demande introuvable');
      }
      const typePermis = demande.typePermis;
      if (!typePermis) {
        throw new NotFoundException('Type de permis introuvable pour la demande');
      }

      const codeType = typePermis.code_type ?? 'UNK';
      const countDeposited = await tx.demandePortail.count({
        where: {
          id_typePermis: typePermis.id,
          NOT: { date_demande: null },
        },
      });
      const finalCode = `DEM-${codeType}-${countDeposited + 1}`;

      const updated = await tx.demandePortail.update({
        where: { id_demande },
        data: {
          code_demande: finalCode,
          date_demande: new Date(),
          statut_demande: 'EN_ATTENTE',
        },
      });

      return updated;
    });
  }

  // demande.service.ts
  async update(id: number, updateDemandeDto: UpdateDemandeDto) {
    return this.prisma.demandePortail.update({
      where: { id_demande: id },
      data: {
        id_wilaya: updateDemandeDto.id_wilaya,
        id_daira: updateDemandeDto.id_daira,
        id_commune: updateDemandeDto.id_commune,
        lieu_ditFR: updateDemandeDto.lieu_ditFR,
        lieu_dit_ar: updateDemandeDto.lieu_ditAR,
        statut_juridique_terrain: updateDemandeDto.statut_juridique_terrain,
        occupant_terrain_legal: updateDemandeDto.occupant_terrain_legal,
        superficie: updateDemandeDto.superficie,
      },
    });
  }
}
