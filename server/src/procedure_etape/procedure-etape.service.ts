// src/procedure-etape/procedure-etape.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProcedureEtape, StatutProcedure } from '@prisma/client';

@Injectable()
export class ProcedureEtapeService {
  constructor(private prisma: PrismaService) {}

  private async getCombinaisonIdForProcedure(id_proc: number): Promise<number | null> {
    const demande = await this.prisma.demandePortail.findFirst({
      where: { id_proc },
      select: { id_typePermis: true, id_typeProc: true },
    });

    if (!demande?.id_typePermis || !demande?.id_typeProc) {
      return null;
    }

    const combo = await this.prisma.combinaisonPermisProc.findUnique({
      where: {
        id_typePermis_id_typeProc: {
          id_typePermis: demande.id_typePermis,
          id_typeProc: demande.id_typeProc,
        },
      },
      select: { id_combinaison: true },
    });

    return combo?.id_combinaison ?? null;
  }

  // src/procedure-etape/procedure-etape.service.ts

  async setStepStatus(
    id_proc: number,
    id_etape: number,
    statut: StatutProcedure,
    link?: string,
  ) {
    const now = new Date();
    console.log('[setStepStatus] called', {
      id_proc,
      id_etape,
      targetStatut: statut,
      link,
    });

    const existing = await this.prisma.procedureEtape.findUnique({
      where: { id_proc_id_etape: { id_proc, id_etape } },
    });
    console.log('[setStepStatus] existing ProcedureEtape:', existing);

    // Get the phase of this etape (can be null now because etapes can be detached)
    const etapeWithPhase = await this.prisma.etapeProc.findUnique({
      where: { id_etape },
      include: {
        ManyEtapes: true, // relations vers les phases via table de jointure
      },
    });

    if (!etapeWithPhase) {
      throw new Error(`Etape ${id_etape} not found`);
    }

    // Déterminer la phase depuis la table de jointure ManyEtape (priorité), sinon procedurePhaseEtapes.
    const combinaisonId = await this.getCombinaisonIdForProcedure(id_proc);

    let phaseId: number | null = null;
    if (combinaisonId != null) {
      const match = await this.prisma.relationPhaseTypeProc.findFirst({
        where: {
          id_combinaison: combinaisonId,
          manyEtape: { id_etape },
        },
        include: { manyEtape: true },
        orderBy: [{ ordre: 'asc' }],
      });

      if (match?.manyEtape?.id_phase != null) {
        phaseId = match.manyEtape.id_phase;
      }
    }

    if (phaseId == null) {
      phaseId = etapeWithPhase.ManyEtapes?.[0]?.id_phase ?? null;
    }

    if (phaseId == null) {
      const procPhaseEtape = await this.prisma.procedurePhaseEtapes.findFirst({
        where: {
          id_proc,
          manyEtape: {
            id_etape,
          },
        },
        include: { manyEtape: true },
      });
      if (procPhaseEtape?.manyEtape?.id_phase != null) {
        phaseId = procPhaseEtape.manyEtape.id_phase;
      }
    }

    console.log('[setStepStatus] resolved phaseId', {
      id_proc,
      id_etape,
      etapeIdPhase: etapeWithPhase.ManyEtapes?.[0]?.id_phase,
      resolvedPhaseId: phaseId,
    });

    // Ensure procedure exists and has phase associations
    await this.ensureProcedureHasPhases(id_proc);

    // Removed the updateMany that sets other EN_COURS to EN_ATTENTE
    // This allows multiple EN_COURS in a phase

    const updateData: any = { statut };
    if (link) updateData.link = link;

    if (!existing) {
      const createData: any = {
        id_proc,
        id_etape,
        statut,
        link,
      };

      if (statut === StatutProcedure.EN_COURS) {
        createData.date_debut = now;
      } else if (statut === StatutProcedure.TERMINEE) {
        createData.date_debut = now;
        createData.date_fin = now;
      }

      const result = await this.prisma.procedureEtape.create({
        data: createData,
      });
      console.log('[setStepStatus] created ProcedureEtape:', result);

      // Auto-update phase status after creating etape, if we have a phase
      if (phaseId != null) {
        await this.autoUpdatePhaseStatus(id_proc, phaseId);
      }
      return result;
    }

    if (statut === StatutProcedure.EN_COURS && !existing.date_debut) {
      updateData.date_debut = now;
    }

    if (statut === StatutProcedure.TERMINEE) {
      if (!existing.date_debut) {
        updateData.date_debut = now;
      }
      updateData.date_fin = now;
    }

    const result = await this.prisma.procedureEtape.update({
      where: { id_proc_id_etape: { id_proc, id_etape } },
      data: updateData,
    });
    console.log('[setStepStatus] updated ProcedureEtape:', result);

    // Auto-update phase status after etape change, if we have a phase
    if (phaseId != null) {
      await this.autoUpdatePhaseStatus(id_proc, phaseId);
    }
    return result;
  }

