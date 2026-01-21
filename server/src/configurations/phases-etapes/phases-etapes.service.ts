import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateEtapeDto,
  CreatePhaseDto,
  CreateRelationPhaseTypeProcDto,
  CreateCombinaisonPermisProcDto,
  UpdateEtapeDto,
  UpdatePhaseDto,
  UpdateRelationPhaseTypeProcDto,
  UpdateCombinaisonPermisProcDto,
} from './phases-etapes.dto';

@Injectable()
export class PhasesEtapesService {
  constructor(private readonly prisma: PrismaService) {}

  // Phases

  async findAllPhasesWithDetails() {
    const phases = await this.prisma.phase.findMany({
      orderBy: { ordre: 'asc' },
      include: {
        ManyEtapes: {
          orderBy: { ordre_etape: 'asc' },
          include: { etape: true, phase: true },
        },
      },
    });

    return phases.map((phase: any) => ({
      ...phase,
      ManyEtates: phase.ManyEtates || [],
      etapes:
        phase.ManyEtapes?.map((me: any) => ({
          ...me.etape,
          duree_etape: me.duree_etape ?? null,
          ordre_etape: me.ordre_etape,
          page_route: me.page_route ?? null,
          id_phase: me.id_phase,
        })) || [],
    }));
  }

  async createPhase(dto: CreatePhaseDto) {
    return this.prisma.phase.create({
      data: {
        libelle: dto.libelle,
        ordre: dto.ordre,
        description: dto.description ?? null,
      },
    });
  }

  async updatePhase(id_phase: number, dto: UpdatePhaseDto) {
    try {
      return await this.prisma.phase.update({
        where: { id_phase },
        data: dto,
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Phase avec id ${id_phase} introuvable`);
      }
      throw new BadRequestException(
        'Erreur lors de la mise à jour de la phase',
      );
    }
  }

  async deletePhase(id_phase: number) {
    const etapesCount = await this.prisma.manyEtape.count({
      where: { id_phase },
    });
    const relationsCount = await this.prisma.relationPhaseTypeProc.count({
      where: { manyEtape: { id_phase } },
    });
    const procedurePhasesCount = await this.prisma.procedurePhase.count({
      where: { id_phase },
    });
    const procedurePhaseEtapesCount =
      await this.prisma.procedurePhaseEtapes.count({
        where: { manyEtape: { id_phase } },
      });

    if (
      etapesCount > 0 ||
      relationsCount > 0 ||
      procedurePhasesCount > 0 ||
      procedurePhaseEtapesCount > 0
    ) {
      throw new BadRequestException(
        'Impossible de supprimer une phase qui est déjà utilisée par des étapes ou des procédures.',
      );
    }

    try {
      return await this.prisma.phase.delete({
        where: { id_phase },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Phase avec id ${id_phase} introuvable`);
      }
      throw error;
    }
  }

  // Etapes

  async findAllEtapes() {
    const etapes = await this.prisma.etapeProc.findMany({
      orderBy: [{ id_etape: 'asc' }],
      include: {
        ManyEtapes: {
          include: { phase: true },
        },
      },
    });
    return etapes.map((e) => ({
      ...e,
      // mettre à plat une éventuelle première assignation pour compat front
      duree_etape: e.ManyEtapes?.[0]?.duree_etape ?? null,
      ordre_etape: e.ManyEtapes?.[0]?.ordre_etape ?? null,
      page_route: e.ManyEtapes?.[0]?.page_route ?? null,
      id_phase: e.ManyEtapes?.[0]?.id_phase ?? null,
      phaseLibelle: e.ManyEtapes?.[0]?.phase?.libelle ?? null,
    }));
  }

  // Liste brute des couples Phase/Étape (ManyEtape) avec leurs libellés
  async findAllManyEtapes() {
    return this.prisma.manyEtape.findMany({
      orderBy: [
        { id_phase: 'asc' },
        { ordre_etape: 'asc' },
      ],
      include: {
        phase: true,
        etape: true,
      },
    });
  }

  async findEtapesByPhase(id_phase: number) {
    const many = await this.prisma.manyEtape.findMany({
      where: { id_phase },
      orderBy: { ordre_etape: 'asc' },
      include: { etape: true },
    });
    return many.map((me) => ({
      ...me.etape,
      duree_etape: me.duree_etape ?? null,
      ordre_etape: me.ordre_etape,
      page_route: me.page_route ?? null,
      id_phase: me.id_phase,
    }));
  }

