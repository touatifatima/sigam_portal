'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  FiCalendar,
  FiDollarSign,
  FiMoreHorizontal,
  FiTrendingDown,
  FiTrendingUp,
} from 'react-icons/fi';
import styles from './PermisDashboard.module.css';

export type EncaissementPeriod = 'month' | 'quarter' | 'year';

export type EncaissementCategoryStat = {
  key: string;
  label: string;
  amount: number;
  count: number;
  percentage: number;
  color: string;
};

export type EncaissementsOverviewData = {
  period: EncaissementPeriod;
  totalAmount: number;
  totalTransactions: number;
  categories: EncaissementCategoryStat[];
  month: {
    current: number;
    previous: number;
    variation: number;
  };
  year: {
    current: number;
    previous: number;
    variation: number;
  };
};

type EncaissementsCardProps = {
  data: EncaissementsOverviewData | null;
  loading?: boolean;
  period: EncaissementPeriod;
  onPeriodChange: (period: EncaissementPeriod) => void;
};

function formatCurrency(value: number) {
  return `${Number(value || 0).toLocaleString('fr-FR')} DA`;
}

function formatVariation(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${Number(value || 0).toFixed(1)}%`;
}

function PeriodTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: EncaissementCategoryStat;
  }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const entry = payload[0]?.payload;
  if (!entry) {
    return null;
  }

  return (
    <div className={styles.encaissementsTooltip}>
      <strong>{entry.label}</strong>
      <span>{formatCurrency(entry.amount)}</span>
      <span>{entry.percentage.toFixed(1)}% du total</span>
    </div>
  );
}

function ActiveDonutShape(props: any) {
  const {
    cx = 0,
    cy = 0,
    innerRadius = 0,
    outerRadius = 0,
    startAngle = 0,
    endAngle = 0,
    fill = '#2563eb',
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={Math.max(innerRadius - 4, 0)}
        outerRadius={outerRadius + 14}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.96}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={Math.max(innerRadius - 2, 0)}
        outerRadius={outerRadius + 22}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.14}
      />
    </g>
  );
}

export default function EncaissementsCard({
  data,
  loading = false,
  period,
  onPeriodChange,
}: EncaissementsCardProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const categories = data?.categories ?? [];
  const totalAmount = data?.totalAmount ?? 0;
  const hasChartData = totalAmount > 0 && categories.some((item) => item.amount > 0);
  const periodLabel = useMemo(() => {
    if (period === 'month') return 'Mois en cours';
    if (period === 'quarter') return 'Trimestre en cours';
    return 'Année en cours';
  }, [period]);
  const activeCategory = activeIndex !== null ? categories[activeIndex] : null;
  const pieHighlightProps: any = {
    activeIndex: activeIndex === null ? undefined : activeIndex,
    activeShape: (props: any) => <ActiveDonutShape {...props} />,
  };

  useEffect(() => {
    setActiveIndex(null);
  }, [period, totalAmount]);

  return (
    <section className={styles.encaissementsSection}>
      <div className={styles.encaissementsCard}>
        <div className={styles.encaissementsHeader}>
          <div>
            <div className={styles.encaissementsKicker}>Encaissements validés</div>
            <h4 className={styles.encaissementsTitle}>Répartition des encaissements</h4>
            <p className={styles.encaissementsSubtitle}>
              Paiements validés, confirmés ou payés uniquement
            </p>
          </div>

          <div className={styles.encaissementsHeaderActions}>
            <div className={styles.encaissementsPeriods}>
              {(['month', 'quarter', 'year'] as EncaissementPeriod[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={
                    period === item ? styles.encaissementsPeriodActive : styles.encaissementsPeriod
                  }
                  onClick={() => onPeriodChange(item)}
                >
                  <FiCalendar />
                  {item === 'month' ? 'Mois' : item === 'quarter' ? 'Trimestre' : 'Année'}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={styles.encaissementsMenu}
              aria-label="Options encaissements"
            >
              <FiMoreHorizontal />
            </button>
          </div>
        </div>

        {loading ? (
          <div className={styles.encaissementsLoading}>
            <div className={styles.encaissementsLoadingRing} />
            <div className={styles.encaissementsLoadingText}>Chargement des encaissements...</div>
          </div>
        ) : (
          <>
            <div
              key={`encaissements-chart-${period}`}
              className={styles.encaissementsChartWrap}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className={styles.encaissementsChartAura} />

              {hasChartData ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 16, right: 24, bottom: 12, left: 24 }}>
                    <defs>
                      <radialGradient id="encaissementsGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgba(59, 130, 246, 0.16)" />
                        <stop offset="60%" stopColor="rgba(79, 70, 229, 0.05)" />
                        <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
                      </radialGradient>
                    </defs>
                    <Pie
                      {...pieHighlightProps}
                      data={categories}
                      dataKey="amount"
                      nameKey="label"
                      cx="50%"
                      cy="48%"
                      innerRadius={62}
                      outerRadius={132}
                      paddingAngle={4}
                      cornerRadius={20}
                      stroke="rgba(255, 255, 255, 0.98)"
                      strokeWidth={7}
                      startAngle={90}
                      endAngle={-270}
                      isAnimationActive
                      animationBegin={120}
                      animationDuration={720}
                    >
                      {categories.map((entry, index) => (
                        <Cell
                          key={entry.key}
                          fill={entry.color}
                          onMouseEnter={() => setActiveIndex(index)}
                          onFocus={() => setActiveIndex(index)}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<PeriodTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className={styles.encaissementsEmptyChart}>
                  <FiDollarSign />
                  <p>Aucun encaissement validé sur la période sélectionnée</p>
                </div>
              )}

              <div key={`encaissements-center-${period}`} className={styles.encaissementsCenterValue}>
                {activeCategory ? (
                  <span className={styles.encaissementsCenterBadge}>{activeCategory.label}</span>
                ) : (
                  <span>Répartition en cours</span>
                )}
                <strong>{formatCurrency(totalAmount)}</strong>
                <small>
                  {periodLabel} • {data?.totalTransactions ?? 0} transactions validées
                </small>
              </div>
            </div>

            {activeCategory ? (
              <div className={styles.encaissementsLegendHint}>
                <span
                  className={styles.encaissementsLegendDot}
                  style={{ background: activeCategory.color }}
                />
                <div>
                  <strong>{activeCategory.label}</strong>
                  <span>
                    {formatCurrency(activeCategory.amount)} • {activeCategory.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ) : null}

            <div key={`encaissements-bottom-${period}`} className={styles.encaissementsBottomPanel}>
              <div className={styles.encaissementsMetric}>
                <div className={styles.encaissementsMetricLabel}>Encaissements du mois</div>
                <div className={styles.encaissementsMetricValue}>
                  {formatCurrency(data?.month.current ?? 0)}
                </div>
                <div
                  className={
                    (data?.month.variation ?? 0) >= 0
                      ? styles.encaissementsMetricTrendUp
                      : styles.encaissementsMetricTrendDown
                  }
                >
                  {(data?.month.variation ?? 0) >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
                  {formatVariation(data?.month.variation ?? 0)} vs mois précédent
                </div>
              </div>

              <div className={styles.encaissementsMetric}>
                <div className={styles.encaissementsMetricLabel}>Encaissements de l'année</div>
                <div className={styles.encaissementsMetricValue}>
                  {formatCurrency(data?.year.current ?? 0)}
                </div>
                <div
                  className={
                    (data?.year.variation ?? 0) >= 0
                      ? styles.encaissementsMetricTrendUp
                      : styles.encaissementsMetricTrendDown
                  }
                >
                  {(data?.year.variation ?? 0) >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
                  {formatVariation(data?.year.variation ?? 0)} vs année précédente
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
