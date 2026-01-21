import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateActionnaireDto,
  ActionnaireResult,
} from '../dto/create-actionnaire.dto';
import {
  PersonnePhysiquePortail,
  FonctionPersonneMoral,
  RegistreCommercePortail,
  DetenteurMoralePortail,
  EnumTypeFonction,
  Prisma,
} from '@prisma/client';

@Injectable()
export class SocieteService {
  async getAllStatutsJuridiques() {
    return this.prisma.statutJuridiquePortail.findMany({
      orderBy: { code_statut: 'asc' },
    });
  }

  async getStatutJuridiqueById(id: number) {
    return this.prisma.statutJuridiquePortail.findUnique({
      where: { id_statutJuridique: id },
    });
  }

  async createDetenteur(data: any) {
    // First validate the statut exists
    const statutExists = await this.prisma.statutJuridiquePortail.findUnique({
      where: { id_statutJuridique: parseInt(data.statut_id, 10) },
    });

    if (!statutExists) {
      throw new HttpException(
        'Statut juridique invalide',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate pays exists if id_pays is provided
    if (data.id_pays) {
      const paysExists = await this.prisma.pays.findUnique({
        where: { id_pays: parseInt(data.id_pays, 10) },
      });
      if (!paysExists) {
        throw new HttpException('Pays invalide', HttpStatus.BAD_REQUEST);
      }
    }
    // Validate nationalite exists if provided
    if (data.id_nationalite) {
      const natExists = await this.prisma.nationalite.findUnique({
        where: { id_nationalite: parseInt(data.id_nationalite, 10) },
      });
      if (!natExists) {
        throw new HttpException('Nationalité invalide', HttpStatus.BAD_REQUEST);
      }
    }


    // Parse optional date_constitution
    let parsedDateConstitution: Date | null = null;
    if (data.date_constitution && String(data.date_constitution).trim() !== '') {
      const d = new Date(data.date_constitution);
      if (Number.isNaN(d.getTime())) {
        throw new HttpException('Date de constitution invalide', HttpStatus.BAD_REQUEST);
      }
      parsedDateConstitution = d;
    }

    const existing = await this.prisma.detenteurMoralePortail.findFirst({
      where: {
        nom_societeFR: data.nom_fr,
        nom_societeAR: data.nom_ar,
      },
    });

    if (existing) {
      throw new HttpException(
        'Le Detenteur Morale existe déjà.',
        HttpStatus.CONFLICT,
      );
    }

    return this.prisma.detenteurMoralePortail.create({
      data: {
        nom_societeFR: data.nom_fr,
        nom_societeAR: data.nom_ar,
        telephone: data.tel,
        email: data.email,
        fax: data.fax,
        adresse_siege: data.adresse,
        date_constitution: parsedDateConstitution,
        // Link to StatutJuridique via join table (many-to-many)
        FormeJuridiqueDetenteur: {
          create: {
            id_statut: parseInt(data.statut_id, 10),
            date: new Date(),
          },
        },
        ...(data.id_pays && {
          pays: {
            connect: { id_pays: parseInt(data.id_pays, 10) },
          },
        }),
        ...(data.id_nationalite && {
          nationaliteRef: {
            connect: { id_nationalite: parseInt(data.id_nationalite, 10) },
          },
        }),
      },
    });
  }

  async updateRepresentant(nin: string, data: any) {
    // Find person by NIN
    const personne = await this.prisma.personnePhysiquePortail.findUnique({
      where: { num_carte_identite: nin },
    });

    if (!personne) {
      throw new HttpException('Personne non trouvée', HttpStatus.NOT_FOUND);
    }

    // Resolve optional nationality label from id_nationalite for legacy string field
    let nationalite = '';
    if (data.id_nationalite) {
      const nat = await this.prisma.nationalite.findUnique({
        where: { id_nationalite: parseInt(data.id_nationalite, 10) },
      });
      if (nat) nationalite = nat.libelle;
    }

    const updatedPersonne = await this.prisma.personnePhysiquePortail.update({
      where: { id_personne: personne.id_personne },
      data: {
        nomFR: data.nom,
        prenomFR: data.prenom,
        nomAR: data.nom_ar,
        prenomAR: data.prenom_ar,
        telephone: data.tel,
        email: data.email,
        fax: data.fax,
        qualification: data.qualite,
        lieu_naissance: data.lieu_naissance,
        ...(data.id_pays && {
          pays: { connect: { id_pays: parseInt(data.id_pays, 10) } },
        }),
        ...(data.id_nationalite && {
          nationaliteRef: {
            connect: { id_nationalite: parseInt(data.id_nationalite, 10) },
          },
        }),
      },
    });

    // Update or create the function
    await this.linkFonction(
      updatedPersonne.id_personne,
      data.id_detenteur,
      EnumTypeFonction.Representant,
      'Actif',
      parseFloat(data.taux_participation),
    );

    return { personne: updatedPersonne };
  }

  async updateRepresentantById(id_personne: number, data: any) {
    const personne = await this.prisma.personnePhysiquePortail.findUnique({
      where: { id_personne },
    });

    if (!personne) {
      throw new HttpException('Personne non trouvée', HttpStatus.NOT_FOUND);
    }

    const updatedPersonne = await this.prisma.personnePhysiquePortail.update({
      where: { id_personne },
      data: {
        nomFR: data.nom,
        prenomFR: data.prenom,
        nomAR: data.nom_ar,
        prenomAR: data.prenom_ar,
        telephone: data.tel,
        email: data.email,
        fax: data.fax,
        qualification: data.qualite,
        lieu_naissance: data.lieu_naissance,
        num_carte_identite: data.nin ?? personne.num_carte_identite,
        ...(data.id_pays && {
          pays: { connect: { id_pays: parseInt(data.id_pays, 10) } },
        }),
        ...(data.id_nationalite && {
          nationaliteRef: {
            connect: { id_nationalite: parseInt(data.id_nationalite, 10) },
          },
        }),
      },
    });

    await this.linkFonction(
      updatedPersonne.id_personne,
      data.id_detenteur,
      EnumTypeFonction.Representant,
      'Actif',
      parseFloat(data.taux_participation),
    );

    return { personne: updatedPersonne };
  }

  async linkFonction(
    id_personne: number,
    id_detenteur: number,
    type_fonction: EnumTypeFonction,
    statut_personne: string,
    taux_participation: number,
  ): Promise<FonctionPersonneMoral> {
    // For "Representant" we keep a single row per detenteur: update the existing row even if the personne change
    if (type_fonction === EnumTypeFonction.Representant) {
      const existingRep = await this.prisma.fonctionPersonneMoral.findFirst({
        where: {
          id_detenteur,
          type_fonction,
        },
      });

      if (existingRep) {
        return this.prisma.fonctionPersonneMoral.update({
          where: { id_fonctionDetent: existingRep.id_fonctionDetent },
          data: {
            id_personne,
            statut_personne,
            taux_participation,
          },
        });
      }
    } else {
      // For other fonctions (e.g., actionnaires), keep uniqueness per personne/detenteur/type
      const existing = await this.prisma.fonctionPersonneMoral.findFirst({
        where: {
          id_personne,
          id_detenteur,
          type_fonction,
        },
      });

      if (existing) {
        // Update existing
        return this.prisma.fonctionPersonneMoral.update({
          where: {
            id_fonctionDetent: existing.id_fonctionDetent,
          },
          data: {
            statut_personne,
            taux_participation,
          },
        });
      }
    }

    // Create new if not exists
    const maxId = await this.prisma.fonctionPersonneMoral.aggregate({
      _max: { id_fonctionDetent: true },
    });
    const nextId = (maxId._max.id_fonctionDetent || 0) + 1;

    const data: Prisma.FonctionPersonneMoralUncheckedCreateInput = {
      id_fonctionDetent: nextId,
      id_detenteur,
      id_personne,
      type_fonction,
      statut_personne,
      taux_participation,
    };

    return this.prisma.fonctionPersonneMoral.create({
      data,
    });
  }

  async createRegistre(id_detenteur: number, data: any) {
    if (!data.numero_rc || !data.date_enregistrement || !data.capital_social || !data.nis || !data.nif) {
      throw new HttpException('Tous les champs requis doivent être fournis.', HttpStatus.BAD_REQUEST);
    }

    const existing = await this.prisma.registreCommercePortail.findFirst({
      where: {
        numero_rc: data.numero_rc,
        nis: data.nis,
        nif: data.nif,
        id_detenteur,
      },
    });

    if (existing) {
      throw new HttpException('Le Registre de Commerce existe déjà.', HttpStatus.CONFLICT);
    }

    const parsedDate = new Date(data.date_enregistrement);
    if (isNaN(parsedDate.getTime())) {
      throw new HttpException('Date d’enregistrement invalide.', HttpStatus.BAD_REQUEST);
    }

    const capital = parseFloat(data.capital_social);
    if (isNaN(capital)) {
      throw new HttpException('Capital social invalide.', HttpStatus.BAD_REQUEST);
    }

    return this.prisma.registreCommercePortail.create({
      data: {
        id_detenteur,
        numero_rc: data.numero_rc,
        date_enregistrement: parsedDate,
        capital_social: capital,
        nis: data.nis,
        adresse_legale: data.adresse_legale || '',
        nif: data.nif,
      },
    });
  }

  constructor(private prisma: PrismaService) {}

  async createPersonne(data: any): Promise<PersonnePhysiquePortail> {
    let existing: PersonnePhysiquePortail | null = null;
    if (data.nin) {
      existing = await this.prisma.personnePhysiquePortail.findFirst({
        where: {
          nomFR: data.nom,
          prenomFR: data.prenom,
          num_carte_identite: data.nin,
        },
      });
    }

    if (existing) {
      throw new HttpException(
        'Cette Personne Physique existe déjà.',
        HttpStatus.CONFLICT,
      );
    }

    // Determine nationality label from selected nationalité
    let nationalite = '';
    if (data.id_nationalite) {
      const nat = await this.prisma.nationalite.findUnique({
        where: { id_nationalite: parseInt(data.id_nationalite, 10) },
      });
      if (nat) nationalite = nat.libelle;
    }

    const createData: any = {
      nomFR: data.nom,
      prenomFR: data.prenom,
      nomAR: data.nom_ar ?? '',
      prenomAR: data.prenom_ar ?? '',
      telephone: data.tel ?? '',
      email: data.email ?? '',
      fax: data.fax ?? '',
      qualification: data.qualite,
      ...(data.nin && { num_carte_identite: data.nin }),
      adresse_domicile: data.adresse_domicile ?? '',
      date_naissance: data.date_naissance
        ? new Date(data.date_naissance)
        : new Date(),
      lieu_naissance: data.lieu_naissance ?? '',
      lieu_juridique_soc: data.lieu_juridique_soc ?? '',
      ref_professionnelles: data.ref_professionnelles ?? '',
    };

    if (data.id_pays) {
      createData.pays = { connect: { id_pays: parseInt(data.id_pays, 10) } };
    }
    if (data.id_nationalite) {
      createData.nationaliteRef = {
        connect: { id_nationalite: parseInt(data.id_nationalite, 10) },
      };
    }

    try {
      const result = await this.prisma.personnePhysiquePortail.create({
        data: createData,
      });
      return result;
    } catch (error) {
      console.error('Error creating PersonnePhysique:', error);
      throw error;
    }
  }

  async updateActionnaires(
    id_detenteur: number,
    list: CreateActionnaireDto[],
  ): Promise<ActionnaireResult[]> {
    // First delete actionnaires not in the new list
    const existingNins = list.map((a) => a.numero_carte).filter(Boolean);
    await this.prisma.fonctionPersonneMoral.deleteMany({
      where: {
        id_detenteur,
        type_fonction: 'Actionnaire',
        NOT: {
          personne: {
            num_carte_identite: {
              in: existingNins,
            },
          },
        },
      },
    });

    const results: ActionnaireResult[] = [];

    for (const [index, a] of list.entries()) {
      let personne: PersonnePhysiquePortail;
      const existingPersonne = await this.prisma.personnePhysiquePortail.findFirst({
        where: { num_carte_identite: a.numero_carte },
      });

      if (existingPersonne) {
        // Update existing person
        personne = await this.prisma.personnePhysiquePortail.update({
          where: { id_personne: existingPersonne.id_personne },
          data: {
            nomFR: a.nom,
            prenomFR: a.prenom,
            qualification: a.qualification,
            //nationalite: a.nationalite,
            lieu_naissance: a.lieu_naissance,
            // Add pays connection if available
            ...(a.id_pays && {
              pays: {
                connect: { id_pays: a.id_pays },
              },
            }),
            ...(a.id_nationalite && {
              nationaliteRef: {
                connect: { id_nationalite: a.id_nationalite },
              },
            }),
          },
        });
      } else {
        // Create new person with detailed logging
        const personneData: any = {
          nom: a.nom,
          prenom: a.prenom,
          nom_ar: '',
          prenom_ar: '',
          tel: '',
          email: '',
          fax: '',
          qualite: a.qualification,
          nin: a.numero_carte,
          lieu_naissance: a.lieu_naissance,
        };

        // Add id_pays if available
        if (a.id_pays) {
          personneData.id_pays = a.id_pays;
        } else {
          console.log('WARNING: No id_pays in actionnaire data');
        }

        if (a.id_nationalite) {
          personneData.id_nationalite = a.id_nationalite;
        }

        personne = await this.createPersonne(personneData);
      }

      // Link/update as actionnaire
      const lien = await this.linkFonction(
        personne.id_personne,
        id_detenteur,
        'Actionnaire',
        'Actif',
        parseFloat(a.taux_participation),
      );

      results.push({ personne, lien });
    }
    return results;
  }

  async updateRegistre(
    id_detenteur: number,
    data: any,
  ): Promise<RegistreCommercePortail> {
    // First check if registre exists for this detenteur
    const existing = await this.prisma.registreCommercePortail.findFirst({
      where: { id_detenteur },
    });

    if (!existing) {
      throw new HttpException(
        'Registre de Commerce non trouvé',
        HttpStatus.NOT_FOUND,
      );
    }

    const rawDate =
      typeof data.date_enregistrement === 'string' &&
      data.date_enregistrement.trim().toLowerCase() === 'invalid date'
        ? ''
        : data.date_enregistrement;
    let parsedDate: Date | null = null;
    if (rawDate) {
      parsedDate = new Date(rawDate);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new HttpException("Date d'enregistrement invalide.", HttpStatus.BAD_REQUEST);
      }
    }
    
    const rawCapital = data.capital_social;
    let capital: number | null = null;
    if (rawCapital !== undefined && rawCapital !== null && String(rawCapital).trim() !== '') {
      capital = parseFloat(rawCapital);
      if (Number.isNaN(capital)) {
        throw new HttpException('Capital social invalide.', HttpStatus.BAD_REQUEST);
      }
    }
    
    return this.prisma.registreCommercePortail.update({
      where: { id: existing.id }, // ??? use primary key (id)
      data: {
        numero_rc: data.numero_rc,
        date_enregistrement: parsedDate ?? existing.date_enregistrement,
        capital_social: capital ?? existing.capital_social,
        nis: data.nis,
        adresse_legale: data.adresse_legale,
        nif: data.nif,
        id_detenteur, // keep the relation
      },
    });
  }

  async updateDetenteur(id: number, data: any): Promise<DetenteurMoralePortail> {
    // First check if detenteur exists
    const existing = await this.prisma.detenteurMoralePortail.findUnique({
      where: { id_detenteur: id },
    });

    if (!existing) {
      throw new HttpException('Détenteur non trouvé', HttpStatus.NOT_FOUND);
    }

    // Check for conflicts with other detenteurs
    const conflictingDetenteur = await this.prisma.detenteurMoralePortail.findFirst({
      where: {
        NOT: { id_detenteur: id },
        OR: [{ nom_societeFR: data.nom_fr }, { nom_societeAR: data.nom_ar }],
      },
    });

    if (conflictingDetenteur) {
      throw new HttpException(
        'Un détenteur avec ce nom existe déjà',
        HttpStatus.CONFLICT,
      );
    }


    // Parse optional date_constitution similarly to registre updates
    const rawDateConst =
      typeof data.date_constitution === 'string' &&
      data.date_constitution.trim().toLowerCase() === 'invalid date'
        ? ''
        : data.date_constitution;
    let parsedDateConst: Date | null = null;
    if (rawDateConst) {
      const d = new Date(rawDateConst);
      if (Number.isNaN(d.getTime())) {
        throw new HttpException('Date de constitution invalide', HttpStatus.BAD_REQUEST);
      }
      parsedDateConst = d;
    }

    // Build update payload dynamically; include date only if provided, otherwise keep existing
    const updatePayload: Prisma.DetenteurMoralePortailUpdateInput = {
      nom_societeFR: data.nom_fr,
      nom_societeAR: data.nom_ar,
      telephone: data.tel,
      email: data.email,
      fax: data.fax,
      adresse_siege: data.adresse,
      ...(data.id_pays && {
        pays: { connect: { id_pays: parseInt(data.id_pays, 10) } },
      }),
      ...(data.id_nationalite && {
        nationaliteRef: {
          connect: { id_nationalite: parseInt(data.id_nationalite, 10) },
        },
      }),
    };

    const dateToPersist = parsedDateConst ?? existing.date_constitution;
    if (dateToPersist) {
      updatePayload.date_constitution = dateToPersist;
    }

    const updated = await this.prisma.detenteurMoralePortail.update({
      where: { id_detenteur: id },
      data: updatePayload,
    });

    // Optionally update statut juridique link in join table
    if (data.statut_id) {
      await this.prisma.formeJuridiqueDetenteur.deleteMany({
        where: { id_detenteur: id },
      });
      await this.prisma.formeJuridiqueDetenteur.create({
        data: {
          id_detenteur: id,
          id_statut: parseInt(data.statut_id, 10),
          date: new Date(),
        },
      });
    }

    return updated;
  }

  async deleteActionnaires(id_detenteur: number) {
    // Start transaction to ensure data consistency
    return this.prisma.$transaction(async (tx) => {
      // 1. Get all actionnaires with their person data
      const fonctions = await tx.fonctionPersonneMoral.findMany({
        where: {
          id_detenteur,
          type_fonction: 'Actionnaire',
        },
        include: {
          personne: true,
        },
      });

      // 2. Delete all actionnaire functions
      await tx.fonctionPersonneMoral.deleteMany({
        where: {
          id_detenteur,
          type_fonction: 'Actionnaire',
        },
      });

      // 3. Delete orphaned persons (not used in other functions)
      for (const f of fonctions) {
        const otherFunctionsCount = await tx.fonctionPersonneMoral.count({
          where: {
            id_personne: f.id_personne,
            NOT: {
              id_detenteur,
              id_personne: f.id_personne,
            },
          },
        });

        if (otherFunctionsCount === 0) {
          await tx.personnePhysiquePortail.delete({
            where: { id_personne: f.id_personne! },
          });
        }
      }

      return { count: fonctions.length };
    });
  }

  async createActionnaires(
    id_detenteur: number,
    list: CreateActionnaireDto[],
  ): Promise<ActionnaireResult[]> {
    const results: ActionnaireResult[] = [];

    for (const a of list) {
      // 1. Check if the person already exists
      const existingPersonne = await this.prisma.personnePhysiquePortail.findFirst({
        where: {
          nomFR: a.nom,
          prenomFR: a.prenom,
          num_carte_identite: a.numero_carte,
        },
      });

      let personne;

      if (existingPersonne) {
        // 2. Check if already linked to this detenteur as Actionnaire
        const existingLink = await this.prisma.fonctionPersonneMoral.findFirst({
          where: {
            id_personne: existingPersonne.id_personne,
            id_detenteur,
            type_fonction: 'Actionnaire',
          },
        });

        if (existingLink) {
          // 3. Throw HTTP Conflict
          throw new HttpException(
            `L'actionnaire "${a.nom} ${a.prenom}" existe déjà pour cette société.`,
            HttpStatus.CONFLICT,
          );
        }

        personne = existingPersonne;
      } else {
        // Create new personne
        personne = await this.createPersonne({
          nom: a.nom,
          prenom: a.prenom,
          nom_ar: '',
          prenom_ar: '',
          tel: '',
          email: '',
          fax: '',
          qualite: a.qualification,
          nationalite: a.id_nationalite,
          nin: a.numero_carte,
          id_pays: a.id_pays,
          lieu_naissance: a.lieu_naissance,
          pays: {
            connect: { id_pays: a.id_pays }, // 👈 connect instead of create
          },
        });
      }

      // Link as actionnaire
      const lien = await this.linkFonction(
        personne.id_personne,
        id_detenteur,
        'Actionnaire',
        'Actif',
        parseFloat(a.taux_participation),
      );

      results.push({ personne, lien });
    }

    return results;
  }

  async createSingleActionnaire(
    id_detenteur: number,
    dto: CreateActionnaireDto,
  ): Promise<ActionnaireResult> {
    if (!dto.id_pays || !dto.id_nationalite) {
      throw new HttpException(
        'Pays et nationalité sont obligatoires pour chaque actionnaire.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const taux = parseFloat(dto.taux_participation);
    if (Number.isNaN(taux)) {
      throw new HttpException(
        'Taux de participation invalide.',
        HttpStatus.BAD_REQUEST,
      );
    }

    let personne = dto.numero_carte
      ? await this.prisma.personnePhysiquePortail.findFirst({
          where: { num_carte_identite: dto.numero_carte },
        })
      : null;

    if (personne) {
      // If this person is already an actionnaire for this detenteur, do not overwrite: raise conflict
      const existingLink = await this.prisma.fonctionPersonneMoral.findFirst({
        where: {
          id_personne: personne.id_personne,
          id_detenteur,
          type_fonction: EnumTypeFonction.Actionnaire,
        },
      });
      if (existingLink) {
        throw new HttpException(
          "Cet actionnaire existe déjà pour cette société (utilisez Modifier pour le mettre à jour).",
          HttpStatus.CONFLICT,
        );
      }

      // Otherwise, update the person fields (e.g. if coming from another detenteur) then link
      personne = await this.prisma.personnePhysiquePortail.update({
        where: { id_personne: personne.id_personne },
        data: {
          nomFR: dto.nom,
          prenomFR: dto.prenom,
          qualification: dto.qualification,
          lieu_naissance: dto.lieu_naissance,
          ...(dto.id_pays && {
            pays: {
              connect: { id_pays: dto.id_pays },
            },
          }),
          ...(dto.id_nationalite && {
            nationaliteRef: {
              connect: { id_nationalite: dto.id_nationalite },
            },
          }),
        },
      });
    } else {
      personne = await this.createPersonne({
        nom: dto.nom,
        prenom: dto.prenom,
        nom_ar: '',
        prenom_ar: '',
        tel: '',
        email: '',
        fax: '',
        qualite: dto.qualification,
        nin: dto.numero_carte,
        id_pays: dto.id_pays,
        id_nationalite: dto.id_nationalite,
        lieu_naissance: dto.lieu_naissance,
      });
    }

    let lien = await this.prisma.fonctionPersonneMoral.findFirst({
      where: {
        id_personne: personne.id_personne,
        id_detenteur,
        type_fonction: EnumTypeFonction.Actionnaire,
      },
    });

    if (lien) {
      lien = await this.prisma.fonctionPersonneMoral.update({
        where: { id_fonctionDetent: lien.id_fonctionDetent },
        data: {
          taux_participation: taux,
          statut_personne: 'Actif',
        },
      });
    } else {
      lien = await this.linkFonction(
        personne.id_personne,
        id_detenteur,
        EnumTypeFonction.Actionnaire,
        'Actif',
        taux,
      );
    }

    return { personne, lien };
  }

  async updateSingleActionnaire(
    id_detenteur: number,
    id_actionnaire: number,
    dto: CreateActionnaireDto,
  ): Promise<ActionnaireResult> {
    const existingLien = await this.prisma.fonctionPersonneMoral.findFirst({
      where: {
        id_fonctionDetent: id_actionnaire,
        id_detenteur,
        type_fonction: EnumTypeFonction.Actionnaire,
      },
      include: { personne: true },
    });

    if (!existingLien) {
      throw new HttpException(
        "Actionnaire introuvable pour cette société.",
        HttpStatus.NOT_FOUND,
      );
    }

    const idPersonne = existingLien.id_personne;
    if (!idPersonne) {
      throw new HttpException(
        'Actionnaire sans personne associée.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const conflict =
      dto.numero_carte &&
      (await this.prisma.personnePhysiquePortail.findFirst({
        where: {
          num_carte_identite: dto.numero_carte,
          NOT: { id_personne: idPersonne },
        },
      }));
    if (conflict) {
      throw new HttpException(
        'Ce NIN est déjà utilisé par une autre personne.',
        HttpStatus.CONFLICT,
      );
    }

    const updatedPersonne = await this.prisma.personnePhysiquePortail.update({
      where: { id_personne: idPersonne },
      data: {
        nomFR: dto.nom,
        prenomFR: dto.prenom,
        qualification: dto.qualification,
        lieu_naissance: dto.lieu_naissance,
        num_carte_identite: dto.numero_carte,
        ...(dto.id_pays && {
          pays: {
            connect: { id_pays: dto.id_pays },
          },
        }),
        ...(dto.id_nationalite && {
          nationaliteRef: {
            connect: { id_nationalite: dto.id_nationalite },
          },
        }),
      },
    });

    const updatedLien = await this.prisma.fonctionPersonneMoral.update({
      where: { id_fonctionDetent: existingLien.id_fonctionDetent },
      data: {
        taux_participation: parseFloat(dto.taux_participation),
        statut_personne: 'Actif',
      },
    });

    return { personne: updatedPersonne, lien: updatedLien };
  }

  async deleteSingleActionnaire(
    id_detenteur: number,
    id_actionnaire: number,
  ) {
    const lien = await this.prisma.fonctionPersonneMoral.findFirst({
      where: {
        id_fonctionDetent: id_actionnaire,
        id_detenteur,
        type_fonction: EnumTypeFonction.Actionnaire,
      },
    });

    if (!lien) {
      throw new HttpException(
        "Actionnaire introuvable pour cette société.",
        HttpStatus.NOT_FOUND,
      );
    }

    await this.prisma.fonctionPersonneMoral.delete({
      where: { id_fonctionDetent: lien.id_fonctionDetent },
    });

    const stillUsed = await this.prisma.fonctionPersonneMoral.count({
      where: {
        id_personne: lien.id_personne as number,
        NOT: { id_fonctionDetent: lien.id_fonctionDetent },
      },
    });

    if (stillUsed === 0) {
      await this.prisma.personnePhysiquePortail.delete({
        where: { id_personne: lien.id_personne as number },
      });
    }

    return { deleted: true };
  }

  async searchDetenteurs(query: string): Promise<any[]> {
    try {
      return await this.prisma.detenteurMoralePortail.findMany({
        where: {
          OR: [
            { nom_societeFR: { contains: query, mode: 'insensitive' } },
            { nom_societeAR: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { telephone: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 10,
        select: {
          id_detenteur: true,
          nom_societeFR: true,
          nom_societeAR: true,
          telephone: true,
          email: true,
        },
        orderBy: { nom_societeFR: 'asc' },
      });
    } catch (error) {
      console.error('Error searching detenteurs:', error);
      throw new HttpException(
        'Failed to search detenteurs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getDetenteurById(id: number): Promise<any> {
    return this.prisma.detenteurMoralePortail.findUnique({
      where: { id_detenteur: id },
      include: {
        fonctions: {
          include: {
            personne: {
              include: {
                pays: true,
                nationaliteRef: true,
              },
            },
          },
        },
        registreCommerce: {
          take: 1,
          orderBy: { date_enregistrement: 'desc' },
        },
        FormeJuridiqueDetenteur: {
          include: {
            statutJuridique: true,
          },
        },
        pays: true,
        nationaliteRef: true,
      },
    });
  }

  async getRepresentantLegal(id_detenteur: number): Promise<any> {
    return this.prisma.fonctionPersonneMoral.findFirst({
      where: {
        id_detenteur,
        type_fonction: EnumTypeFonction.Representant,
      },
      include: {
        personne: {
          include: {
            pays: true,
            nationaliteRef: true,
          },
        },
      },
    });
  }

  async getRegistreCommerce(id_detenteur: number): Promise<any> {
    return this.prisma.registreCommercePortail.findMany({
      where: { id_detenteur },
      orderBy: { date_enregistrement: 'desc' },
    });
  }

  async updateRegistreById(id_registre: number, data: any): Promise<RegistreCommercePortail> {
    const existing = await this.prisma.registreCommercePortail.findUnique({
      where: { id: id_registre },
    });
    if (!existing) {
      throw new HttpException('Registre de Commerce non trouvé', HttpStatus.NOT_FOUND);
    }

    const rawDate =
      typeof data.date_enregistrement === 'string' &&
      data.date_enregistrement.trim().toLowerCase() === 'invalid date'
        ? ''
        : data.date_enregistrement;
    let parsedDate: Date | null = null;
    if (rawDate) {
      parsedDate = new Date(rawDate);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new HttpException("Date d'enregistrement invalide.", HttpStatus.BAD_REQUEST);
      }
    }

    const rawCapital = data.capital_social;
    let capital: number | null = null;
    if (rawCapital !== undefined && rawCapital !== null && String(rawCapital).trim() !== '') {
      capital = parseFloat(rawCapital);
      if (Number.isNaN(capital)) {
        throw new HttpException('Capital social invalide.', HttpStatus.BAD_REQUEST);
      }
    }

    return this.prisma.registreCommercePortail.update({
      where: { id: id_registre },
      data: {
        numero_rc: data.numero_rc,
        date_enregistrement: parsedDate ?? existing.date_enregistrement,
        capital_social: capital ?? existing.capital_social,
        nis: data.nis,
        adresse_legale: data.adresse_legale,
        nif: data.nif,
        id_detenteur: data.id_detenteur ?? existing.id_detenteur,
      },
    });
  }

  async deleteRegistreById(id_registre: number) {
    const existing = await this.prisma.registreCommercePortail.findUnique({
      where: { id: id_registre },
    });
    if (!existing) {
      throw new HttpException('Registre de Commerce non trouvé', HttpStatus.NOT_FOUND);
    }
    await this.prisma.registreCommercePortail.delete({ where: { id: id_registre } });
    return { deleted: true };
  }

  async getActionnaires(id_detenteur: number): Promise<any[]> {
    const rows = await this.prisma.fonctionPersonneMoral.findMany({
      where: {
        id_detenteur,
        type_fonction: EnumTypeFonction.Actionnaire,
      },
      include: {
        personne: {
          include: {
            pays: true,
            nationaliteRef: true,
          },
        },
      },
    });
    // Expose a stable id_actionnaire to simplify frontend mapping
    return rows.map((row) => ({
      ...row,
      id_actionnaire: row.id_fonctionDetent,
    }));
  }

  async associateDetenteurWithDemande(
    id_demande: number,
    id_detenteur: number,
  ): Promise<any> {
    // Verify both demande and detenteur exist
    const demande = await this.prisma.demandePortail.findUnique({
      where: { id_demande },
    });
    if (!demande) {
      throw new HttpException('Demande not found', HttpStatus.NOT_FOUND);
    }
    const detenteur = await this.prisma.detenteurMoralePortail.findUnique({
      where: { id_detenteur },
    });
    if (!detenteur) {
      throw new HttpException('Detenteur not found', HttpStatus.NOT_FOUND);
    }

    // Ensure only one primary detenteur per demande: remove existing links then create
    await this.prisma.detenteurDemandePortail.deleteMany({ where: { id_demande } });
    return this.prisma.detenteurDemandePortail.create({
      data: {
        id_demande,
        id_detenteur,
        role_detenteur: 'Titulaire',
      },
    });
  }
}