  async createEtape(dto: CreateEtapeDto) {
    // Ensure phase exists
    const phase = await this.prisma.phase.findUnique({
      where: { id_phase: dto.id_phase },
    });

    if (!phase) {
      throw new BadRequestException(
        `Phase avec id ${dto.id_phase} introuvable`,
      );
    }

    let etape;
    try {
      etape = await this.prisma.etapeProc.create({
        data: {
          lib_etape: dto.lib_etape,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        // Primary key collision (sequence out of sync). Compute next id manually.
        const max = await this.prisma.etapeProc.aggregate({
          _max: { id_etape: true },
        });
        const nextId = (max._max.id_etape ?? 0) + 1;
        etape = await this.prisma.etapeProc.create({
          data: {
            id_etape: nextId,
            lib_etape: dto.lib_etape,
          },
        });
      } else {
        throw error;
      }
    }

    await this.prisma.manyEtape.create({
      data: {
        id_phase: dto.id_phase,
        id_etape: etape.id_etape,
        ordre_etape: dto.ordre_etape,
        duree_etape: dto.duree_etape ?? null,
        page_route: dto.page_route ?? null,
      },
    });

    return {
      ...etape,
      duree_etape: dto.duree_etape ?? null,
      ordre_etape: dto.ordre_etape,
      page_route: dto.page_route ?? null,
      id_phase: dto.id_phase,
    };
  }

  async updateEtape(id_etape: number, dto: UpdateEtapeDto) {
    try {
      const updatedEtape = await this.prisma.etapeProc.update({
        where: { id_etape },
        data: { lib_etape: dto.lib_etape },
      });

      if (dto.id_phase != null) {
        await this.prisma.manyEtape.upsert({
          where: {
            id_phase_id_etape: {
              id_phase: dto.id_phase,
              id_etape,
            },
          },
          create: {
            id_phase: dto.id_phase,
            id_etape,
            ordre_etape: dto.ordre_etape ?? 0,
            duree_etape: dto.duree_etape ?? null,
            page_route: dto.page_route ?? null,
          },
          update: {
            ordre_etape: dto.ordre_etape ?? 0,
            duree_etape: dto.duree_etape ?? null,
            page_route: dto.page_route ?? null,
          },
        });
      }

      return {
        ...updatedEtape,
        duree_etape: dto.duree_etape ?? null,
        ordre_etape: dto.ordre_etape ?? null,
        page_route: dto.page_route ?? null,
        id_phase: dto.id_phase ?? null,
      };
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Étape avec id ${id_etape} introuvable`);
      }
      throw new BadRequestException("Erreur lors de la mise à jour de l'étape");
    }
  }

  async deleteEtape(id_etape: number) {
    try {
      await this.prisma.manyEtape.deleteMany({
        where: { id_etape },
      });
      return await this.prisma.etapeProc.delete({
        where: { id_etape },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Étape avec id ${id_etape} introuvable`);
      }
      throw error;
    }
  }

  // Combinaisons et relations Phase / TypeProc / TypePermis

  async findAllCombinaisons() {
    return this.prisma.combinaisonPermisProc.findMany({
      include: {
        typePermis: true,
        typeProc: true,
      },
      orderBy: [{ id_typePermis: 'asc' }, { id_typeProc: 'asc' }],
    });
  }

