// src/detenteur-morale/detenteur-morale.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DetenteurMoraleService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.detenteurMoralePortail.findMany({
      orderBy: { nom_societeFR: 'asc' },
    });
  }

  async findOne(id: number) {
    const detenteur = await this.prisma.detenteurMoralePortail.findUnique({
      where: { id_detenteur: id },
    });

    if (!detenteur) {
      throw new NotFoundException(`DetenteurMorale with ID ${id} not found`);
    }

    return detenteur;
  }
}
