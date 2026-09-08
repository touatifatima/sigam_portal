import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type DashboardPaymentStatus =
  | 'paid'
  | 'pending'
  | 'failed'
  | 'expired'
  | 'cancelled';

type EncaissementPeriod = 'month' | 'quarter' | 'year';
type EncaissementScope = 'global' | 'user';

@Injectable()
export class PermisDashboardService {
  private readonly countryGeoCache = new Map<
    string,
    { lat: number; lng: number } | null
  >();

  constructor(private prisma: PrismaService) {}

  private normalizeText(value: string | null | undefined): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, '')
      .trim()
      .toLowerCase();
  }

  private isInvestorRoleName(value: string | null | undefined): boolean {
    const normalized = this.normalizeText(value);
    if (!normalized) return false;
    if (normalized.includes('invest')) return true;
    return ['user', 'utilisateur'].includes(normalized);
  }

  private async resolveCountryCoordinates(
    country: string,
  ): Promise<{ lat: number; lng: number } | null> {
    const normalized = this.normalizeText(country);
    if (!normalized) return null;

    const cached = this.countryGeoCache.get(normalized);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(country)}`,
        {
          headers: {
            'User-Agent': 'sigam-vite-dashboard/1.0',
            'Accept-Language': 'fr',
          },
        },
      );

      if (!response.ok) {
        this.countryGeoCache.set(normalized, null);
        return null;
      }

      const payload = (await response.json()) as Array<{
        lat?: string;
        lon?: string;
      }>;
      const first = payload[0];
      const lat = Number(first?.lat);
      const lng = Number(first?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        this.countryGeoCache.set(normalized, null);
        return null;
      }

      const coordinates = { lat, lng };
      this.countryGeoCache.set(normalized, coordinates);
      return coordinates;
    } catch {
      this.countryGeoCache.set(normalized, null);
      return null;
    }
  }

  private normalizePaymentStatus(
    value: string | null | undefined,
  ): DashboardPaymentStatus {
    const normalized = String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s_-]+/g, '')
      .trim()
      .toLowerCase();

    if (!normalized) return 'pending';
    if (
      normalized.includes('paid') ||
      normalized.includes('paye') ||
      normalized.includes('payee') ||
      normalized.includes('confirm') ||
      normalized.includes('valide') ||
      normalized.includes('valid')
    ) {
      return 'paid';
    }
    if (normalized.includes('fail') || normalized.includes('echou'))
      return 'failed';
    if (normalized.includes('expir')) return 'expired';
    if (normalized.includes('cancel') || normalized.includes('annul'))
      return 'cancelled';
    if (
      normalized.includes('attente') ||
      normalized.includes('pending') ||
      normalized.includes('due')
    ) {
      return 'pending';
    }

    return 'pending';
  }

  private isCollectedPayment(paymentStatus: string | null | undefined): boolean {
    return this.normalizePaymentStatus(paymentStatus) === 'paid';
  }

  private getEncaissementPeriodStart(period: EncaissementPeriod, now: Date): Date {
    if (period === 'month') {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }

    if (period === 'quarter') {
      const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
      return new Date(now.getFullYear(), quarterStartMonth, 1);
    }

    return new Date(now.getFullYear(), 0, 1);
  }

  private shiftDateClamped(date: Date, monthsOffset: number): Date {
    const year = date.getFullYear();
    const month = date.getMonth() + monthsOffset;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const milliseconds = date.getMilliseconds();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const safeDay = Math.min(day, lastDay);

    return new Date(year, month, safeDay, hours, minutes, seconds, milliseconds);
  }

  private getEncaissementCategory(libelle: string | null | undefined): {
    key: 'deposit' | 'instruction' | 'royalties' | 'taxes';
    label: string;
    color: string;
  } {
    const normalized = this.normalizeText(libelle);
    if (
      normalized.includes('produitattribution') ||
      normalized.includes('fraisdedossier') ||
      normalized.includes('depot') ||
      normalized.includes('dossier')
    ) {
      return {
        key: 'deposit',
        label: 'Frais de dépôt',
        color: '#3b82f6',
      };
    }

    if (normalized.includes('droitdetablissement') || normalized.includes('instruction')) {
      return {
        key: 'instruction',
        label: 'Frais d\'instruction',
        color: '#8b5cf6',
      };
    }

    if (normalized.includes('redevance')) {
      return {
        key: 'royalties',
        label: 'Redevances',
        color: '#14b8a6',
      };
    }

    return {
      key: 'taxes',
      label: 'Taxes et autres paiements',
      color: '#f59e0b',
    };
  }

  async getPublicDashboardStats() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [total, typesSubstances, superficieAgg, titulaires, titresAccordesCetteAnnee] = await Promise.all([
      this.prisma.permisPortail.count(),
      this.prisma.substance.count(),
      this.prisma.permisPortail.aggregate({
        _sum: { superficie: true },
      }),
      this.prisma.permisPortail.groupBy({
        by: ['id_detenteur'],
        where: { id_detenteur: { not: null } },
        _count: { id: true },
      }),
      this.prisma.permisPortail.count({
        where: {
          date_octroi: { gte: startOfYear, lte: now },
        },
      }),
    ]);

    return {
      total,
      typesSubstances,
      superficieTotale: Number(superficieAgg._sum.superficie || 0),
      entreprisesTitulaires: titulaires.length,
      titresAccordesCetteAnnee,
    };
  }

  async getDashboardStats() {
    const now = new Date();
    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

    const [
      totalPermis,
      activePermis,
      pendingDemands,
      expiredPermis,
      expiringSoon,
      surfaceAgg,
      topDetGroup,
    ] = await Promise.all([
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

  async getInvestorRepartition() {
    const users = await this.prisma.utilisateurPortail.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        role: {
          select: {
            name: true,
          },
        },
        detenteur: {
          select: {
            id_detenteur: true,
            pays: {
              select: {
                id_pays: true,
                nom_pays: true,
              },
            },
          },
        },
      },
    });

    const investorUsers = users.filter((user) =>
      this.isInvestorRoleName(user.role?.name),
    );

    const grouped = new Map<string, { country: string; count: number }>();
    let noCountryCount = 0;

    investorUsers.forEach((user) => {
      const country = String(user.detenteur?.pays?.nom_pays ?? '').trim();
      if (!country) {
        noCountryCount += 1;
        return;
      }

      const key = this.normalizeText(country);
      const current = grouped.get(key);
      if (current) {
        current.count += 1;
      } else {
        grouped.set(key, { country, count: 1 });
      }
    });

    const totalInvestors = investorUsers.length;
    const countries = await Promise.all(
      Array.from(grouped.values()).map(async (entry) => {
        const coordinates = await this.resolveCountryCoordinates(entry.country);
        return {
          country: entry.country,
          count: entry.count,
          percentage: totalInvestors
            ? Number(((entry.count / totalInvestors) * 100).toFixed(1))
            : 0,
          latitude: coordinates?.lat ?? null,
          longitude: coordinates?.lng ?? null,
        };
      }),
    );

    countries.sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));

    return {
      totalInvestors,
      countries,
      noCountry: {
        count: noCountryCount,
        percentage: totalInvestors
          ? Number(((noCountryCount / totalInvestors) * 100).toFixed(1))
          : 0,
      },
    };
  }

  async getUserDashboardStats(params: {
    userId: number;
    detenteurId?: number | null;
  }) {
    const safeUserId = Number(params.userId);
    const safeDetenteurId = Number(params.detenteurId ?? 0);

    if (!Number.isFinite(safeUserId) || safeUserId <= 0) {
      return {
        demandesEnCours: 0,
        permisActifs: 0,
        enInstruction: 0,
        demandesApprouvees: 0,
        totalPayeeYear: 0,
        previousYearTotalPayee: 0,
        referenceYear: new Date().getFullYear(),
      };
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const nextYearStart = new Date(currentYear + 1, 0, 1);
    const previousYearStart = new Date(currentYear - 1, 0, 1);

    const [demandesEnCours, enInstruction, demandesApprouvees, permisActifs, payments] =
      await Promise.all([
        this.prisma.demandePortail.count({
          where: {
            utilisateurId: safeUserId,
            statut_demande: {
              in: ['EN_COURS', 'EN_ATTENTE', 'EN_COMPLEMENT'],
            },
          },
        }),
        this.prisma.demandePortail.count({
          where: {
            utilisateurId: safeUserId,
            procedure: {
              statut_proc: 'EN_COURS',
            },
          },
        }),
        this.prisma.demandePortail.count({
          where: {
            utilisateurId: safeUserId,
            statut_demande: {
              in: ['ACCEPTEE', 'APPROUVEE', 'APPROUVE', 'VALIDEE'],
            },
          },
        }),
        safeDetenteurId > 0
          ? this.prisma.permisPortail.count({
              where: {
                id_detenteur: safeDetenteurId,
                OR: [
                  { statut: { lib_statut: 'En vigueur' } },
                  { date_expiration: { gt: now } },
                  { date_expiration: null },
                ],
              },
            })
          : Promise.resolve(0),
        this.prisma.paiement.findMany({
          where: {
            idUtilisateur: safeUserId,
            date_paiement: {
              gte: previousYearStart,
              lt: nextYearStart,
            },
          },
          select: {
            montant_paye: true,
            etat_paiement: true,
            date_paiement: true,
          },
          orderBy: { date_paiement: 'desc' },
        }),
      ]);

    const paymentTotals = payments.reduce(
      (acc, payment) => {
        if (this.normalizePaymentStatus(payment.etat_paiement) !== 'paid') {
          return acc;
        }

        const amount = Number(payment.montant_paye || 0);
        const paymentYear = payment.date_paiement.getFullYear();

        if (paymentYear === currentYear) {
          acc.totalPayeeYear += amount;
        } else if (paymentYear === currentYear - 1) {
          acc.previousYearTotalPayee += amount;
        }

        return acc;
      },
      {
        totalPayeeYear: 0,
        previousYearTotalPayee: 0,
      },
    );

    return {
      demandesEnCours,
      permisActifs,
      enInstruction,
      demandesApprouvees,
      totalPayeeYear: paymentTotals.totalPayeeYear,
      previousYearTotalPayee: paymentTotals.previousYearTotalPayee,
      referenceYear: currentYear,
    };
  }

  async getDashboardPayments(userId: number) {
    const safeUserId = Number(userId);
    if (!Number.isFinite(safeUserId) || safeUserId <= 0) {
      return {
        summary: {
          totalDue: 0,
          pendingCount: 0,
        },
        latestPayments: [],
      };
    }

    const [allPayments, latestPayments] = await Promise.all([
      this.prisma.paiement.findMany({
        where: { idUtilisateur: safeUserId },
        select: {
          montant_paye: true,
          etat_paiement: true,
        },
      }),
      this.prisma.paiement.findMany({
        where: { idUtilisateur: safeUserId },
        orderBy: { date_paiement: 'desc' },
        take: 5,
        include: {
          facture: {
            include: {
              demande: {
                select: {
                  code_demande: true,
                  short_code: true,
                  typePermis: {
                    select: {
                      lib_type: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const summary = allPayments.reduce(
      (acc, payment) => {
        const status = this.normalizePaymentStatus(payment.etat_paiement);
        if (status === 'pending') {
          acc.totalDue += Number(payment.montant_paye || 0);
          acc.pendingCount += 1;
        }
        return acc;
      },
      {
        totalDue: 0,
        pendingCount: 0,
      },
    );

    return {
      summary,
      latestPayments: latestPayments.map((payment) => {
        const demande = payment.facture?.demande ?? null;
        const requestReference =
          demande?.code_demande || demande?.short_code || `PAY-${payment.id}`;

        return {
          id: payment.id,
          requestReference,
          permitType: demande?.typePermis?.lib_type || 'Demande minière',
          amount: Number(payment.montant_paye || 0),
          status: this.normalizePaymentStatus(payment.etat_paiement),
          paymentDate: payment.date_paiement.toISOString(),
          receiptUrl: payment.justificatif_url || null,
        };
      }),
    };
  }

  async getEncaissementsOverview(params: {
    period?: string;
    scope?: EncaissementScope;
    userId?: number | null;
  } = {}) {
    const period =
      params.period === 'month' || params.period === 'quarter' || params.period === 'year'
        ? params.period
        : 'year';
    const scope = params.scope === 'user' ? 'user' : 'global';
    const safeUserId = Number(params.userId ?? 0);
    const now = new Date();
    const previousYearStart = new Date(now.getFullYear() - 1, 0, 1);

    const baseWhere =
      scope === 'user' && Number.isFinite(safeUserId) && safeUserId > 0
        ? {
            idUtilisateur: safeUserId,
            date_paiement: {
              gte: previousYearStart,
              lte: now,
            },
          }
        : {
            date_paiement: {
              gte: previousYearStart,
              lte: now,
            },
          };

    const payments = await this.prisma.paiement.findMany({
      where: baseWhere,
      include: {
        obligation: {
          include: {
            typePaiement: true,
          },
        },
      },
      orderBy: { date_paiement: 'desc' },
    });

    const collectedPayments = payments.filter((payment) =>
      this.isCollectedPayment(payment.etat_paiement),
    );

    const periodStart = this.getEncaissementPeriodStart(period, now);
    const periodPayments = collectedPayments.filter((payment) => {
      const paymentDate = new Date(payment.date_paiement);
      return paymentDate >= periodStart && paymentDate <= now;
    });

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStartDate = this.shiftDateClamped(monthStart, -1);
    const prevMonthStart = new Date(
      prevMonthStartDate.getFullYear(),
      prevMonthStartDate.getMonth(),
      1,
    );
    const prevMonthEnd = this.shiftDateClamped(now, -1);

    const yearStart = new Date(now.getFullYear(), 0, 1);
    const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const prevYearEnd = this.shiftDateClamped(now, -12);

    const sumPayments = (items: typeof collectedPayments) =>
      items.reduce((sum, payment) => sum + Number(payment.montant_paye || 0), 0);

    const currentMonthPayments = collectedPayments.filter((payment) => {
      const paymentDate = new Date(payment.date_paiement);
      return paymentDate >= monthStart && paymentDate <= now;
    });

    const previousMonthPayments = collectedPayments.filter((payment) => {
      const paymentDate = new Date(payment.date_paiement);
      return paymentDate >= prevMonthStart && paymentDate <= prevMonthEnd;
    });

    const currentYearPayments = collectedPayments.filter((payment) => {
      const paymentDate = new Date(payment.date_paiement);
      return paymentDate >= yearStart && paymentDate <= now;
    });

    const previousYearPayments = collectedPayments.filter((payment) => {
      const paymentDate = new Date(payment.date_paiement);
      return paymentDate >= prevYearStart && paymentDate <= prevYearEnd;
    });

    const currentMonthAmount = sumPayments(currentMonthPayments);
    const previousMonthAmount = sumPayments(previousMonthPayments);
    const currentYearAmount = sumPayments(currentYearPayments);
    const previousYearAmount = sumPayments(previousYearPayments);

    const computeVariation = (current: number, previous: number) => {
      if (previous <= 0) {
        return current > 0 ? 100 : 0;
      }
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    const categoryMap: Record<
      'deposit' | 'instruction' | 'royalties' | 'taxes',
      { label: string; color: string; amount: number; count: number }
    > = {
      deposit: { label: 'Frais de dépôt', color: '#3b82f6', amount: 0, count: 0 },
      instruction: { label: "Frais d'instruction", color: '#8b5cf6', amount: 0, count: 0 },
      royalties: { label: 'Redevances', color: '#14b8a6', amount: 0, count: 0 },
      taxes: { label: 'Taxes et autres paiements', color: '#f59e0b', amount: 0, count: 0 },
    };

    periodPayments.forEach((payment) => {
      const category = this.getEncaissementCategory(payment.obligation?.typePaiement?.libelle);
      const amount = Number(payment.montant_paye || 0);
      categoryMap[category.key].amount += amount;
      categoryMap[category.key].count += 1;
    });

    const totalAmount = periodPayments.reduce(
      (sum, payment) => sum + Number(payment.montant_paye || 0),
      0,
    );

    const categories = Object.entries(categoryMap)
      .map(([key, entry]) => ({
        key,
        label: entry.label,
        amount: Number(entry.amount.toFixed(2)),
        count: entry.count,
        percentage: totalAmount > 0 ? Number(((entry.amount / totalAmount) * 100).toFixed(1)) : 0,
        color: entry.color,
      }))
      .filter((entry) => entry.amount > 0 || totalAmount === 0)
      .sort((a, b) => b.amount - a.amount);

    return {
      period,
      totalAmount,
      totalTransactions: periodPayments.length,
      categories,
      month: {
        current: currentMonthAmount,
        previous: previousMonthAmount,
        variation: computeVariation(currentMonthAmount, previousMonthAmount),
      },
      year: {
        current: currentYearAmount,
        previous: previousYearAmount,
        variation: computeVariation(currentYearAmount, previousYearAmount),
      },
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
      nameMap[sub.id_sub] =
        sub.nom_subFR || sub.nom_subAR || `Substance ${sub.id_sub}`;
    });

    return ranked.map((row) => ({
      id: row.id,
      name: nameMap[row.id] || `Substance ${row.id}`,
      count: row.count,
    }));
  }
}