  async ensureProcedureHasPhases(id_proc: number) {
    // Check if procedure exists and get its type
    const procedure = await this.prisma.procedurePortail.findUnique({
      where: { id_proc },
      include: {
        demandes: {
          include: {
            typeProcedure: true,
            typePermis: true,
          },
        },
      },
    });

    if (!procedure) {
      throw new Error(`Procedure with ID ${id_proc} not found`);
    }

    // Get the procedure type (assuming first demande's type)
    const primaryDemande = procedure.demandes[0];
    const procedureType = primaryDemande?.typeProcedure;
    const procedureTypePermis = primaryDemande?.typePermis;
    if (!procedureType || !procedureTypePermis) {
      console.warn(
        `[ensureProcedureHasPhases] Missing demande/type for procedure ${id_proc}; skipping phase generation.`,
      );
      return;
    }

    // Check if procedure has phase associations
    const phaseCount = await this.prisma.procedurePhase.count({
      where: { id_proc },
    });

    if (phaseCount === 0) {
      // Get phases specific to this procedure type
    const phaseRelations = await this.prisma.relationPhaseTypeProc.findMany({
      where: {
        combinaison: {
          id_typeProc: procedureType.id,
          id_typePermis: procedureTypePermis.id,
        },
      },
      include: {
        manyEtape: {
          include: {
            phase: true,
          },
        },
      },
      orderBy: [{ ordre: 'asc' }],
    });

    if (phaseRelations.length === 0) {
      // No configured phases for this procedure/typePermis combo; skip creating phases to avoid hard failure.
      console.warn(
        `[ensureProcedureHasPhases] No phases defined for typeProc=${procedureType.id} typePermis=${procedureTypePermis.id}; skipping phase generation.`,
      );
      return;
    }

    // dedupe by phase id (since relationPhaseTypeProc is now per manyEtape)
    const byPhase = new Map<number, { ordre: number; id_phase: number }>();
    phaseRelations.forEach((relation, index) => {
      const phaseId = relation.manyEtape?.id_phase;
      if (phaseId == null) return;
      const ordre = relation.ordre ?? index + 1;
      if (!byPhase.has(phaseId) || ordre < (byPhase.get(phaseId)?.ordre ?? ordre)) {
        byPhase.set(phaseId, { ordre, id_phase: phaseId });
      }
    });

    const procedurePhasesData = Array.from(byPhase.values()).map((p, idx) => ({
      id_proc,
      id_phase: p.id_phase,
      ordre: p.ordre ?? idx + 1,
      statut: StatutProcedure.EN_ATTENTE,
    }));

      await this.prisma.procedurePhase.createMany({
        data: procedurePhasesData,
      });
    }
  }

  async autoUpdatePhaseStatus(id_proc: number, id_phase: number) {
    const combinaisonId = await this.getCombinaisonIdForProcedure(id_proc);
    // Get all etapes in this phase with their status
    const phaseEtapes = await this.prisma.manyEtape.findMany({
      where: {
        id_phase,
        ...(combinaisonId != null
          ? {
              relationPhaseTypeProc: {
                some: { id_combinaison: combinaisonId },
              },
            }
          : {}),
      },
      include: {
        etape: {
          include: {
            procedureEtapes: {
              where: { id_proc },
            },
          },
        },
      },
      orderBy: { ordre_etape: 'asc' },
    });

    if (phaseEtapes.length === 0) {
      // If this phase has no configured steps for the current combinaison, don't mark it TERMINEE.
      return this.prisma.procedurePhase.updateMany({
        where: { id_proc, id_phase },
        data: { statut: StatutProcedure.EN_ATTENTE },
      });
    }

    const statuses = phaseEtapes.map(
      (me) => me.etape.procedureEtapes[0]?.statut || 'EN_ATTENTE',
    );

    let newStatut: StatutProcedure;

    if (statuses.every((statut) => statut === 'TERMINEE')) {
      newStatut = StatutProcedure.TERMINEE;
    } else if (statuses.some((statut) => statut === 'EN_COURS')) {
      newStatut = StatutProcedure.EN_COURS;
    } else {
      newStatut = StatutProcedure.EN_ATTENTE;
    }

    console.log('[autoUpdatePhaseStatus] result', {
      id_proc,
      id_phase,
      statuses,
      newStatut,
    });

    // Update the phase status (if it exists for this procedure)
    try {
      return await this.prisma.procedurePhase.update({
        where: { id_proc_id_phase: { id_proc, id_phase } },
        data: { statut: newStatut },
      });
    } catch (error: any) {
      if (error?.code === 'P2025') {
        // No procedurePhase row for this (id_proc, id_phase) – skip quietly
        console.warn(
          '[autoUpdatePhaseStatus] No ProcedurePhase found to update',
          {
            id_proc,
            id_phase,
          },
        );
        return null;
      }
      throw error;
    }
  }

