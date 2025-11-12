// src/procedure/procedure.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProcedureService {
  constructor(private prisma: PrismaService) {}

async getAllProcedures() {
  return this.prisma.demandePortail.findMany({
    include: {
      typeProcedure: true,  // 🔑 directly from Demande now
      procedure: {
        include: {
          permis: {
            include: {
              detenteur: true,
              procedures: {
                where: {
                  demandes: {
                    some: {
                      typeProcedure: { libelle: 'demande' }
                    }
                  }
                },
                include: {
                  demandes: {
                    include: {
                      entreprise: true,
                      typeProcedure: true, // also here for consistency
                    }
                  }
                }
              }
            }
          },
          ProcedureEtape: {
            include: {
              etape: true,
            },
            orderBy: {
              etape: {
                ordre_etape: 'asc',
              },
            },
          },
        },
      },
      entreprise: true,
    },
    orderBy: {
      date_demande: 'desc',
    },
  });
}

async getProcedureById(id: number) {
  return this.prisma.procedurePortail.findUnique({
    where: { id_procedure: id },
    include: {
      demandes: {
        include: {
          entreprise: true,
          typeProcedure: true, // 🔑 moved here instead of procedure
        },
        take: 1, // first demande
      },
      ProcedureEtape: {
        include: {
          etape: true,
        },
        orderBy: {
          etape: {
            ordre_etape: 'asc',
          },
        },
      },
      permis: {
        include: {
          detenteur: true,
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
            orderBy: {
              etape: {
                ordre_etape: 'asc',
              },
            },
          },
        },
      },
      typeProcedure: true,   // ✅ now linked via demande
      entreprise: true,
    },
    orderBy: {
      date_demande: 'desc',
    },
  });

  return data;
}


