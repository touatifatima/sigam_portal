import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GisService } from '../gis/gis.service';

@Injectable()
export class Permisdashboard2Service {
  constructor(private prisma: PrismaService, private gisService: GisService) {}

  async findAll(antenneId?: number) {
    // Reuse the richer include tree so list views
    // (dashboard, tables) have access to demandes,
    // localisation and substances data.
    return this.findAll1({ antenneId });
  }

  async findByDetenteur(detenteurId: number) {
    if (!Number.isFinite(detenteurId)) {
      throw new BadRequestException('detenteurId manquant');
    }

    const permisList = await this.prisma.permisPortail.findMany({
      where: { id_detenteur: detenteurId },
      include: {
        typePermis: true,
        detenteur: {
          include: {
            FormeJuridiqueDetenteur: {
              include: { statutJuridique: true },
              orderBy: { date: 'desc' },
            },
          },
        },
        statut: true,
        antenne: true,
        permisProcedure: {
          include: {
            procedure: {
              include: {
                demandes: {
                  include: {
                    wilaya: { select: { id_wilaya: true, nom_wilayaFR: true, nom_wilayaAR: true } },
                    typeProcedure: true,
                    commune: {
                      select: {
                        id_commune: true,
                        nom_communeFR: true,
                        nom_communeAR: true,
                        daira: {
                          select: {
                            id_daira: true,
                            nom_dairaFR: true,
                            nom_dairaAR: true,
                            wilaya: {
                              select: { id_wilaya: true, nom_wilayaFR: true, nom_wilayaAR: true },
                            },
                          },
                        },
                      },
                    },
                    detenteurdemande: {
                      include: {
                        detenteur: true,
                      },
                    },
                  },
                  orderBy: { date_demande: 'desc' },
                },
                SubstanceAssocieeDemande: {
                  include: { substance: true },
                },
              },
            },
          },
        },
      },
      orderBy: {
        date_octroi: 'desc',
      },
    });

    return permisList.map((permis: any) =>
      this.enrichPermisWithDerivedHolder(permis),
    );
  }

  async findActive(antenneId?: number) {
    const permisList = await this.prisma.permisPortail.findMany({
      where: {
        statut: {
          lib_statut: 'En vigueur',
        },
        ...(antenneId ? { id_antenne: antenneId } : {}),
      },
      include: {
        typePermis: true,
        detenteur: {
          include: {
            FormeJuridiqueDetenteur: {
              include: { statutJuridique: true },
              orderBy: { date: 'desc' },
            },
          },
        },
        statut: true,
        permisProcedure: {
          select: { date_octroi_proc: true },
        },
      },
      orderBy: {
        date_octroi: 'desc',
      },
    });
    return permisList.map((permis: any) =>
      this.enrichPermisWithDerivedHolder(permis),
    );
  }

  async findExpired(antenneId?: number) {
    const now = new Date();
    const permisList = await this.prisma.permisPortail.findMany({
      where: {
        date_expiration: { lt: now },
        ...(antenneId ? { id_antenne: antenneId } : {}),
      },
      include: {
        typePermis: true,
        detenteur: {
          include: {
            FormeJuridiqueDetenteur: {
              include: { statutJuridique: true },
              orderBy: { date: 'desc' },
            },
          },
        },
        statut: true,
        permisProcedure: {
          include: {
            procedure: {
              include: {
                demandes: {
                  include: {
                    wilaya: { select: { id_wilaya: true, nom_wilayaFR: true, nom_wilayaAR: true } },
                    typeProcedure: true,
                    commune: {
                      select: {
                        id_commune: true,
                        nom_communeFR: true,
                        nom_communeAR: true,
                        daira: {
                          select: {
                            id_daira: true,
                            nom_dairaFR: true,
                            nom_dairaAR: true,
                            wilaya: {
                              select: { id_wilaya: true, nom_wilayaFR: true, nom_wilayaAR: true },
                            },
                          },
                        },
                      },
                    },
                    detenteurdemande: {
                      include: {
                        detenteur: true,
                      },
                    },
                  },
                  orderBy: { date_demande: 'desc' },
                },
                SubstanceAssocieeDemande: {
                  include: { substance: true },
                },
              },
            },
          },
        },
      },
      orderBy: {
        date_expiration: 'desc',
      },
    });
    return permisList.map((permis: any) =>
      this.enrichPermisWithDerivedHolder(permis),
    );
  }

 

