import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('permis')
export class PermisPublicController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('type')
  async getPermisByType(@Query('type') type: string) {
    if (!type) {
      throw new BadRequestException('Le paramètre type est requis');
    }

    const permis = await this.prisma.permisPortail.findMany({
      where: {
        typePermis: { code_type: type.toUpperCase() },
      },
      include: {
        detenteur: true,
        typePermis: true,
        permisProcedure: {
          include: {
            procedure: {
              include: {
                demandes: {
                  include: {
                    detenteurdemande: {
                      include: { detenteur: true },
                      take: 1,
                    },
                  },
                  orderBy: { date_demande: 'desc' },
                  take: 1,
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

    return permis.map((p) => {
      const demandeCourante =
        p.permisProcedure?.[0]?.procedure?.demandes?.[0] ?? null;
      const procDates = (p.permisProcedure || [])
        .map((rel) => rel?.date_octroi_proc)
        .filter((d) => d != null)
        .map((d) => (d instanceof Date ? d : new Date(d)))
        .filter((d) => !isNaN(d.getTime()));
      const latestProcDate =
        procDates.length > 0
          ? new Date(Math.max(...procDates.map((d) => d.getTime())))
          : null;

      return {
        id: p.id,
        code_permis: p.code_permis,
        titulaire:
          p.detenteur?.nom_societeFR ??
          demandeCourante?.detenteurdemande?.[0]?.detenteur?.nom_societeFR ??
          null,
        // La superficie peut être portée par la demande la plus récente
        superficie: (p as any).superficie ?? demandeCourante?.superficie ?? null,
        localisation: p.lieu_ditFR ?? null,
        ressources: null,
        date_octroi:
          latestProcDate || p.date_octroi || demandeCourante?.date_demande || null,
        date_expiration: p.date_expiration || null,
        type: p.typePermis?.code_type ?? null,
      };
    });
  }
}