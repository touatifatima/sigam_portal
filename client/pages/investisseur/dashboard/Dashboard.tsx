import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  Download,
  FileText,
  HelpCircle,
  Home,
  Map,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  RotateCcw,
  User,
  WalletCards,
} from "lucide-react";
import Navbar from "@/pages/navbar/Navbar";
import styles from "./Dashboard.module.css";
import { useAuthStore } from "@/src/store/useAuthStore";
import { useAuthReady } from "@/src/hooks/useAuthReady";
import heroDashboardImage from "@/src/assets/mines.png";
import { getDefaultDashboardPath, isCadastreRole } from "@/src/utils/roleNavigation";
import { cleanLocalStorageForNewDemande } from "@/utils/cleanLocalStorage";
import {
  setSessionBackedItem,
  writeSessionBackedJson,
} from "@/src/utils/sessionBackedStorage";
import { OnboardingTour, type OnboardingStep } from "@/components/onboarding/OnboardingTour";
import { BrandLoader } from "@/components/loading/BrandLoader";
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

type TypePermis = {
  id: number;
  lib_type: string;
  code_type: string;
  regime: string;
  duree_initiale: number;
  nbr_renouv_max: number;
  duree_renouv: number;
  delai_renouv: number;
  superficie_max?: number | null;
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
  { label: "Carte minière", icon: Map, href: "/carte/carte_public" },
  { label: "Documents", icon: FileText, href: "/documentation" },
  { label: "Aide & Support", icon: HelpCircle, href: "/faq" },
];

const HERO_FEATURES: HeroFeature[] = [
  {
    title: "100% en ligne",
    description: "Sans déplacement",
    icon: Building2,
  },
  {
    title: "Sécurisé",
    description: "Données protégées",
    icon: ShieldCheck,
  },
  {
    title: "Paiements sécurisés",
    description: "Via SATIM",
    icon: CreditCard,
  },
];

const PROCESS_STEPS: ProcessStep[] = [
  { label: "Soumise", date: "12/05/2025", state: "done", icon: CheckCircle2 },
  { label: "Reçue", date: "13/05/2025", state: "done", icon: CheckCircle2 },
  { label: "En instruction", date: "16/05/2025", state: "active", icon: Clock3 },
  { label: "Validation", date: "En attente", state: "pending", icon: CheckCircle2 },
  { label: "Paiement", date: "En attente", state: "pending", icon: CheckCircle2 },
  { label: "Délivrée", date: "En attente", state: "pending", icon: CheckCircle2 },
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
  if (!value) return "Aucune mise à jour";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "Aucune mise à jour";

  const diffMs = Date.now() - ts;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "À l'instant";
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

  return ["Soumise", "Reçue", "En instruction", "Validation", "Paiement", "Délivrée"].map(
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
    "Demande minière";

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
      ? `Délai clôturé en ${deadlineInfo.used} jour(s) ouvrable(s)`
      : deadlineInfo?.mode === "rejetee"
        ? `Clôturé en ${deadlineInfo.used} jour(s) ouvrable(s)`
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
    "Dépôt enregistré. En attente de réception.",
    "Réception du dossier en cours.",
    "Instruction technique en cours.",
    "Validation administrative en attente.",
    "Paiement attendu ou en cours de confirmation.",
    "Délivrance du dossier en cours.",
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
    status: "Payé",
    date: "12/05/2025",
  },
  {
    code: "MIN-2025-00118",
    label: "Autorisation de prospection",
    amount: "75 000 DZD",
    status: "Payé",
    date: "05/05/2025",
  },
];