  // In your Permisdashboard2Service
  async findAll1(pagination: { skip?: number; take?: number; antenneId?: number } = {}) {
    const { antenneId } = pagination;
    const permisList = await this.prisma.permisPortail.findMany({
      where: antenneId ? { id_antenne: antenneId } : undefined,
      include: {
        typePermis: true,
        detenteur: {
          include: {
            FormeJuridiqueDetenteur: {
              include: { statutJuridique: true },
              orderBy: { date: 'desc' },
            },
          },
        },
        statut: true,
        antenne: true,
        permisProcedure: {
          include: {
            procedure: {
              include: {
                demandes: {
                  include: {
                    wilaya: { select: { id_wilaya: true, nom_wilayaFR: true, nom_wilayaAR: true } },
                    typeProcedure: true,
                    commune: {
                      select: {
                        id_commune: true,
                        nom_communeFR: true,
                        nom_communeAR: true,
                        daira: {
                          select: {
                            id_daira: true,
                            nom_dairaFR: true,
                            nom_dairaAR: true,
                            wilaya: {
                              select: { id_wilaya: true, nom_wilayaFR: true, nom_wilayaAR: true },
                            },
                          },
                        },
                      },
                    },
                    detenteurdemande: {
                      include: {
                        detenteur: true,
                      },
                    },
                  },
                  orderBy: { date_demande: 'desc' },
                },
                SubstanceAssocieeDemande: {
                  include: { substance: true },
                },
              },
            },
          },
        },
      },
      orderBy: {
        date_octroi: 'desc',
      },
      skip: pagination.skip,
      take: pagination.take,
    });

    return permisList.map((permis: any) =>
      this.enrichPermisWithDerivedHolder(permis),
    );
  }
  async findCurrent(pagination: { skip?: number; take?: number; antenneId?: number } = {}) {
    const { antenneId } = pagination;
    const permisList = await this.prisma.permisPortail.findMany({
      where: {
        statut: {
          lib_statut: 'En vigueur',
        },
        ...(antenneId ? { id_antenne: antenneId } : {}),
      },
      include: {
        typePermis: true,
        detenteur: true,
        statut: true,
        permisProcedure: {
          include: {
            procedure: {
              include: {
                demandes: {
                  include: {
                    wilaya: { select: { id_wilaya: true, nom_wilayaFR: true, nom_wilayaAR: true } },
                    typeProcedure: true,
                    commune: {
                      select: {
                        id_commune: true,
                        nom_communeFR: true,
                        nom_communeAR: true,
                        daira: {
                          select: {
                            id_daira: true,
                            nom_dairaFR: true,
                            nom_dairaAR: true,
                            wilaya: {
                              select: { id_wilaya: true, nom_wilayaFR: true, nom_wilayaAR: true },
                            },
                          },
                        },
                      },
                    },
                    detenteurdemande: {
                      include: {
                        detenteur: true,
                      },
                    },
                  },
                  orderBy: { date_demande: 'desc' },
                },
                SubstanceAssocieeDemande: {
                  include: { substance: true },
                },
              },
            },
          },
        },
      },
      orderBy: {
        date_octroi: 'desc',
      },
      skip: pagination.skip,
      take: pagination.take,
    });

    return permisList.map((permis: any) =>
      this.enrichPermisWithDerivedHolder(permis),
    );
  }

