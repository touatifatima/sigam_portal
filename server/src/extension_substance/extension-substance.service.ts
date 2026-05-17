import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Enumpriorite, Prisma, StatutProcedure } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { buildDemandeCode } from 'src/demandes/utils/demande-code';
import { NotificationsService } from 'src/notifications/notifications.service';

type SubstanceInput = {
  id_substance?: number;
  id_sub?: number;
  id?: number;
  priorite?: 'principale' | 'secondaire' | null;
};

@Injectable()
export class ExtensionSubstanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async createProcedureWithRetry(
    codeType: string,
    suffix: string,
    statut: StatutProcedure,
  ) {
    const procCount = await this.prisma.procedurePortail.count();
    const baseNumProc = `PROC-${codeType}-${procCount + 1}-${suffix}`;
    let created: { id_proc: number; num_proc: string | null } | null = null;
    let attempt = 0;

    while (!created && attempt < 3) {
      const candidateNum =
        attempt === 0 ? baseNumProc : `${baseNumProc}-${attempt}`;
      try {
        created = await this.prisma.procedurePortail.create({
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
            created = await this.prisma.procedurePortail.create({
              data: {
                num_proc: `PROC-${codeType}-${Date.now()}-${suffix}`,
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

    if (!created?.id_proc) {
      throw new InternalServerErrorException(
        'Impossible de créer la procédure d’extension substances.',
      );
    }
    return created;
  }

  private async resolveTypeProcedureExtensionSubstance() {
    const exact = await this.prisma.typeProcedure.findFirst({
      where: {
        AND: [
          { libelle: { contains: 'extension', mode: 'insensitive' } },
          { libelle: { contains: 'substance', mode: 'insensitive' } },
        ],
      },
    });
    if (exact) return exact;

    const fallback = await this.prisma.typeProcedure.findFirst({
      where: { libelle: { contains: 'extension', mode: 'insensitive' } },
    });
    if (fallback) return fallback;

    throw new NotFoundException(
      'TypeProcedure extension substances introuvable.',
    );
  }

  private async getBaseSubstancesForPermis(
    permisId: number,
    excludeProcId?: number,
  ) {
    const links = await this.prisma.permisProcedure.findMany({
      where: {
        id_permis: permisId,
        ...(excludeProcId ? { id_proc: { not: excludeProcId } } : {}),
      },
      include: {
        procedure: {
          include: {
            SubstanceAssocieeDemande: {
              include: { substance: true },
            },
          },
        },
      },
      orderBy: { id_procedurePermis: 'desc' },
    });

    for (const link of links) {
      const subs = link.procedure?.SubstanceAssocieeDemande || [];
      if (subs.length) {
        return subs.map((s) => ({
          id_substance: s.id_substance,
          priorite: s.priorite ?? 'secondaire',
          nom_subFR: s.substance?.nom_subFR ?? null,
          nom_subAR: s.substance?.nom_subAR ?? null,
          categorie_sub: s.substance?.categorie_sub ?? null,
          source_proc: link.id_proc,
        }));
      }
    }
    return [];
  }

  async start(permisId: number, date_demande?: string, utilisateurId?: number) {
    if (!Number.isFinite(permisId)) {
      throw new BadRequestException('permisId invalide');
    }

    const permis = await this.prisma.permisPortail.findUnique({
      where: { id: permisId },
      include: {
        typePermis: true,
        permisProcedure: {
          include: {
            procedure: {
              include: {
                demandes: true,
              },
            },
          },
        },
      },
    });

    if (!permis) {
      throw new NotFoundException(`Permis ${permisId} introuvable`);
    }

    const linkedProcedures =
      permis.permisProcedure
        ?.map((r) => r.procedure)
        .filter((p): p is NonNullable<typeof p> => !!p)
        .sort((a, b) => {
          const da = a?.date_debut_proc
            ? new Date(a.date_debut_proc).getTime()
            : 0;
          const db = b?.date_debut_proc
            ? new Date(b.date_debut_proc).getTime()
            : 0;
          return db - da;
        }) ?? [];

    if (!linkedProcedures.length) {
      throw new NotFoundException(
        `Aucune procédure liée trouvée pour le permis ${permisId}`,
      );
    }

    const latestProc = linkedProcedures[0];
    const latestDemande =
      [...(latestProc.demandes || [])]
        .sort((a, b) => {
          const da = a?.date_demande ? new Date(a.date_demande).getTime() : 0;
          const db = b?.date_demande ? new Date(b.date_demande).getTime() : 0;
          return db - da;
        })[0] ?? null;

    const requestedUserId = Number(utilisateurId);
    const requesterUserId =
      Number.isFinite(requestedUserId) && requestedUserId > 0
        ? requestedUserId
        : Number(latestDemande?.utilisateurId);
    if (!Number.isFinite(requesterUserId) || requesterUserId <= 0) {
      throw new BadRequestException(
        'utilisateurId introuvable pour la demande d extension substances.',
      );
    }

    const typeProc = await this.resolveTypeProcedureExtensionSubstance();
    const codeType = permis.typePermis?.code_type ?? 'UNK';
    const newProcedure = await this.createProcedureWithRetry(
      codeType,
      'EXTS',
      StatutProcedure.EN_COURS,
    );

    await this.prisma.permisProcedure.create({
      data: { id_permis: permis.id, id_proc: newProcedure.id_proc },
    });

    const parsedDate =
      date_demande && !Number.isNaN(Date.parse(date_demande))
        ? new Date(date_demande)
        : new Date();
    const detenteurId = Number(permis.id_detenteur);
    const resolvedDetenteurId =
      Number.isFinite(detenteurId) && detenteurId > 0 ? detenteurId : null;

    const newDemande = await this.prisma.demandePortail.create({
      data: {
        utilisateurId: requesterUserId,
        id_proc: newProcedure.id_proc,
        id_typePermis: permis.id_typePermis,
        id_typeProc: typeProc.id,
        id_wilaya: latestDemande?.id_wilaya ?? undefined,
        id_daira: latestDemande?.id_daira ?? undefined,
        id_commune: latestDemande?.id_commune ?? undefined,
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
      select: { id_demande: true },
    });

    const generatedCode = buildDemandeCode(
      'EXTSUB',
      codeType,
      newDemande.id_demande,
    );

    await this.prisma.demandePortail.update({
      where: { id_demande: newDemande.id_demande },
      data: {
        code_demande: generatedCode,
      },
    });

    // L'extension substances suit aussi le flux "modification" côté métier.
    await this.prisma.demModification.upsert({
      where: { id_demande: newDemande.id_demande },
      update: {
        type_modification: 'EXTENSION_SUBSTANCE',
        type_modif: 'EXTENSION',
        statut_modification: 'EN_COURS',
      },
      create: {
        id_demande: newDemande.id_demande,
        type_modification: 'EXTENSION_SUBSTANCE',
        type_modif: 'EXTENSION',
        statut_modification: 'EN_COURS',
      },
    });

    try {
      await this.notificationsService.createAdminNewDemandeNotification({
        demandeId: newDemande.id_demande,
        demandeCode: generatedCode,
        requesterUserId,
      });
    } catch (error) {
      console.warn(
        'Failed to create admin notification for extension-substance demande',
        error,
      );
    }

    const baseSubstances = await this.getBaseSubstancesForPermis(
      permis.id,
      newProcedure.id_proc,
    );
    if (baseSubstances.length) {
      await this.prisma.substanceAssocieeDemande.createMany({
        data: baseSubstances
          .filter((s) => Number.isFinite(Number(s.id_substance)))
          .map((s) => ({
            id_proc: newProcedure.id_proc,
            id_substance: Number(s.id_substance),
            priorite:
              s.priorite === 'principale'
                ? Enumpriorite.principale
                : Enumpriorite.secondaire,
          })),
        skipDuplicates: true,
      });
    }

    return {
      new_proc_id: newProcedure.id_proc,
      new_demande_id: newDemande.id_demande,
      id_permis: permis.id,
      copied_substances: baseSubstances.length,
    };
  }

  async getSubstancesForStep1(procId: number) {
    if (!Number.isFinite(procId)) {
      throw new BadRequestException('id_proc invalide');
    }

    const link = await this.prisma.permisProcedure.findFirst({
      where: { id_proc: procId },
      select: { id_permis: true },
    });
    if (!link?.id_permis) {
      throw new NotFoundException(`Permis non trouvé pour la procédure ${procId}`);
    }

    const [allSubstances, currentProcSubs, baseSubstances] = await Promise.all([
      this.prisma.substance.findMany({
        orderBy: { nom_subFR: 'asc' },
        select: {
          id_sub: true,
          nom_subFR: true,
          nom_subAR: true,
          categorie_sub: true,
        },
      }),
      this.prisma.substanceAssocieeDemande.findMany({
        where: { id_proc: procId },
        include: { substance: true },
      }),
      this.getBaseSubstancesForPermis(link.id_permis, procId),
    ]);

    const baseSet = new Set(
      baseSubstances
        .map((s) => Number(s.id_substance))
        .filter((id) => Number.isFinite(id)),
    );

    const currentSubstances = baseSubstances.map((s) => ({
      id_substance: s.id_substance,
      nom_subFR: s.nom_subFR,
      nom_subAR: s.nom_subAR,
      categorie_sub: s.categorie_sub,
      priorite: s.priorite ?? 'secondaire',
      readOnly: true,
    }));

    const selectedAdded = currentProcSubs
      .filter((s) => {
        const id = Number(s.id_substance);
        return Number.isFinite(id) && !baseSet.has(id);
      })
      .map((s) => ({
        id_substance: s.id_substance,
        nom_subFR: s.substance?.nom_subFR ?? null,
        nom_subAR: s.substance?.nom_subAR ?? null,
        categorie_sub: s.substance?.categorie_sub ?? null,
        priorite: s.priorite ?? 'secondaire',
      }));

    const availableSubstances = allSubstances.filter(
      (s) => !baseSet.has(Number(s.id_sub)),
    );

    const demande = await this.prisma.demandePortail.findFirst({
      where: { id_proc: procId },
      select: { id_demande: true, code_demande: true },
      orderBy: { id_demande: 'desc' },
    });

    return {
      id_proc: procId,
      id_permis: link.id_permis,
      id_demande: demande?.id_demande ?? null,
      code_demande: demande?.code_demande ?? null,
      currentSubstances,
      selectedAdded,
      availableSubstances,
    };
  }

  async saveAddedSubstances(procId: number, substances: SubstanceInput[]) {
    if (!Number.isFinite(procId)) {
      throw new BadRequestException('id_proc invalide');
    }
    if (!Array.isArray(substances)) {
      throw new BadRequestException('substances doit être une liste');
    }

    const link = await this.prisma.permisProcedure.findFirst({
      where: { id_proc: procId },
      select: { id_permis: true },
    });
    if (!link?.id_permis) {
      throw new NotFoundException(`Permis non trouvé pour la procédure ${procId}`);
    }

    const baseSubstances = await this.getBaseSubstancesForPermis(
      link.id_permis,
      procId,
    );
    const baseSet = new Set(
      baseSubstances
        .map((s) => Number(s.id_substance))
        .filter((id) => Number.isFinite(id)),
    );

    const normalized = substances
      .map((raw) => {
        const id =
          Number(raw?.id_substance ?? raw?.id_sub ?? raw?.id ?? Number.NaN);
        if (!Number.isFinite(id)) return null;
        return {
          id_substance: id,
          priorite:
            raw?.priorite === 'principale'
              ? Enumpriorite.principale
              : Enumpriorite.secondaire,
        };
      })
      .filter((v): v is { id_substance: number; priorite: Enumpriorite } => !!v);

    const uniqueMap = new Map<number, { id_substance: number; priorite: 'principale' | 'secondaire' }>();
    normalized.forEach((item) => {
      if (!baseSet.has(item.id_substance)) {
        uniqueMap.set(item.id_substance, item);
      }
    });
    const toSave = Array.from(uniqueMap.values());

    await this.prisma.substanceAssocieeDemande.deleteMany({
      where: {
        id_proc: procId,
        id_substance: {
          notIn: Array.from(baseSet),
        },
      },
    });

    if (toSave.length) {
      await this.prisma.substanceAssocieeDemande.createMany({
        data: toSave.map((s) => ({
          id_proc: procId,
          id_substance: s.id_substance,
          priorite: s.priorite,
        })),
        skipDuplicates: true,
      });
    }

    return this.getSubstancesForStep1(procId);
  }
}

