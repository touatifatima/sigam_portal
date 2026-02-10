import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermisDashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const now = new Date();
    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

    const [totalPermis, activePermis, pendingDemands, expiredPermis, expiringSoon, surfaceAgg, topDetGroup] =
      await Promise.all([
        this.prisma.permisPortail.count(),
        this.prisma.permisPortail.count({
          where: { statut: { lib_statut: 'En vigueur' } },
        }),
        this.prisma.procedurePortail.count({
          where: { statut_proc: 'EN_COURS' },
        }),
        this.prisma.permisPortail.count({
          where: {
            date_expiration: { lt: now },
            statut: { lib_statut: 'En vigueur' },
          },
        }),
        this.prisma.permisPortail.count({
          where: {
            date_expiration: { gt: now, lte: sixMonthsLater },
          },
        }),
        this.prisma.permisPortail.aggregate({
          _sum: { superficie: true },
          _avg: { superficie: true },
          _max: { superficie: true },
        }),
        this.prisma.permisPortail.groupBy({
          by: ['id_detenteur'],
          where: { id_detenteur: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
      ]);

    const detIds = topDetGroup
      .map((g) => g.id_detenteur)
      .filter((id): id is number => typeof id === 'number');

    const detMap = detIds.length
      ? (
          await this.prisma.detenteurMoralePortail.findMany({
            where: { id_detenteur: { in: detIds } },
            select: { id_detenteur: true, nom_societeFR: true },
          })
        ).reduce<Record<number, string>>((acc, d) => {
          acc[d.id_detenteur] = d.nom_societeFR || 'Sans titulaire';
          return acc;
        }, {})
      : {};

    const topTitulaires = topDetGroup.map((g) => ({
      name: detMap[g.id_detenteur as number] || 'Sans titulaire',
      count: g._count.id,
    }));

    return {
      total: totalPermis,
      actifs: activePermis,
      enCours: pendingDemands,
      expires: expiredPermis,
      expiringSoon,
      surface: {
        total: Number(surfaceAgg._sum.superficie || 0),
        avg: Number(surfaceAgg._avg.superficie || 0),
        max: Number(surfaceAgg._max.superficie || 0),
      },
      topTitulaires,
    };
  }

  async getPermisEvolution() {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 6 }, (_, i) => currentYear - 5 + i);

    const evolutionData = await Promise.all(
      years.map(async (year) => {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year + 1, 0, 1);

        const count = await this.prisma.permisPortail.count({
          where: {
            date_octroi: {
              gte: startDate,
              lt: endDate,
            },
          },
        });

        return {
          year: year.toString(),
          value: count,
        };
      }),
    );

    return evolutionData;
  }

  async getPermisTypesDistribution() {
    const typeData = await this.prisma.typePermis.findMany({
      include: {
        _count: {
          select: { permis: true },
        },
      },
    });

    const colors = [
      '#3B82F6',
      '#06B6D4',
      '#F472B6',
      '#FBBF24',
      '#10B981',
      '#8B5CF6',
    ];

    return typeData.map((type, index) => ({
      name: type.lib_type,
      value: type._count.permis,
      color: colors[index % colors.length],
    }));
  }

  // Add this new method for status distribution
  async getPermisStatusDistribution() {
    // Get all statuses with their counts
    const statusData = await this.prisma.statutPermis.findMany({
      include: {
        _count: {
          select: { Permis: true },
        },
      },
    });

    // Define colors for different statuses
    const statusColors: Record<string, string> = {
      Actif: '#10B981', // Green
      Expirée: '#EF4444', // Red
      'En attente': '#F59E0B', // Amber
      Suspendu: '#8B5CF6', // Violet
      Révoqué: '#64748B', // Gray
      default: '#3B82F6', // Blue (default)
    };

    return statusData.map((status) => ({
      name: status.lib_statut,
      value: status._count.Permis,
      color: statusColors[status.lib_statut] || statusColors.default,
    }));
  }

  // Alternative method if you want to include expiration-based status
  async getPermisStatusDistributionWithExpiration() {
    // Get status-based counts
    const statusData = await this.prisma.statutPermis.findMany({
      include: {
        _count: {
          select: { Permis: true },
        },
      },
    });

    // Get count of expired permits regardless of their status
    const expiredCount = await this.prisma.permisPortail.count({
      where: {
        date_expiration: {
          lt: new Date(),
        },
      },
    });

    // Define colors for different statuses
    const statusColors: Record<string, string> = {
      'En vigueur': '#10B981', // Green
      Expirée: '#EF4444', // Red
      'En attente': '#F59E0B', // Amber
      Suspendu: '#8B5CF6', // Violet
      Révoqué: '#64748B', // Gray
      default: '#3B82F6', // Blue (default)
    };

    const result = statusData.map((status) => ({
      name: status.lib_statut,
      value: status._count.Permis,
      color: statusColors[status.lib_statut] || statusColors.default,
    }));

    // Add expired count as a separate category if needed
    // Note: This might double-count permits that are marked as expired in both status and date
    result.push({
      name: 'Expirée (par date)',
      value: expiredCount,
      color: '#EF4444',
    });

    return result;
  }

  async getRecentActivities() {
    // Get recent permis creations
    const recentPermis = await this.prisma.permisPortail.findMany({
      take: 10,
      orderBy: { date_octroi: 'desc' },
      include: {
        typePermis: true,
        detenteur: true,
        antenne: true,
      },
    });

    // Get recent demandes
    const recentDemandes = await this.prisma.demandePortail.findMany({
      take: 10,
      orderBy: { date_demande: 'desc' },
      include: {
        detenteurdemande: { include: { detenteur: true } },
        procedure: true,
      },
    });

    // Transform into activity format
    const activities = [
      ...recentPermis.map((permis) => ({
        id: permis.id,
        type: 'permis' as const,
        title: 'Nouveau permis créé',
        description: `Permis ${permis.typePermis.lib_type} créé`,
        timestamp: permis.date_octroi,
        status: 'success' as const,
        code: permis.code_permis,
        user: permis.detenteur?.nom_societeFR,
      })),
      ...recentDemandes.map((demande) => ({
        id: demande.id_demande,
        type: 'demande' as const,
        title: 'Nouvelle demande soumise',
        description: `Demande de ${demande.procedure?.statut_proc || 'nouveau permis'}`,
        timestamp: demande.date_demande,
        status: 'info' as const,
        code: demande.code_demande,
        user: demande.detenteurdemande?.[0]?.detenteur?.nom_societeFR,
      })),
    ];

    // Sort by timestamp and return top 10
    return activities.sort(
      (a, b) =>
        new Date(b.timestamp ?? 0).getTime() -
        new Date(a.timestamp ?? 0).getTime(),
    );
  }

  async getExpiringSoonPermis() {
    const now = new Date();
    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

    return this.prisma.permisPortail.findMany({
      where: {
        date_expiration: {
          gt: now,
          lte: sixMonthsLater,
        },
      },
      orderBy: { date_expiration: 'asc' },
      select: {
        id: true,
        code_permis: true,
        date_expiration: true,
        superficie: true,
        typePermis: { select: { code_type: true, lib_type: true } },
        detenteur: { select: { nom_societeFR: true } },
      },
    });
  }

  async getTopSurfacePermis() {
    return this.prisma.permisPortail.findMany({
      orderBy: [{ superficie: 'desc' }],
      where: { superficie: { not: null } },
      take: 10,
      select: {
        id: true,
        code_permis: true,
        superficie: true,
        typePermis: { select: { code_type: true, lib_type: true } },
        detenteur: { select: { nom_societeFR: true } },
      },
    });
  }

  async getPermisByWilaya() {
    // Group permits by wilaya code then enrich with wilaya names
    const grouped = await this.prisma.permisPortail.groupBy({
      by: ['code_wilaya'],
      _count: { id: true },
      where: { code_wilaya: { not: null } },
    });

    const codes = grouped
      .map((g) => g.code_wilaya)
      .filter((c): c is string => !!c);

    const wilayas = codes.length
      ? await this.prisma.wilaya.findMany({
          where: { code_wilaya: { in: codes } },
          select: { code_wilaya: true, nom_wilayaFR: true },
        })
      : [];

    const nameMap = wilayas.reduce<Record<string, string>>((acc, w) => {
      acc[w.code_wilaya] = w.nom_wilayaFR;
      return acc;
    }, {});

    return grouped.map((g) => ({
      label: nameMap[g.code_wilaya ?? ''] || g.code_wilaya || 'Non renseignée',
      value: g._count.id,
      code: g.code_wilaya,
    }));
  }

  async getPermisByAntenne() {
    // Group permits by antenne then enrich with antenne names
    const grouped = await this.prisma.permisPortail.groupBy({
      by: ['id_antenne'],
      _count: { id: true },
      where: { id_antenne: { not: null } },
    });

    const ids = grouped
      .map((g) => g.id_antenne)
      .filter((id): id is number => typeof id === 'number');

    const antennes = ids.length
      ? await this.prisma.antenne.findMany({
          where: { id_antenne: { in: ids } },
          select: { id_antenne: true, nom: true },
        })
      : [];

    const nameMap = antennes.reduce<Record<number, string>>((acc, a) => {
      acc[a.id_antenne] = a.nom;
      return acc;
    }, {});

    return grouped.map((g) => ({
      label: nameMap[g.id_antenne as number] || `Antenne ${g.id_antenne}`,
      value: g._count.id,
      id_antenne: g.id_antenne,
    }));
  }

  async getTopSubstances(limit = 10) {
    const associations = await this.prisma.substanceAssocieeDemande.findMany({
      where: { id_substance: { not: null } },
      select: {
        id_substance: true,
        procedure: {
          select: {
            permisProcedure: { select: { id_permis: true } },
          },
        },
      },
    });

    const substancePermisMap = new Map<number, Set<number>>();

    associations.forEach((assoc) => {
      const substanceId = assoc.id_substance;
      if (typeof substanceId !== 'number') return;
      const permits = assoc.procedure?.permisProcedure ?? [];
      if (!permits.length) return;
      let set = substancePermisMap.get(substanceId);
      if (!set) {
        set = new Set<number>();
        substancePermisMap.set(substanceId, set);
      }
      permits.forEach((p) => {
        if (typeof p.id_permis === 'number') {
          set?.add(p.id_permis);
        }
      });
    });

    const ranked = Array.from(substancePermisMap.entries())
      .map(([id, set]) => ({ id, count: set.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const ids = ranked.map((row) => row.id);
    const substances = ids.length
      ? await this.prisma.substance.findMany({
          where: { id_sub: { in: ids } },
          select: { id_sub: true, nom_subFR: true, nom_subAR: true },
        })
      : [];

    const nameMap: Record<number, string> = {};
    substances.forEach((sub) => {
      nameMap[sub.id_sub] = sub.nom_subFR || sub.nom_subAR || `Substance ${sub.id_sub}`;
    });

    return ranked.map((row) => ({
      id: row.id,
      name: nameMap[row.id] || `Substance ${row.id}`,
      count: row.count,
    }));
  }
}