  async createCombinaison(
    dto: CreateCombinaisonPermisProcDto & { duree_regl_proc?: number | null },
  ) {
    // Ensure referenced types exist
    const typePermis = await this.prisma.typePermis.findUnique({
      where: { id: dto.id_typePermis },
    });
    const typeProc = await this.prisma.typeProcedure.findUnique({
      where: { id: dto.id_typeProc },
    });

    if (!typePermis) {
      throw new BadRequestException(
        `Type de permis avec id ${dto.id_typePermis} introuvable`,
      );
    }

    if (!typeProc) {
      throw new BadRequestException(
        `Type de procédure avec id ${dto.id_typeProc} introuvable`,
      );
    }

    const existing = await this.prisma.combinaisonPermisProc.findFirst({
      where: {
        id_typePermis: dto.id_typePermis,
        id_typeProc: dto.id_typeProc,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Cette combinaison type permis / type procédure existe déjà.',
      );
    }

    return this.prisma.combinaisonPermisProc.create({
      data: {
        id_typePermis: dto.id_typePermis,
        id_typeProc: dto.id_typeProc,
        duree_regl_proc: dto.duree_regl_proc ?? null,
      },
    });
  }

  async deleteCombinaison(id_combinaison: number) {
    const relationsCount = await this.prisma.relationPhaseTypeProc.count({
      where: { id_combinaison },
    });

    if (relationsCount > 0) {
      throw new BadRequestException(
        "Impossible de supprimer une combinaison utilisée par des phases. Retirez d'abord ses phases associées.",
      );
    }

    try {
      return await this.prisma.combinaisonPermisProc.delete({
        where: { id_combinaison },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(
          `Combinaison avec id ${id_combinaison} introuvable`,
        );
      }
      throw error;
    }
  }

  async updateCombinaison(
    id_combinaison: number,
    dto: UpdateCombinaisonPermisProcDto & { duree_regl_proc?: number | null },
  ) {
    try {
      return await this.prisma.combinaisonPermisProc.update({
        where: { id_combinaison },
        data: {
          duree_regl_proc: dto.duree_regl_proc ?? null,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(
          `Combinaison avec id ${id_combinaison} introuvable`,
        );
      }
      throw new BadRequestException(
        'Erreur lors de la mise à jour de la combinaison.',
      );
    }
  }

  async findRelationsByCombinaison(id_combinaison: number) {
    return this.prisma.relationPhaseTypeProc.findMany({
      where: { id_combinaison },
      include: {
        manyEtape: {
          include: {
            phase: true,
            etape: true,
          },
        },
      },
      orderBy: [{ ordre: 'asc' }],
    });
  }

  async createRelation(
    dto: CreateRelationPhaseTypeProcDto & { ordre?: number | null },
  ) {
    const idManyRaw =
      (dto as any).id_manyEtate != null ? (dto as any).id_manyEtate : dto.id_manyEtape;
    const idMany = idManyRaw != null ? Number(idManyRaw) : null;
    const idComb = dto.id_combinaison != null ? Number(dto.id_combinaison) : null;
    if (idMany == null || Number.isNaN(idMany)) {
      throw new BadRequestException('id_manyEtape manquant ou invalide');
    }
    if (idComb == null || Number.isNaN(idComb)) {
      throw new BadRequestException('id_combinaison manquant ou invalide');
    }

    // Optional: prevent duplicates for same (id_manyEtape, id_combinaison)
    const existing = await this.prisma.relationPhaseTypeProc.findFirst({
      where: {
        id_manyEtape: idMany,
        id_combinaison: idComb,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Une relation pour cette phase et cette combinaison existe déjà.',
      );
    }

    return this.prisma.relationPhaseTypeProc.create({
      data: {
        id_manyEtape: idMany,
        id_combinaison: idComb,
        ordre: dto.ordre ?? null,
        dureeEstimee: dto.dureeEstimee ?? null,
      },
    });
  }

  async updateRelation(
    id_relation: number,
    dto: UpdateRelationPhaseTypeProcDto,
  ) {
    try {
      const data: any = {
        ordre: (dto as any).ordre ?? null,
        dureeEstimee: dto.dureeEstimee ?? null,
      };
      const idManyRaw =
        (dto as any).id_manyEtate != null ? (dto as any).id_manyEtate : (dto as any).id_manyEtape;
      if (idManyRaw != null) {
        const idMany = Number(idManyRaw);
        if (Number.isNaN(idMany)) {
          throw new BadRequestException('id_manyEtape invalide');
        }
        data.id_manyEtape = idMany;
      }
      if (dto.id_combinaison != null) {
        const idComb = Number(dto.id_combinaison);
        if (Number.isNaN(idComb)) {
          throw new BadRequestException('id_combinaison invalide');
        }
        data.id_combinaison = idComb;
      }

      return await this.prisma.relationPhaseTypeProc.update({
        where: { id_relation },
        data,
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(
          `Relation phase/typeProc avec id ${id_relation} introuvable`,
        );
      }
      throw new BadRequestException(
        'Erreur lors de la mise à jour de la relation phase / type procédure',
      );
    }
  }

  async deleteRelation(id_relation: number) {
    try {
      return await this.prisma.relationPhaseTypeProc.delete({
        where: { id_relation },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(
          `Relation phase/typeProc avec id ${id_relation} introuvable`,
        );
      }
      throw error;
    }
  }
}
