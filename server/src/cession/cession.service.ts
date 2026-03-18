import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  EnumTypeFonction,
  Prisma,
  StatutProcedure,
} from '@prisma/client';
import { buildDemandeCode } from 'src/demandes/utils/demande-code';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProcedureEtapeService } from 'src/procedure_etape/procedure-etape.service';
import { StartCessionDto } from './start-cession.dto';

@Injectable()
export class CessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly procedureEtapeService: ProcedureEtapeService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private normalizeString(value?: string | null): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private parseDate(value?: string | null): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private normalizeTaux(value: number): number {
    return Number((Number(value) || 0).toFixed(4));
  }

  private isAcceptedStatus(value?: string | null): boolean {
    const normalized = (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();
    return normalized === 'ACCEPTEE';
  }

  private parseCessionPayload(remarques?: string | null): {
    cedantActionnaireId: number | null;
    tauxCede: number | null;
    beneficiaries: Array<{ id_actionnaire: number; taux: number }>;
  } {
    if (!remarques) {
      return {
        cedantActionnaireId: null,
        tauxCede: null,
        beneficiaries: [],
      };
    }

    try {
      const raw = JSON.parse(remarques) as any;
      const rawBeneficiaries = Array.isArray(raw?.beneficiaries)
        ? raw.beneficiaries
        : [];

      const beneficiaries = rawBeneficiaries
        .map((item: any) => ({
          id_actionnaire: Number(item?.id_actionnaire),
          taux: this.normalizeTaux(Number(item?.taux)),
        }))
        .filter(
          (item) =>
            Number.isFinite(item.id_actionnaire) &&
            Number.isFinite(item.taux) &&
            item.taux > 0,
        );

      const cedantActionnaireId = Number(raw?.cedant?.id_actionnaire);
      const tauxCede = Number(raw?.cedant?.taux_cede);

      return {
        cedantActionnaireId: Number.isFinite(cedantActionnaireId)
          ? cedantActionnaireId
          : null,
        tauxCede: Number.isFinite(tauxCede)
          ? this.normalizeTaux(tauxCede)
          : null,
        beneficiaries,
      };
    } catch {
      return {
        cedantActionnaireId: null,
        tauxCede: null,
        beneficiaries: [],
      };
    }
  }

  private getAllowedFonctionsForCession(): EnumTypeFonction[] {
    return [
      EnumTypeFonction.Actionnaire,
      EnumTypeFonction.Representant_Actionnaire,
      EnumTypeFonction.Representant,
    ];
  }

  private async resolveTypeProcedureCession(tx: Prisma.TransactionClient) {
    const exact = await tx.typeProcedure.findFirst({
      where: { libelle: { equals: 'cession', mode: 'insensitive' } },
    });
    if (exact) return exact;

    const fallback = await tx.typeProcedure.findFirst({
      where: { libelle: { contains: 'cession', mode: 'insensitive' } },
    });
    if (fallback) return fallback;

    throw new BadRequestException(
      'Le type de procédure "cession" est introuvable.',
    );
  }

  private async createProcedureWithRetry(
    tx: Prisma.TransactionClient,
    codeType: string,
    typeProcId: number,
  ) {
    // Ne jamais faire de retry CREATE dans la meme transaction apres une erreur SQL:
    // Postgres marque la transaction comme "aborted" (25P02).
    // Strategie: creer d'abord la ligne, puis construire un num_proc unique via id_proc.
    const created = await tx.procedurePortail.create({
      data: {
        num_proc: null,
        date_debut_proc: new Date(),
        statut_proc: StatutProcedure.EN_COURS,
        typeProcedureId: typeProcId,
      },
      select: { id_proc: true },
    });

    if (!created?.id_proc) {
      throw new InternalServerErrorException(
        'Impossible de creer la procedure de cession.',
      );
    }

    return tx.procedurePortail.update({
      where: { id_proc: created.id_proc },
      data: { num_proc: `PROC-${codeType}-${created.id_proc}-CES` },
      select: { id_proc: true, num_proc: true },
    });
  }


  async getActionnairesForPermis(permisId: number) {
    const permis = await this.prisma.permisPortail.findUnique({
      where: { id: permisId },
      include: {
        detenteur: {
          select: {
            id_detenteur: true,
            nom_societeFR: true,
            nom_societeAR: true,
          },
        },
        typePermis: {
          select: { lib_type: true, code_type: true },
        },
      },
    });

    if (!permis) {
      throw new NotFoundException(`Permis ${permisId} introuvable.`);
    }
    if (!permis.id_detenteur) {
      throw new BadRequestException(
        'Ce permis n’a pas de détenteur lié.',
      );
    }

    const rows = await this.prisma.fonctionPersonneMoral.findMany({
      where: {
        id_detenteur: permis.id_detenteur,
        type_fonction: { in: this.getAllowedFonctionsForCession() },
      },
      include: {
        personne: {
          include: {
            pays: true,
            nationaliteRef: true,
          },
        },
      },
      orderBy: [{ taux_participation: 'desc' }, { id_fonctionDetent: 'asc' }],
    });

    const actionnaires = rows.map((row) => ({
      id_actionnaire: row.id_fonctionDetent,
      id_personne: row.id_personne,
      nom: row.personne?.nomFR ?? '',
      prenom: row.personne?.prenomFR ?? '',
      nomAR: row.personne?.nomAR ?? null,
      prenomAR: row.personne?.prenomAR ?? null,
      lieu_naissance: row.personne?.lieu_naissance ?? null,
      nationalite: row.personne?.nationaliteRef?.libelle ?? null,
      id_nationalite: row.personne?.id_nationalite ?? null,
      qualification: row.personne?.qualification ?? null,
      numero_carte: row.personne?.num_carte_identite ?? null,
      taux: this.normalizeTaux(Number(row.taux_participation ?? 0)),
      id_pays: row.personne?.id_pays ?? null,
      pays: row.personne?.pays?.nom_pays ?? null,
      statut_personne: row.statut_personne ?? null,
      type_fonction: row.type_fonction ?? null,
    }));

    const total = this.normalizeTaux(
      actionnaires.reduce((sum, item) => sum + Number(item.taux || 0), 0),
    );

    return {
      id_permis: permis.id,
      code_permis: permis.code_permis ?? `PERMIS-${permis.id}`,
      id_detenteur: permis.id_detenteur,
      detenteur: permis.detenteur
        ? {
            id_detenteur: permis.detenteur.id_detenteur,
            nom_societeFR: permis.detenteur.nom_societeFR ?? null,
            nom_societeAR: permis.detenteur.nom_societeAR ?? null,
          }
        : null,
      type_permis: permis.typePermis
        ? {
            lib_type: permis.typePermis.lib_type ?? null,
            code_type: permis.typePermis.code_type ?? null,
          }
        : null,
      total_taux: total,
      actionnaires,
    };
  }

  async startCession(dto: StartCessionDto) {
    const permisId = Number(dto.permisId);
    const cedantActionnaireId = Number(dto.cedantActionnaireId);
    const tauxCede = this.normalizeTaux(Number(dto.tauxCede));

    if (!Number.isFinite(permisId)) {
      throw new BadRequestException('permisId invalide.');
    }
    if (!Number.isFinite(cedantActionnaireId)) {
      throw new BadRequestException('Actionnaire cédant invalide.');
    }
    if (!Number.isFinite(tauxCede) || tauxCede <= 0) {
      throw new BadRequestException(
        'Le taux cédé doit être strictement positif.',
      );
    }
    if (!Array.isArray(dto.beneficiaries) || dto.beneficiaries.length === 0) {
      throw new BadRequestException(
        'Au moins un bénéficiaire doit être sélectionné.',
      );
    }

    const normalizedBeneficiaries = dto.beneficiaries.map((benef) => ({
      id_actionnaire: Number(benef.id_actionnaire),
      taux: this.normalizeTaux(Number(benef.taux)),
    }));

    if (
      normalizedBeneficiaries.some(
        (benef) =>
          !Number.isFinite(benef.id_actionnaire) ||
          !Number.isFinite(benef.taux) ||
          benef.taux <= 0,
      )
    ) {
      throw new BadRequestException(
        'Chaque bénéficiaire doit avoir un id_actionnaire et un taux valide.',
      );
    }

    const uniqueBeneficiaries = new Set(
      normalizedBeneficiaries.map((benef) => benef.id_actionnaire),
    );
    if (uniqueBeneficiaries.size !== normalizedBeneficiaries.length) {
      throw new BadRequestException(
        'Un bénéficiaire ne peut apparaître qu’une seule fois.',
      );
    }

    const totalBeneficiary = this.normalizeTaux(
      normalizedBeneficiaries.reduce((sum, benef) => sum + benef.taux, 0),
    );
    if (Math.abs(totalBeneficiary - tauxCede) > 0.0001) {
      throw new BadRequestException(
        'La somme des taux des bénéficiaires doit être égale au taux cédé.',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const permis = await tx.permisPortail.findUnique({
        where: { id: permisId },
        include: {
          typePermis: true,
          detenteur: true,
        },
      });

      if (!permis) {
        throw new NotFoundException(`Permis ${permisId} introuvable.`);
      }
      if (!permis.id_detenteur) {
        throw new BadRequestException('Le permis ne possède pas de détenteur.');
      }

      const existingOpen = await tx.demCession.findFirst({
        where: {
          demande: {
            statut_demande: {
              in: [StatutProcedure.EN_COURS, StatutProcedure.EN_ATTENTE],
            },
            procedure: {
              permisProcedure: {
                some: { id_permis: permisId },
              },
            },
          },
        },
        select: {
          id_cession: true,
          id_demande: true,
          demande: { select: { id_proc: true } },
        },
        orderBy: { id_cession: 'desc' },
      });

      if (existingOpen?.demande?.id_proc) {
        return {
          existing: true,
          new_proc_id: existingOpen.demande.id_proc,
          new_demande_id: existingOpen.id_demande,
          id_cession: existingOpen.id_cession,
        };
      }

      const actionnaires = await tx.fonctionPersonneMoral.findMany({
        where: {
          id_detenteur: permis.id_detenteur,
          type_fonction: { in: this.getAllowedFonctionsForCession() },
        },
        include: { personne: true },
      });

      const cedant = actionnaires.find(
        (row) => row.id_fonctionDetent === cedantActionnaireId,
      );
      if (!cedant) {
        throw new BadRequestException(
          "L'actionnaire cédant est introuvable pour cette société.",
        );
      }

      const cedantCurrent = this.normalizeTaux(
        Number(cedant.taux_participation ?? 0),
      );
      if (tauxCede > cedantCurrent + 0.0001) {
        throw new BadRequestException(
          `Le taux cédé (${tauxCede}%) dépasse le taux du cédant (${cedantCurrent}%).`,
        );
      }

      const beneficiaries = normalizedBeneficiaries.map((benef) => {
        if (benef.id_actionnaire === cedantActionnaireId) {
          throw new BadRequestException(
            'Le cédant ne peut pas être bénéficiaire de la même cession.',
          );
        }
        const row = actionnaires.find(
          (item) => item.id_fonctionDetent === benef.id_actionnaire,
        );
        if (!row) {
          throw new BadRequestException(
            `Bénéficiaire introuvable: ${benef.id_actionnaire}.`,
          );
        }
        return { row, taux: benef.taux };
      });

      const totalBefore = this.normalizeTaux(
        actionnaires.reduce(
          (sum, row) => sum + Number(row.taux_participation ?? 0),
          0,
        ),
      );

      const cedantAfter = this.normalizeTaux(cedantCurrent - tauxCede);
      const projected = new Map<number, number>(
        actionnaires.map((row) => [
          row.id_fonctionDetent,
          this.normalizeTaux(Number(row.taux_participation ?? 0)),
        ]),
      );
      projected.set(cedantActionnaireId, cedantAfter);
      for (const benef of beneficiaries) {
        const current = projected.get(benef.row.id_fonctionDetent) ?? 0;
        projected.set(
          benef.row.id_fonctionDetent,
          this.normalizeTaux(current + benef.taux),
        );
      }

      const totalAfter = this.normalizeTaux(
        Array.from(projected.values()).reduce((sum, value) => sum + value, 0),
      );
      if (Math.abs(totalBefore - totalAfter) > 0.0001) {
        throw new BadRequestException(
          'La cession déséquilibre le total des participations.',
        );
      }

      const latestDemande = await tx.demandePortail.findFirst({
        where: {
          procedure: {
            permisProcedure: { some: { id_permis: permisId } },
          },
        },
        orderBy: { id_demande: 'desc' },
        select: {
          id_demande: true,
          id_proc: true,
          utilisateurId: true,
          id_wilaya: true,
          id_daira: true,
          id_commune: true,
        },
      });

      if (!latestDemande?.utilisateurId) {
        throw new BadRequestException(
          'Impossible de déterminer l’utilisateur source pour la cession.',
        );
      }

      const typeProc = await this.resolveTypeProcedureCession(tx);
      const codeType = permis.typePermis?.code_type ?? 'UNK';
      const newProcedure = await this.createProcedureWithRetry(
        tx,
        codeType,
        typeProc.id,
      );

      await tx.permisProcedure.create({
        data: {
          id_permis: permisId,
          id_proc: newProcedure.id_proc,
        },
      });

      const parsedDate = this.parseDate(dto.date_demande) ?? new Date();
      const detenteurId = Number(permis.id_detenteur);
      const resolvedDetenteurId =
        Number.isFinite(detenteurId) && detenteurId > 0
          ? detenteurId
          : null;
      const createdDemande = await tx.demandePortail.create({
        data: {
          utilisateurId: latestDemande.utilisateurId,
          id_proc: newProcedure.id_proc,
          id_sourceProc: latestDemande.id_proc ?? undefined,
          id_typeProc: typeProc.id,
          id_typePermis: permis.id_typePermis,
          id_wilaya: latestDemande.id_wilaya ?? undefined,
          id_daira: latestDemande.id_daira ?? undefined,
          id_commune: latestDemande.id_commune ?? undefined,
          code_demande: null,
          statut_demande: StatutProcedure.EN_COURS,
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
        'CES',
        codeType,
        createdDemande.id_demande,
      );

      await tx.demandePortail.update({
        where: { id_demande: createdDemande.id_demande },
        data: {
          code_demande: generatedCode,
          remarques: JSON.stringify({
            beneficiaries: beneficiaries.map((benef) => ({
              id_actionnaire: benef.row.id_fonctionDetent,
              id_personne: benef.row.id_personne,
              taux: benef.taux,
            })),
            cedant: {
              id_actionnaire: cedant.id_fonctionDetent,
              id_personne: cedant.id_personne,
              taux_cede: tauxCede,
            },
          }),
        },
      });

      if (!cedant.id_personne || !beneficiaries[0]?.row?.id_personne) {
        throw new BadRequestException(
          'Impossible de créer la cession: personnes physiques manquantes.',
        );
      }

      const nature =
        Math.abs(cedantAfter) < 0.0001 ? 'COMPLET' : 'PARTIEL';
      const cession = await tx.demCession.create({
        data: {
          id_demande: createdDemande.id_demande,
          id_ancienCessionnaire: cedant.id_personne,
          id_nouveauCessionnaire: beneficiaries[0].row.id_personne,
          motif_cession: this.normalizeString(dto.motif_cession) ?? 'Cession de parts',
          nature_cession: nature,
          taux_cession: tauxCede,
          date_validation: null,
        },
        select: { id_cession: true },
      });

      return {
        existing: false,
        new_proc_id: newProcedure.id_proc,
        new_demande_id: createdDemande.id_demande,
        id_cession: cession.id_cession,
        demande_code: generatedCode,
        requester_user_id: latestDemande.utilisateurId,
      };
    });

    if (!result.existing && Number.isFinite(Number(result.new_demande_id))) {
      try {
        await this.notificationsService.createAdminNewDemandeNotification({
          demandeId: Number(result.new_demande_id),
          demandeCode: (result as any).demande_code ?? null,
          requesterUserId:
            Number((result as any).requester_user_id || 0) || undefined,
        });
      } catch (error) {
        console.warn(
          'Failed to create admin notification for cession demande',
          error,
        );
      }
    }

    await this.procedureEtapeService.ensureProcedureHasPhases(result.new_proc_id);
    const procWithPhases = await this.procedureEtapeService.getProcedureWithPhases(
      result.new_proc_id,
    );
    const orderedEtapes = (procWithPhases?.ProcedurePhase || [])
      .slice()
      .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
      .flatMap((pp: any) =>
        (pp.phase?.etapes || [])
          .slice()
          .sort((a: any, b: any) => (a.ordre ?? 0) - (b.ordre ?? 0)),
      );

    const first = orderedEtapes[0]?.id_etape;
    const second = orderedEtapes[1]?.id_etape;

    if (first && second) {
      await this.procedureEtapeService.setStepStatus(
        result.new_proc_id,
        first,
        StatutProcedure.TERMINEE,
      );
      await this.procedureEtapeService.setStepStatus(
        result.new_proc_id,
        second,
        StatutProcedure.EN_COURS,
      );
    } else if (first) {
      await this.procedureEtapeService.setStepStatus(
        result.new_proc_id,
        first,
        StatutProcedure.EN_COURS,
      );
    }

    return result;
  }

  async applyAcceptedCessionByDemandeId(idDemande: number) {
    if (!Number.isFinite(idDemande)) {
      throw new BadRequestException('idDemande invalide.');
    }

    return this.prisma.$transaction(async (tx) => {
      const cession = await tx.demCession.findUnique({
        where: { id_demande: idDemande },
        include: {
          demande: {
            select: {
              id_demande: true,
              id_proc: true,
              statut_demande: true,
              remarques: true,
            },
          },
        },
      });

      if (!cession?.demande) {
        return { applied: false, reason: 'NOT_CESSION' as const };
      }

      if (!this.isAcceptedStatus(cession.demande.statut_demande)) {
        return { applied: false, reason: 'NOT_ACCEPTED' as const };
      }

      if (cession.date_validation) {
        return { applied: false, reason: 'ALREADY_APPLIED' as const };
      }

      if (!cession.demande.id_proc) {
        throw new BadRequestException(
          'Demande de cession invalide: id_proc manquant.',
        );
      }

      const permisLink = await tx.permisProcedure.findFirst({
        where: { id_proc: cession.demande.id_proc },
        include: {
          permis: {
            select: { id_detenteur: true },
          },
        },
      });

      const idDetenteur = permisLink?.permis?.id_detenteur ?? null;
      if (!idDetenteur) {
        throw new BadRequestException(
          'Impossible d’appliquer la cession: détenteur introuvable.',
        );
      }

      const actionnaires = await tx.fonctionPersonneMoral.findMany({
        where: {
          id_detenteur: idDetenteur,
          type_fonction: { in: this.getAllowedFonctionsForCession() },
        },
      });

      if (actionnaires.length === 0) {
        throw new BadRequestException(
          'Aucun actionnaire trouvé pour appliquer la cession.',
        );
      }

      const payload = this.parseCessionPayload(cession.demande.remarques);
      const cedantFallback = actionnaires.find(
        (row) => row.id_personne === cession.id_ancienCessionnaire,
      );

      const cedantActionnaireId =
        payload.cedantActionnaireId ?? cedantFallback?.id_fonctionDetent ?? null;
      if (!cedantActionnaireId) {
        throw new BadRequestException(
          'Cédant introuvable dans la société pour appliquer la cession.',
        );
      }

      const cedant = actionnaires.find(
        (row) => row.id_fonctionDetent === cedantActionnaireId,
      );
      if (!cedant) {
        throw new BadRequestException(
          'L’actionnaire cédant est introuvable pour l’application finale.',
        );
      }

      const rawBeneficiaries =
        payload.beneficiaries.length > 0
          ? payload.beneficiaries
          : (() => {
              const fallback = actionnaires.find(
                (row) => row.id_personne === cession.id_nouveauCessionnaire,
              );
              const taux = this.normalizeTaux(Number(cession.taux_cession ?? 0));
              if (!fallback || taux <= 0) return [];
              return [{ id_actionnaire: fallback.id_fonctionDetent, taux }];
            })();

      if (rawBeneficiaries.length === 0) {
        throw new BadRequestException(
          'Aucun bénéficiaire valide trouvé pour appliquer la cession.',
        );
      }

      const beneficiariesMap = new Map<number, number>();
      for (const item of rawBeneficiaries) {
        if (item.id_actionnaire === cedantActionnaireId) {
          throw new BadRequestException(
            'Le cédant ne peut pas être bénéficiaire de la cession.',
          );
        }
        const current = beneficiariesMap.get(item.id_actionnaire) ?? 0;
        beneficiariesMap.set(
          item.id_actionnaire,
          this.normalizeTaux(current + item.taux),
        );
      }

      const beneficiaries = Array.from(beneficiariesMap.entries()).map(
        ([id_actionnaire, taux]) => {
          const row = actionnaires.find(
            (item) => item.id_fonctionDetent === id_actionnaire,
          );
          if (!row) {
            throw new BadRequestException(
              `Bénéficiaire introuvable: ${id_actionnaire}.`,
            );
          }
          return { row, taux };
        },
      );

      const totalBeneficiary = this.normalizeTaux(
        beneficiaries.reduce((sum, benef) => sum + benef.taux, 0),
      );
      const tauxCede = this.normalizeTaux(
        payload.tauxCede ?? Number(cession.taux_cession ?? totalBeneficiary),
      );

      if (Math.abs(totalBeneficiary - tauxCede) > 0.0001) {
        throw new BadRequestException(
          'Incohérence des taux de cession: somme bénéficiaires différente du taux cédé.',
        );
      }

      const totalBefore = this.normalizeTaux(
        actionnaires.reduce(
          (sum, row) => sum + Number(row.taux_participation ?? 0),
          0,
        ),
      );

      const cedantCurrent = this.normalizeTaux(
        Number(cedant.taux_participation ?? 0),
      );
      if (tauxCede > cedantCurrent + 0.0001) {
        throw new BadRequestException(
          `Taux cédé (${tauxCede}%) supérieur au taux actuel du cédant (${cedantCurrent}%).`,
        );
      }

      const cedantAfter = this.normalizeTaux(cedantCurrent - tauxCede);
      const projected = new Map<number, number>(
        actionnaires.map((row) => [
          row.id_fonctionDetent,
          this.normalizeTaux(Number(row.taux_participation ?? 0)),
        ]),
      );
      projected.set(cedantActionnaireId, cedantAfter);
      for (const benef of beneficiaries) {
        const current = projected.get(benef.row.id_fonctionDetent) ?? 0;
        projected.set(
          benef.row.id_fonctionDetent,
          this.normalizeTaux(current + benef.taux),
        );
      }

      const totalAfter = this.normalizeTaux(
        Array.from(projected.values()).reduce((sum, value) => sum + value, 0),
      );
      if (Math.abs(totalBefore - totalAfter) > 0.0001) {
        throw new BadRequestException(
          'Application de cession refusée: total des participations déséquilibré.',
        );
      }

      await tx.fonctionPersonneMoral.update({
        where: { id_fonctionDetent: cedantActionnaireId },
        data: { taux_participation: cedantAfter },
      });

      for (const benef of beneficiaries) {
        const current = this.normalizeTaux(
          Number(benef.row.taux_participation ?? 0),
        );
        await tx.fonctionPersonneMoral.update({
          where: { id_fonctionDetent: benef.row.id_fonctionDetent },
          data: { taux_participation: this.normalizeTaux(current + benef.taux) },
        });
      }

      await tx.demCession.update({
        where: { id_cession: cession.id_cession },
        data: { date_validation: new Date() },
      });

      return {
        applied: true,
        reason: 'APPLIED' as const,
        id_demande: idDemande,
        id_cession: cession.id_cession,
      };
    });
  }
}

