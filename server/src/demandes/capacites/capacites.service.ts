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

    if (data.id_expert) {
      const expertExists = await this.prisma.expertMinier.findUnique({
        where: { id_expert: data.id_expert },
      });

      if (!expertExists) {
        throw new Error(`Expert with id ${data.id_expert} does not exist`);
      }
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
        id_expert: data.id_expert || null,
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