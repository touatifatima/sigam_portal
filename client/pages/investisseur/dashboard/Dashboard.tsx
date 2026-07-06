import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Download,
  FileText,
  Headphones,
  HelpCircle,
  Home,
  Map,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  User,
  WalletCards,
} from "lucide-react";
import Navbar from "@/pages/navbar/Navbar";
import styles from "./Dashboard.module.css";
import algerieMapUrl from "@/src/assets/algerie.png";
import { useAuthStore } from "@/src/store/useAuthStore";
import { useAuthReady } from "@/src/hooks/useAuthReady";
import heroDashboardImage from "@/src/assets/ChatGPT Image 17 juin 2026, 11_21_32.png";
import { getDefaultDashboardPath, isCadastreRole } from "@/src/utils/roleNavigation";
import { OnboardingTour, type OnboardingStep } from "@/components/onboarding/OnboardingTour";
import {
  getHasSeenOnboarding,
  getOnboardingActive,
  getOnboardingPageSeen,
  markOnboardingPageCompleted,
  setOnboardingActive,
  stopOnboardingForever,
} from "@/src/onboarding/storage";

type StatState = {
  demandesEnCours: number;
  permisActifs: number;
};

type NavItem = {
  label: string;
  icon: typeof Home;
  href: string;
};

type HeroFeature = {
  title: string;
  description: string;
  icon: typeof Building2;
};

type StatCard = {
  label: string;
  value: string;
  hint: string;
  icon: typeof FileText;
  tone: "blue" | "gold" | "violet" | "green" | "red";
};

type RecentRequestTone = "blue" | "amber" | "green" | "red";

type RecentRequestCard = {
  title: string;
  reference: string;
  status: string;
  progress: number;
  tone: RecentRequestTone;
  updated: string;
};

type ProcessStep = {
  label: string;
  date: string;
  state: "done" | "active" | "pending";
  icon: typeof CheckCircle2;
};

type TrackerStepState = "done" | "active" | "pending";

type TrackerStep = {
  label: string;
  date: string;
  state: TrackerStepState;
  icon: typeof CheckCircle2 | typeof Clock3;
};

type TrackerRequestItem = {
  id_demande: number;
  code_demande?: string | null;
  short_code?: string | null;
  date_demande?: string | null;
  duree_instruction?: number | null;
  statut_demande?: string | null;
  dossier_recevable?: boolean | null;
  date_instruction?: string | null;
  date_refus?: string | null;
  utilisateurId?: number | null;
  typePermis?: { code_type?: string | null; lib_type?: string | null } | null;
  typeProcedure?: { libelle?: string | null } | null;
};

type TrackerDetailResponse = {
  id_demande: number;
  code_demande?: string | null;
  short_code?: string | null;
  statut_demande?: string | null;
  date_demande?: string | null;
  date_instruction?: string | null;
  date_refus?: string | null;
  date_fin_instruction?: string | null;
  remarques?: string | null;
  Nom_Prenom_Resp_Enregist?: string | null;
  utilisateurId?: number | null;
  typePermis?: { code_type?: string | null; lib_type?: string | null } | null;
  typeProcedure?: { libelle?: string | null } | null;
  facture?: {
    statut?: string | null;
    paiements?: Array<{
      date_paiement?: string | null;
      etat_paiement?: string | null;
      montant_paye?: number | null;
    }> | null;
  } | null;
  procedure?: {
    statut_proc?: string | null;
    date_fin_proc?: string | null;
    ProcedureEtape?: Array<{
      statut?: string | null;
      date_debut?: string | null;
      date_fin?: string | null;
      etape?: {
        nom_etape?: string | null;
        lib_etape?: string | null;
        ordre_etape?: number | null;
      } | null;
    }> | null;
  } | null;
};

type TrackerResult = {
  reference: string;
  title: string;
  status: string;
  statusTone: "blue" | "gold" | "green" | "red" | "violet";
  lastUpdated: string;
  estimatedRemaining: string;
  responsibleService: string;
  nextAction: string;
  steps: TrackerStep[];
};

type PaymentItem = {
  code: string;
  label: string;
  amount: string;
  status: string;
  date: string;
};

type QuickLink = {
  label: string;
  icon: typeof FileText;
  href: string;
  tone: "blue" | "green" | "gold" | "violet" | "red";
};

const DASHBOARD_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "dashboard-hero",
    target: '[data-onboarding-id="dashboard-hero"]',
    title: "Votre espace personnel de Guichet Unique Minier",
    description:
      "Ici vous retrouvez un resume global de votre activite miniere avec vos actions prioritaires.",
    placement: "bottom",
  },
  {
    id: "dashboard-new-request",
    target: '[data-onboarding-id="dashboard-new-request"]',
    title: "Demarrer une nouvelle demande",
    description:
      "Ce bouton lance directement le workflow de creation de demande, avec verification prealable et etapes guidees.",
    placement: "left",
  },
  {
    id: "dashboard-status",
    target: '[data-onboarding-id="dashboard-status"]',
    title: "Statut instantane",
    description:
      "Ces cartes donnent vos indicateurs critiques: profil entreprise, demandes en cours et permis actifs.",
    placement: "bottom",
  },
  {
    id: "dashboard-demandes",
    target: '[data-onboarding-id="dashboard-card-demandes"]',
    title: "Suivi des demandes",
    description:
      "Accedez rapidement a vos demandes pour voir les statuts, actions attendues et historique.",
    placement: "right",
  },
  {
    id: "dashboard-notifications",
    target: '[data-onboarding-id="dashboard-card-notifications"]',
    title: "Centre de notifications",
    description:
      "Toutes les alertes importantes arrivent ici: changements de statut, demandes de complement, decisions.",
    placement: "left",
  },
  {
    id: "dashboard-quick-access",
    target: '[data-onboarding-id="dashboard-quick-access"]',
    title: "Acces rapide",
    description:
      "Utilisez ces raccourcis pour naviguer plus vite entre vos modules metier.",
    placement: "top",
  },
];

