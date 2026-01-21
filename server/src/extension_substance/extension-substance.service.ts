import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExtensionSubstanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Démarre (ou récupère) une procédure pour extension de substances.
   * Pour l'instant on réutilise la première procédure liée au permis (pas de nouvelle table).
   */
  async start(permisId: number) {
    if (!permisId) {
      throw new NotFoundException('permisId manquant');
    }

    const link = await this.prisma.permisProcedure.findFirst({
      where: { id_permis: permisId },
      orderBy: { id_procedurePermis: 'asc' },
      include: {
        procedure: {
          include: {
            SubstanceAssocieeDemande: { include: { substance: true } },
            demandes: true,
          },
        },
      },
    });

    if (!link?.procedure) {
      throw new NotFoundException(
        `Aucune procédure trouvée pour le permis ${permisId}`,
      );
    }

    const procedure = link.procedure;
    const latestDemande = [...(procedure.demandes || [])].sort(
      (a: any, b: any) => {
        const da = a?.date_demande ? new Date(a.date_demande).getTime() : 0;
        const db = b?.date_demande ? new Date(b.date_demande).getTime() : 0;
        return db - da;
      },
    )[0];

    return {
      id_proc: procedure.id_proc,
      num_proc: procedure.num_proc,
      id_demande: latestDemande?.id_demande ?? null,
      substances:
        procedure.SubstanceAssocieeDemande?.map((s: any) => ({
          id_sub: s.substance?.id_sub,
          nom_subFR: s.substance?.nom_subFR,
          nom_subAR: s.substance?.nom_subAR,
          categorie_sub: s.substance?.categorie_sub,
          priorite: s.priorite,
        })) ?? [],
    };
  }

  /**
   * Retourne les substances de la procédure (lecture seule).
   */
  async listSubstances(id_proc: number) {
    const proc = await this.prisma.procedurePortail.findUnique({
      where: { id_proc },
      include: {
        SubstanceAssocieeDemande: { include: { substance: true } },
        demandes: true,
      },
    });

    if (!proc) {
      throw new NotFoundException(`Procédure ${id_proc} introuvable`);
    }

    const latestDemande = [...(proc.demandes || [])].sort((a: any, b: any) => {
      const da = a?.date_demande ? new Date(a.date_demande).getTime() : 0;
      const db = b?.date_demande ? new Date(b.date_demande).getTime() : 0;
      return db - da;
    })[0];

    return {
      id_proc: proc.id_proc,
      num_proc: proc.num_proc,
      id_demande: latestDemande?.id_demande ?? null,
      substances:
        proc.SubstanceAssocieeDemande?.map((s: any) => ({
          id_sub: s.substance?.id_sub,
          nom_subFR: s.substance?.nom_subFR,
          nom_subAR: s.substance?.nom_subAR,
          categorie_sub: s.substance?.categorie_sub,
          priorite: s.priorite,
        })) ?? [],
    };
  }
}