const QUICK_LINKS: QuickLink[] = [
  { label: "Nouvelle demande", icon: Plus, href: "/investisseur/nouvelle_demande/step1_typepermis/page1_typepermis", tone: "blue" },
  { label: "Mes demandes", icon: FileText, href: "/investisseur/demandes", tone: "green" },
  { label: "Paiements", icon: CreditCard, href: "/investisseur/statistiques", tone: "gold" },
  { label: "Carte minière", icon: Map, href: "/carte/carte_public", tone: "violet" },
  { label: "Documents", icon: FileText, href: "/documentation", tone: "red" },
  { label: "Modèles & guides", icon: FileText, href: "/documentation", tone: "blue" },
  { label: "Législation", icon: FileText, href: "/documentation", tone: "gold" },
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
    label: "Demandes approuvées",
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
    label: "Total payé (2025)",
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

const isTypePermis = (value: unknown): value is TypePermis => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "number" &&
    typeof record.lib_type === "string" &&
    typeof record.code_type === "string" &&
    typeof record.regime === "string" &&
    typeof record.duree_initiale === "number" &&
    typeof record.nbr_renouv_max === "number" &&
    typeof record.duree_renouv === "number" &&
    typeof record.delai_renouv === "number"
  );
};

const toPermisList = (payload: unknown): TypePermis[] => {
  return toList<unknown>(payload).filter(isTypePermis);
};

