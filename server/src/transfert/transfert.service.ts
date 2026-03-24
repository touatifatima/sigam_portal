import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { EnumTypeDetenteur, Prisma, StatutProcedure } from '@prisma/client';
import { buildDemandeCode } from 'src/demandes/utils/demande-code';
import { NotificationsService } from 'src/notifications/notifications.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProcedureEtapeService } from 'src/procedure_etape/procedure-etape.service';
import { CreateDetenteurDto } from './create-detenteur.dto';
import { StartTransfertDto } from './start-transfert.dto';

@Injectable()
export class TransfertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly procedureEtapeService: ProcedureEtapeService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private isNumericId(value: string): boolean {
    return /^\d+$/.test(value);
  }

  async resolvePermisId(permisIdOrCode: string): Promise<number> {
    const candidate = String(permisIdOrCode ?? '').trim();
    if (!candidate) {
      throw new BadRequestException('permisId invalide');
    }

    if (this.isNumericId(candidate)) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    const permis = await this.prisma.permisPortail.findFirst({
      where: { short_code: candidate } as any,
      select: { id: true },
    });

    if (!permis?.id) {
      throw new NotFoundException('Permis introuvable.');
    }

    return permis.id;
  }

  private normalizeString(value?: string | null): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private parseDate(value?: string | null): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private async resolveTypeProcedureTransfert(
    tx: Prisma.TransactionClient,
  ) {
    const exact = await tx.typeProcedure.findFirst({
      where: {
        libelle: {
          equals: 'transfert',
          mode: 'insensitive',
        },
      },
    });
    if (exact) return exact;

    const fallback = await tx.typeProcedure.findFirst({
      where: {
        libelle: {
          contains: 'transf',
          mode: 'insensitive',
        },
      },
    });
    if (fallback) return fallback;

    throw new BadRequestException(
      'Le type de procédure "transfert" est introuvable.',
    );
  }

  private async createProcedureWithRetry(
    tx: Prisma.TransactionClient,
    codeType: string,
    typeProcId: number,
  ) {
    const procCount = await tx.procedurePortail.count();
    const baseNumProc = `PROC-${codeType}-${procCount + 1}-TRF`;

    let created: { id_proc: number; num_proc: string | null } | null = null;
    let attempt = 0;

    while (!created && attempt < 3) {
      const candidate = attempt === 0 ? baseNumProc : `${baseNumProc}-${attempt}`;
      try {
        created = await tx.procedurePortail.create({
          data: {
            num_proc: candidate,
            date_debut_proc: new Date(),
            statut_proc: StatutProcedure.EN_COURS,
            typeProcedureId: typeProcId,
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
            created = await tx.procedurePortail.create({
              data: {
                num_proc: `PROC-${codeType}-${Date.now()}-TRF`,
                date_debut_proc: new Date(),
                statut_proc: StatutProcedure.EN_COURS,
                typeProcedureId: typeProcId,
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
        'Impossible de créer la procédure de transfert.',
      );
    }
    return created;
  }

  private async createDetenteur(
    payload: CreateDetenteurDto,
    tx: Prisma.TransactionClient,
  ) {
    const nomFR = this.normalizeString(payload.nom_societeFR);
    const nomAR = this.normalizeString(payload.nom_societeAR);
    if (!nomFR && !nomAR) {
      throw new BadRequestException(
        'Le nom de la société (FR ou AR) est obligatoire.',
      );
    }

    const dateConstitution =
      this.parseDate(payload.date_constitution) ?? new Date();

    const detenteur = await tx.detenteurMoralePortail.create({
      data: {
        nom_societeFR: nomFR,
        nom_societeAR: nomAR,
        date_constitution: dateConstitution,
        id_pays: payload.id_pays ?? null,
        adresse_siege: this.normalizeString(payload.adresse_siege),
        telephone: this.normalizeString(payload.telephone),
        fax: this.normalizeString(payload.fax),
        email: this.normalizeString(payload.email),
        site_web: this.normalizeString(payload.site_web),
        ...(payload.id_statutJuridique
          ? {
              FormeJuridiqueDetenteur: {
                create: {
                  id_statut: Number(payload.id_statutJuridique),
                  date: new Date(),
                },
              },
            }
          : {}),
      },
    });

    const rc = payload.registreCommerce;
    const hasRcData =
      !!this.normalizeString(rc?.numero_rc) ||
      !!this.normalizeString(rc?.nis) ||
      !!this.normalizeString(rc?.nif) ||
      !!this.normalizeString(rc?.adresse_legale) ||
      Number.isFinite(Number(rc?.capital_social)) ||
      !!this.parseDate(rc?.date_enregistrement);

    if (hasRcData) {
      await tx.registreCommercePortail.create({
        data: {
          id_detenteur: detenteur.id_detenteur,
          numero_rc: this.normalizeString(rc?.numero_rc),
          nis: this.normalizeString(rc?.nis),
          nif: this.normalizeString(rc?.nif),
          adresse_legale: this.normalizeString(rc?.adresse_legale),
          capital_social:
            Number.isFinite(Number(rc?.capital_social)) && rc?.capital_social != null
              ? Number(rc.capital_social)
              : null,
          date_enregistrement: this.parseDate(rc?.date_enregistrement),
        },
      });
    }

    return detenteur;
  }

  async createDetenteurFromDto(payload: CreateDetenteurDto) {
    return this.prisma.$transaction(async (tx) => {
      const created = await this.createDetenteur(payload, tx);
      const preview = await tx.detenteurMoralePortail.findUnique({
        where: { id_detenteur: created.id_detenteur },
        select: {
          id_detenteur: true,
          nom_societeFR: true,
          nom_societeAR: true,
          date_constitution: true,
          registreCommerce: {
            select: { capital_social: true, date_enregistrement: true },
            take: 1,
            orderBy: { id: 'desc' },
          },
        },
      });
      return {
        id_detenteur: preview?.id_detenteur ?? created.id_detenteur,
        nom_societeFR: preview?.nom_societeFR ?? null,
        nom_societeAR: preview?.nom_societeAR ?? null,
        date_constitution: preview?.date_constitution ?? null,
        capital_social: preview?.registreCommerce?.[0]?.capital_social ?? null,
        date_enregistrement: preview?.registreCommerce?.[0]?.date_enregistrement ?? null,
      };
    });
  }

  async searchDetenteurs(q?: string, excludeDetenteurId?: number) {
    const query = this.normalizeString(q);
    const where: Prisma.DetenteurMoralePortailWhereInput = query
      ? {
          OR: [
            { nom_societeFR: { contains: query, mode: 'insensitive' } },
            { nom_societeAR: { contains: query, mode: 'insensitive' } },
          ],
        }
      : {};

    const rows = await this.prisma.detenteurMoralePortail.findMany({
      where,
      select: {
        id_detenteur: true,
        nom_societeFR: true,
        nom_societeAR: true,
      },
      orderBy: [{ nom_societeFR: 'asc' }, { nom_societeAR: 'asc' }],
      take: 20,
    });

    return rows
      .filter((row) =>
        Number.isFinite(Number(excludeDetenteurId))
          ? row.id_detenteur !== Number(excludeDetenteurId)
          : true,
      )
      .map((row) => ({
        id_detenteur: row.id_detenteur,
        nom_societeFR: row.nom_societeFR ?? null,
        nom_societeAR: row.nom_societeAR ?? null,
        displayName:
          row.nom_societeFR ??
          row.nom_societeAR ??
          `Société #${row.id_detenteur}`,
      }));
  }

  async getDetenteurPreview(id_detenteur: number) {
    const detenteur = await this.prisma.detenteurMoralePortail.findUnique({
      where: { id_detenteur },
      select: {
        id_detenteur: true,
        nom_societeFR: true,
        nom_societeAR: true,
        date_constitution: true,
        registreCommerce: {
          select: {
            capital_social: true,
            date_enregistrement: true,
          },
          take: 1,
          orderBy: { id: 'desc' },
        },
      },
    });

    if (!detenteur) {
      throw new NotFoundException('Société introuvable.');
    }

    return {
      id_detenteur: detenteur.id_detenteur,
      nom_societeFR: detenteur.nom_societeFR ?? null,
      nom_societeAR: detenteur.nom_societeAR ?? null,
      date_constitution: detenteur.date_constitution ?? null,
      capital_social: detenteur.registreCommerce?.[0]?.capital_social ?? null,
      date_enregistrement:
        detenteur.registreCommerce?.[0]?.date_enregistrement ?? null,
    };
  }

  async getPermisDetails(permisId: number) {
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
        typePermis: true,
        statut: true,
      },
    });
    if (!permis) {
      throw new NotFoundException('Permis introuvable.');
    }
    return permis;
  }

  async getDetenteurFull(id_detenteur: number) {
    const detenteur = await this.prisma.detenteurMoralePortail.findUnique({
      where: { id_detenteur },
      include: {
        registreCommerce: true,
        fonctions: { include: { personne: true } },
      },
    });
    if (!detenteur) {
      throw new NotFoundException('Détenteur introuvable.');
    }
    return detenteur;
  }

  async startTransfert(dto: StartTransfertDto) {
    const permisId = Number(dto.permisId);
    if (!Number.isFinite(permisId)) {
      throw new BadRequestException('permisId invalide.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const permis = await tx.permisPortail.findUnique({
        where: { id: permisId },
        include: {
          typePermis: true,
        },
      });
      if (!permis) {
        throw new NotFoundException(`Permis ${permisId} introuvable.`);
      }

      const existingOpen = await tx.demTransfert.findFirst({
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
          id_transfert: true,
          id_demande: true,
          demande: { select: { id_proc: true } },
        },
        orderBy: { id_transfert: 'desc' },
      });
      if (existingOpen?.demande?.id_proc) {
        return {
          new_proc_id: existingOpen.demande.id_proc,
          new_demande_id: existingOpen.id_demande,
          existing: true,
        };
      }

      let newDetenteurId: number | null = Number.isFinite(
        Number(dto.existingDetenteurId),
      )
        ? Number(dto.existingDetenteurId)
        : null;

      if (!newDetenteurId && dto.newDetenteur) {
        const created = await this.createDetenteur(dto.newDetenteur, tx);
        newDetenteurId = created.id_detenteur;
      }

      if (!newDetenteurId) {
        throw new BadRequestException('Le cessionnaire est obligatoire.');
      }
      if (permis.id_detenteur && newDetenteurId === permis.id_detenteur) {
        throw new BadRequestException(
          'Le cessionnaire doit être différent du détenteur actuel.',
        );
      }

      const typeProc = await this.resolveTypeProcedureTransfert(tx);

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
          'Impossible de déterminer l’utilisateur de la demande source.',
        );
      }

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
        },
        select: { id_demande: true },
      });

      const generatedCode = buildDemandeCode(
        'TRF',
        codeType,
        createdDemande.id_demande,
      );

      await tx.demandePortail.update({
        where: { id_demande: createdDemande.id_demande },
        data: {
          code_demande: generatedCode,
        },
      });

      const demTransfert = await tx.demTransfert.create({
        data: {
          id_demande: createdDemande.id_demande,
          motif_transfert: this.normalizeString(dto.motif_transfert),
          observations: this.normalizeString(dto.observations),
          date_transfert: new Date(),
        },
        select: { id_transfert: true },
      });

      const transferRows: Prisma.TransfertDetenteurCreateManyInput[] = [];
      if (permis.id_detenteur) {
        transferRows.push({
          id_transfert: demTransfert.id_transfert,
          id_detenteur: permis.id_detenteur,
          type_detenteur: EnumTypeDetenteur.ANCIEN,
          role: 'CEDANT',
          date_enregistrement: new Date(),
        });
      }
      transferRows.push({
        id_transfert: demTransfert.id_transfert,
        id_detenteur: newDetenteurId,
        type_detenteur: EnumTypeDetenteur.NOUVEAU,
        role: 'CESSIONNAIRE',
        date_enregistrement: new Date(),
      });
      await tx.transfertDetenteur.createMany({ data: transferRows });

      if (permis.id_detenteur) {
        await tx.detenteurDemandePortail.create({
          data: {
            id_demande: createdDemande.id_demande,
            id_detenteur: permis.id_detenteur,
            role_detenteur: 'ANCIEN',
          },
        });
      }

      await tx.detenteurDemandePortail.create({
        data: {
          id_demande: createdDemande.id_demande,
          id_detenteur: newDetenteurId,
          role_detenteur: 'NOUVEAU',
        },
      });

      return {
        new_proc_id: newProcedure.id_proc,
        new_demande_id: createdDemande.id_demande,
        id_transfert: demTransfert.id_transfert,
        id_permis: permisId,
        demande_code: generatedCode,
        requester_user_id: latestDemande.utilisateurId,
        existing: false,
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
          'Failed to create admin notification for transfert demande',
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

  async getReceiverForProcedure(id_proc: number) {
    const demande = await this.prisma.demandePortail.findFirst({
      where: { id_proc },
      select: {
        id_demande: true,
        code_demande: true,
        transfert: {
          select: {
            id_transfert: true,
            transfertDetenteur: {
              include: {
                detenteur: {
                  select: {
                    id_detenteur: true,
                    nom_societeFR: true,
                    nom_societeAR: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { id_demande: 'desc' },
    });

    if (!demande) {
      throw new NotFoundException(`Aucune demande trouvée pour la procédure ${id_proc}`);
    }

    const cessionnaire = demande.transfert?.transfertDetenteur?.find(
      (t) => t.type_detenteur === EnumTypeDetenteur.NOUVEAU,
    );

    return {
      id_proc,
      id_demande: demande.id_demande,
      code_demande: demande.code_demande ?? null,
      cessionnaire: cessionnaire
        ? {
            id_detenteur: cessionnaire.id_detenteur,
            nom_societeFR: cessionnaire.detenteur?.nom_societeFR ?? null,
            nom_societeAR: cessionnaire.detenteur?.nom_societeAR ?? null,
          }
        : null,
    };
  }

  async getHistoryByPermis(permisId: number) {
    const relations = await this.prisma.permisProcedure.findMany({
      where: { id_permis: permisId },
      select: { id_proc: true },
    });
    const procIds = relations.map((r) => r.id_proc);
    if (procIds.length === 0) return [];

    return this.prisma.demTransfert.findMany({
      where: {
        demande: {
          id_proc: { in: procIds },
        },
      },
      orderBy: { date_transfert: 'desc' },
      include: {
        transfertDetenteur: {
          include: {
            detenteur: {
              select: {
                id_detenteur: true,
                nom_societeFR: true,
                nom_societeAR: true,
              },
            },
          },
        },
      },
    });
  }
}
