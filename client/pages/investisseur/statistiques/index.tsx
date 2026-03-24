import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  FileText,
  Clock3,
  CheckCircle2,
  Banknote,
  BarChart3,
  PieChart as PieChartIcon,
  Ruler,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  MapPinned,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import styles from "./statistiques.module.css";
import { useAuthStore } from "@/src/store/useAuthStore";
import { useAuthReady } from "@/src/hooks/useAuthReady";
import { InvestorLayout } from "@/components/investor/InvestorLayout";

type PeriodMode = "mois" | "trimestre" | "annee";

type DemandeRecord = {
  id_demande?: number;
  code_demande?: string | null;
  date_demande?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  statut_demande?: string | null;
  typePermis?: {
    lib_type?: string | null;
    code_type?: string | null;
  } | null;
  wilaya?: {
    nom_wilayaFR?: string | null;
  } | null;
  commune?: {
    daira?: {
      wilaya?: {
        nom_wilayaFR?: string | null;
      } | null;
    } | null;
  } | null;
};

type PermisRecord = {
  id?: number;
  code_permis?: string | null;
  date_octroi?: string | Date | null;
  date_expiration?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  superficie?: number | string | null;
  superficie_totale?: number | string | null;
  statut?:
    | string
    | {
        lib_statut?: string | null;
      }
    | null;
  typePermis?: {
    lib_type?: string | null;
    code_type?: string | null;
  } | null;
  commune?: {
    daira?: {
      wilaya?: {
        nom_wilayaFR?: string | null;
      } | null;
    } | null;
  } | null;
};

type Metrics = {
  totalDemandes: number;
  pendingDemandes: number;
  activePermis: number;
  paiementsDus: number;
  superficieTotale: number;
};

type TrendPoint = {
  mois: string;
  demandes: number;
  permis: number;
};

type DonutPoint = {
  name: string;
  value: number;
  color: string;
};

type RecentAction = {
  date: Date;
  nature: "Demande" | "Permis";
  reference: string;
  statut: string;
};

type WilayaPoint = {
  wilaya: string;
  total: number;
};

const DONUT_COLORS = [
  "#8a184f",
  "#0f9ab9",
  "#1f9d6b",
  "#f59e0b",
  "#7c3aed",
  "#ef4444",
];

const toList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: T[] }).data;
  }
  return [];
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeStatus = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const isActivePermisStatus = (status: unknown): boolean => {
  const normalized = normalizeStatus(status);
  return (
    normalized.includes("ACTIF") ||
    normalized.includes("VALIDE") ||
    normalized.includes("VALID") ||
    normalized.includes("VIGUEUR")
  );
};

const isPendingDemandeStatus = (status: unknown): boolean => {
  const normalized = normalizeStatus(status);
  return (
    normalized.includes("ATTENTE") ||
    normalized.includes("EN_COURS") ||
    normalized.includes("COURS") ||
    normalized.includes("INSTRUCTION")
  );
};

const isPaymentDueStatus = (status: unknown): boolean => {
  const normalized = normalizeStatus(status);
  return (
    normalized.includes("PAIEMENT") ||
    normalized.includes("A_PAYER") ||
    normalized.includes("IMPAYE") ||
    normalized.includes("DUE")
  );
};

const formatMonthLabel = (date: Date): string => {
  const base = date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
  return base.charAt(0).toUpperCase() + base.slice(1);
};

const formatDate = (date: Date | null): string =>
  date
    ? date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "--";