const NAV_ITEMS: NavItem[] = [
  { label: "Accueil", icon: Home, href: "/investisseur/InvestorDashboard" },
  { label: "Mes demandes", icon: FileText, href: "/investisseur/demandes" },
  { label: "Paiements", icon: CreditCard, href: "/investisseur/statistiques" },
  { label: "Carte miniÃ¨re", icon: Map, href: "/carte/carte_public" },
  { label: "Documents", icon: FileText, href: "/documentation" },
  { label: "Aide & Support", icon: HelpCircle, href: "/faq" },
];

const HERO_FEATURES: HeroFeature[] = [
  {
    title: "100% en ligne",
    description: "Sans dÃ©placement",
    icon: Building2,
  },
  {
    title: "SÃ©curisÃ©",
    description: "DonnÃ©es protÃ©gÃ©es",
    icon: ShieldCheck,
  },
  {
    title: "Paiements sÃ©curisÃ©s",
    description: "Via SATIM",
    icon: CreditCard,
  },
];

const PROCESS_STEPS: ProcessStep[] = [
  { label: "Soumise", date: "12/05/2025", state: "done", icon: CheckCircle2 },
  { label: "ReÃ§ue", date: "13/05/2025", state: "done", icon: CheckCircle2 },
  { label: "En instruction", date: "16/05/2025", state: "active", icon: Clock3 },
  { label: "Validation", date: "En attente", state: "pending", icon: CheckCircle2 },
  { label: "Paiement", date: "En attente", state: "pending", icon: CheckCircle2 },
  { label: "DÃ©livrÃ©e", date: "En attente", state: "pending", icon: CheckCircle2 },
];

const normalizeReference = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, "");

const formatDateLabel = (value?: string | null) => {
  if (!value) return "En attente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "En attente";
  return date.toLocaleDateString("fr-FR");
};

const formatRelativeDateLabel = (value?: string | null) => {
  if (!value) return "Aucune mise Ã  jour";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "Aucune mise Ã  jour";

  const diffMs = Date.now() - ts;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "Ã€ l'instant";
  if (diffMs < hour) return `Il y a ${Math.floor(diffMs / minute)} min`;
  if (diffMs < day) return `Il y a ${Math.floor(diffMs / hour)} h`;
  if (diffMs < 7 * day) return `Il y a ${Math.floor(diffMs / day)} j`;

  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};