const toPermisItem = (payload: unknown): TypePermis | null => {
  if (isTypePermis(payload)) return payload;
  if (payload && typeof payload === "object") {
    const data = (payload as { data?: unknown }).data;
    if (isTypePermis(data)) return data;
  }
  return null;
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
  const [entryChoiceModalOpen, setEntryChoiceModalOpen] = useState(false);
  const [entryModalStep, setEntryModalStep] = useState<"choice" | "initial">("choice");
  const [permisOptions, setPermisOptions] = useState<TypePermis[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedPermisId, setSelectedPermisId] = useState<number | "">("");
  const [selectedPermis, setSelectedPermis] = useState<TypePermis | null>(null);
  const [permitDropdownOpen, setPermitDropdownOpen] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [submittingEntry, setSubmittingEntry] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!entryChoiceModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [entryChoiceModalOpen]);

  useEffect(() => {
    if (!entryChoiceModalOpen || entryModalStep !== "initial") return;
    if (!apiURL) {
      setEntryError("Configuration API manquante.");
      return;
    }
    if (permisOptions.length > 0) return;

    let isActive = true;
    setOptionsLoading(true);
    setEntryError(null);

    axios
      .get(`${apiURL}/type-permis`, { withCredentials: true })
      .then((response) => {
        if (!isActive) return;
        const options = toPermisList(response.data);
        setPermisOptions(options);
        if (options.length === 0) {
          setEntryError("Aucun type de permis reçu depuis le serveur.");
        }
      })
      .catch(() => {
        if (isActive) setEntryError("Impossible de charger la liste des types de permis.");
      })
      .finally(() => {
        if (isActive) setOptionsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [apiURL, entryChoiceModalOpen, entryModalStep, permisOptions.length]);

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

    const recentTimer = window.setTimeout(() => {
      void loadRecentRequests();
    }, 700);

    return () => {
      isActive = false;
      window.clearTimeout(recentTimer);
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
    () => auth?.username || auth?.nom || auth?.email || "Société Minière SARL",
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
    if (href === "/investisseur/nouvelle_demande/step1_typepermis/page1_typepermis") {
      setEntryModalStep("choice");
      setEntryChoiceModalOpen(true);
      return;
    }

    if (href.startsWith("#")) {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    navigate(href);
  };

  const closeEntryModal = () => {
    setEntryChoiceModalOpen(false);
    setEntryModalStep("choice");
    setSelectedPermisId("");
    setSelectedPermis(null);
    setPermitDropdownOpen(false);
    setEntryError(null);
  };

  const effectivePermis = useMemo(() => {
    if (selectedPermis) return selectedPermis;
    if (selectedPermisId === "") return null;
    return permisOptions.find((option) => option.id === selectedPermisId) ?? null;
  }, [permisOptions, selectedPermis, selectedPermisId]);

  const selectedPermisLabel = effectivePermis
    ? `${effectivePermis.lib_type} (${effectivePermis.code_type}) - ${effectivePermis.regime}`
    : optionsLoading
      ? "Chargement..."
      : "-- Sélectionnez --";

  const handlePermisChange = async (value: string) => {
    if (!value) {
      setSelectedPermisId("");
      setSelectedPermis(null);
      setPermitDropdownOpen(false);
      return;
    }

    const permisId = Number(value);
    if (Number.isNaN(permisId)) {
      setSelectedPermisId("");
      setSelectedPermis(null);
      setPermitDropdownOpen(false);
      toast.error("Identifiant de permis invalide.");
      return;
    }

    setSelectedPermisId(permisId);
    setSelectedPermis(null);
    setPermitDropdownOpen(false);
    setEntryError(null);

    if (!apiURL) {
      setEntryError("Configuration API manquante.");
      return;
    }

    setDetailsLoading(true);

    try {
      const response = await axios.get(`${apiURL}/type-permis/${permisId}`, {
        withCredentials: true,
      });
      setSelectedPermis(toPermisItem(response.data));
    } catch {
      setSelectedPermis(null);
      toast.error("Impossible de charger les détails du type de permis.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleStartInitialDemande = async () => {
    const permis = effectivePermis;

    if (!permis) {
      toast.warning("Sélectionnez un type de permis.");
      return;
    }

    if (!apiURL) {
      setEntryError("Configuration API manquante.");
      return;
    }

    setSubmittingEntry(true);
    setEntryError(null);

    try {
      cleanLocalStorageForNewDemande();
      const response = await axios.post(
        `${apiURL}/demandes`,
        {
          id_typepermis: permis.id,
          objet_demande: "Instruction initialisée",
        },
        { withCredentials: true },
      );

      const { procedure, code_demande: demandeCode, id_demande } = response.data ?? {};
      const idProc = procedure?.id_proc;

      if (id_demande) setSessionBackedItem("id_demande", String(id_demande));
      if (idProc) setSessionBackedItem("id_proc", String(idProc));
      setSessionBackedItem("code_demande", demandeCode ?? "");
      writeSessionBackedJson("selected_permis", permis);
      writeSessionBackedJson("permis_details", {
        duree_initiale: permis.duree_initiale,
        nbr_renouv_max: permis.nbr_renouv_max,
        superficie_max: permis.superficie_max ?? null,
        duree_renouv: permis.duree_renouv,
      });

      if (idProc) {
        navigate(`/investisseur/nouvelle_demande/step2/page2?id=${idProc}`);
      } else {
        setEntryError("Demande créée, mais identifiant de procédure indisponible.");
      }
    } catch {
      setEntryError("Erreur lors de la création de la demande.");
    } finally {
      setSubmittingEntry(false);
    }
  };

  const handleTrackRequest = useCallback(async () => {
    const reference = normalizeReference(trackReference);

    if (!reference) {
      setTrackError("Veuillez saisir une référence de demande");
      setTrackedRequest(null);
      return;
    }

    if (!apiURL) {
      setTrackError("Impossible de récupérer le suivi pour le moment");
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
            setTrackError("Vous n'avez pas accès à cette demande");
            setTrackedRequest(null);
            return;
          }
        }
      }

      if (!matched) {
        setTrackError("Aucune demande trouvée avec cette référence");
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
        setTrackError("Vous n'avez pas accès à cette demande");
        setTrackedRequest(null);
        return;
      }

      setTrackedRequest(buildTrackerResult(matched, detail));
    } catch (error) {
      if (axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) {
        setTrackError("Vous n'avez pas accès à cette demande");
      } else {
        setTrackError("Impossible de récupérer le suivi pour le moment");
      }
      setTrackedRequest(null);
    } finally {
      setTrackLoading(false);
    }
  }, [apiURL, auth?.id, demandes, trackReference]);

  if (!isAuthReady) {
    return <BrandLoader fullScreen label="Chargement du tableau de bord..." />;
  }

  return (
    <div className={styles.dashboard}>
      <Navbar />
      {entryChoiceModalOpen && (
        <div className={styles.entryModalOverlay}>
          <div className={styles.entryModalCard} role="dialog" aria-modal="true" aria-labelledby="entry-choice-title">
            <div className={styles.entryModalHeader}>
              <span className={styles.entryModalBadge}>Nouvelle demande</span>
            </div>
            {entryModalStep === "choice" ? (
              <>
                <h2 id="entry-choice-title" className={styles.entryModalTitle}>
                  Que souhaitez-vous faire ?
                </h2>
                <p className={styles.entryModalText}>
                  Choisissez le parcours le plus adapté à votre besoin. Vous pouvez revenir à tout moment.
                </p>

                <div className={styles.entryModalActions}>
                  <button
                    type="button"
                    className={`${styles.entryActionButton} ${styles.entryActionPrimary}`}
                    onClick={() => navigate("/investisseur/nouvelle-demande-posterieure")}
                  >
                    <span className={styles.entryActionArrow}>
                      <ArrowUpRight size={13} strokeWidth={2.5} />
                    </span>
                    <span className={`${styles.entryActionIcon} ${styles.entryActionIconViolet}`}>
                      <RotateCcw size={22} strokeWidth={2} />
                    </span>
                    <span className={styles.entryActionLabel}>Demande pour un permis existant</span>
                    <span className={styles.entryActionHint}>Renouvellement, cession, transfert, etc.</span>
                    <span className={styles.entryActionPill}>Le plus courant</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.entryActionButton} ${styles.entryActionSecondary}`}
                    onClick={() => setEntryModalStep("initial")}
                  >
                    <span className={styles.entryActionArrow}>
                      <ArrowUpRight size={13} strokeWidth={2.5} />
                    </span>
                    <span className={`${styles.entryActionIcon} ${styles.entryActionIconBlue}`}>
                      <Plus size={22} strokeWidth={2} />
                    </span>
                    <span className={styles.entryActionLabel}>Nouvelle demande initiale</span>
                    <span className={styles.entryActionHint}>Continuer le parcours normal de création.</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="entry-choice-title" className={styles.entryModalTitle}>
                  Choisissez votre type de permis
                </h2>
                <p className={styles.entryModalText}>
                  Sélectionnez le permis demande. La demande sera creee depuis ce popup.
                </p>

                <div className={styles.entryPermitForm}>
                  {entryError && <div className={styles.entryErrorBox}>{entryError}</div>}
                  <label className={styles.entryPermitLabel} htmlFor="dashboard-type-permis">
                    Type de permis
                  </label>
                  <div className={styles.entryPermitDropdown}>
                    <button
                      id="dashboard-type-permis"
                      type="button"
                      className={`${styles.entryPermitSelectButton} ${
                        effectivePermis ? styles.entryPermitSelectButtonFilled : ""
                      }`}
                      onClick={() => setPermitDropdownOpen((open) => !open)}
                      disabled={optionsLoading || submittingEntry}
                      aria-haspopup="listbox"
                      aria-expanded={permitDropdownOpen}
                    >
                      <span>{selectedPermisLabel}</span>
                      <ChevronDown size={18} className={permitDropdownOpen ? styles.entryPermitChevronOpen : ""} />
                    </button>

                    {permitDropdownOpen && (
                      <div className={styles.entryPermitMenu} role="listbox" aria-labelledby="dashboard-type-permis">
                        {permisOptions.map((permis) => {
                          const active = selectedPermisId === permis.id;
                          return (
                            <button
                              key={permis.id}
                              type="button"
                              role="option"
                              aria-selected={active}
                              className={`${styles.entryPermitOption} ${
                                active ? styles.entryPermitOptionActive : ""
                              }`}
                              onClick={() => void handlePermisChange(String(permis.id))}
                            >
                              <span>{permis.lib_type}</span>
                              <small>
                                {permis.code_type} - {permis.regime}
                              </small>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {detailsLoading && <p className={styles.entryPermitHint}>Chargement des détails...</p>}

                  {effectivePermis && !detailsLoading && (
                    <div className={styles.entryPermitDetails}>
                      <div>
                        <span>Duree initiale</span>
                        <strong>{effectivePermis.duree_initiale} ans</strong>
                      </div>
                      <div>
                        <span>Renouvellements max</span>
                        <strong>{effectivePermis.nbr_renouv_max}</strong>
                      </div>
                      <div>
                        <span>Superficie max</span>
                        <strong>{effectivePermis.superficie_max ? `${effectivePermis.superficie_max} ha` : "Non spécifiée"}</strong>
                      </div>
                    </div>
                  )}

                  <div className={styles.entryPermitActions}>
                    <button
                      type="button"
                      className={styles.entryBackButton}
                      onClick={() => setEntryModalStep("choice")}
                      disabled={submittingEntry}
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      className={styles.entryContinueButton}
                      onClick={() => void handleStartInitialDemande()}
                      disabled={!effectivePermis || submittingEntry || detailsLoading}
                    >
                      {submittingEntry ? "Création..." : "Continuer"}
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className={styles.entryModalFooter}>
              <button
                type="button"
                className={styles.entryDashboardButton}
                onClick={closeEntryModal}
              >
                Annuler et retour au tableau de bord
              </button>
            </div>
          </div>
        </div>
      )}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <button className={styles.brand} type="button" onClick={() => navigate("/investisseur/InvestorDashboard")}>
            <span className={styles.brandMark}>
              <img src="/anamlogo.png" alt="ANAM" className={styles.brandLogo} />
            </span>
            <span className={styles.brandText}>
              <span className={styles.brandKicker}>Republique Algerienne</span>
              <span className={styles.brandTitle}>Ministere des Mines</span>
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
                <span className={styles.userRole}>Entreprise verifiee</span>
              </span>
              <ChevronDown size={16} className={styles.userChevron} />
            </button>
          </div>
        </div>
      </header>

      <DashboardModernBody
        companyName={companyName}
        companyInitials={companyInitials}
        isEntrepriseVerified={Boolean(auth?.isEntrepriseVerified)}
        stats={stats}
        recentRequests={recentRequests}
        recentRequestsLoading={recentRequestsLoading}
        trackReference={trackReference}
        trackLoading={trackLoading}
        trackError={trackError}
        trackedRequest={trackedRequest}
        onTrackReferenceChange={(value) => {
          setTrackReference(value);
          if (trackError) setTrackError(null);
        }}
        onTrackRequest={() => void handleTrackRequest()}
        onNavigate={handleNavigate}
        onOpenNewRequest={() => setEntryChoiceModalOpen(true)}
      />

      <OnboardingTour
        isOpen={showOnboarding}
        steps={DASHBOARD_ONBOARDING_STEPS}
        onClose={handleCloseOnboarding}
        onComplete={handleCompleteOnboarding}
      />
    </div>
  );
}

type DashboardModernBodyProps = {
  companyName: string;
  companyInitials: string;
  isEntrepriseVerified: boolean;
  stats: StatState;
  recentRequests: RecentRequestCard[];
  recentRequestsLoading: boolean;
  trackReference: string;
  trackLoading: boolean;
  trackError: string | null;
  trackedRequest: TrackerResult | null;
  onTrackReferenceChange: (value: string) => void;
  onTrackRequest: () => void;
  onNavigate: (href: string) => void;
  onOpenNewRequest: () => void;
};

function DashboardModernBody({
  companyName,
  companyInitials,
  isEntrepriseVerified,
  stats,
  recentRequests,
  recentRequestsLoading,
  trackReference,
  trackLoading,
  trackError,
  trackedRequest,
  onTrackReferenceChange,
  onTrackRequest,
  onNavigate,
  onOpenNewRequest,
}: DashboardModernBodyProps) {
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const [loadMapFrame, setLoadMapFrame] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const host = mapHostRef.current;
    if (!host || !("IntersectionObserver" in window)) {
      const timer = window.setTimeout(() => setLoadMapFrame(true), 6000);
      return () => window.clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLoadMapFrame(true);
          observer.disconnect();
        }
      },
      { rootMargin: "80px 0px" },
    );

    observer.observe(host);
    const fallbackTimer = window.setTimeout(() => setLoadMapFrame(true), 12000);

    return () => {
      window.clearTimeout(fallbackTimer);
      observer.disconnect();
    };
  }, []);
  const kpis = [
    { label: "Demandes en cours", value: String(stats.demandesEnCours || 17).padStart(2, "0"), hint: "↑ 18% ce mois", tone: "up", icon: FileText },
    { label: "Permis actifs", value: String(stats.permisActifs || 8).padStart(2, "0"), hint: "+1 ce mois", tone: "neutral", icon: ShieldCheck },
    { label: "En instruction", value: "06", hint: "−2 ce mois", tone: "neutral", icon: Clock3 },
    { label: "Approuvées", value: "24", hint: "↑ 5 ce mois", tone: "up", icon: CheckCircle2 },
    { label: "Paiements en attente", value: "2", hint: "125 000 DZD", tone: "warn", icon: WalletCards },
    { label: "Total payé 2025", value: "3,25M", hint: "↑ 22% vs 2024", tone: "up", icon: CreditCard },
  ];

  const requests = recentRequests.length > 0 ? recentRequests : [
    {
      title: "Renouvellement",
      reference: "RNV-TXC-123",
      status: "En cours",
      progress: 65,
      tone: "amber" as const,
      updated: "il y a 1 jour",
    },
    {
      title: "Extension_Sub",
      reference: "EXT-APM-121",
      status: "En cours",
      progress: 65,
      tone: "amber" as const,
      updated: "06/07/2026",
    },
    {
      title: "Demande",
      reference: "TEMP-PEM-1780218229795",
      status: "Complément requis",
      progress: 34,
      tone: "blue" as const,
      updated: "31/05/2026",
    },
  ];

  const currentTracker = trackedRequest ?? {
    reference: "EXT-APM-121",
    title: "Extension_Sub",
    status: "En cours",
    statusTone: "gold" as const,
    lastUpdated: "06/07/2026",
    estimatedRemaining: "Non disponible",
    responsibleService: "Instruction technique",
    nextAction: "Instruction technique en cours - votre dossier est en cours d'analyse par le service compétent.",
    steps: PROCESS_STEPS,
  };

  const quickActions = QUICK_LINKS.filter((item) => item.label !== "Paiements");

  return (
    <main className={styles.modernMain}>
      <section className={styles.modernHero} data-onboarding-id="dashboard-hero">
        <div
          className={styles.modernHeroBackdrop}
          style={{ backgroundImage: `url(${heroDashboardImage})` }}
        />
        <div className={styles.modernHeroOverlay} />
        <div className={styles.modernHeroCompany}>
          <div>
            <strong>{companyName}</strong>
            <span className={isEntrepriseVerified ? styles.modernHeroVerified : styles.modernHeroPending}>
              {isEntrepriseVerified ? "Vérifiée" : "En attente"}
            </span>
            <small>NIF 123456789012345</small>
          </div>
          <b>{companyInitials.slice(0, 1)}</b>
        </div>
        <div className={styles.modernHeroBody}>
          <span>Guichet unique minier</span>
          <h1>
            Toutes vos <em>démarches</em>
            <br />
            minières, <em>en un seul</em>
            <br />
            <em>endroit.</em>
          </h1>
          <p>Simplifiez, suivez et gérez l'ensemble de vos demandes et permis miniers en toute transparence.</p>
          <div className={styles.modernHeroBadges}>
            <strong>100% en ligne</strong>
            <strong>Sécurisé</strong>
            <strong>Paiements sécurisés</strong>
          </div>
          <div className={styles.modernHeroActions}>
            <button type="button" onClick={onOpenNewRequest}>
              <Plus size={16} />
              Nouvelle demande
            </button>
            <button type="button" onClick={() => onNavigate("/investisseur/demandes")}>
              Voir mes demandes
            </button>
          </div>
        </div>
      </section>

      <section className={styles.modernBlock}>
        <div className={styles.modernSectionTitle}>
          <h2>Indicateurs</h2>
          <span>Mis à jour aujourd'hui</span>
        </div>
        <div className={styles.modernKpiRow} data-onboarding-id="dashboard-status">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
            <article key={kpi.label} className={`${styles.modernKpi} ${styles[`modernKpi_${kpi.tone}`]}`}>
              <div className={styles.modernKpiTop}>
                <label>{kpi.label}</label>
                <span><Icon size={15} /></span>
              </div>
              <div className={styles.modernKpiValueRow}>
                <strong>{kpi.value}</strong>
              </div>
              <em className={kpi.tone === "up" ? styles.modernUp : kpi.tone === "warn" ? styles.modernWarn : ""}>{kpi.hint}</em>
            </article>
            );
          })}
        </div>
      </section>

      <section className={styles.modernBlock} data-onboarding-id="dashboard-quick-access">
        <div className={styles.modernSectionTitle}>
          <h2>Accès rapide</h2>
        </div>
        <div className={styles.modernActions}>
          <button
            type="button"
            className={styles.modernActionPrimary}
            data-onboarding-id="dashboard-new-request"
            onClick={onOpenNewRequest}
          >
            <Plus size={15} />
            Nouvelle demande
          </button>
          {quickActions
            .filter((item) => item.label !== "Nouvelle demande")
            .map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  className={styles.modernAction}
                  onClick={() => onNavigate(item.href)}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
        </div>
      </section>

      <section className={styles.modernBlock} data-onboarding-id="dashboard-card-notifications">
        <div className={styles.modernSectionTitle}>
          <h2>Carte minière</h2>
          <span>127 concessions référencées</span>
        </div>
        <div className={styles.modernMapCard}>
          <div className={styles.modernMapInfo}>
            <span className={styles.modernMapEyebrow}>
              <Map size={13} />
              Géologie & ressources
            </span>
            <h3>Carte minière interactive</h3>
            <p>Explorez les zones minières, gisements et titres miniers actifs sur le territoire algérien.</p>
            <div className={styles.modernMapStats}>
              <div><strong>127</strong><span>Concessions</span></div>
              <div><strong>48</strong><span>Zones actives</span></div>
              <div><strong>09</strong><span>Wilayas</span></div>
            </div>
            <button type="button" className={styles.modernMapButton} onClick={() => onNavigate("/carte/carte_public")}>
              Ouvrir la carte
              <ArrowRight size={15} />
            </button>
            <div className={styles.modernMapLegend}>
              <span><i className={styles.dotGold} />Gisements</span>
              <span><i className={styles.dotGreen} />Zones ouvertes</span>
              <span><i className={styles.dotRed} />Zones réservées</span>
              <span><i className={styles.dotBlue} />Mes permis</span>
              <span><i className={styles.dotViolet} />Mes demandes</span>
            </div>
          </div>

          <div className={styles.modernMapCanvas} ref={mapHostRef}>
            {loadMapFrame ? (
              <iframe
                src="https://sig.anam.dz/portal/apps/experiencebuilder/experience?id=fc56f54b45264df2a5f4e07fd2462664"
                className={styles.modernMapIframe}
                title="Carte minière interactive"
                loading="lazy"
                allowFullScreen
              />
            ) : (
              <div className={styles.modernMapDeferred}>
                <Map size={28} />
                <strong>Carte minière prête à charger</strong>
                <span>Le tableau de bord s'affiche d'abord, la carte se charge ensuite.</span>
                <button type="button" onClick={() => setLoadMapFrame(true)}>
                  Charger la carte
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.modernGrid}>
        <div className={styles.modernStack}>
          <section className={styles.modernCard} data-onboarding-id="dashboard-card-demandes">
            <div className={styles.modernCardHead}>
              <h3>Demandes récentes</h3>
              <button type="button" onClick={() => onNavigate("/investisseur/demandes")}>Voir tout</button>
            </div>
            <div className={styles.modernReqList}>
              {recentRequestsLoading && recentRequests.length === 0 ? (
                <div className={styles.modernEmpty}>Chargement des dernières demandes...</div>
              ) : (
                requests.slice(0, 3).map((request) => (
                  <article key={request.reference} className={styles.modernReq}>
                    <div className={styles.modernReqIcon}><FileText size={17} /></div>
                    <div className={styles.modernReqBody}>
                      <strong>{request.title}</strong>
                      <span>Réf. {request.reference} - {request.updated}</span>
                    </div>
                    <div className={styles.modernReqProgress}>
                      <div><i style={{ width: `${request.progress}%` }} /></div>
                      <span>{request.progress}%</span>
                    </div>
                    <span className={request.tone === "amber" ? styles.modernStatusProgress : styles.modernStatusWait}>
                      {request.status}
                    </span>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className={styles.modernCard}>
            <div className={styles.modernCardHead}>
              <h3>Paiements</h3>
              <button type="button" onClick={() => onNavigate("/investisseur/statistiques")}>Voir tout</button>
            </div>
            <div className={styles.modernPayBanner}>
              <div>
                <span>Montant ? r?gler</span>
                <strong>125 000 DZD</strong>
                <small>2 paiement(s) en attente</small>
              </div>
              <button type="button">
                <WalletCards size={15} />
                Payer maintenant
              </button>
            </div>
            <div className={styles.modernPayList}>
              {PAYMENTS.map((payment) => (
                <article key={payment.code} className={styles.modernPayRow}>
                  <div>
                    <strong>{payment.code}</strong>
                    <span>{payment.label}</span>
                  </div>
                  <b>{payment.amount}</b>
                  <em>{payment.status}</em>
                  <span>{payment.date}</span>
                  <button type="button" aria-label={`Télécharger le reçu ${payment.code}`}>
                    <Download size={14} />
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className={styles.modernCard}>
          <div className={styles.modernCardHead}>
            <h3>Suivre une demande</h3>
          </div>
          <div className={styles.modernTrackPad}>
            <div className={styles.modernTrackInput}>
              <input
                value={trackReference}
                placeholder="EXT-APM-121"
                onChange={(event) => onTrackReferenceChange(event.target.value)}
              />
              <button type="button" onClick={onTrackRequest} disabled={trackLoading}>
                {trackLoading ? "Recherche..." : "Suivre"}
              </button>
            </div>
            {trackError && (
              <div className={styles.modernTrackError}>
                <AlertCircle size={15} />
                {trackError}
              </div>
            )}
            <div className={styles.modernLiveTag}><span />Suivi instantan?</div>
            <div className={styles.modernResultCard}>
              <div className={styles.modernResultHead}>
                <div>
                  <strong>{currentTracker.title}</strong>
                  <span>{currentTracker.reference}</span>
                </div>
                <em>{currentTracker.status}</em>
              </div>
              <div className={styles.modernInfoGrid}>
                <div><Clock3 size={14} /><span>Dernière mise à jour</span><strong>{currentTracker.lastUpdated}</strong></div>
                <div><ArrowRight size={14} /><span>Temps restant estimé</span><strong>{currentTracker.estimatedRemaining}</strong></div>
                <div><ShieldCheck size={14} /><span>Service responsable</span><strong>{currentTracker.responsibleService}</strong></div>
                <div><Plus size={14} /><span>Statut actuel</span><strong>{currentTracker.status}</strong></div>
              </div>
              <p>{currentTracker.nextAction}</p>
            </div>
            <div className={styles.modernSteps}>
              {(currentTracker.steps ?? PROCESS_STEPS).map((step, index) => (
                <div
                  key={`${step.label}-${index}`}
                  className={`${styles.modernStep} ${
                    step.state === "done" ? styles.modernStepDone : step.state === "active" ? styles.modernStepActive : ""
                  }`}
                >
                  <span>{step.state === "done" ? "✓" : index + 1}</span>
                  <strong>{step.label}</strong>
                  <small>{step.date}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
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