  /**
   * Ensure a permis has a detenteur populated.
   * If the direct relation is null, fall back to the latest demande's holder.
   */
  private enrichPermisWithDerivedHolder(permis: any) {
    this.applyEffectiveOctroi(permis);
    if (permis?.detenteur) {
      return permis;
    }

    const demandes: any[] = [];

    if (Array.isArray(permis?.permisProcedure)) {
      permis.permisProcedure.forEach((relation: any) => {
        if (Array.isArray(relation.procedure?.demandes)) {
          relation.procedure.demandes.forEach((d: any) => demandes.push(d));
        }
      });
    }

    if (Array.isArray(permis?.demandes)) {
      demandes.push(...permis.demandes);
    }

    if (!demandes.length) {
      return permis;
    }

    const withDates = demandes
      .filter((d: any) => d && d.date_demande)
      .sort(
        (a: any, b: any) =>
          new Date(b.date_demande).getTime() -
          new Date(a.date_demande).getTime(),
      );

    const latest = withDates[0] ?? demandes[0];

    const detRel = Array.isArray(latest.detenteurdemande)
      ? latest.detenteurdemande[0]
      : null;

    if (detRel?.detenteur && !permis.detenteur) {
      permis.detenteur = detRel.detenteur;
    }

    return permis;
  }

  private applyEffectiveOctroi(permis: any) {
    if (!permis) return permis;
    const links = Array.isArray(permis?.permisProcedure) ? permis.permisProcedure : [];
    const dates = links
      .map((link: any) => link?.date_octroi_proc)
      .filter((d: any) => d != null)
      .map((d: any) => (d instanceof Date ? d : new Date(d)))
      .filter((d: Date) => !isNaN(d.getTime()));
    const latest =
      dates.length > 0
        ? new Date(Math.max(...dates.map((d: Date) => d.getTime())))
        : null;
    const fallback =
      permis?.date_octroi && !isNaN(new Date(permis.date_octroi).getTime())
        ? new Date(permis.date_octroi)
        : null;
    const effective = latest ?? fallback ?? null;
    if (latest) {
      permis.date_octroi_proc = latest;
    }
    permis.date_octroi_effective = effective;
    if (effective) {
      permis.date_octroi = effective;
    }
    return permis;
  }

  async findOneWithDetails(permisId: number) {
    const permis: any = await this.prisma.permisPortail.findUnique({
      where: { id: permisId },
      include: {
        typePermis: true,
        antenne: true,
        detenteur: true,
        statut: true,
        permisProcedure: {
          include: {
            procedure: {
              include: {
                SubstanceAssocieeDemande: { include: { substance: true } },
                ProcedureEtape: {
                  include: { etape: true },
                },
                demandes: {
                  include: {
                    detenteurdemande: {
                      include: {
                        detenteur: {
                          include: {
                            FormeJuridiqueDetenteur: {
                              include: { statutJuridique: true },
                              orderBy: { date: 'desc' },
                            },
                          },
                        },
                      },
                      take: 1,
                    },
                    typeProcedure: true,
                    typePermis: true,
                    wilaya: { select: { id_wilaya: true, nom_wilayaFR: true, nom_wilayaAR: true } },
                    commune: {
                      select: {
                        id_commune: true,
                        nom_communeFR: true,
                        nom_communeAR: true,
                        daira: {
                          select: {
                            id_daira: true,
                            nom_dairaFR: true,
                            nom_dairaAR: true,
                            wilaya: {
                              select: { id_wilaya: true, nom_wilayaFR: true, nom_wilayaAR: true },
                            },
                          },
                        },
                      },
                    },
                  },
                  orderBy: { date_demande: 'desc' },
                },
                coordonnees: { include: { coordonnee: true } },
              },
            },
          },
        },
      },
    });

    if (!permis) {
      throw new NotFoundException(`Permis with id ${permisId} not found`);
    }

    // Flatten many-to-many relation so the frontend can use permis.procedures
    const procedures =
      permis.permisProcedure
        ?.map((rel: any) => rel.procedure)
        .filter((proc: any) => !!proc) ?? [];

    const signaturePrecedent = (() => {
      const links = Array.isArray(permis?.permisProcedure) ? permis.permisProcedure : [];
      const rows = links
        .map((link: any) => {
          const raw = link?.date_signature;
          if (raw == null) return null;
          const date = raw instanceof Date ? raw : new Date(raw);
          if (isNaN(date.getTime())) return null;
          return { date, id_proc: link?.id_proc ?? null };
        })
        .filter((row: any) => row && row.date);

      const latestProcId = (() => {
        let bestId: number | null = null;
        let bestTs = 0;
        let bestHasDate = false;
        links.forEach((link: any) => {
          const idProc = Number(link?.id_proc);
          if (!Number.isFinite(idProc) || idProc <= 0) return;
          const proc = link?.procedure;
          const rawDate =
            proc?.date_fin_proc ??
            proc?.date_debut_proc ??
            proc?.created_at ??
            null;
          const parsed = rawDate ? new Date(rawDate).getTime() : NaN;
          const hasDate = Number.isFinite(parsed);
          const ts = hasDate ? parsed : idProc;
          if (bestId == null) {
            bestId = idProc;
            bestTs = ts;
            bestHasDate = hasDate;
            return;
          }
          if (hasDate && (!bestHasDate || ts > bestTs)) {
            bestId = idProc;
            bestTs = ts;
            bestHasDate = true;
          } else if (!hasDate && !bestHasDate && idProc > (bestId ?? 0)) {
            bestId = idProc;
            bestTs = ts;
            bestHasDate = false;
          }
        });
        return bestId;
      })();

      if (rows.length > 0) {
        rows.sort((a: any, b: any) => b.date.getTime() - a.date.getTime());
        return rows[0];
      }
      const fallback =
        permis?.date_signature && !isNaN(new Date(permis.date_signature).getTime())
          ? new Date(permis.date_signature)
          : null;
      if (fallback || latestProcId) {
        return { date: fallback ?? null, id_proc: latestProcId };
      }
      return null;
    })();

    this.applyEffectiveOctroi(permis);
    const { permisProcedure, ...rest } = permis as any;

    // Ensure titulaire is derived from demandes/detenteurDemande when needed
    return this.enrichPermisWithDerivedHolder({
      ...rest,
      procedures,
      date_signature_precedent: signaturePrecedent?.date ?? null,
      date_signature_precedent_proc_id: signaturePrecedent?.id_proc ?? null,
    });
  }

