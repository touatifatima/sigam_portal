import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { mergeTypeSpecificFields } from '../demande/demande-type-helpers';

@Injectable()
export class CapacitesService {
  constructor(private prisma: PrismaService) {}

  async saveCapacites(data: any) {
    const id_demande = Number(data.id_demande);

    if (Number.isNaN(id_demande)) {
      throw new Error('Invalid id_demande: Must be a valid number');
    }

    const demande = await this.prisma.demandePortail.findUnique({
      where: { id_demande },
      include: { typeProcedure: true },
    });

    if (!demande) {
      throw new Error(`Demande with id ${id_demande} not found`);
    }

    let expertId = Number(data.id_expert);
    if (Number.isNaN(expertId)) {
      expertId = 0;
    }

    const expertMode = (data.expert_mode ?? '').toString();
    const expertAutre = (data.expert_autre ?? '').toString().trim();
    const expertNom = (data.nom_expert ?? '').toString().trim();

    const parsedAgrement = data.date_agrement ? new Date(data.date_agrement) : null;
    const agrementDate =
      parsedAgrement && !Number.isNaN(parsedAgrement.valueOf()) ? parsedAgrement : null;

    const expertPayload = {
      nom_expert: expertMode === 'autre' ? expertAutre : expertNom,
      num_agrement: data.num_agrement ? data.num_agrement.toString().trim() : null,
      date_agrement: agrementDate,
      etat_agrement: data.etat_agrement ? data.etat_agrement.toString().trim() : null,
      adresse: data.adresse ? data.adresse.toString().trim() : null,
      email: data.email ? data.email.toString().trim() : null,
      tel_expert: data.tel_expert ? data.tel_expert.toString().trim() : null,
      fax_expert: data.fax_expert ? data.fax_expert.toString().trim() : null,
      specialisation: data.specialisation ? data.specialisation.toString().trim() : null,
    };

    const hasExpertPayload = Boolean(expertPayload.nom_expert);

    if (hasExpertPayload) {
      if (expertId) {
        const expertExists = await this.prisma.expertMinier.findUnique({
          where: { id_expert: expertId },
        });

        if (expertExists) {
          await this.prisma.expertMinier.update({
            where: { id_expert: expertId },
            data: expertPayload,
          });
        } else {
          const createdExpert = await this.prisma.expertMinier.create({
            data: expertPayload,
          });
          expertId = createdExpert.id_expert;
        }
      } else {
        const createdExpert = await this.prisma.expertMinier.create({
          data: expertPayload,
        });
        expertId = createdExpert.id_expert;
      }
    } else if (expertId) {
      const expertExists = await this.prisma.expertMinier.findUnique({
        where: { id_expert: expertId },
      });

      if (!expertExists) {
        throw new Error(`Expert with id ${expertId} does not exist`);
      }
    } else {
      expertId = 0;
    }

    const typeLabel = demande.typeProcedure?.libelle?.toLowerCase() ?? '';
    const parsedDuration = data.duree_travaux
      ? parseInt(data.duree_travaux, 10)
      : null;
    const parsedStart = data.date_demarrage_prevue
      ? new Date(data.date_demarrage_prevue)
      : null;

    const durationValue =
      typeof parsedDuration === 'number' && Number.isFinite(parsedDuration)
        ? parsedDuration
        : null;

    const capacityPayload = {
      duree_trvx: durationValue,
      date_demarrage_prevue: parsedStart,
    };

    if (typeLabel.includes('renouvel')) {
      await this.prisma.procedureRenouvellement.upsert({
        where: { id_demande },
        update: capacityPayload,
        create: { id_demande, ...capacityPayload },
      });
    } else if (typeLabel.includes('modification')) {
      await this.prisma.demModification.upsert({
        where: { id_demande },
        update: capacityPayload,
        create: { id_demande, ...capacityPayload },
      });
    } else {
      await this.prisma.demInitial.upsert({
        where: { id_demande },
        update: capacityPayload,
        create: { id_demande, ...capacityPayload },
      });
    }

    const updated = await this.prisma.demandePortail.update({
      where: { id_demande },
      data: {
        description_travaux: data.description,
        sources_financement: data.financement,
        id_expert: expertId || null,
      },
      include: {
        expertMinier: true,
        typeProcedure: true,
        procedure: true,
        detenteurdemande: { include: { detenteur: true } },
        demInitial: true,
        modification: true,
        renouvellement: true,
      },
    });

    return mergeTypeSpecificFields(updated);
  }
}
