import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DemandesDashboardService {
  constructor(private prisma: PrismaService) {}

  async findPending() {
    return this.prisma.demandePortail.findMany({
      where: {
        procedure: {
          statut_proc: 'EN_COURS'
        }
      },
      include: {
        entreprise: true,
        procedure: true
      },
      orderBy: {
        date_demande: 'desc'
      }
    });
  }
}