  async getProcedureWithPhases(id_proc: number) {
    console.log(`🔍 Looking for procedure with ID: ${id_proc}`);

    await this.ensureProcedureHasPhases(id_proc);

    const combinaisonId = await this.getCombinaisonIdForProcedure(id_proc);

    const procedure = await this.prisma.procedurePortail.findUnique({
      where: { id_proc },
      include: {
        ProcedurePhase: {
          include: {
            phase: {
              include: {
                ManyEtapes: {
                  ...(combinaisonId != null
                    ? {
                        where: {
                          relationPhaseTypeProc: {
                            some: { id_combinaison: combinaisonId },
                          },
                        },
                      }
                    : {}),
                  include: {
                    etape: {
                      include: {
                        procedureEtapes: {
                          where: { id_proc },
                        },
                      },
                    },
                  },
                  orderBy: { ordre_etape: 'asc' },
                },
              },
            },
          },
          orderBy: { ordre: 'asc' },
        },
        ProcedureEtape: {
          include: {
            etape: true,
          },
        },
        demandes: {
          include: {
            typeProcedure: true,
            typePermis: true, // This should include typePermis
          },
        },
      },
    });
    // Recompose etapes à partir de ManyEtapes pour compatibilité front (phase.etapes attendu)
    if (procedure?.ProcedurePhase) {
      procedure.ProcedurePhase = procedure.ProcedurePhase.map((pp: any) => {
        const etapes =
          pp.phase?.ManyEtapes?.map((me: any) => ({
            ...me.etape,
            duree_etape: me.duree_etape ?? null,
            ordre_etape: me.ordre_etape,
            page_route: me.page_route ?? null,
            id_phase: me.id_phase,
            procedureEtapes: me.etape?.procedureEtapes ?? [],
          })) || [];
        return {
          ...pp,
          phase: {
            ...pp.phase,
            etapes,
          },
        };
      });
    }

    return procedure;
  }

  async getCurrentEtape(id_proc: number) {
    const enCours = await this.prisma.procedureEtape.findFirst({
      where: {
        id_proc,
        statut: StatutProcedure.EN_COURS,
      },
      include: { etape: true },
    });

    if (enCours) return enCours;

    return this.prisma.procedureEtape.findFirst({
      where: { id_proc },
      orderBy: { date_debut: 'desc' },
      include: { etape: true },
    });
  }

  async canMoveToNextPhase(
    id_proc: number,
    currentPhaseId: number,
  ): Promise<boolean> {
    const combinaisonId = await this.getCombinaisonIdForProcedure(id_proc);
    const currentPhase = await this.prisma.procedurePhase.findUnique({
      where: { id_proc_id_phase: { id_proc, id_phase: currentPhaseId } },
      include: {
        phase: {
          include: {
            ManyEtapes: {
              ...(combinaisonId != null
                ? {
                    where: {
                      relationPhaseTypeProc: {
                        some: { id_combinaison: combinaisonId },
                      },
                    },
                  }
                : {}),
              include: {
                etape: {
                  include: {
                    procedureEtapes: { where: { id_proc } },
                  },
                },
              },
              orderBy: { ordre_etape: 'asc' },
            },
          },
        },
      },
    });

    if (!currentPhase) return false;

    // Check if all etapes in current phase are completed
    const mappedEtapes =
      currentPhase.phase?.ManyEtapes?.map((me: any) => ({
        ...me.etape,
        procedureEtapes: me.etape?.procedureEtapes ?? [],
      })) ?? [];

    const allEtapesCompleted = mappedEtapes.every(
      (etape) => etape.procedureEtapes[0]?.statut === 'TERMINEE',
    );

    return allEtapesCompleted;
  }

  async startNextPhase(id_proc: number, currentPhaseId: number) {
    // Check if we can move to next phase
    const canMove = await this.canMoveToNextPhase(id_proc, currentPhaseId);
    if (!canMove) {
      throw new Error(
        'Cannot move to next phase - current phase not completed',
      );
    }

    const combinaisonId = await this.getCombinaisonIdForProcedure(id_proc);
    const currentPhaseRow = await this.prisma.procedurePhase.findUnique({
      where: { id_proc_id_phase: { id_proc, id_phase: currentPhaseId } },
      select: { ordre: true },
    });

    if (!currentPhaseRow) {
      throw new Error('Current phase not found');
    }

    // Get the next phase
    const nextPhase = await this.prisma.procedurePhase.findFirst({
      where: {
        id_proc,
        ordre: { gt: currentPhaseRow.ordre },
      },
      orderBy: { ordre: 'asc' },
      include: {
        phase: {
          include: {
            ManyEtapes: {
              ...(combinaisonId != null
                ? {
                    where: {
                      relationPhaseTypeProc: {
                        some: { id_combinaison: combinaisonId },
                      },
                    },
                  }
                : {}),
              include: { etape: true },
              orderBy: { ordre_etape: 'asc' },
            },
          },
        },
      },
    });

    if (!nextPhase) return null;

    // Start the first etape of the next phase
    const firstEtape = nextPhase.phase.ManyEtapes?.[0]?.etape;

    if (firstEtape) {
      return this.setStepStatus(
        id_proc,
        firstEtape.id_etape,
        StatutProcedure.EN_COURS,
      );
    }

    return null;
  }
}