const getPeriodBounds = (mode: PeriodMode, reference: Date) => {
  const year = reference.getFullYear();
  const month = reference.getMonth();

  if (mode === "mois") {
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = new Date(reference);
    const previousStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const previousEnd = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end, previousStart, previousEnd };
  }

  if (mode === "trimestre") {
    const quarterStartMonth = Math.floor(month / 3) * 3;
    const start = new Date(year, quarterStartMonth, 1, 0, 0, 0, 0);
    const end = new Date(reference);
    const previousStart = new Date(year, quarterStartMonth - 3, 1, 0, 0, 0, 0);
    const previousEnd = new Date(year, quarterStartMonth, 0, 23, 59, 59, 999);
    return { start, end, previousStart, previousEnd };
  }

  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(reference);
  const previousStart = new Date(year - 1, 0, 1, 0, 0, 0, 0);
  const previousEnd = new Date(year - 1, 11, 31, 23, 59, 59, 999);
  return { start, end, previousStart, previousEnd };
};

const computeVariation = (current: number, previous: number): number => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const isDateInRange = (date: Date | null, start: Date, end: Date): boolean => {
  if (!date) return false;
  return date >= start && date <= end;
};

const escapeCsvValue = (value: string): string => {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
};

const downloadBlob = (filename: string, content: BlobPart, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

function useAnimatedNumber(target: number, durationMs = 800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const startValue = value;
    const endValue = Number.isFinite(target) ? target : 0;
    const startedAt = performance.now();

    const frame = (timestamp: number) => {
      const progress = Math.min((timestamp - startedAt) / durationMs, 1);
      const nextValue = startValue + (endValue - startValue) * progress;
      setValue(Math.round(nextValue));
      if (progress < 1) {
        requestAnimationFrame(frame);
      }
    };

    const id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  return value;
}

export default function InvestisseurStatistiquesPage() {
  const navigate = useNavigate();
  const { auth } = useAuthStore();
  const isAuthReady = useAuthReady();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const [periodMode, setPeriodMode] = useState<PeriodMode>("mois");
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demandes, setDemandes] = useState<DemandeRecord[]>([]);
  const [permis, setPermis] = useState<PermisRecord[]>([]);

  const referenceDate = useMemo(() => new Date(), []);

  const getDemandeDate = useCallback((item: DemandeRecord): Date | null => {
    return toDate(item.date_demande ?? item.createdAt ?? item.updatedAt);
  }, []);

  const getPermisDate = useCallback((item: PermisRecord): Date | null => {
    return toDate(item.date_octroi ?? item.createdAt ?? item.updatedAt);
  }, []);

  const getPermisStatus = useCallback((item: PermisRecord): string => {
    const raw = item.statut;
    if (typeof raw === "string") return raw;
    if (raw && typeof raw === "object") {
      return String((raw as { lib_statut?: unknown }).lib_statut ?? "");
    }
    return "";
  }, []);

  const getDemandeStatus = useCallback((item: DemandeRecord): string => {
    return String(item.statut_demande ?? "");
  }, []);

  const getPermisType = useCallback((item: PermisRecord): string => {
    const type = item.typePermis;
    if (!type) return "Non precise";
    return String(type.lib_type ?? type.code_type ?? "Non precise");
  }, []);

  const getDemandeType = useCallback((item: DemandeRecord): string => {
    const type = item.typePermis;
    if (!type) return "Non precise";
    return String(type.lib_type ?? type.code_type ?? "Non precise");
  }, []);

  const getWilayaNameFromPermis = useCallback((item: PermisRecord): string => {
    const direct = item.commune?.daira?.wilaya?.nom_wilayaFR;
    return String(direct ?? "Non precise");
  }, []);

  const getWilayaNameFromDemande = useCallback((item: DemandeRecord): string => {
    const direct = item.wilaya?.nom_wilayaFR;
    const fallback = item.commune?.daira?.wilaya?.nom_wilayaFR;
    return String(direct ?? fallback ?? "Non precise");
  }, []);

  const getPermisSuperficie = useCallback((item: PermisRecord): number => {
    return toNumber(item.superficie ?? item.superficie_totale);
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!auth?.email && !auth?.username) {
      navigate("/");
    }
  }, [auth?.email, auth?.username, isAuthReady, navigate]);

  useEffect(() => {
    let isMounted = true;
    if (!apiURL) {
      setError("API non configuree.");
      setIsLoading(false);
      return () => undefined;
    }

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      const [demandesResult, permisResult] = await Promise.allSettled([
        axios.get(`${apiURL}/demandes/mes-demandes`, { withCredentials: true }),
        axios.get(`${apiURL}/operateur/permis`, { withCredentials: true }),
      ]);

      if (!isMounted) return;

      let hasAtLeastOneSuccess = false;

      if (demandesResult.status === "fulfilled") {
        setDemandes(toList<DemandeRecord>(demandesResult.value.data));
        hasAtLeastOneSuccess = true;
      } else {
        setDemandes([]);
      }

      if (permisResult.status === "fulfilled") {
        setPermis(toList<PermisRecord>(permisResult.value.data));
        hasAtLeastOneSuccess = true;
      } else {
        setPermis([]);
      }

      if (!hasAtLeastOneSuccess) {
        setError("Impossible de charger les statistiques pour le moment.");
      }
      setIsLoading(false);
    };

    void loadData();
    return () => {
      isMounted = false;
    };
  }, [apiURL]);

  const periodBounds = useMemo(() => getPeriodBounds(periodMode, referenceDate), [periodMode, referenceDate]);

  const currentPeriodLabel = useMemo(() => {
    if (periodMode === "mois") {
      return `Periode : ${referenceDate.toLocaleDateString("fr-FR", {
        month: "long",
      })} - ${referenceDate.getFullYear()}`;
    }
    if (periodMode === "trimestre") {
      const quarter = Math.floor(referenceDate.getMonth() / 3) + 1;
      return `Periode : T${quarter} - ${referenceDate.getFullYear()}`;
    }
    return `Periode : ${referenceDate.getFullYear()}`;
  }, [periodMode, referenceDate]);

  const computeMetrics = useCallback(
    (start: Date, end: Date): Metrics => {
      const demandesInRange = demandes.filter((item) => isDateInRange(getDemandeDate(item), start, end));

      const activePermis = permis.filter((item) => {
        const permisDate = getPermisDate(item);
        const expirationDate = toDate(item.date_expiration);
        const isInRangeForStart = !permisDate || permisDate <= end;
        const isNotExpired = !expirationDate || expirationDate >= start;
        return isInRangeForStart && isNotExpired && isActivePermisStatus(getPermisStatus(item));
      });

      const pendingDemandes = demandesInRange.filter((item) =>
        isPendingDemandeStatus(getDemandeStatus(item)),
      ).length;

      const paiementDemandes = demandesInRange.filter((item) =>
        isPaymentDueStatus(getDemandeStatus(item)),
      ).length;

      const superficieTotale = activePermis.reduce(
        (sum, item) => sum + getPermisSuperficie(item),
        0,
      );

      return {
        totalDemandes: demandesInRange.length,
        pendingDemandes,
        activePermis: activePermis.length,
        paiementsDus: paiementDemandes,
        superficieTotale,
      };
    },
    [demandes, permis, getDemandeDate, getPermisDate, getPermisStatus, getDemandeStatus, getPermisSuperficie],
  );

  const currentMetrics = useMemo(
    () => computeMetrics(periodBounds.start, periodBounds.end),
    [computeMetrics, periodBounds.start, periodBounds.end],
  );

  const previousMetrics = useMemo(
    () => computeMetrics(periodBounds.previousStart, periodBounds.previousEnd),
    [computeMetrics, periodBounds.previousStart, periodBounds.previousEnd],
  );

  const totalDemandesAnimated = useAnimatedNumber(currentMetrics.totalDemandes);
  const pendingDemandesAnimated = useAnimatedNumber(currentMetrics.pendingDemandes);
  const activePermisAnimated = useAnimatedNumber(currentMetrics.activePermis);
  const paiementsDusAnimated = useAnimatedNumber(currentMetrics.paiementsDus);

  const metricsForCards = useMemo(
    () => [
      {
        id: "totalDemandes",
        label: "Total demandes",
        value: totalDemandesAnimated,
        variation: computeVariation(currentMetrics.totalDemandes, previousMetrics.totalDemandes),
        icon: <FileText size={20} />,
        tone: "bordeaux",
      },
      {
        id: "pendingDemandes",
        label: "Demandes en attente",
        value: pendingDemandesAnimated,
        variation: computeVariation(currentMetrics.pendingDemandes, previousMetrics.pendingDemandes),
        icon: <Clock3 size={20} />,
        tone: "orange",
      },
      {
        id: "activePermis",
        label: "Permis actifs",
        value: activePermisAnimated,
        variation: computeVariation(currentMetrics.activePermis, previousMetrics.activePermis),
        icon: <CheckCircle2 size={20} />,
        tone: "green",
      },
      {
        id: "paiementsDus",
        label: "Paiements dus",
        value: paiementsDusAnimated,
        variation: computeVariation(currentMetrics.paiementsDus, previousMetrics.paiementsDus),
        icon: <Banknote size={20} />,
        tone: "amber",
      },
    ],
    [
      totalDemandesAnimated,
      pendingDemandesAnimated,
      activePermisAnimated,
      paiementsDusAnimated,
      currentMetrics.totalDemandes,
      previousMetrics.totalDemandes,
      currentMetrics.pendingDemandes,
      previousMetrics.pendingDemandes,
      currentMetrics.activePermis,
      previousMetrics.activePermis,
      currentMetrics.paiementsDus,
      previousMetrics.paiementsDus,
    ],
  );

  const evolutionData = useMemo<TrendPoint[]>(() => {
    const months: TrendPoint[] = [];
    const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 11, 1);

    for (let i = 0; i < 12; i += 1) {
      const monthStart = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const monthEnd = new Date(start.getFullYear(), start.getMonth() + i + 1, 0, 23, 59, 59, 999);

      const demandesCumul = demandes.filter((item) => {
        const date = getDemandeDate(item);
        return !!date && date <= monthEnd;
      }).length;

      const permisCumul = permis.filter((item) => {
        const date = getPermisDate(item);
        return !!date && date <= monthEnd;
      }).length;

      months.push({
        mois: formatMonthLabel(monthStart),
        demandes: demandesCumul,
        permis: permisCumul,
      });
    }

    return months;
  }, [referenceDate, demandes, permis, getDemandeDate, getPermisDate]);

  const typeDistributionData = useMemo<DonutPoint[]>(() => {
    const counts = new Map<string, number>();

    const sourcePermis = permis.length
      ? permis.map((item) => getPermisType(item))
      : demandes.map((item) => getDemandeType(item));

    sourcePermis.forEach((type) => {
      const key = String(type || "Non precise");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const sorted = Array.from(counts.entries())
      .map(([name, value], index) => ({
        name,
        value,
        color: DONUT_COLORS[index % DONUT_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);

    if (sorted.length <= 5) return sorted;

    const top = sorted.slice(0, 5);
    const others = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
    return [...top, { name: "Autres", value: others, color: "#6b7280" }];
  }, [permis, demandes, getPermisType, getDemandeType]);

  const latestActions = useMemo<RecentAction[]>(() => {
    const demandActions = demandes
      .map<RecentAction | null>((item) => {
        const date = getDemandeDate(item);
        if (!date || !isDateInRange(date, periodBounds.start, periodBounds.end)) return null;
        return {
          date,
          nature: "Demande",
          reference: String(item.code_demande ?? `DEM-${item.id_demande ?? "--"}`),
          statut: String(item.statut_demande ?? "--"),
        };
      })
      .filter((item): item is RecentAction => item !== null);

    const permitActions = permis
      .map<RecentAction | null>((item) => {
        const date = getPermisDate(item);
        if (!date || !isDateInRange(date, periodBounds.start, periodBounds.end)) return null;
        return {
          date,
          nature: "Permis",
          reference: String(item.code_permis ?? `PERMIS-${item.id ?? "--"}`),
          statut: getPermisStatus(item) || "--",
        };
      })
      .filter((item): item is RecentAction => item !== null);

    return [...demandActions, ...permitActions]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 8);
  }, [demandes, permis, getDemandeDate, getPermisDate, getPermisStatus, periodBounds.start, periodBounds.end]);

  const wilayaStats = useMemo<WilayaPoint[]>(() => {
    const counters = new Map<string, number>();

    demandes.forEach((item) => {
      const date = getDemandeDate(item);
      if (!isDateInRange(date, periodBounds.start, periodBounds.end)) return;
      const wilaya = getWilayaNameFromDemande(item);
      counters.set(wilaya, (counters.get(wilaya) ?? 0) + 1);
    });

    permis.forEach((item) => {
      const date = getPermisDate(item);
      if (!isDateInRange(date, periodBounds.start, periodBounds.end)) return;
      const wilaya = getWilayaNameFromPermis(item);
      counters.set(wilaya, (counters.get(wilaya) ?? 0) + 1);
    });

    return Array.from(counters.entries())
      .map(([wilaya, total]) => ({ wilaya, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [
    demandes,
    permis,
    getDemandeDate,
    getPermisDate,
    getWilayaNameFromDemande,
    getWilayaNameFromPermis,
    periodBounds.start,
    periodBounds.end,
  ]);

  const maxWilayaCount = useMemo(
    () => (wilayaStats.length ? Math.max(...wilayaStats.map((item) => item.total)) : 1),
    [wilayaStats],
  );

  const handleExportCsv = useCallback(() => {
    setIsExportingCsv(true);
    try {
      const rows: string[] = [];
      rows.push([escapeCsvValue("Indicateur"), escapeCsvValue("Valeur")].join(","));
      rows.push([escapeCsvValue("Total demandes"), escapeCsvValue(String(currentMetrics.totalDemandes))].join(","));
      rows.push([escapeCsvValue("Demandes en attente"), escapeCsvValue(String(currentMetrics.pendingDemandes))].join(","));
      rows.push([escapeCsvValue("Permis actifs"), escapeCsvValue(String(currentMetrics.activePermis))].join(","));
      rows.push([escapeCsvValue("Paiements dus"), escapeCsvValue(String(currentMetrics.paiementsDus))].join(","));
      rows.push([
        escapeCsvValue("Superficie totale (ha)"),
        escapeCsvValue(currentMetrics.superficieTotale.toLocaleString("fr-FR", { maximumFractionDigits: 2 })),
      ].join(","));
      rows.push("");
      rows.push([escapeCsvValue("Date"), escapeCsvValue("Nature"), escapeCsvValue("Reference"), escapeCsvValue("Statut")].join(","));

      latestActions.forEach((action) => {
        rows.push(
          [
            escapeCsvValue(formatDate(action.date)),
            escapeCsvValue(action.nature),
            escapeCsvValue(action.reference),
            escapeCsvValue(action.statut),
          ].join(","),
        );
      });

      const csvContent = `\uFEFF${rows.join("\n")}`;
      downloadBlob(
        `statistiques-investisseur-${new Date().toISOString().slice(0, 10)}.csv`,
        csvContent,
        "text/csv;charset=utf-8;",
      );
    } finally {
      setIsExportingCsv(false);
    }
  }, [currentMetrics, latestActions]);

  const handleExportPdf = useCallback(async () => {
    setIsExportingPdf(true);
    try {
      const [{ default: JsPdf }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const doc = new JsPdf({ orientation: "portrait", unit: "mm", format: "a4" });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(122, 28, 53);
      doc.setFontSize(16);
      doc.text("ANAM - Mes statistiques investisseur", 14, 18);

      doc.setFontSize(10);
      doc.setTextColor(70, 70, 70);
      doc.setFont("helvetica", "normal");
      doc.text(currentPeriodLabel, 14, 24);
      doc.text(`Genere le ${formatDate(new Date())}`, 14, 29);

      autoTable(doc, {
        startY: 34,
        head: [["Indicateur", "Valeur"]],
        body: [
          ["Total demandes", String(currentMetrics.totalDemandes)],
          ["Demandes en attente", String(currentMetrics.pendingDemandes)],
          ["Permis actifs", String(currentMetrics.activePermis)],
          ["Paiements dus", String(currentMetrics.paiementsDus)],
          [
            "Superficie totale (ha)",
            currentMetrics.superficieTotale.toLocaleString("fr-FR", {
              maximumFractionDigits: 2,
            }),
          ],
        ],
        headStyles: { fillColor: [122, 28, 53] },
        styles: { fontSize: 10 },
      });

      const lastY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 80;

      autoTable(doc, {
        startY: lastY + 8,
        head: [["Date", "Nature", "Reference", "Statut"]],
        body: latestActions.length
          ? latestActions.map((action) => [
              formatDate(action.date),
              action.nature,
              action.reference,
              action.statut,
            ])
          : [["--", "--", "Aucune action sur la periode", "--"]],
        headStyles: { fillColor: [15, 154, 185] },
        styles: { fontSize: 9 },
      });

      doc.save(`statistiques-investisseur-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setIsExportingPdf(false);
    }
  }, [currentMetrics, latestActions, currentPeriodLabel]);

  if (!isAuthReady || isLoading) {
    return (
      <InvestorLayout>
        <div className={styles.page}>
          <div className={styles.container}>
            <div className={styles.loadingBox}>
              <div className={styles.spinner} />
              <p>Chargement des statistiques...</p>
            </div>
          </div>
        </div>
      </InvestorLayout>
    );
  }

  return (
    <InvestorLayout>
      <div className={styles.page}>
        <div className={styles.orbOne} />
        <div className={styles.orbTwo} />

        <div className={styles.container}>
          <section className={styles.heroHeader}>
            <div className={styles.heroContent}>
              <div className={styles.heroText}>
                <div className={styles.heroLabel}>
                  <Sparkles size={14} />
                  <span>Portail Investisseur</span>
                </div>
                <h1 className={styles.heroTitle}>Mes statistiques</h1>
                <p className={styles.heroSubtitle}>Suivi de mes activites minieres</p>
                <p className={styles.periodLabel}>{currentPeriodLabel}</p>
              </div>

              <div className={styles.heroActions}>
                <button
                  className={styles.dashboardButton}
                  onClick={() => navigate("/investisseur/InvestorDashboard")}
                >
                  <ArrowLeft size={18} />
                  Retour au dashboard
                </button>

                <div className={styles.actions}>
                  <select
                    className={styles.select}
                    value={periodMode}
                    onChange={(event) => setPeriodMode(event.target.value as PeriodMode)}
                    aria-label="Selection de periode"
                  >
                    <option value="mois">Mois</option>
                    <option value="trimestre">Trimestre</option>
                    <option value="annee">Annee</option>
                  </select>

                  <button
                    className={styles.exportButton}
                    onClick={handleExportCsv}
                    disabled={isExportingCsv}
                  >
                    <Download size={16} />
                    {isExportingCsv ? "Export CSV..." : "Exporter CSV"}
                  </button>

                  <button
                    className={`${styles.exportButton} ${styles.exportButtonPrimary}`}
                    onClick={handleExportPdf}
                    disabled={isExportingPdf}
                  >
                    <Download size={16} />
                    {isExportingPdf ? "Export PDF..." : "Exporter PDF"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {error ? <p className={styles.error}>{error}</p> : null}

          <section className={styles.kpiGrid}>
          {metricsForCards.map((item, index) => {
            const variationClass =
              item.variation > 0
                ? styles.variationPositive
                : item.variation < 0
                ? styles.variationNegative
                : styles.variationNeutral;
            const ToneIcon = item.variation < 0 ? ArrowDownRight : ArrowUpRight;
            const formattedVariation = `${item.variation > 0 ? "+" : ""}${item.variation.toFixed(0)}% ce ${
              periodMode === "annee" ? "cycle" : "mois"
            }`;

            return (
              <article
                key={item.id}
                className={`${styles.kpiCard} ${styles[`tone_${item.tone}`]}`}
                style={{ animationDelay: `${index * 0.06}s` }}
              >
                <div className={styles.kpiTop}>
                  <p className={styles.kpiTitle}>{item.label}</p>
                  <div className={styles.kpiIcon}>{item.icon}</div>
                </div>
                <p className={styles.kpiValue}>{item.value.toLocaleString("fr-FR")}</p>
                <span className={`${styles.variationPill} ${variationClass}`}>
                  <ToneIcon size={14} />
                  {formattedVariation}
                </span>
              </article>
            );
          })}
          </section>

          <section className={styles.chartGrid}>
          <article className={`${styles.card} ${styles.cardLarge}`}>
            <div className={styles.cardHeader}>
              <h2>
                <BarChart3 size={18} />
                Evolution des demandes et permis
              </h2>
            </div>
            <div className={styles.chartBody}>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={evolutionData} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="demandesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8a184f" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#8a184f" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="permisFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f9ab9" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0f9ab9" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5d9df" />
                  <XAxis dataKey="mois" tick={{ fill: "#7a1c35", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#7a1c35", fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid #2f2f33",
                      borderRadius: "10px",
                      color: "#ffffff",
                    }}
                    labelStyle={{ color: "#f4f4f5", fontWeight: 700 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="demandes"
                    stroke="#8a184f"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#demandesFill)"
                    name="Demandes"
                  />
                  <Area
                    type="monotone"
                    dataKey="permis"
                    stroke="#0f9ab9"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#permisFill)"
                    name="Permis"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>
                <PieChartIcon size={18} />
                Repartition par type
              </h2>
            </div>
            <div className={styles.chartBody}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={typeDistributionData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={3}
                  >
                    {typeDistributionData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value.toLocaleString("fr-FR")} dossier(s)`,
                      name,
                    ]}
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid #2f2f33",
                      borderRadius: "10px",
                      color: "#ffffff",
                    }}
                    labelStyle={{ color: "#f4f4f5", fontWeight: 700 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.legendList}>
                {typeDistributionData.map((entry) => (
                  <div key={entry.name} className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ backgroundColor: entry.color }} />
                    <span>{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>
          </section>

          <section className={styles.bottomGrid}>
            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>
                  <Ruler size={18} />
                  Superficie totale exploitee
                </h2>
              </div>
              <div className={styles.surfaceMetric}>
                <p className={styles.surfaceValue}>
                  {currentMetrics.superficieTotale.toLocaleString("fr-FR", {
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className={styles.surfaceUnit}>hectares</p>
              </div>
            </article>

            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>Dernieres actions</h2>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Reference</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestActions.length ? (
                      latestActions.map((action) => (
                        <tr key={`${action.nature}-${action.reference}-${action.date.getTime()}`}>
                          <td>{formatDate(action.date)}</td>
                          <td>{action.nature}</td>
                          <td>{action.reference}</td>
                          <td>{action.statut}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className={styles.emptyRow}>
                          Aucune action sur cette periode.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>
                  <MapPinned size={18} />
                  Wilayas actives
                </h2>
              </div>
              <div className={styles.wilayaList}>
                {wilayaStats.length ? (
                  wilayaStats.map((item) => (
                    <div key={item.wilaya} className={styles.wilayaItem}>
                      <div className={styles.wilayaMeta}>
                        <span>{item.wilaya}</span>
                        <strong>{item.total}</strong>
                      </div>
                      <div className={styles.wilayaBarTrack}>
                        <div
                          className={styles.wilayaBarFill}
                          style={{ width: `${(item.total / maxWilayaCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={styles.emptyText}>Aucune donnee de localisation sur cette periode.</p>
                )}
              </div>
            </article>
          </section>
      </div>
      </div>
    </InvestorLayout>
  );
}