const toTimestamp = (value?: string | null) => {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const computeBusinessDeadline = (item: TrackerRequestItem) => {
  if (!item.duree_instruction || !item.date_demande) return null;

  const total = item.duree_instruction;
  const start = new Date(item.date_demande);
  start.setHours(0, 0, 0, 0);

  const addBusinessDays = (base: Date, businessDays: number) => {
    const result = new Date(base);
    let added = 0;
    while (added < businessDays) {
      result.setDate(result.getDate() + 1);
      const day = result.getDay();
      if (day !== 0 && day !== 6) {
        added += 1;
      }
    }
    return result;
  };

  const countBusinessDaysBetween = (from: Date, to: Date) => {
    const d1 = new Date(from);
    const d2 = new Date(to);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    if (d2 < d1) return 0;

    let days = 0;
    const cursor = new Date(d1);
    while (cursor <= d2) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) {
        days += 1;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  };

  const deadline = addBusinessDays(start, total);

  if (item.dossier_recevable && item.date_instruction) {
    const closure = new Date(item.date_instruction);
    const used = countBusinessDaysBetween(start, closure);
    const remaining = Math.max(total - used, 0);
    return { mode: "recevable" as const, used, remaining, total, deadline };
  }

  if (item.statut_demande === "REJETEE" && item.date_refus) {
    const closure = new Date(item.date_refus);
    const used = countBusinessDaysBetween(start, closure);
    const remaining = Math.max(total - used, 0);
    return { mode: "rejetee" as const, used, remaining, total, deadline };
  }

  const now = new Date();
  const nowFloor = new Date(now);
  nowFloor.setHours(0, 0, 0, 0);

  if (nowFloor >= deadline) {
    return { mode: "ongoing" as const, used: total, remaining: 0, total, deadline };
  }

  const remaining = countBusinessDaysBetween(nowFloor, deadline);
  const used = Math.max(total - remaining, 0);

  return { mode: "ongoing" as const, used, remaining, total, deadline };
};

const resolveTrackerStage = (item: TrackerRequestItem, detail?: TrackerDetailResponse | null) => {
  const raw = normalizeReference(
    String(detail?.statut_demande ?? item.statut_demande ?? detail?.procedure?.statut_proc ?? ""),
  );

  if (raw.includes("DELIV") || raw.includes("LIVR") || detail?.procedure?.date_fin_proc) {
    return 5;
  }
  if (raw.includes("PAI") || (detail?.facture?.paiements?.length ?? 0) > 0) {
    return 4;
  }
  if (raw.includes("VALID") || raw.includes("ACCEP") || raw.includes("APPROUV")) {
    return 3;
  }
  if (raw.includes("INSTR") || raw.includes("ANALYS") || raw.includes("COURS")) {
    return 2;
  }
  if (raw.includes("RECU") || raw.includes("RECEP") || raw.includes("RECEV")) {
    return 1;
  }
  if (raw.includes("DEPOT") || raw.includes("SOU") || raw.includes("INIT")) {
    return 0;
  }

  if (item.date_instruction || detail?.date_instruction) return 2;
  if (item.date_demande || detail?.date_demande) return 1;
  return 0;
};

const buildTrackerSteps = (item: TrackerRequestItem, detail?: TrackerDetailResponse | null): TrackerStep[] => {
  const stage = resolveTrackerStage(item, detail);
  const paymentDate = detail?.facture?.paiements?.find((entry) => entry?.date_paiement)?.date_paiement;
  const procedureSteps = detail?.procedure?.ProcedureEtape ?? [];
  const firstProcedureDate =
    procedureSteps.find((entry) => entry?.date_debut)?.date_debut ??
    procedureSteps.find((entry) => entry?.date_fin)?.date_fin ??
    null;

  const stepDates = [
    detail?.date_demande ?? item.date_demande,
    firstProcedureDate ?? detail?.date_instruction ?? item.date_instruction ?? item.date_demande,
    detail?.date_instruction ?? item.date_instruction ?? firstProcedureDate ?? item.date_demande,
    detail?.date_fin_instruction ?? detail?.procedure?.date_fin_proc ?? detail?.date_instruction ?? item.date_instruction,
    paymentDate ?? detail?.date_fin_instruction ?? detail?.procedure?.date_fin_proc ?? null,
    detail?.procedure?.date_fin_proc ?? paymentDate ?? detail?.date_fin_instruction ?? null,
  ];

  return ["Soumise", "ReÃ§ue", "En instruction", "Validation", "Paiement", "DÃ©livrÃ©e"].map(
    (label, index) => ({
      label,
      date: index <= stage ? formatDateLabel(stepDates[index]) : "En attente",
      state: index < stage ? "done" : index === stage ? "active" : "pending",
      icon: index === 2 ? Clock3 : CheckCircle2,
    }),
  );
};

const buildTrackerResult = (item: TrackerRequestItem, detail?: TrackerDetailResponse | null): TrackerResult => {
  const reference = String(
    detail?.code_demande || detail?.short_code || item.code_demande || `DEM-${item.id_demande}`,
  );
  const status = String(detail?.statut_demande || item.statut_demande || detail?.procedure?.statut_proc || "--");
  const title =
    detail?.typeProcedure?.libelle ||
    detail?.typePermis?.lib_type ||
    item.typeProcedure?.libelle ||
    item.typePermis?.lib_type ||
    "Demande miniÃ¨re";

  const timestamps = [
    toTimestamp(detail?.date_demande ?? item.date_demande),
    toTimestamp(detail?.date_instruction ?? item.date_instruction),
    toTimestamp(detail?.date_fin_instruction),
    toTimestamp(detail?.date_refus ?? item.date_refus),
    toTimestamp(detail?.procedure?.date_fin_proc),
    ...(detail?.facture?.paiements ?? [])
      .map((entry) => toTimestamp(entry?.date_paiement))
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const latestTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : null;
  const lastUpdated = latestTimestamp
    ? new Date(latestTimestamp).toLocaleDateString("fr-FR")
    : "En attente";

  const deadlineInfo = computeBusinessDeadline(item);
  const estimatedRemaining =
    deadlineInfo?.mode === "recevable"
      ? `DÃ©lai clÃ´turÃ© en ${deadlineInfo.used} jour(s) ouvrable(s)`
      : deadlineInfo?.mode === "rejetee"
        ? `ClÃ´turÃ© en ${deadlineInfo.used} jour(s) ouvrable(s)`
        : deadlineInfo
          ? `Il reste ${deadlineInfo.remaining} jour(s) ouvrable(s)`
          : "Estimation indisponible";

  const stage = resolveTrackerStage(item, detail);
  const responsibleService =
    detail?.Nom_Prenom_Resp_Enregist ||
    detail?.procedure?.statut_proc ||
    detail?.typeProcedure?.libelle ||
    "Service d'instruction";

  const nextActionByStage = [
    "DÃ©pÃ´t enregistrÃ©. En attente de rÃ©ception.",
    "RÃ©ception du dossier en cours.",
    "Instruction technique en cours.",
    "Validation administrative en attente.",
    "Paiement attendu ou en cours de confirmation.",
    "DÃ©livrance du dossier en cours.",
  ];

  const statusTone: TrackerResult["statusTone"] = /REJET/i.test(status)
    ? "red"
    : /PAI|PAY/i.test(status)
      ? "gold"
      : /DELIV|LIVR/i.test(status)
        ? "green"
        : /VALID|ACCEP|APPROUV/i.test(status)
          ? "green"
          : /INSTR|ANALYS|COURS/i.test(status)
            ? "gold"
            : "blue";

  return {
    reference,
    title,
    status,
    statusTone,
    lastUpdated,
    estimatedRemaining,
    responsibleService,
    nextAction: nextActionByStage[Math.min(stage, nextActionByStage.length - 1)],
    steps: buildTrackerSteps(item, detail),
  };
};

const buildRecentRequestCard = (item: TrackerRequestItem, detail?: TrackerDetailResponse | null): RecentRequestCard => {
  const tracker = buildTrackerResult(item, detail);
  const activeIndex = tracker.steps.findIndex((step) => step.state === "active");
  const completedCount = tracker.steps.filter((step) => step.state === "done").length;
  const progressByStage = [18, 34, 65, 78, 90, 100];
  const progress =
    activeIndex >= 0
      ? progressByStage[activeIndex] ??
        Math.min(100, Math.max(12, Math.round(((activeIndex + 1) / tracker.steps.length) * 100)))
      : completedCount >= tracker.steps.length
        ? 100
        : Math.max(10, Math.round((completedCount / Math.max(tracker.steps.length, 1)) * 100));

  const tone: RecentRequestTone =
    tracker.statusTone === "red"
      ? "red"
      : tracker.statusTone === "green"
        ? "green"
        : tracker.statusTone === "gold"
          ? "amber"
          : "blue";

  return {
    title: tracker.title,
    reference: tracker.reference,
    status: tracker.status,
    progress,
    tone,
    updated: formatRelativeDateLabel(
      detail?.date_fin_instruction ??
        detail?.procedure?.date_fin_proc ??
        detail?.date_instruction ??
        detail?.date_demande ??
        item.date_demande,
    ),
  };
};

const PAYMENTS: PaymentItem[] = [
  {
    code: "MIN-2025-00120",
    label: "Permis d'exploitation",
    amount: "450 000 DZD",
    status: "PayÃ©",
    date: "12/05/2025",
  },
  {
    code: "MIN-2025-00118",
    label: "Autorisation de prospection",
    amount: "75 000 DZD",
    status: "PayÃ©",
    date: "05/05/2025",
  },
];

const QUICK_LINKS: QuickLink[] = [
  { label: "Nouvelle demande", icon: Plus, href: "/investisseur/nouvelle_demande/step1_typepermis/page1_typepermis", tone: "blue" },
  { label: "Mes demandes", icon: FileText, href: "/investisseur/demandes", tone: "green" },
  { label: "Paiements", icon: CreditCard, href: "/investisseur/statistiques", tone: "gold" },
  { label: "Carte miniÃ¨re", icon: Map, href: "/carte/carte_public", tone: "violet" },
  { label: "Documents", icon: FileText, href: "/documentation", tone: "red" },
  { label: "ModÃ¨les & Guides", icon: FileText, href: "/documentation", tone: "blue" },
  { label: "LÃ©gislation", icon: FileText, href: "/documentation", tone: "gold" },
  { label: "FAQ", icon: HelpCircle, href: "/faq", tone: "violet" },
];

const HERO_STATS: StatCard[] = [
  {
    label: "Demandes en cours",
    value: "17",
    hint: "+18% ce mois",
    icon: FileText,
    tone: "blue",
  },
  {
    label: "Permis actifs",
    value: "08",
    hint: "+1 ce mois",
    icon: ShieldCheck,
    tone: "gold",
  },
  {
    label: "En instruction",
    value: "06",
    hint: "-2 ce mois",
    icon: Map,
    tone: "violet",
  },
  {
    label: "Demandes approuvÃ©es",
    value: "24",
    hint: "+5 ce mois",
    icon: CheckCircle2,
    tone: "green",
  },
  {
    label: "Paiements en attente",
    value: "2",
    hint: "125 000 DZD",
    icon: WalletCards,
    tone: "red",
  },
  {
    label: "Total payÃ© (2025)",
    value: "3 250 000 DZD",
    hint: "+22% vs 2024",
    icon: CreditCard,
    tone: "blue",
  },
];

const toList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { items?: unknown }).items)
  ) {
    return (payload as { items: T[] }).items;
  }
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: T[] }).data;
  }
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data?: { items?: unknown } }).data?.items)
  ) {
    return (payload as { data: { items: T[] } }).data.items;
  }
  return [];
};

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { auth } = useAuthStore();
  const isAuthReady = useAuthReady();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const [demandes, setDemandes] = useState<TrackerRequestItem[]>([]);
  const [stats, setStats] = useState<StatState>({
    demandesEnCours: 0,
    permisActifs: 0,
  });
  const [recentRequests, setRecentRequests] = useState<RecentRequestCard[]>([]);
  const [recentRequestsLoading, setRecentRequestsLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [trackReference, setTrackReference] = useState("");
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [trackedRequest, setTrackedRequest] = useState<TrackerResult | null>(null);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!auth?.email && !auth?.username) {
      navigate("/");
      return;
    }
    if (isCadastreRole(auth?.role)) {
      navigate(getDefaultDashboardPath(auth?.role), { replace: true });
    }
  }, [auth?.email, auth?.role, auth?.username, isAuthReady, navigate]);

  useEffect(() => {
    let isActive = true;
    if (!apiURL) return () => undefined;
    if (isCadastreRole(auth?.role)) return () => undefined;

    const loadStats = async () => {
      try {
        const demandesResult = await axios.get(`${apiURL}/demandes/mes-demandes`, {
          withCredentials: true,
        });
        const userDemandes = toList<TrackerRequestItem>(demandesResult.data);

        if (!isActive) return;
        setDemandes(userDemandes);
        setStats({
          demandesEnCours: userDemandes.length,
          permisActifs: 0,
        });
      } catch {
        if (!isActive) return;
        setStats((prev) => ({ ...prev }));
      }
    };

    void loadStats();

    return () => {
      isActive = false;
    };
  }, [apiURL, auth?.role]);

  useEffect(() => {
    let isActive = true;
    const latestDemandes = [...demandes]
      .filter((item) => item.id_demande != null)
      .sort((a, b) => {
        const dateDelta = (toTimestamp(b.date_demande) ?? 0) - (toTimestamp(a.date_demande) ?? 0);
        if (dateDelta !== 0) return dateDelta;
        return b.id_demande - a.id_demande;
      })
      .slice(0, 3);

    const loadRecentRequests = async () => {
      if (latestDemandes.length === 0) {
        if (isActive) {
          setRecentRequests([]);
          setRecentRequestsLoading(false);
        }
        return;
      }

      setRecentRequestsLoading(true);

      try {
        const cards = await Promise.all(
          latestDemandes.map(async (item) => {
            try {
              const response = await axios.get(`${apiURL}/demandes_dashboard/${encodeURIComponent(String(item.id_demande))}`, {
                withCredentials: true,
              });
              const detail = (response.data?.data ?? response.data) as TrackerDetailResponse;
              if (auth?.id && detail?.utilisateurId && detail.utilisateurId !== auth.id) {
                return buildRecentRequestCard(item);
              }
              return buildRecentRequestCard(item, detail);
            } catch {
              return buildRecentRequestCard(item);
            }
          }),
        );

        if (isActive) {
          setRecentRequests(cards);
        }
      } finally {
        if (isActive) {
          setRecentRequestsLoading(false);
        }
      }
    };

    if (!apiURL) {
      setRecentRequests(latestDemandes.map((item) => buildRecentRequestCard(item)));
      return () => {
        isActive = false;
      };
    }

    void loadRecentRequests();

    return () => {
      isActive = false;
    };
  }, [apiURL, auth?.id, demandes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (getHasSeenOnboarding()) return;

    const search = new URLSearchParams(location.search);
    const shouldStartFromQuery = search.get("onboarding") === "1";
    const active = getOnboardingActive() || shouldStartFromQuery;
    const alreadySeenDashboard = getOnboardingPageSeen("investor-dashboard");

    if (shouldStartFromQuery) {
      setOnboardingActive(true);
    }

    if (active && !alreadySeenDashboard) {
      setShowOnboarding(true);
    }
  }, [location.search]);

  const companyName = useMemo(
    () => auth?.username || auth?.nom || auth?.email || "SociÃ©tÃ© MiniÃ¨re SARL",
    [auth?.email, auth?.nom, auth?.username],
  );

  const companyInitials = useMemo(() => {
    const parts = companyName.split(/\s+/).filter(Boolean);
    const initials = parts.slice(0, 2).map((part) => part[0] ?? "").join("");
    return initials ? initials.toUpperCase() : "SM";
  }, [companyName]);

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    stopOnboardingForever();
  };

  const handleCompleteOnboarding = () => {
    setShowOnboarding(false);
    markOnboardingPageCompleted("investor-dashboard");
  };

  const handleNavigate = (href: string) => {
    if (href.startsWith("#")) {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    navigate(href);
  };

  const handleTrackRequest = useCallback(async () => {
    const reference = normalizeReference(trackReference);

    if (!reference) {
      setTrackError("Veuillez saisir une rÃ©fÃ©rence de demande");
      setTrackedRequest(null);
      return;
    }

    if (!apiURL) {
      setTrackError("Impossible de rÃ©cupÃ©rer le suivi pour le moment");
      setTrackedRequest(null);
      return;
    }

    const matchesReference = (item: any) => {
      const candidates = [
        item.code_demande,
        item.short_code,
        item.id_demande != null ? String(item.id_demande) : null,
      ]
        .filter(Boolean)
        .map((value) => normalizeReference(String(value)));

      return candidates.includes(reference);
    };

    setTrackLoading(true);
    setTrackError(null);

    try {
      let matched = demandes.find(matchesReference);

      if (!matched) {
        const searchResponse = await axios.get(`${apiURL}/demandes_dashboard?page=1&pageSize=50&search=${encodeURIComponent(trackReference.trim())}`, {
          withCredentials: true,
        });
        const remoteDemandes = toList<TrackerRequestItem>(searchResponse.data);
        matched = remoteDemandes.find(matchesReference);

        if (matched && auth?.id) {
          const ownerId = Number(matched.utilisateurId ?? 0);
          if (ownerId && ownerId !== auth.id) {
            setTrackError("Vous nâ€™avez pas accÃ¨s Ã  cette demande");
            setTrackedRequest(null);
            return;
          }
        }
      }

      if (!matched) {
        setTrackError("Aucune demande trouvÃ©e avec cette rÃ©fÃ©rence");
        setTrackedRequest(null);
        return;
      }

      const detailResponse = await axios.get(
        `${apiURL}/demandes_dashboard/${encodeURIComponent(String(matched.id_demande))}`,
        {
          withCredentials: true,
        },
      );

      const detail = (detailResponse.data?.data ?? detailResponse.data) as TrackerDetailResponse;
      if (auth?.id && detail?.utilisateurId && detail.utilisateurId !== auth.id) {
        setTrackError("Vous nâ€™avez pas accÃ¨s Ã  cette demande");
        setTrackedRequest(null);
        return;
      }

      setTrackedRequest(buildTrackerResult(matched, detail));
    } catch (error) {
      if (axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) {
        setTrackError("Vous nâ€™avez pas accÃ¨s Ã  cette demande");
      } else {
        setTrackError("Impossible de rÃ©cupÃ©rer le suivi pour le moment");
      }
      setTrackedRequest(null);
    } finally {
      setTrackLoading(false);
    }
  }, [apiURL, auth?.id, demandes, trackReference]);

  if (!isAuthReady) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <Navbar />
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <button className={styles.brand} type="button" onClick={() => navigate("/investisseur/InvestorDashboard")}>
            <span className={styles.brandMark}>
              <img src="/anamlogo.png" alt="ANAM" className={styles.brandLogo} />
            </span>
            <span className={styles.brandText}>
              <span className={styles.brandKicker}>RÃ©publique AlgÃ©rienne</span>
              <span className={styles.brandTitle}>MinistÃ¨re des Mines</span>
            </span>
          </button>

          <nav className={styles.topNav} aria-label="Navigation principale">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/investisseur/InvestorDashboard"
                  ? location.pathname === "/investisseur/InvestorDashboard"
                  : item.href !== "#support" && location.pathname.startsWith(item.href);

              return (
                <button
                  key={item.label}
                  type="button"
                  className={`${styles.topNavItem} ${isActive ? styles.topNavItemActive : ""}`}
                  onClick={() => handleNavigate(item.href)}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.notificationButton}
              data-onboarding-id="dashboard-card-notifications"
              onClick={() => navigate("/notification")}
              aria-label="Notifications"
            >
              <Bell size={18} />
              <span className={styles.notificationBadge}>5</span>
            </button>

            <button
              type="button"
              className={styles.userCard}
              onClick={() => navigate("/investisseur/profil")}
            >
              <span className={styles.userAvatar}>
                <img src="/anamlogo.png" alt="" className={styles.userAvatarImage} />
                <span className={styles.userAvatarFallback} aria-hidden="true">
                  {companyInitials}
                </span>
              </span>
              <span className={styles.userMeta}>
                <span className={styles.userName}>{companyName}</span>
                <span className={styles.userRole}>Entreprise vÃ©rifiÃ©e</span>
              </span>
              <ChevronDown size={16} className={styles.userChevron} />
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero} data-onboarding-id="dashboard-hero">
          <div
            className={styles.heroBackdrop}
            style={{ backgroundImage: `url(${heroDashboardImage})` }}
          />
          <div className={styles.heroOverlay} />

          <div className={styles.heroGrid}>
            <div className={styles.heroContent}>
              <p className={styles.heroEyebrow}>GUICHET UNIQUE MINIER</p>
              <h1 className={styles.heroTitle}>
                Toutes vos <em>démarches</em>
                <br />
                minières, <em>en un seul</em>
                <br />
                <em>endroit.</em>
              </h1>
              <p className={styles.heroLead}>
                Simplifiez, suivez et gÃ©rez l&apos;ensemble de vos demandes et permis
                miniers en toute transparence.
              </p>

              <div className={styles.heroFeatures}>
                {HERO_FEATURES.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div key={feature.title} className={styles.heroFeature}>
                      <span className={styles.heroFeatureIcon}>
                        <Icon size={16} />
                      </span>
                      <div>
                        <strong>{feature.title}</strong>
                        <span>{feature.description}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={styles.heroActions}>
                <button
                  type="button"
                  className={styles.primaryAction}
                  data-onboarding-id="dashboard-new-request"
                  onClick={() => navigate("/investisseur/nouvelle_demande/step1_typepermis/page1_typepermis")}
                >
                  <Plus size={18} />
                  <span>Nouvelle demande</span>
                </button>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={() => navigate("/investisseur/demandes")}
                >
                  <FileText size={17} />
                  <span>Voir mes demandes</span>
                </button>
              </div>
            </div>

            <aside className={styles.heroPanel}>
              <div className={styles.heroPanelHeader}>
                <h2>Mon entreprise</h2>
                <span className={auth?.isEntrepriseVerified ? styles.statusVerified : styles.statusPending}>
                  {auth?.isEntrepriseVerified ? "✓ Vérifiée" : "En attente"}
                </span>
              </div>

              <div className={styles.heroPanelCompanyRow}>
                <div className={styles.heroPanelAvatar}>{companyInitials}</div>
                <div className={styles.heroPanelBody}>
                  <p className={styles.heroPanelCompany}>{companyName}</p>
                  <p className={styles.heroPanelMeta}>NIF : 123456789012345</p>
                  <p className={styles.heroPanelMeta}>Statut : <span className={styles.heroPanelActive}>Actif</span></p>
                </div>
              </div>

              <div className={styles.heroPanelStats}>
                <div className={styles.heroPanelStat}>
                  <strong>{stats.demandesEnCours || 17}</strong>
                  <span>Demandes</span>
                </div>
                <div className={styles.heroPanelStatDivider} />
                <div className={styles.heroPanelStat}>
                  <strong>08</strong>
                  <span>Permis actifs</span>
                </div>
                <div className={styles.heroPanelStatDivider} />
                <div className={styles.heroPanelStat}>
                  <strong>24</strong>
                  <span>Approuvées</span>
                </div>
              </div>

              <button
                type="button"
                className={styles.heroPanelAction}
                onClick={() => navigate("/investisseur/profil")}
              >
                <User size={15} />
                <span>Voir mon profil</span>
              </button>
            </aside>
          </div>
        </section>

        {/* ── Barre de raccourcis rapides ── */}
        <div className={styles.quickBar}>
          {QUICK_LINKS
            .filter(item => item.label !== "Paiements" && item.label !== "Mes demandes")
            .map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  className={`${styles.quickBarBtn} ${styles[`quickTone_${item.tone}`]}`}
                  onClick={() => handleNavigate(item.href)}
                >
                  <span className={styles.quickBarIcon}><Icon size={18} /></span>
                  <span className={styles.quickBarLabel}>{item.label}</span>
                </button>
              );
            })
          }
        </div>

        <section className={styles.statsGrid} data-onboarding-id="dashboard-status">
          {HERO_STATS.map((item, index) => {
            const Icon = item.icon;
            return (
              <article key={item.label} className={styles.statCard} style={{ animationDelay: `${index * 0.05}s` }}>
                <div className={`${styles.statIcon} ${styles[`statTone_${item.tone}`]}`}>
                  <Icon size={18} />
                </div>
                <div className={styles.statBody}>
                  <p className={styles.statLabel}>{item.label}</p>
                  <p className={styles.statValue}>{item.value}</p>
                  <p className={styles.statHint}>{item.hint}</p>
                </div>
              </article>
            );
          })}
        </section>

        <section className={styles.contentGrid}>
          <section className={`${styles.card} ${styles.requestsCard}`} data-onboarding-id="dashboard-card-demandes">
            <div className={styles.cardHeader}>
              <h2>Mes demandes rÃ©centes</h2>
              <button type="button" className={styles.cardLinkButton} onClick={() => navigate("/investisseur/demandes")}>
                Voir tout
              </button>
            </div>

            <div className={styles.requestList}>
              {recentRequestsLoading && recentRequests.length === 0 ? (
                <div className={styles.requestEmptyState}>
                  <div className={styles.requestEmptyPulse} />
                  <p>Chargement des derniÃ¨res demandes...</p>
                </div>
              ) : recentRequests.length > 0 ? (
                recentRequests.map((request) => (
                  <article key={request.reference} className={styles.requestRow}>
                  <div className={`${styles.requestIcon} ${styles[`requestTone_${request.tone}`]}`}>
                    <FileText size={18} />
                  </div>

                  <div className={styles.requestBody}>
                    <div className={styles.requestTopLine}>
                      <div>
                        <h3>{request.title}</h3>
                        <p>RÃ©f : {request.reference}</p>
                      </div>
                      <span className={`${styles.requestStatus} ${styles[`requestStatus_${request.tone}`]}`}>
                        {request.status}
                      </span>
                    </div>

                    <div className={styles.progressRow}>
                      <div className={styles.progressTrack}>
                        <div className={`${styles.progressFill} ${styles[`progressFill_${request.tone}`]}`} style={{ width: `${request.progress}%` }} />
                      </div>
                      <span>{request.progress}%</span>
                    </div>

                    <div className={styles.requestFoot}>
                      <span className={styles.requestFootHint}>Mis Ã  jour : {request.updated}</span>
                    </div>
                  </div>
                </article>
                ))
              ) : (
                <div className={styles.requestEmptyState}>
                  <FileText size={18} />
                  <p>Aucune demande rÃ©cente trouvÃ©e.</p>
                </div>
              )}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Suivi d&apos;une demande</h2>
            </div>

            <p className={styles.sectionLead}>Entrez le numÃ©ro de rÃ©fÃ©rence pour suivre l&apos;avancement</p>

            <div className={styles.trackRow}>
              <label className={styles.trackField}>
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Ex : MIN-2025-00124"
                  aria-label="NumÃ©ro de rÃ©fÃ©rence"
                  value={trackReference}
                  onChange={(event) => {
                    setTrackReference(event.target.value);
                    if (trackError) setTrackError(null);
                  }}
                />
              </label>
              <button
                type="button"
                className={styles.trackButton}
                onClick={() => void handleTrackRequest()}
                disabled={trackLoading}
              >
                {trackLoading ? (
                  <>
                    <Loader2 size={16} className={styles.trackSpinner} />
                    <span>Recherche...</span>
                  </>
                ) : (
                  <span>Suivre</span>
                )}
              </button>
            </div>

            {trackError && (
              <div className={styles.trackError} role="alert">
                <AlertCircle size={16} />
                <span>{trackError}</span>
              </div>
            )}

            {trackedRequest && (
              <div className={`${styles.trackResult} ${styles[`trackTone_${trackedRequest.statusTone}`]}`}>
                <div className={styles.trackResultHeader}>
                  <div className={styles.trackResultTitleBlock}>
                    <p className={styles.trackResultEyebrow}>Suivi instantanÃ©</p>
                    <h3>{trackedRequest.title}</h3>
                  </div>
                  <span className={styles.trackResultBadge}>{trackedRequest.reference}</span>
                </div>

                <div className={styles.trackResultGrid}>
                  <div className={styles.trackResultItem}>
                    <span>Statut actuel</span>
                    <strong>{trackedRequest.status}</strong>
                  </div>
                  <div className={styles.trackResultItem}>
                    <span>DerniÃ¨re mise Ã  jour</span>
                    <strong>{trackedRequest.lastUpdated}</strong>
                  </div>
                  <div className={styles.trackResultItem}>
                    <span>Temps restant estimÃ©</span>
                    <strong>{trackedRequest.estimatedRemaining}</strong>
                  </div>
                  <div className={styles.trackResultItem}>
                    <span>Service responsable</span>
                    <strong>{trackedRequest.responsibleService}</strong>
                  </div>
                </div>

                <p className={styles.trackResultAction}>{trackedRequest.nextAction}</p>
              </div>
            )}

            <div className={styles.stepsBlock}>
              <p className={styles.stepsTitle}>Ã‰tapes du processus</p>
              <div
                key={trackedRequest?.reference ?? "default"}
                className={`${styles.stepsGrid} ${trackedRequest ? styles.stepsGridAnimated : ""}`}
              >
                {(trackedRequest?.steps ?? PROCESS_STEPS).map((step) => {
                  const Icon = step.icon;
                  const stepClass =
                    step.state === "done"
                      ? styles.stepDone
                      : step.state === "active"
                        ? styles.stepActive
                        : styles.stepPending;

                  return (
                    <div key={step.label} className={styles.stepItem}>
                      <div className={`${styles.stepDot} ${stepClass}`}>
                        <Icon size={14} />
                      </div>
                      <strong>{step.label}</strong>
                      <span>{step.date}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

        </section>

        <section className={styles.contentGridSecondary} data-onboarding-id="dashboard-quick-access">
          <section className={`${styles.card} ${styles.mapCard}`}>
            {/* Orbes décoratifs */}
            <div className={styles.mapOrb1} aria-hidden="true" />
            <div className={styles.mapOrb2} aria-hidden="true" />

            <div className={styles.mapLeft}>
              <div className={styles.mapCopy}>
                <span className={styles.mapBadge}>
                  <Map size={12} />
                  Géologie &amp; Ressources
                </span>
                <h2 className={styles.mapTitle}>Carte minière<br />interactive</h2>
                <p className={styles.mapDesc}>Explorez les zones minières, gisements et titres miniers actifs sur le territoire algérien.</p>

                <div className={styles.mapMiniStats}>
                  <div className={styles.mapMiniStat}>
                    <strong>127</strong>
                    <span>Concessions</span>
                  </div>
                  <div className={styles.mapMiniStatDiv} />
                  <div className={styles.mapMiniStat}>
                    <strong>48</strong>
                    <span>Zones actives</span>
                  </div>
                  <div className={styles.mapMiniStatDiv} />
                  <div className={styles.mapMiniStat}>
                    <strong>09</strong>
                    <span>Wilayas</span>
                  </div>
                </div>

                <button type="button" className={styles.mapButton} onClick={() => navigate("/carte/carte_public")}>
                  <span>Ouvrir la carte</span>
                  <ArrowRight size={15} />
                </button>
              </div>

              <div className={styles.mapLegend}>
                <p className={styles.mapLegendTitle}>Légende</p>
                <div className={styles.mapLegendGrid}>
                  <span className={styles.legendPill}><i className={styles.legendDotOrange} />Gisements</span>
                  <span className={styles.legendPill}><i className={styles.legendDotGreen} />Zones ouvertes</span>
                  <span className={styles.legendPill}><i className={styles.legendDotRed} />Zones réservées</span>
                  <span className={styles.legendPill}><i className={styles.legendDotBlue} />Mes permis</span>
                  <span className={styles.legendPill}><i className={styles.legendDotViolet} />Mes demandes</span>
                </div>
              </div>
            </div>

            <div className={styles.mapVisual}>
              <iframe
                src="https://sig.anam.dz/portal/apps/experiencebuilder/experience?id=fc56f54b45264df2a5f4e07fd2462664"
                className={styles.mapIframe}
                title="Carte minière interactive"
                loading="lazy"
                allowFullScreen
              />
            </div>
          </section>

          <section className={`${styles.card} ${styles.paymentCard}`}>
            <div className={styles.cardHeader}>
              <h2>Paiements</h2>
              <button type="button" className={styles.cardLinkButton} onClick={() => navigate("/investisseur/statistiques")}>
                Voir tout
              </button>
            </div>

            <div className={styles.paymentHighlight}>
              <div>
                <p>Montant Ã  rÃ©gler</p>
                <strong>125 000 DZD</strong>
                <span>2 paiement(s) en attente</span>
              </div>
              <button type="button" className={styles.payButton}>
                <LockIcon />
                <span>Payer maintenant</span>
              </button>
            </div>

            <div className={styles.paymentList}>
              <p className={styles.paymentSectionTitle}>Derniers paiements</p>
              {PAYMENTS.map((payment) => (
                <article key={payment.code} className={styles.paymentRow}>
                  <div className={styles.paymentInfo}>
                    <strong>{payment.code}</strong>
                    <span>{payment.label}</span>
                  </div>
                  <div className={styles.paymentMeta}>
                    <strong>{payment.amount}</strong>
                    <span className={styles.paymentPaid}>{payment.status}</span>
                    <span>{payment.date}</span>
                  </div>
                  <button type="button" className={styles.downloadButton} aria-label={`Télécharger le reçu ${payment.code}`}>
                    <Download size={16} />
                  </button>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className={styles.footerGrid}>
          <section className={styles.supportCard} id="support">
            <div className={styles.supportCopy}>
              <div className={styles.supportBadge}>
                <Headphones size={17} />
              </div>
              <div>
                <h2>Besoin d&apos;aide ?</h2>
                <p>Notre Ã©quipe est Ã  votre disposition</p>
              </div>
            </div>

            <div className={styles.supportActions}>
              <button type="button" className={styles.supportButton} onClick={() => navigate("/contact")}>
                Contacter le support
              </button>
              <button type="button" className={styles.supportIconButton} onClick={() => navigate("/faq")}>
                <HelpCircle size={18} />
              </button>
            </div>
          </section>
        </section>
      </main>

      <OnboardingTour
        isOpen={showOnboarding}
        steps={DASHBOARD_ONBOARDING_STEPS}
        onClose={handleCloseOnboarding}
        onComplete={handleCompleteOnboarding}
      />
    </div>
  );
}

function AlgeriaMapIllustration() {
  return (
    <div className={styles.mapStage} aria-hidden="true">
      <img className={styles.mapImage} src={algerieMapUrl} alt="" aria-hidden="true" />
    </div>
  );
}

function LockIcon() {
  return (
    <span className={styles.lockIcon} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M7 10V8.2C7 5.32 9.24 3 12 3C14.76 3 17 5.32 17 8.2V10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <rect
          x="5"
          y="10"
          width="14"
          height="10"
          rx="2.5"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    </span>
  );
}