  async updateDetails(permisId: number, payload: { date_octroi?: string | Date | null; date_signature?: string | Date | null; date_expiration?: string | Date | null; superficie?: number | null }) {
    const parseDate = (value: string | Date | null | undefined) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      const d = new Date(value as any);
      return isNaN(d.getTime()) ? undefined : d;
    };

    const dateOctroi = parseDate(payload.date_octroi);
    const dateSignature = parseDate(payload.date_signature);
    const dateExpiration = parseDate(payload.date_expiration);
    const superficie =
      payload.superficie === undefined ? undefined
      : payload.superficie === null ? null
      : Number.isFinite(Number(payload.superficie)) ? Number(payload.superficie)
      : undefined;

    return this.prisma.permisPortail.update({
      where: { id: permisId },
      data: {
        ...(dateOctroi !== undefined ? { date_octroi: dateOctroi } : {}),
        ...(dateSignature !== undefined ? { date_signature: dateSignature } : {}),
        ...(dateExpiration !== undefined ? { date_expiration: dateExpiration } : {}),
        ...(superficie !== undefined ? { superficie } : {}),
      },
      select: {
        id: true,
        date_octroi: true,
        date_signature: true,
        date_expiration: true,
        superficie: true,
      },
    });
  }

  async delete(id: number) {
    return this.prisma.permisPortail.delete({
      where: { id },
    });
  }

  async getObligationsForPermis(permisId: number) {
    return this.prisma.obligationFiscale.findMany({
      where: { id_permis: permisId },
      include: {
        typePaiement: true,
        paiements: true,
      },
      orderBy: { date_echeance: 'asc' },
    });
  }

  // src/permis/permis.service.ts

  async getDocumentsByProcedure(permisId: number) {
    // Get all procedures for this permis with their documents
    const procedures = await this.prisma.procedurePortail.findMany({
      where: {
        permisProcedure: { some: { id_permis: permisId } },
      },
      include: {
        demandes: {
          include: {
            dossiersFournis: {
              include: {
                documents: {
                  include: {
                    document: {
                      include: {
                        dossierFournisDocuments: {
                          take: 1,
                          orderBy: {
                            created_at: 'desc',
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

    // Organize documents by procedure
    const proceduresWithDocuments = procedures.map((procedure) => {
      const procedureDocuments = procedure.demandes.flatMap((demande) =>
        demande.dossiersFournis.flatMap((dossier) =>
          dossier.documents.map((dossierDoc) => {
            const fileInfo = dossierDoc.document.dossierFournisDocuments[0];

            return {
              id: dossierDoc.document.id_doc,
              nom: dossierDoc.document.nom_doc,
              description: dossierDoc.document.description,
              type: dossierDoc.document.format,
              taille: parseInt(dossierDoc.document.taille_doc) || 0,
              url: fileInfo?.file_url || '',
              date_upload: fileInfo?.created_at || new Date(),
              status: fileInfo?.status || 'inconnu',
            };
          }),
        ),
      );

      return {
        id_proc: procedure.id_proc,
        num_proc: procedure.num_proc,
        statut_proc: procedure.statut_proc,
        documents: procedureDocuments,
        documentCount: procedureDocuments.length,
      };
    });

    return proceduresWithDocuments;
  }

  async getAllDocumentsForPermis(permisId: number) {
    const [procedureDocuments] = await Promise.all([
      this.getDocumentsByProcedure(permisId),
    ]);

    // Calculate total document count
    const totalCount = procedureDocuments.reduce(
      (total, proc) => total + proc.documentCount,
      0,
    );
    return {
      procedures: procedureDocuments,
      totalCount,
    };
  }

  async getHistorique(permisId: number) {
    const current = await this.prisma.permisPortail.findUnique({
      where: { id: permisId },
      select: { id: true, code_permis: true },
    });

    if (!current) {
      throw new NotFoundException(`Permis with id ${permisId} not found`);
    }

    const codePermis = current.code_permis;
    if (!codePermis) {
      return [];
    }

    const history = await this.prisma.permisPortail.findMany({
      where: { code_permis: codePermis },
      include: {
        typePermis: true,
        detenteur: {
          include: {
            FormeJuridiqueDetenteur: {
              include: { statutJuridique: true },
              orderBy: { date: 'desc' },
            },
          },
        },
        statut: true,
      },
    });

    history.sort((a, b) => {
      const aTime = a.date_octroi
        ? a.date_octroi.getTime()
        : Number.POSITIVE_INFINITY;
      const bTime = b.date_octroi
        ? b.date_octroi.getTime()
        : Number.POSITIVE_INFINITY;
      if (aTime !== bTime) {
        return aTime - bTime;
      }
      return a.id - b.id;
    });

    return history.map((p) => ({
      id: p.id,
      code: p.code_permis,
      type: p.typePermis?.lib_type || p.typePermis?.code_type || 'Type inconnu',
      type_code: p.typePermis?.code_type || null,
      date_octroi: p.date_octroi,
      date_expiration: p.date_expiration,
      statut: p.statut?.lib_statut || null,
      detenteur: p.detenteur?.nom_societeFR || null,
    }));
  }

  private isPermisExpiredByDate(permis: any) {
    if (!permis?.date_expiration) return false;
    const d =
      permis.date_expiration instanceof Date
        ? permis.date_expiration
        : new Date(permis.date_expiration);
    return !isNaN(d.getTime()) && d.getTime() < Date.now();
  }

  private async createDemandeForProcedure(
    procedureId: number,
    permis: any,
    typeProcedureId?: number,
    codePrefix: string = 'PROC',
  ) {
    const existingDemande = await this.prisma.demandePortail.findFirst({
      where: { id_proc: procedureId },
      select: { id_demande: true },
    });
    if (existingDemande) return;

    const latestDemande = permis?.permisProcedure?.[0]?.procedure?.demandes?.[0];
    const idWilaya =
      latestDemande?.wilaya?.id_wilaya ??
      latestDemande?.commune?.daira?.wilaya?.id_wilaya ??
      undefined;
    const idDaira =
      latestDemande?.daira?.id_daira ??
      latestDemande?.commune?.daira?.id_daira ??
      undefined;
    const idCommune = latestDemande?.commune?.id_commune ?? undefined;

    const utilisateurId = latestDemande?.utilisateurId;
    if (!utilisateurId) {
      throw new BadRequestException('utilisateurId manquant pour creer la demande');
    }

    const demandePayload = {
      id_proc: procedureId,
      id_typeProc: typeProcedureId ?? undefined,
      id_typePermis: permis.id_typePermis ?? undefined,
      utilisateurId,
      statut_demande: 'EN_COURS',
      date_demande: new Date(),
      code_demande: `${codePrefix}-${permis.id}-${procedureId}`,
      ...(idWilaya ? { id_wilaya: idWilaya } : {}),
      ...(idDaira ? { id_daira: idDaira } : {}),
      ...(idCommune ? { id_commune: idCommune } : {}),
    };
    await this.prisma.demandePortail.create({ data: demandePayload });
  }

  async startExpiration(permisId: number, typeProcedureId?: number) {
    const permis = await this.prisma.permisPortail.findUnique({
      where: { id: permisId },
      include: {
        statut: true,
        permisProcedure: {
          include: {
            procedure: {
              include: {
                demandes: {
                  include: {
                    commune: {
                      select: {
                        id_commune: true,
                        daira: {
                          select: {
                            id_daira: true,
                            wilaya: { select: { id_wilaya: true } },
                          },
                        },
                      },
                    },
                    wilaya: { select: { id_wilaya: true } },
                    daira: { select: { id_daira: true } },
                  },
                  orderBy: { date_demande: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    if (!permis) {
      throw new NotFoundException(`Permis with id ${permisId} not found`);
    }
    if (!this.isPermisExpiredByDate(permis)) {
      throw new BadRequestException('Ce permis n’est pas encore expiré.');
    }

    const now = new Date();
    const procedure = await this.prisma.procedurePortail.create({
      data: {
        statut_proc: 'EN_COURS',
        date_debut_proc: now,
        resultat: 'EXPIRATION',
        observations: 'Procédure d’expiration',
        ...(typeProcedureId ? { typeProcedureId } : {}),
      },
    });

    await this.prisma.permisProcedure.create({
      data: {
        id_permis: permisId,
        id_proc: procedure.id_proc,
      },
    });

    await this.createDemandeForProcedure(
      procedure.id_proc,
      permis,
      typeProcedureId,
      'EXP',
    );

    return {
      ok: true,
      id_proc: procedure.id_proc,
    };
  }

  async expirePermis(
    permisId: number,
    procId?: number,
    typeProcedureId?: number,
    observations?: string,
  ) {
    const permis = await this.prisma.permisPortail.findUnique({
      where: { id: permisId },
      include: { statut: true },
    });
    if (!permis) {
      throw new NotFoundException(`Permis with id ${permisId} not found`);
    }
    const now = new Date();
    if (!this.isPermisExpiredByDate(permis)) {
      throw new BadRequestException('Ce permis n’est pas encore expiré.');
    }

    const expiredStatut = await this.prisma.statutPermis.findFirst({
      where: { lib_statut: { contains: 'expir', mode: 'insensitive' } },
    });
    if (!expiredStatut) {
      throw new NotFoundException('Statut "Expiré" introuvable.');
    }

    let procedureId = procId;
    if (procedureId) {
      const link = await this.prisma.permisProcedure.findFirst({
        where: { id_permis: permisId, id_proc: procedureId },
      });
      if (!link) {
        throw new BadRequestException("La procédure d'expiration ne correspond pas au permis.");
      }
      await this.prisma.procedurePortail.update({
        where: { id_proc: procedureId },
        data: {
          statut_proc: 'TERMINEE',
          date_fin_proc: now,
          resultat: 'EXPIRE',
          observations: observations?.trim()
            ? observations.trim()
            : 'Validation de l’expiration du permis',
        },
      });
    } else {
      const procedure = await this.prisma.procedurePortail.create({
        data: {
          statut_proc: 'TERMINEE',
          date_debut_proc: now,
          date_fin_proc: now,
          resultat: 'EXPIRE',
          observations: observations?.trim()
            ? observations.trim()
            : 'Validation de l’expiration du permis',
          ...(typeProcedureId ? { typeProcedureId } : {}),
        },
      });

      await this.prisma.permisProcedure.create({
        data: {
          id_permis: permisId,
          id_proc: procedure.id_proc,
        },
      });
      procedureId = procedure.id_proc;
    }

    await this.prisma.permisPortail.update({
      where: { id: permisId },
      data: { id_statut: expiredStatut.id },
    });

   

    return {
      ok: true,
      id_proc: procedureId,
      statut: expiredStatut.lib_statut,
    };
  }

  async startAnnulation(permisId: number, typeProcedureId?: number) {
    const permis = await this.prisma.permisPortail.findUnique({
      where: { id: permisId },
      include: {
        statut: true,
        permisProcedure: {
          include: {
            procedure: {
              include: {
                demandes: {
                  include: {
                    commune: {
                      select: {
                        id_commune: true,
                        daira: {
                          select: {
                            id_daira: true,
                            wilaya: { select: { id_wilaya: true } },
                          },
                        },
                      },
                    },
                    wilaya: { select: { id_wilaya: true } },
                    daira: { select: { id_daira: true } },
                  },
                  orderBy: { date_demande: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    if (!permis) {
      throw new NotFoundException(`Permis with id ${permisId} not found`);
    }

    const now = new Date();
    const procedure = await this.prisma.procedurePortail.create({
      data: {
        statut_proc: 'EN_COURS',
        date_debut_proc: now,
        resultat: 'ANNULATION',
        observations: 'Procédure d’annulation',
        ...(typeProcedureId ? { typeProcedureId } : {}),
      },
    });

    await this.prisma.permisProcedure.create({
      data: {
        id_permis: permisId,
        id_proc: procedure.id_proc,
      },
    });

    await this.createDemandeForProcedure(
      procedure.id_proc,
      permis,
      typeProcedureId,
      'ANN',
    );

    return {
      ok: true,
      id_proc: procedure.id_proc,
    };
  }

  async annulePermis(
    permisId: number,
    procId?: number,
    typeProcedureId?: number,
    observations?: string,
  ) {
    const permis = await this.prisma.permisPortail.findUnique({
      where: { id: permisId },
      include: { statut: true },
    });
    if (!permis) {
      throw new NotFoundException(`Permis with id ${permisId} not found`);
    }

    const cancelledStatut = await this.prisma.statutPermis.findFirst({
      where: { lib_statut: { contains: 'annul', mode: 'insensitive' } },
    });
    if (!cancelledStatut) {
      throw new NotFoundException('Statut "Annulé" introuvable.');
    }

    const now = new Date();
    let procedureId = procId;
    if (procedureId) {
      const link = await this.prisma.permisProcedure.findFirst({
        where: { id_permis: permisId, id_proc: procedureId },
      });
      if (!link) {
        throw new BadRequestException("La procédure d'annulation ne correspond pas au permis.");
      }
      await this.prisma.procedurePortail.update({
        where: { id_proc: procedureId },
        data: {
          statut_proc: 'TERMINEE',
          date_fin_proc: now,
          resultat: 'ANNULE',
          observations: observations?.trim()
            ? observations.trim()
            : "Validation de l'annulation du permis",
        },
      });
    } else {
      const procedure = await this.prisma.procedurePortail.create({
        data: {
          statut_proc: 'TERMINEE',
          date_debut_proc: now,
          date_fin_proc: now,
          resultat: 'ANNULE',
          observations: observations?.trim()
            ? observations.trim()
            : "Validation de l'annulation du permis",
          ...(typeProcedureId ? { typeProcedureId } : {}),
        },
      });

      await this.prisma.permisProcedure.create({
        data: {
          id_permis: permisId,
          id_proc: procedure.id_proc,
        },
      });
      procedureId = procedure.id_proc;
    }

    await this.prisma.permisPortail.update({
      where: { id: permisId },
      data: { id_statut: cancelledStatut.id },
    });

    

    return {
      ok: true,
      id_proc: procedureId,
      statut: cancelledStatut.lib_statut,
    };
  }
}