async deleteProcedureAndRelatedData(procedureId: number) { 
  return this.prisma.$transaction(async (prisma) => {
    // First get the demande for this procedure
    const demande = await prisma.demandePortail.findFirst({
      where: { id_proc: procedureId },
      include: {
        typeProcedure: true,
        procedure: {
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
    });

    if (!demande) {
      throw new Error('Demande not found for this procedure');
    }

    // If this is a renewal procedure, decrement the count
    if (demande.typeProcedure?.libelle?.toLowerCase() === 'renouvellement' && 
        demande.procedure!.permis.length > 0) {
      const permisId = demande.procedure!.permis[0].id;
      const currentCount = demande.procedure!.permis[0].nombre_renouvellements || 0;
      
      await prisma.permisPortail.update({
        where: { id: permisId },
        data: {
          nombre_renouvellements: Math.max(0, currentCount - 1),
        },
      });
    }

    // Get all related demandes for this procedure
    const demandes = await prisma.demandePortail.findMany({
      where: { id_proc: procedureId },
      select: {
        id_demande: true,
        id_entreprise: true,
        id_expert: true,
      },
    });

    const demandeIds = demandes.map(d => d.id_demande);
    const detenteurIds = demandes.map(d => d.id_entreprise).filter(id => id !== null) as number[];
    const expertIds = demandes.map(d => d.id_expert).filter(id => id !== null) as number[];

    // NEW: Delete related records in correct order to avoid foreign key constraints

    // 1. Delete CahierCharge records first
    await prisma.cahierCharge.deleteMany({
      where: { 
        demandeId: { in: demandeIds } 
      },
    });

    // 2. Delete ProcedureRenouvellement records
    await prisma.procedureRenouvellement.deleteMany({
      where: { 
        id_demande: { in: demandeIds } 
      },
    });

    // 3. Delete DossierFournisDocument records
    await prisma.dossierFournisDocumentPortail.deleteMany({
      where: { 
        dossierFournis: { 
          id_demande: { in: demandeIds } 
        }, 
      },
    });

    // 4. Delete DossierFournis records
    await prisma.dossierFournisPortail.deleteMany({
      where: { id_demande: { in: demandeIds } }
    });

    // 5. Delete SubstanceAssocieeDemande records
    await prisma.substanceAssocieeDemande.deleteMany({
      where: { id_proc: procedureId }
    });

    // 6. Delete InteractionWali records
    await prisma.interactionWaliPortail.deleteMany({
      where: { id_procedure: procedureId }
    });
  /*
    // 7. Handle SeanceCD and related records
    const seances = await prisma.procedurePortail.findUnique({
      where: { id_procedure: procedureId },
      select: { id_seance: true }
    });

    if (seances?.id_seance) {
      const seanceId = seances.id_seance;

      // Get all comites related to this seance
      const comites = await prisma.comiteDirection.findMany({
        where: { id_seance: seanceId },
        select: { id_comite: true }
      });

      const comiteIds = comites.map(c => c.id_comite);

      if (comiteIds.length > 0) {
        // Delete all decisions of these comites
        await prisma.decisionCD.deleteMany({
          where: { id_comite: { in: comiteIds } }
        });

        // Delete all comites for this seance
        await prisma.comiteDirection.deleteMany({
          where: { id_seance: seanceId }
        });
      }

      // Check if any other procedures use this seance before deleting it
      const otherProceduresCount = await prisma.procedurePortail.count({
        where: {
          id_procedure: { not: procedureId },
          id_seance: seanceId
        }
      });

      if (otherProceduresCount === 0) {
        // Only delete if no other procedures are linked
        await prisma.seanceCDPrevue.delete({
          where: { id_seance: seanceId }
        });
      }
    }
*/
    // 8. Delete ProcedureEtape records
    await prisma.procedureEtape.deleteMany({
      where: { id_proc: procedureId }
    });

    // 9. Delete related Coordonnee records
    const links = await prisma.procedureCoordPortail.findMany({
      where: { id_proc: procedureId },
      select: { id_coordonnees: true }
    });

    const coordIds = links.map(l => l.id_coordonnees);

    await prisma.procedureCoordPortail.deleteMany({
      where: { id_proc: procedureId }
    });

    await prisma.coordonneePortail.deleteMany({
      where: { id_coordonnees: { in: coordIds } }
    });

    // 10. Now delete the Demandes (this should work after deleting all related records)
    await prisma.demandePortail.deleteMany({
      where: { id_proc: procedureId }
    });

    // 11. Check and delete DetenteurMorale if not referenced elsewhere
    const personnePhysiqueIdsToDelete: number[] = [];
    
    for (const detenteurId of detenteurIds) {
      const otherReferences = await prisma.demandePortail.count({
        where: { 
          id_entreprise: detenteurId,
          id_proc: { not: procedureId }
        }
      });
      
      const permisReferences = await prisma.permisPortail.count({
        where: { id_detenteur: detenteurId }
      });

      if (otherReferences === 0 && permisReferences === 0) {
        // First get all PersonnePhysique IDs related to this detenteur
        const fonctions = await prisma.fonctionPersonneMoralePortail.findMany({
          where: { id_entreprise: detenteurId },
          select: { id_personne: true }
        });
        
        // Collect PersonnePhysique IDs for potential deletion
        personnePhysiqueIdsToDelete.push(...fonctions.map(f => f.id_personne));

        // Delete related FonctionPersonneMoral records
        await prisma.fonctionPersonneMoralePortail.deleteMany({
          where: { id_entreprise: detenteurId }
        });

        // Delete related RegistreCommerce if exists
        await prisma.registreCommercePortail.deleteMany({
          where: { id_entreprise: detenteurId }
        });

        // Delete the DetenteurMorale
        await prisma.entreprisePortail.delete({
          where: { id_entreprise: detenteurId }
        });
      }
    }

    // 12. Check and delete PersonnePhysique records if they're not referenced elsewhere
    for (const personneId of personnePhysiqueIdsToDelete) {
      const otherFonctionReferences = await prisma.fonctionPersonneMoralePortail.count({
        where: { id_personne: personneId }
      });

      if (otherFonctionReferences === 0) {
        await prisma.personnePhysiquePortail.delete({
          where: { id_personne: personneId }
        });
      }
    }

    // 13. Check and delete ExpertMinier if not referenced elsewhere
    for (const expertId of expertIds) {
      const otherReferences = await prisma.demandePortail.count({
        where: { 
          id_expert: expertId,
          id_proc: { not: procedureId }
        }
      });

      if (otherReferences === 0) {
        await prisma.expertMinierPortail.delete({
          where: { id_expert: expertId }
        });
      }
    }

    // 14. Finally, delete the Procedure itself
    return prisma.procedurePortail.delete({
      where: { id_procedure: procedureId }
    });
  });
}

async terminerProcedure(idProc: number) {
  const procedure = await this.prisma.procedurePortail.findUnique({
    where: { id_procedure: idProc },
    include: { demandes: true }, // plural!
  });

  if (!procedure || procedure.demandes.length === 0) {
    throw new NotFoundException('Procédure ou demande introuvable');
  }

  const demande = procedure.demandes[0]; // Assuming only one demande per procédure
  const now = new Date();

  await this.prisma.$transaction([
    this.prisma.procedurePortail.update({
      where: { id_procedure: idProc },
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
