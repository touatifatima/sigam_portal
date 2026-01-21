import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GisService } from '../gis/gis.service';

@Injectable()
export class ProcedureService {
  constructor(
    private prisma: PrismaService,
    private readonly gisService: GisService,
  ) {}

  async getAllProcedures() {
    // NOTE: This endpoint is used by the dashboard "suivi_procedure" page.
    // Keep payload small to avoid long-running queries / huge JSON responses.
    return this.prisma.demandePortail.findMany({
      select: {
        id_demande: true,
        code_demande: true,
        date_demande: true,
        date_instruction: true,
        statut_demande: true,
        typeProcedure: {
          select: {
            id: true,
            description: true,
            libelle: true,
          },
        },
        typePermis: {
          select: {
            id: true,
            code_type: true,
            lib_type: true,
          },
        },
        detenteurdemande: {
          select: {
            detenteur: {
              select: {
                id_detenteur: true,
                nom_societeFR: true,
              },
            },
          },
        },
        procedure: {
          select: {
            id_proc: true,
            num_proc: true,
            statut_proc: true,
            date_debut_proc: true,
            date_fin_proc: true,
            ProcedureEtape: {
              select: {
                id_proc: true,
                id_etape: true,
                statut: true,
                date_debut: true,
                date_fin: true,
                link: true,
                etape: {
                  select: {
                    id_etape: true,
                    lib_etape: true,
                  },
                },
              },
            },
            permisProcedure: {
              select: {
                permis: {
                  select: {
                    id: true,
                    code_permis: true,
                    typePermis: {
                      select: {
                        id: true,
                        code_type: true,
                        lib_type: true,
                      },
                    },
                    detenteur: {
                      select: {
                        id_detenteur: true,
                        nom_societeFR: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { date_demande: 'desc' },
    });
  }

  async getProcedureById(id: number) {
    return this.prisma.procedurePortail.findUnique({
      where: { id_proc: id },
      include: {
        demandes: {
          include: {
            detenteurdemande: {
              include: { detenteur: true },
            },
            typeProcedure: true,
          },
          take: 1, // first demande
        },
        ProcedureEtape: {
          include: {
            etape: true,
          },
        },
        permisProcedure: {
          include: {
            permis: {
              include: {
                detenteur: true,
              },
            },
          },
        },
      },
    });
  }

  async getProceduresEnCours() {
    const data = await this.prisma.demandePortail.findMany({
      where: {
        procedure: {
          statut_proc: {
            notIn: ['TERMINEE'],
          },
        },
      },
      include: {
        procedure: {
          include: {
            ProcedureEtape: {
              include: {
                etape: true,
              },
            },
          },
        },
        typeProcedure: true,
        detenteurdemande: {
          include: { detenteur: true },
        },
      },
      orderBy: {
        date_demande: 'desc',
      },
    });

    return data;
  }
  async deleteProcedureAndRelatedData(procedureId: number) {
    const deletedProcedure = await this.prisma.$transaction(async (prisma) => {
      // First get the demande for this procedure
      const demande = await prisma.demandePortail.findFirst({
        where: { id_proc: procedureId },
        include: {
          typeProcedure: true,
          procedure: {
            include: {
              permisProcedure: {
                include: {
                  permis: {
                    select: {
                      id: true,
                      nombre_renouvellements: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!demande) {
        throw new Error('Demande not found for this procedure');
      }

      // If this is a renewal procedure, decrement the count
      if (
        demande.typeProcedure?.libelle?.toLowerCase() === 'renouvellement' &&
        demande.procedure?.permisProcedure?.length
      ) {
        const permisRecord = demande.procedure.permisProcedure[0].permis;
        if (permisRecord) {
          const permisId = permisRecord.id;
          const currentCount = permisRecord.nombre_renouvellements || 0;

          await prisma.permisPortail.update({
            where: { id: permisId },
            data: {
              nombre_renouvellements: Math.max(0, currentCount - 1),
            },
          });
        }
      }

      // Get all related demandes for this procedure
      const demandes = await prisma.demandePortail.findMany({
        where: { id_proc: procedureId },
        select: {
          id_demande: true,
          id_expert: true,
          detenteurdemande: {
            select: { id_detenteur: true },
          },
        },
      });

      const demandeIds = demandes.map((d) => d.id_demande);
      const detenteurIds = demandes
        .flatMap((d) => d.detenteurdemande.map((dd) => dd.id_detenteur))
        .filter((id): id is number => typeof id === 'number');
      const expertIds = demandes
        .map((d) => d.id_expert)
        .filter((id): id is number => typeof id === 'number');

      // NEW: Delete related records in correct order to avoid foreign key constraints

      // 0. Demande sub-types and children that reference demande first (ON DELETE RESTRICT)

      // Fusion: delete fusion sources then demFusion
      const fusions = await prisma.demFusion.findMany({
        where: { id_demande: { in: demandeIds } },
        select: { id_fusion: true },
      });
      const fusionIds = fusions.map((f) => f.id_fusion);
      if (fusionIds.length) {
        await prisma.fusionPermisSource.deleteMany({
          where: { id_fusion: { in: fusionIds } },
        });
        await prisma.demFusion.deleteMany({
          where: { id_fusion: { in: fusionIds } },
        });
      }

      // Transfert: delete transfertDetenteur then demTransfert
      const transferts = await prisma.demTransfert.findMany({
        where: { id_demande: { in: demandeIds } },
        select: { id_transfert: true },
      });
      const transfertIds = transferts.map((t) => t.id_transfert);
      if (transfertIds.length) {
        await prisma.transfertDetenteur.deleteMany({
          where: { id_transfert: { in: transfertIds } },
        });
        await prisma.demTransfert.deleteMany({
          where: { id_transfert: { in: transfertIds } },
        });
      }

      // Other demande subtype tables (1:1 with demande)
      await prisma.demAnnulation.deleteMany({ where: { id_demande: { in: demandeIds } } });
      await prisma.demFermeture.deleteMany({ where: { id_demande: { in: demandeIds } } });
      await prisma.demInitial.deleteMany({ where: { id_demande: { in: demandeIds } } });
      await prisma.demModification.deleteMany({ where: { id_demande: { in: demandeIds } } });
      await prisma.demSubstitution.deleteMany({ where: { id_demande: { in: demandeIds } } });
      await prisma.demRenonciation.deleteMany({ where: { id_demande: { in: demandeIds } } });
      await prisma.demCession.deleteMany({ where: { id_demande: { in: demandeIds } } });

      // Geology/cadastre auxiliary tables
      await prisma.demandeVerificationGeo.deleteMany({
        where: { id_demande: { in: demandeIds } },
      });
      await prisma.demandeMin.deleteMany({
        where: { id_demande: { in: demandeIds } },
      });

      // DetenteurDemande link table
      await prisma.detenteurDemandePortail.deleteMany({
        where: { id_demande: { in: demandeIds } },
      });

      // Provisional inscription for this procedure/demande(s)
      await prisma.inscriptionProvisoirePortail.deleteMany({
        where: {
          OR: [{ id_proc: procedureId }, { id_demande: { in: demandeIds } }],
        },
      });

      // 1. Delete CahierCharge records first
      await prisma.cahierChargePortail.deleteMany({
        where: {
          demandeId: { in: demandeIds },
        },
      });

      // 2. Delete ProcedureRenouvellement records
      await prisma.procedureRenouvellement.deleteMany({
        where: {
          id_demande: { in: demandeIds },
        },
      });

      // 3. Delete DossierFournisDocument records
      await prisma.dossierFournisDocumentPortail.deleteMany({
        where: {
          dossierFournis: {
            id_demande: { in: demandeIds },
          },
        },
      });

      // 4. Delete DossierFournis records
      await prisma.dossierFournisPortail.deleteMany({
        where: { id_demande: { in: demandeIds } },
      });

      // 5. Delete SubstanceAssocieeDemande records
      await prisma.substanceAssocieeDemande.deleteMany({
        where: { id_proc: procedureId },
      });

      // 6. Delete InteractionWali records
      await prisma.interactionWaliPortail.deleteMany({
        where: { id_procedure: procedureId },
      });

      // 7. Handle SeanceCD and related records
      const seances = await prisma.procedurePortail.findUnique({
        where: { id_proc: procedureId },
        select: { id_seance: true },
      });

      if (seances?.id_seance) {
        const seanceId = seances.id_seance;

        // Get all comites related to this seance
        const comites = await prisma.comiteDirection.findMany({
          where: { id_seance: seanceId },
          select: { id_comite: true },
        });

        const comiteIds = comites.map((c) => c.id_comite);

        if (comiteIds.length > 0) {
          // Delete all decisions of these comites
          await prisma.decisionCD.deleteMany({
            where: { id_comite: { in: comiteIds } },
          });

          // Delete all comites for this seance
          await prisma.comiteDirection.deleteMany({
            where: { id_seance: seanceId },
          });
        }

        // Check if any other procedures use this seance before deleting it
        const otherProceduresCount = await prisma.procedurePortail.count({
          where: {
            id_proc: { not: procedureId },
            id_seance: seanceId,
          },
        });

        if (otherProceduresCount === 0) {
          // Only delete if no other procedures are linked
          await prisma.seanceCDPrevue.delete({
            where: { id_seance: seanceId },
          });
        }
      }

      // 8. Delete ProcedureEtape records
      await prisma.procedureEtape.deleteMany({
        where: { id_proc: procedureId },
      });

      // 8bis. Delete ProcedurePhase (phases associées à la procédure)
      await prisma.procedurePhase.deleteMany({
        where: { id_proc: procedureId },
      });

      // 8ter. Delete procedurePhaseEtapes (liens phase/etape pour cette procédure) if the model exists
      await prisma.procedurePhaseEtapes.deleteMany({
        where: { id_proc: procedureId },
      });

      // 9. Delete permis_procedure links (liaison avec les titres)
      await prisma.permisProcedure.deleteMany({
        where: { id_proc: procedureId },
      });

      // 9. Delete related Coordonnee records
      const links = await prisma.procedureCoord.findMany({
        where: { id_proc: procedureId },
        select: { id_coordonnees: true },
      });

      const coordIds = links
        .map((l) => l.id_coordonnees)
        .filter((id): id is number => id !== null && id !== undefined);

      await prisma.procedureCoord.deleteMany({
        where: { id_proc: procedureId },
      });

      if (coordIds.length > 0) {
        await prisma.coordonneePortail.deleteMany({
          where: { id_coordonnees: { in: coordIds } },
        });
      }

      // 10. Now delete the Demandes (this should work after deleting all related records)
      await prisma.demandePortail.deleteMany({
        where: { id_proc: procedureId },
      });

      // 11. Check and delete DetenteurMorale if not referenced elsewhere
      const personnePhysiqueIdsToDelete: number[] = [];

      for (const detenteurId of detenteurIds) {
        const otherReferences = await prisma.detenteurDemandePortail.count({
          where: {
            id_detenteur: detenteurId,
            demande: { id_proc: { not: procedureId } },
          },
        });

        const permisReferences = await prisma.permisPortail.count({
          where: { id_detenteur: detenteurId },
        });

        if (otherReferences === 0 && permisReferences === 0) {
          // First get all PersonnePhysique IDs related to this detenteur
          const fonctions = await prisma.fonctionPersonneMoral.findMany({
            where: { id_detenteur: detenteurId },
            select: { id_personne: true },
          });

          // Collect PersonnePhysique IDs for potential deletion
          personnePhysiqueIdsToDelete.push(
            ...fonctions.map((f) => f.id_personne!),
          );

          // Delete related FonctionPersonneMoral records
          await prisma.fonctionPersonneMoral.deleteMany({
            where: { id_detenteur: detenteurId },
          });

          // Delete related RegistreCommerce if exists
          await prisma.registreCommercePortail.deleteMany({
            where: { id_detenteur: detenteurId },
          });

          // Delete the DetenteurMorale
          await prisma.detenteurMoralePortail.delete({
            where: { id_detenteur: detenteurId },
          });
        }
      }

      // 12. Check and delete PersonnePhysique records if they're not referenced elsewhere
      for (const personneId of personnePhysiqueIdsToDelete) {
        const otherFonctionReferences =
          await prisma.fonctionPersonneMoral.count({
            where: { id_personne: personneId },
          });

        if (otherFonctionReferences === 0) {
          await prisma.personnePhysiquePortail.delete({
            where: { id_personne: personneId },
          });
        }
      }

      // 13. Check and delete ExpertMinier if not referenced elsewhere
      for (const expertId of expertIds) {
        const otherReferences = await prisma.demandePortail.count({
          where: {
            id_expert: expertId,
            id_proc: { not: procedureId },
          },
        });

        if (otherReferences === 0) {
          await prisma.expertMinier.delete({
            where: { id_expert: expertId },
          });
        }
      }

      // 14. Finally, delete the Procedure itself
      return prisma.procedurePortail.delete({
        where: { id_proc: procedureId },
      });
    });

    // Also delete GIS perimeters for this procedure (sig_gis DB). Best-effort (different DB).
    try {
      await this.gisService.deletePerimetersByProcedure(procedureId);
    } catch (e) {
      console.warn('Failed to delete GIS perimeters for procedure', procedureId, e);
    }

    return deletedProcedure;
  }

  async terminerProcedure(idProc: number) {
    const procedure = await this.prisma.procedurePortail.findUnique({
      where: { id_proc: idProc },
      include: { demandes: true }, // plural!
    });

    if (!procedure || procedure.demandes.length === 0) {
      throw new NotFoundException('Procédure ou demande introuvable');
    }

    const demande = procedure.demandes[0]; // Assuming only one demande per procédure
    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.procedurePortail.update({
        where: { id_proc: idProc },
        data: {
          statut_proc: 'TERMINEE',
          date_fin_proc: now,
        },
      }),
      this.prisma.demandePortail.update({
        where: { id_demande: demande.id_demande },
        data: {
          statut_demande: 'ACCEPTEE',
          date_fin_instruction: now,
        },
      }),
    ]);

    return { success: true };
  }
}