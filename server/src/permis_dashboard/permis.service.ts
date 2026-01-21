import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class Permisdashboard2Service {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    // Reuse the richer include tree so list views
    // (dashboard, tables) have access to demandes,
    // localisation and substances data.
    return this.findAll1();
  }

  async findActive() {
    return this.prisma.permisPortail.findMany({
      where: {
        statut: {
          lib_statut: 'En vigueur',
        },
      },
      include: {
        typePermis: true,
        detenteur: true,
        statut: true,
      },
      orderBy: {
        date_octroi: 'desc',
      },
    });
  }

  async findExpired() {
    return this.prisma.permisPortail.findMany({
      where: {
        date_expiration: {
          lt: new Date(),
        },
        statut: {
          lib_statut: 'En vigueur',
        },
      },
      include: {
        typePermis: true,
        detenteur: true,
        statut: true,
      },
      orderBy: {
        date_expiration: 'desc',
      },
    });
  }

  // In your Permisdashboard2Service
  async findAll1(pagination: { skip?: number; take?: number } = {}) {
    const permisList = await this.prisma.permisPortail.findMany({
      include: {
        typePermis: true,
        detenteur: true,
        statut: true,
        antenne: true,
        permisProcedure: {
          include: {
            procedure: {
              include: {
                demandes: {
                  include: {
                    wilaya: { select: { id_wilaya: true, nom_wilayaFR: true } },
                    commune: {
                      select: {
                        id_commune: true,
                        nom_communeFR: true,
                        daira: {
                          select: {
                            id_daira: true,
                            nom_dairaFR: true,
                            wilaya: {
                              select: { id_wilaya: true, nom_wilayaFR: true },
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
  async findCurrent(pagination: { skip?: number; take?: number } = {}) {
    const permisList = await this.prisma.permisPortail.findMany({
      where: {
        statut: {
          lib_statut: 'En vigueur',
        },
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
                    wilaya: { select: { id_wilaya: true, nom_wilayaFR: true } },
                    commune: {
                      select: {
                        id_commune: true,
                        nom_communeFR: true,
                        daira: {
                          select: {
                            id_daira: true,
                            nom_dairaFR: true,
                            wilaya: {
                              select: { id_wilaya: true, nom_wilayaFR: true },
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

  async findOneWithDetails(permisId: number) {
    const permis: any = await this.prisma.permisPortail.findUnique({
      where: { id: permisId },
      include: {
        typePermis: true,
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
                    detenteurdemande: { include: { detenteur: true }, take: 1 },
                    typeProcedure: true,
                  },
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

    const { permisProcedure, ...rest } = permis as any;

    // Ensure titulaire is derived from demandes/detenteurDemande when needed
    return this.enrichPermisWithDerivedHolder({
      ...rest,
      procedures,
    });
  }

  async delete(id: number) {
    return this.prisma.permisPortail.delete({
      where: { id },
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
}