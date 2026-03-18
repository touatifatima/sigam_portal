import { useEffect, useRef, useState } from "react";
import { Factory, FileCheck, Gem, Search, TrendingUp } from "lucide-react";
import styles from "./Statistics.module.css";
import { ScrollReveal } from "./ScrollReveal";

interface StatItemProps {
  icon: React.ReactNode;
  value: number;
  suffix?: string;
  label: string;
  delay: number;
}

type DashboardStatsResponse = {
  total?: number;
  actifs?: number;
  enCours?: number;
  expires?: number;
  expiringSoon?: number;
};

type StatConfig = {
  key: string;
  icon: React.ReactNode;
  value: number;
  suffix?: string;
  label: string;
  delay: number;
};

const toSafeNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const buildDefaultStats = (): StatConfig[] => [
  {
    key: "total",
    icon: <FileCheck className="h-8 w-8" />,
    value: 0,
    label: "Permis miniers (total)",
    delay: 0,
  },
  {
    key: "actifs",
    icon: <Factory className="h-8 w-8" />,
    value: 0,
    label: "Permis en vigueur",
    delay: 100,
  },
  {
    key: "encours",
    icon: <TrendingUp className="h-8 w-8" />,
    value: 0,
    label: "Procedures en cours",
    delay: 200,
  },
  {
    key: "expires",
    icon: <Search className="h-8 w-8" />,
    value: 0,
    label: "Permis expires",
    delay: 300,
  },
  {
    key: "expiringSoon",
    icon: <Gem className="h-8 w-8" />,
    value: 0,
    label: "Expiration <= 6 mois",
    delay: 400,
  },
];

const mapStatsFromApi = (data: DashboardStatsResponse): StatConfig[] => {
  const defaults = buildDefaultStats();
  return [
    { ...defaults[0], value: toSafeNumber(data?.total) },
    { ...defaults[1], value: toSafeNumber(data?.actifs) },
    { ...defaults[2], value: toSafeNumber(data?.enCours) },
    { ...defaults[3], value: toSafeNumber(data?.expires) },
    { ...defaults[4], value: toSafeNumber(data?.expiringSoon) },
  ];
};

const StatItem = ({ icon, value, suffix = "", label, delay }: StatItemProps) => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 },
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const timeout = setTimeout(() => {
      const duration = 2000;
      const steps = 60;
      const increment = value / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setCount(value);
          clearInterval(timer);
        } else {
          setCount(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }, delay);

    return () => clearTimeout(timeout);
  }, [isVisible, value, delay]);

  return (
    <div
      ref={ref}
      className={styles.statItem}
    >
      <div className={styles.statCard}>
        <div className={styles.iconWrapper}>
          <div className={styles.icon}>{icon}</div>
        </div>
        <div className={styles.value}>
          {count.toLocaleString()}
          <span className={styles.valueSuffix}>{suffix}</span>
        </div>
        <div className={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
};

export const Statistics = () => {
  const [stats, setStats] = useState<StatConfig[]>(() => buildDefaultStats());

  useEffect(() => {
    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ||
      ((typeof import.meta !== "undefined" &&
        (import.meta as any)?.env?.VITE_API_URL) as string) ||
      "";

    const url = `${API_BASE}/api/dashboard/stats`;
    const controller = new AbortController();

    const loadStats = async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as DashboardStatsResponse;
        setStats(mapStatsFromApi(data));
      } catch {
        // Keep zero values if backend is unavailable.
      }
    };

    loadStats();
    return () => controller.abort();
  }, []);

  return (
    <section id="stats" className={styles.section}>
      <div className={styles.backgroundPattern}>
        <div className={styles.dotPattern} />
      </div>

      <div className={`container ${styles.container}`}>
        <ScrollReveal delay={60}>
          <div className={styles.header}>
            <span className={styles.label}>Le secteur minier en chiffres</span>
            <h2 className={styles.title}>
              Des solutions innovantes pour{" "}
              <span className={styles.titleHighlight}>votre investissement</span>
            </h2>
            <p className={styles.description}>
              Nous contribuons a accelerer vos procedures d obtention de permis
              miniers grace a des solutions numeriques fluides et fiables.
            </p>
          </div>
        </ScrollReveal>

        <div className={styles.grid}>
          {stats.map(({ key, delay, ...stat }) => (
            <ScrollReveal key={key} delay={120 + delay}>
              <StatItem {...stat} delay={delay} />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};
