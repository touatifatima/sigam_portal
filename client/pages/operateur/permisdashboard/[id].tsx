import { useEffect, useRef, useState, type ElementType } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ArcGISMap, {
  type ArcGISMapRef,
  type Coordinate,
} from "@/components/arcgismap/ArcgisMap";
import {
  ArrowLeft,
  Download,
  Award,
  Building2,
  Search,
  MapPin,
  FileText,
  Map,
  Gem,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  Repeat,
  Edit3,
  GitMerge,
  Scissors,
  ArrowRightLeft,
  HandCoins,
  LogOut,
  Trash2,
  FileCheck,
  Lock,
  DollarSign,
  Eye,
  Gavel,
  FileWarning,
  Scale,
  MessageSquareText,
} from "lucide-react";
import { useAuthReady } from "@/src/hooks/useAuthReady";
import {
  computePermisSuperficie,
  getPermisTitulaireName,
  getPermisWilayaName,
  getPermisDairaName,
  getPermisCommuneName,
  getPermisSubstances,
} from "@/utils/permisHelpers";
import styles from "@/components/wizard/PermisDetails.module.css";
import tabsStyles from "@/components/wizard/DemandeDetails.module.css";
import heroStyles from "./permisDetailHero.module.css";
import EntityMessagesPanel from "@/components/chat/EntityMessagesPanel";
import PerimeterCoordinatesTable from "@/components/perimeter/PerimeterCoordinatesTable";

interface ProcedureItem {
  id?: number | string | null;
  code: string;
  type: string;
  statut: string;
  dateDepot?: string | null;
  dateTraitement?: string | null;
}

interface DocumentItem {
  id?: number | string;
  nom: string;
  type: string;
  taille?: number | null;
  url?: string | null;
  date_upload?: string | null;
  status?: string | null;
  procedureCode?: string | null;
}

interface ObligationItem {
  id?: number | string;
  libelle: string;
  montant: number;
  echeance?: string | null;
  statut: "PAYE" | "EN_ATTENTE" | "EN_RETARD";
}

interface HistoriqueItem {
  id?: number | string;
  code?: string | null;
  type?: string | null;
  date_octroi?: string | null;
  date_expiration?: string | null;
  statut?: string | null;
  detenteur?: string | null;
}

interface ActionRapide {
  id: string;
  label: string;
  icon: ElementType;
  description: string;
  available: boolean;
}

interface FusionCandidate {
  id: number;
  code_permis: string;
  type_label: string;
  titulaire: string;
}

type PermisTabKey =
  | "general"
  | "substances"
  | "procedures"
  | "documents"
  | "obligations"
  | "historique"
  | "actions"
  | "messages";

const apiURL =
  process.env.NEXT_PUBLIC_API_URL ||
  ((typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_API_URL) as string) ||
  "";

const normalizeTypeLabel = (permis: any) =>
  permis?.typePermis?.lib_type ??
  permis?.typePermis?.code_type ??
  permis?.type ??
  "--";

const hasRenouvellementProcedure = (permis: any) => {
  const procedures = Array.isArray(permis?.procedures)
    ? permis.procedures
    : [];
  const rels = Array.isArray(permis?.permisProcedure)
    ? permis.permisProcedure.map((rel: any) => rel?.procedure).filter(Boolean)
    : [];
  const all = [...procedures, ...rels];
  return all.some((proc: any) => {
    const label =
      proc?.typeProcedure?.libelle ??
      proc?.typeProcedure?.label ??
      "";
    const status = String(proc?.statut_proc ?? "").toUpperCase();
    return (
      status === "EN_COURS" &&
      String(label).toLowerCase().includes("renouvel")
    );
  });
};

const deriveStatut = (permis: any) => {
  const exp = permis?.date_expiration ? new Date(permis.date_expiration) : null;
  if (exp && !isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
    return "EXPIRE";
  }
  const lib = String(permis?.statut?.lib_statut ?? "").toLowerCase();
  if (lib.includes("suspend")) return "SUSPENDU";
  if (hasRenouvellementProcedure(permis)) return "EN_RENOUVELLEMENT";
  return "ACTIF";
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return "--";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatShortDate = (value?: string | Date | null) => {
  if (!value) return "--";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("fr-FR");
};

const isTruthyQueryFlag = (value?: string | null) => {
  const normalized = String(value || "").toLowerCase().trim();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "oui";
};

const parsePermisTab = (value?: string | null): PermisTabKey | null => {
  const tab = String(value || "").trim().toLowerCase();
  if (
    tab === "general" ||
    tab === "substances" ||
    tab === "procedures" ||
    tab === "documents" ||
    tab === "obligations" ||
    tab === "historique" ||
    tab === "actions" ||
    tab === "messages"
  ) {
    return tab as PermisTabKey;
  }
  return null;
};

const normalizeStatus = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const parseAreaNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/\s+/g, "").replace(",", ".");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const pickNumericArea = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = parseAreaNumber(value);
    if (parsed !== null && Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

const getDemandeDateScore = (demande: any): number => {
  const raw = demande?.date_demande ?? demande?.created_at ?? demande?.updated_at ?? null;
  if (!raw) return 0;
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? ts : 0;
};

const getDemandeArea = (demande: any): number | null =>
  pickNumericArea(
    demande?.superficie,
    demande?.superficie_ha,
    demande?.superficieHa,
    demande?.surface,
    demande?.superficie_declaree,
    demande?.superficie_cadastrale,
    demande?.superficie_sig,
  );

const resolveSuperficieFromDemandes = (permis: any): number | null => {
  const demandes: any[] = [];

  if (permis?.demande_officielle) {
    demandes.push(permis.demande_officielle);
  }

  if (Array.isArray(permis?.procedures)) {
    permis.procedures.forEach((proc: any) => {
      if (Array.isArray(proc?.demandes)) demandes.push(...proc.demandes);
    });
  }

  if (Array.isArray(permis?.permisProcedure)) {
    permis.permisProcedure.forEach((rel: any) => {
      const proc = rel?.procedure;
      if (Array.isArray(proc?.demandes)) demandes.push(...proc.demandes);
    });
  }

  if (!demandes.length) return null;

  const accepted = demandes.filter((demande) => {
    const status = normalizeStatus(demande?.statut_demande);
    return (
      status === "ACCEPTEE" ||
      status === "ACCEPTE" ||
      status === "VALIDEE" ||
      status === "VALIDE"
    );
  });

  const byRecency = (a: any, b: any) => getDemandeDateScore(b) - getDemandeDateScore(a);

  const acceptedSorted = [...accepted].sort(byRecency);
  for (const demande of acceptedSorted) {
    const area = getDemandeArea(demande);
    if (area != null) return area;
  }

  const allSorted = [...demandes].sort(byRecency);
  for (const demande of allSorted) {
    const area = getDemandeArea(demande);
    if (area != null) return area;
  }

  return null;
};

const getStatutConfig = (statut: string) => {
  const configs = {
    ACTIF: {
      label: "Actif",
      icon: CheckCircle2,
      className: styles.badgeActive,
    },
    EXPIRE: {
      label: "Expiré",
      icon: XCircle,
      className: styles.badgeExpired,
    },
    SUSPENDU: {
      label: "Suspendu",
      icon: AlertTriangle,
      className: styles.badgeSuspended,
    },
    EN_RENOUVELLEMENT: {
      label: "En renouvellement",
      icon: RefreshCw,
      className: styles.badgeRenewal,
    },
  };
  return configs[statut as keyof typeof configs] || configs.ACTIF;
};

const getProcedureStatutConfig = (statut: string) => {
  const configs = {
    TERMINEE: { label: "Terminée", className: styles.procedureSuccess },
    EN_COURS: { label: "En cours", className: styles.procedureWarning },
    REJETEE: { label: "Rejetée", className: styles.procedureDanger },
  };
  return configs[statut as keyof typeof configs] || configs.EN_COURS;
};

const getObligationStatutConfig = (statut: string) => {
  const configs = {
    PAYE: { label: "Payé", icon: CheckCircle2, className: styles.obligationPaid },
    EN_ATTENTE: {
      label: "En attente",
      icon: Clock,
      className: styles.obligationPending,
    },
    EN_RETARD: {
      label: "En retard",
      icon: AlertTriangle,
      className: styles.obligationOverdue,
    },
  };
  return configs[statut as keyof typeof configs] || configs.EN_ATTENTE;
};

const getTypeEmoji = (type: string) => {
  const emojis: Record<string, string> = {
    Exploitation: "⛏️",
    Exploration: "🔍",
    Prospection: "🗺️",
  };
  return emojis[type] || "📄";
};

const resolveObligationStatut = (obligation: any): ObligationItem["statut"] => {
  const raw = String(
    obligation?.statut_paiement ?? obligation?.statut ?? "",
  ).toUpperCase();
  const paidViaPayments = Array.isArray(obligation?.paiements)
    ? obligation.paiements.some((p: any) =>
        String(p?.statut ?? "").toUpperCase().includes("PAY"),
      )
    : false;
  if (raw.includes("PAY") || paidViaPayments) return "PAYE";

  const due = obligation?.date_echeance
    ? new Date(obligation.date_echeance)
    : null;
  if (due && !isNaN(due.getTime()) && due.getTime() < Date.now()) {
    return "EN_RETARD";
  }
  return "EN_ATTENTE";
};

const normalizeProcedureTypeLabel = (value?: string | null) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();

  if (lower.includes("renouvel")) return "Renouvellement";
  if (lower.includes("extension") && lower.includes("substance")) {
    return "Extension substances";
  }
  if (lower.includes("extension") && (lower.includes("perimetre") || lower.includes("périmètre"))) {
    return "Extension périmètre";
  }
  if (lower.includes("extension")) return "Extension";
  if (lower.includes("transfert")) return "Transfert";
  if (lower.includes("cession")) return "Cession";
  if (lower.includes("fusion")) return "Fusion";
  if (lower.includes("division")) return "Division";
  if (lower.includes("renonciation")) return "Renonciation";
  if (lower.includes("annulation")) return "Annulation";
  if (lower.includes("retrait")) return "Retrait";
  if (lower.includes("modification")) return "Modification";
  if (lower.includes("regularisation") || lower.includes("régularisation")) {
    return "Régularisation";
  }
  if (lower.includes("option")) return "Option 2025";
  if (lower.includes("demande")) return "Demande initiale";

  return raw;
};

const resolveProcedureType = (proc: any) => {
  const demandeType =
    proc?.demandes?.[0]?.typeProcedure?.libelle ??
    proc?.demandes?.[0]?.typeProcedure?.label ??
    proc?.demandes?.[0]?.typeProcedure?.code ??
    proc?.demandes?.[0]?.typeProcedure?.code_typeProc ??
    proc?.demandes?.[0]?.typeProcedure?.code_type ??
    null;

  const directType =
    proc?.typeProcedure?.libelle ??
    proc?.typeProcedure?.label ??
    proc?.typeProcedure?.code ??
    proc?.typeProcedure?.code_typeProc ??
    proc?.typeProcedure?.code_type ??
    null;

  const guessedFromCode =
    proc?.num_proc ??
    proc?.code_proc ??
    proc?.code ??
    null;

  const resolved =
    normalizeProcedureTypeLabel(demandeType) ||
    normalizeProcedureTypeLabel(directType) ||
    normalizeProcedureTypeLabel(guessedFromCode);

  return resolved || "Type inconnu";
};

const getProcedureTypeBadgeClass = (type: string) => {
  const t = String(type || "").toLowerCase();
  if (t.includes("renouvel")) return styles.procedureTypeRenewal;
  if (t.includes("extension") && t.includes("substance")) return styles.procedureTypeExtensionSubstances;
  if (t.includes("extension") && (t.includes("perimetre") || t.includes("périmètre"))) {
    return styles.procedureTypeExtensionPerimetre;
  }
  if (t.includes("extension")) return styles.procedureTypeExtension;
  if (t.includes("demande")) return styles.procedureTypeInitiale;
  if (t.includes("transfert")) return styles.procedureTypeTransfert;
  if (t.includes("cession")) return styles.procedureTypeCession;
  if (t.includes("fusion")) return styles.procedureTypeFusion;
  if (t.includes("division")) return styles.procedureTypeDivision;
  if (t.includes("renonciation")) return styles.procedureTypeRenonciation;
  if (t.includes("annulation")) return styles.procedureTypeAnnulation;
  if (t.includes("retrait")) return styles.procedureTypeRetrait;
  if (t.includes("modification")) return styles.procedureTypeModification;
  if (t.includes("regularisation") || t.includes("régularisation")) return styles.procedureTypeRegularisation;
  if (t.includes("option")) return styles.procedureTypeOption;
  return styles.procedureTypeUnknown;
};

const buildProcedures = (permis: any): ProcedureItem[] => {
  const items: ProcedureItem[] = [];
  const pushProcedure = (proc: any, rel?: any) => {
    if (!proc) return;
    const id = proc?.id_proc ?? proc?.id ?? rel?.id_proc ?? null;
    const code =
      proc?.num_proc ??
      proc?.code_proc ??
      proc?.code ??
      proc?.id_proc ??
      proc?.id ??
      "PROC";
    const type = resolveProcedureType(proc);
    const statut = proc?.statut_proc ?? proc?.statut ?? "EN_COURS";
    const dateDepot =
      proc?.date_debut_proc ??
      proc?.date_demande ??
      proc?.created_at ??
      rel?.date_signature ??
      null;
    const dateTraitement = proc?.date_fin_proc ?? null;
    items.push({
      id,
      code: String(code),
      type,
      statut,
      dateDepot,
      dateTraitement,
    });
  };

  if (Array.isArray(permis?.procedures)) {
    permis.procedures.forEach((proc: any) => pushProcedure(proc));
  }
  if (Array.isArray(permis?.permisProcedure)) {
    permis.permisProcedure.forEach((rel: any) =>
      pushProcedure(rel?.procedure, rel),
    );
  }

  const seen = new Set<string>();
  return items.filter((proc) => {
    const key = `${proc.id ?? ""}-${proc.code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const flattenDocuments = (payload: any): DocumentItem[] => {
  const procedures = Array.isArray(payload?.procedures) ? payload.procedures : [];
  const docs = procedures.flatMap((proc: any) => {
    const procCode = proc?.num_proc ?? proc?.id_proc ?? null;
    const list = Array.isArray(proc?.documents) ? proc.documents : [];
    return list.map((doc: any) => ({
      id: doc?.id,
      nom: doc?.nom ?? doc?.description ?? "Document",
      type: doc?.type ?? "PDF",
      taille: typeof doc?.taille === "number" ? doc.taille : null,
      url: doc?.url ?? null,
      date_upload: doc?.date_upload ?? null,
      status: doc?.status ?? null,
      procedureCode: procCode ? String(procCode) : null,
    }));
  });
  return docs;
};

const resolveCoordinatesFromPermis = (permis: any): Coordinate[] => {
  const normalizeStatus = (value: unknown) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();

  const isAcceptedDemande = (demande: any) => {
    const status = normalizeStatus(demande?.statut_demande);
    return (
      status === "ACCEPTEE" ||
      status === "ACCEPTE" ||
      status === "VALIDEE" ||
      status === "VALIDE"
    );
  };

  const parseCoords = (rawList: any[]): Coordinate[] => {
    const parsed: Coordinate[] = [];
    rawList.forEach((item: any, idx: number) => {
      const coord = item?.coordonnee ?? item;
      const x = Number(coord?.x);
      const y = Number(coord?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const zoneRaw = coord?.zone;
      const zone = zoneRaw != null ? Number(zoneRaw) : undefined;
      const hemisphere = coord?.hemisphere === "S" ? "S" : "N";
      parsed.push({
        id: coord?.id_coordonnees ?? coord?.id ?? idx + 1,
        idTitre: coord?.idTitre ?? 1007,
        h: coord?.h ?? 0,
        x,
        y,
        system: (coord?.system as Coordinate["system"]) || "UTM",
        zone,
        hemisphere: hemisphere as "N",
      });
    });
    return parsed;
  };

  if (Array.isArray(permis?.coordonnees_officielles) && permis.coordonnees_officielles.length > 0) {
    return parseCoords(permis.coordonnees_officielles);
  }

  const rels = Array.isArray(permis?.permisProcedure) ? permis.permisProcedure : [];
  const officialProcedure =
    permis?.procedure_officielle ??
    rels
      .map((rel: any) => rel?.procedure)
      .filter((proc: any) => {
        if (!proc) return false;
        if (normalizeStatus(proc?.statut_proc) !== "TERMINEE") return false;
        const demandes = Array.isArray(proc?.demandes) ? proc.demandes : [];
        return demandes.some((demande: any) => isAcceptedDemande(demande));
      })
      .sort((a: any, b: any) => {
        const dateA = new Date(
          a?.date_fin_proc ?? a?.date_debut_proc ?? a?.created_at ?? 0,
        ).getTime();
        const dateB = new Date(
          b?.date_fin_proc ?? b?.date_debut_proc ?? b?.created_at ?? 0,
        ).getTime();
        return dateB - dateA;
      })[0];

  const coordsSource = Array.isArray(officialProcedure?.coordonnees)
    ? officialProcedure.coordonnees
    : [];
  const coords: Coordinate[] = [];

  coordsSource.forEach((item: any, idx: number) => {
    const coord = item?.coordonnee ?? item;
    const x = Number(coord?.x);
    const y = Number(coord?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const zoneRaw = coord?.zone;
    const zone = zoneRaw != null ? Number(zoneRaw) : undefined;
    const hemisphere = coord?.hemisphere === "S" ? "S" : "N";
    coords.push({
      id: coord?.id_coordonnees ?? coord?.id ?? idx + 1,
      idTitre: coord?.idTitre ?? 1007,
      h: coord?.h ?? 0,
      x,
      y,
      system: (coord?.system as Coordinate["system"]) || "UTM",
      zone,
      hemisphere: hemisphere as "N",
    });
  });

  return coords;
};

const actionsRapides: ActionRapide[] = [
  {
    id: "option",
    label: "Option-2025",
    icon: ChevronRight,
    description: "Demander une option sur le périmètre",
    available: true,
  },
  {
    id: "renouvellement",
    label: "Renouvellement",
    icon: Repeat,
    description: "Renouveler le permis avant expiration",
    available: true,
  },
  {
    id: "extension",
    label: "Extension",
    icon: Map,
    description: "Demander une extension du permis",
    available: true,
  },
  {
    id: "modification",
    label: "Modification",
    icon: Edit3,
    description: "Modifier les caractéristiques du permis",
    available: true,
  },
  {
    id: "fusion",
    label: "Fusion",
    icon: GitMerge,
    description: "Fusionner avec un autre permis",
    available: true,
  },
  {
    id: "division",
    label: "Division",
    icon: Scissors,
    description: "Diviser le périmètre en plusieurs permis",
    available: true,
  },
  {
    id: "transfert",
    label: "Transfert",
    icon: ArrowRightLeft,
    description: "Transférer le permis à un tiers",
    available: true,
  },
  {
    id: "cession",
    label: "Cession",
    icon: HandCoins,
    description: "Céder les droits du permis",
    available: true,
  },
  {
    id: "renonciation",
    label: "Renonciation",
    icon: LogOut,
    description: "Renoncer au permis",
    available: true,
  },
  {
    id: "retrait",
    label: "Retrait",
    icon: Trash2,
    description: "Demander le retrait du permis",
    available: false,
  },
  {
    id: "regularisation",
    label: "Régularisation",
    icon: FileCheck,
    description: "Régulariser une situation",
    available: true,
  },
];

const PermisDetailsOperateur = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isAuthReady = useAuthReady();
  const mapRef = useRef<ArcGISMapRef | null>(null);
  const messagesSectionRef = useRef<HTMLDivElement | null>(null);

  const [permis, setPermis] = useState<any | null>(null);
  const [procedures, setProcedures] = useState<ProcedureItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [obligations, setObligations] = useState<ObligationItem[]>([]);
  const [historique, setHistorique] = useState<HistoriqueItem[]>([]);
  const [substances, setSubstances] = useState<string[]>([]);
  const [perimetrePoints, setPerimetrePoints] = useState<Coordinate[]>([]);
  const [perimetreZone, setPerimetreZone] = useState<number | undefined>(undefined);
  const [perimetreHemisphere, setPerimetreHemisphere] = useState<"N" | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<PermisTabKey>("general");
  const [autoFocusMessagesComposer, setAutoFocusMessagesComposer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);
  const [fusionModalOpen, setFusionModalOpen] = useState(false);
  const [fusionLoadingCandidates, setFusionLoadingCandidates] = useState(false);
  const [fusionCandidates, setFusionCandidates] = useState<FusionCandidate[]>([]);
  const [fusionSearch, setFusionSearch] = useState("");
  const [selectedFusionPermisId, setSelectedFusionPermisId] = useState<number | null>(null);
  const [fusionPrincipalId, setFusionPrincipalId] = useState<number | null>(null);
  const [fusionMotif, setFusionMotif] = useState("");
  const [fusionEligibility, setFusionEligibility] = useState<{
    ok: boolean;
    message: string;
    sharedBoundary: number;
    areaHa: number;
  } | null>(null);
  const [fusionChecking, setFusionChecking] = useState(false);
  const [fusionSubmitting, setFusionSubmitting] = useState(false);
  const [fusionExistingProcedureId, setFusionExistingProcedureId] = useState<number | null>(null);

  const startProcedureFlow = async (
    actionId: "renouvellement" | "extension" | "extension_substance",
  ) => {
    const permisId = Number(permis?.id ?? id);
    if (!Number.isFinite(permisId)) {
      toast.error("Permis invalide pour démarrer la procédure.");
      return;
    }
    if (!apiURL) {
      toast.error("API URL manquante.");
      return;
    }

    try {
      const startPath =
        actionId === 'extension'
          ? `${apiURL}/api/procedures/extension/start`
          : actionId === 'extension_substance'
            ? `${apiURL}/api/procedures/extension-substance/start`
            : `${apiURL}/api/procedures/renouvellement/start`;
      const nextPath =
        actionId === 'extension'
          ? `/operateur/extention/step1/page1?id=`
          : actionId === 'extension_substance'
            ? `/operateur/extention_substance/step1/page1?id=`
            : `/operateur/renouvellement/step1/page1?id=`;

      const res = await axios.post(
        startPath,
        {
          permisId,
          date_demande: new Date().toISOString(),
        },
        { withCredentials: true },
      );
      const newProcId = res?.data?.new_proc_id;
      if (!newProcId) {
        toast.error("Impossible de démarrer la procédure.");
        return;
      }
      navigate(`${nextPath}${newProcId}&permisId=${permisId}`);
    } catch (err: any) {
      console.error("Erreur demarrage procedure", err);
      const msg =
        err?.response?.data?.message ||
        "Erreur lors du démarrage de la procedure.";
      toast.error(msg);
    }
  };

  const openFusionModal = async () => {
    const currentPermisId = Number(permis?.id ?? id);
    if (!Number.isFinite(currentPermisId)) {
      toast.error("Permis invalide.");
      return;
    }
    if (!apiURL) {
      toast.error("API URL manquante.");
      return;
    }

    setFusionModalOpen(true);
    setFusionSearch("");
    setFusionCandidates([]);
    setSelectedFusionPermisId(null);
    setFusionPrincipalId(currentPermisId);
    setFusionMotif("");
    setFusionEligibility(null);
    setFusionExistingProcedureId(null);

    setFusionLoadingCandidates(true);
    try {
      const res = await axios.get(`${apiURL}/operateur/permis`, {
        withCredentials: true,
      });
      const raw = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      const currentDetenteurId =
        Number(permis?.id_detenteur ?? permis?.detenteur?.id_detenteur) || null;

      const mapped: FusionCandidate[] = raw
        .filter((p: any) => Number(p?.id) !== currentPermisId)
        .filter((p: any) => {
          if (!currentDetenteurId) return true;
          const detenteurId = Number(p?.id_detenteur ?? p?.detenteur?.id_detenteur);
          return Number.isFinite(detenteurId) && detenteurId === currentDetenteurId;
        })
        .map((p: any) => ({
          id: Number(p.id),
          code_permis: String(p.code_permis ?? p.code ?? `PERMIS-${p.id}`),
          type_label: String(
            p?.typePermis?.lib_type ?? p?.typePermis?.code_type ?? p?.type ?? "--",
          ),
          titulaire: String(
            p?.detenteur?.nom_societeFR ??
              p?.detenteur?.nom_societeAR ??
              getPermisTitulaireName(p) ??
              "--",
          ),
        }));

      setFusionCandidates(mapped);
      if (mapped.length > 0) {
        setSelectedFusionPermisId(mapped[0].id);
      } else {
        setFusionEligibility({
          ok: false,
          message: "Aucun permis éligible trouvé pour la fusion (même détenteur).",
          sharedBoundary: 0,
          areaHa: 0,
        });
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        "Impossible de charger les permis du détenteur.";
      setFusionEligibility({
        ok: false,
        message: String(msg),
        sharedBoundary: 0,
        areaHa: 0,
      });
    } finally {
      setFusionLoadingCandidates(false);
    }
  };

  const checkFusionEligibility = async (candidatePermisId: number) => {
    const currentPermisId = Number(permis?.id ?? id);
    if (!Number.isFinite(currentPermisId) || !Number.isFinite(candidatePermisId) || !apiURL) return;

    setFusionChecking(true);
    setFusionEligibility(null);
    setFusionExistingProcedureId(null);
    try {
      const existing = await axios.get(`${apiURL}/api/fusion-permis/check`, {
        withCredentials: true,
        params: {
          id_principal: currentPermisId,
          id_secondaire: candidatePermisId,
        },
      });
      if (existing?.data?.exists) {
        setFusionExistingProcedureId(Number(existing.data.id_procedure || 0) || null);
        setFusionEligibility({
          ok: false,
          message:
            "Une fusion en cours existe déjà pour au moins un de ces permis. Veuillez la terminer d'abord.",
          sharedBoundary: 0,
          areaHa: 0,
        });
        return;
      }

      const res = await axios.post(
        `${apiURL}/api/fusion-permis/union`,
        {
          id_permis_A: currentPermisId,
          id_permis_B: candidatePermisId,
        },
        { withCredentials: true },
      );
      const data = res?.data || {};
      setFusionEligibility({
        ok: !!data?.success,
        message: String(
          data?.message ||
            (data?.success
              ? "Fusion possible : frontière commune valide."
              : "Fusion impossible pour ces deux permis."),
        ),
        sharedBoundary: Number(data?.shared_boundary_m || 0),
        areaHa: Number(data?.area_ha || 0),
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        "Erreur lors de la vérification de la contiguïté (100 m).";
      setFusionEligibility({
        ok: false,
        message: String(msg),
        sharedBoundary: 0,
        areaHa: 0,
      });
    } finally {
      setFusionChecking(false);
    }
  };

  const handleStartFusion = async () => {
    const currentPermisId = Number(permis?.id ?? id);
    if (!Number.isFinite(currentPermisId) || !Number.isFinite(selectedFusionPermisId || NaN) || !apiURL) {
      toast.error("Paramètres de fusion invalides.");
      return;
    }
    if (!fusionEligibility?.ok) {
      toast.warning("Fusion non éligible. Vérifiez la frontière commune.");
      return;
    }

    const principal = Number(fusionPrincipalId || currentPermisId);
    const secondary =
      principal === currentPermisId ? Number(selectedFusionPermisId) : currentPermisId;

    setFusionSubmitting(true);
    try {
      const res = await axios.post(
        `${apiURL}/api/fusion-permis/fusionner`,
        {
          id_principal: principal,
          id_secondaire: secondary,
          motif_fusion: fusionMotif || "",
        },
        { withCredentials: true },
      );

      const newProcId = Number(res?.data?.id_procedure);
      if (!Number.isFinite(newProcId) || newProcId <= 0) {
        throw new Error("Procédure de fusion introuvable après création.");
      }

      setFusionModalOpen(false);
      toast.success("Procédure de fusion créée.");
      navigate(
        `/operateur/fusion_permis/step1/page1?id=${newProcId}&permisA=${currentPermisId}&permisB=${selectedFusionPermisId}&principal=${principal}`,
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        "Impossible de démarrer la procédure de fusion.";
      toast.error(String(msg));
    } finally {
      setFusionSubmitting(false);
    }
  };

  const handleActionClick = async (actionId: string) => {
    if (actionId === "extension") {
      setExtensionModalOpen(true);
      return;
    }

    if (actionId === "fusion") {
      await openFusionModal();
      return;
    }

    if (actionId === "transfert") {
      const permisId = Number(permis?.id ?? id);
      if (!Number.isFinite(permisId)) {
        toast.error("Permis invalide.");
        return;
      }
      navigate(`/operateur/transfert/step1/page1?permisId=${permisId}`);
      return;
    }

    if (actionId === "cession") {
      const permisId = Number(permis?.id ?? id);
      if (!Number.isFinite(permisId)) {
        toast.error("Permis invalide.");
        return;
      }
      navigate(`/operateur/cession/step1/page1?permisId=${permisId}`);
      return;
    }

    if (actionId !== "renouvellement") {
      navigate(`/operateur/procedure/${actionId}/${permis?.id ?? id}`);
      return;
    }

    await startProcedureFlow("renouvellement");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    const requestedTab = parsePermisTab(search.get("tab"));
    if (requestedTab) {
      setActiveTab(requestedTab);
    }
    const hasFocusMessage = Number(search.get("focusMessageId") || 0) > 0;
    setAutoFocusMessagesComposer(
      isTruthyQueryFlag(search.get("focusComposer")) || hasFocusMessage,
    );
  }, [id]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!apiURL) {
        setError("API URL manquante");
        setLoading(false);
        return;
      }
      if (!id) {
        setError("Permis invalide");
        setLoading(false);
        return;
      }
      const permisRouteKey = String(id).trim();
      if (!permisRouteKey) {
        setError("Permis invalide");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const [permisRes, docsRes, obligationsRes, historiqueRes] = await Promise.all([
          axios.get(`${apiURL}/operateur/permis/${encodeURIComponent(permisRouteKey)}`, {
            withCredentials: true,
          }),
          axios
            .get(`${apiURL}/operateur/permis/${encodeURIComponent(permisRouteKey)}/documents`, {
              withCredentials: true,
            })
            .catch(() => ({ data: null })),
          axios
            .get(
              `${apiURL}/operateur/permis/${encodeURIComponent(permisRouteKey)}/obligations`,
              { withCredentials: true },
            )
            .catch(() => ({ data: [] })),
          axios
            .get(
              `${apiURL}/operateur/permis/${encodeURIComponent(permisRouteKey)}/historique`,
              { withCredentials: true },
            )
            .catch(() => ({ data: [] })),
        ]);

        if (!active) return;

        const permisData = permisRes?.data ?? null;
        setPermis(permisData);

        setProcedures(buildProcedures(permisData));
        setSubstances(getPermisSubstances(permisData));

        const coords = resolveCoordinatesFromPermis(permisData);
        setPerimetrePoints(coords);
        const zone = coords.find((p) => Number.isFinite(p.zone as any))?.zone;
        const hem = coords.find((p) => p.hemisphere)?.hemisphere;
        setPerimetreZone(zone);
        setPerimetreHemisphere(hem === "N" ? "N" : undefined);

        const docs = flattenDocuments(docsRes?.data ?? docsRes);
        setDocuments(docs);

        const obligationsRaw = Array.isArray(obligationsRes?.data)
          ? obligationsRes.data
          : [];
        const mappedObligations = obligationsRaw.map((item: any) => {
          const montant = Number(item?.montant ?? item?.montant_du ?? item?.montant_a_payer ?? 0);
          return {
            id: item?.id_obligation ?? item?.id,
            libelle:
              item?.libelle ??
              item?.typePaiement?.libelle ??
              item?.typePaiement?.code_paiement ??
              "Obligation fiscale",
            montant: Number.isFinite(montant) ? montant : 0,
            echeance: item?.date_echeance ?? item?.dateEcheance ?? null,
            statut: resolveObligationStatut(item),
          } as ObligationItem;
        });
        setObligations(mappedObligations);

        const historiqueRaw = Array.isArray(historiqueRes?.data)
          ? historiqueRes.data
          : [];
        setHistorique(historiqueRaw);
      } catch (err) {
        console.error("Erreur chargement permis", err);
        if (!active) return;
        setError("Impossible de charger le permis.");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    if (isAuthReady) {
      load();
    }

    return () => {
      active = false;
    };
  }, [id, isAuthReady]);

  useEffect(() => {
    if (perimetrePoints.length < 3) return;
    const timer = window.setTimeout(() => {
      mapRef.current?.zoomToCurrentPolygon?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [perimetrePoints]);

  useEffect(() => {
    if (activeTab !== "messages") return;
    if (!messagesSectionRef.current) return;
    const timer = window.setTimeout(() => {
      messagesSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [activeTab]);

  const statutValue = permis ? deriveStatut(permis) : "ACTIF";
  const statutConfig = getStatutConfig(statutValue);
  const StatusIcon = statutConfig.icon;
  const rawStatut = String(permis?.statut?.lib_statut ?? "").toLowerCase();
  const extensionEligible =
    statutValue !== "EXPIRE" &&
    statutValue !== "EN_RENOUVELLEMENT" &&
    !rawStatut.includes("annul") &&
    !rawStatut.includes("revoq") &&
    !rawStatut.includes("retir");
  const fusionEligible = extensionEligible;

  const typeLabel = permis ? normalizeTypeLabel(permis) : "--";
  const titulaireLabel =
    (permis && (getPermisTitulaireName(permis) || permis?.detenteur?.nom_societeFR)) ||
    "--";
  const wilayaLabel = (permis && getPermisWilayaName(permis)) || "--";
  const dairaLabel = (permis && getPermisDairaName(permis)) || "--";
  const communeLabel = (permis && getPermisCommuneName(permis)) || "--";
  const superficieValue = permis
    ? pickNumericArea(
        computePermisSuperficie(permis),
        permis?.superficie,
        permis?.superficie_officielle,
        permis?.superficie_ha,
        permis?.superficieHa,
        permis?.surface,
        permis?.surface_totale,
        permis?.demande_officielle?.superficie,
        permis?.demande_officielle?.superficie_ha,
        permis?.demande_officielle?.surface,
        resolveSuperficieFromDemandes(permis),
      )
    : null;
  const superficieLabel =
    typeof superficieValue === "number" ? `${superficieValue.toFixed(2)} ha` : "--";

  const dateOctroi =
    permis?.date_octroi_effective ??
    permis?.date_octroi ??
    permis?.date_octroi_proc ??
    permis?.date_signature ??
    null;
  const dateExpiration = permis?.date_expiration ?? null;

  const totalObligations = obligations.reduce((sum, o) => sum + o.montant, 0);
  const totalPaye = obligations
    .filter((o) => o.statut === "PAYE")
    .reduce((sum, o) => sum + o.montant, 0);
  const totalEnAttente = obligations
    .filter((o) => o.statut === "EN_ATTENTE")
    .reduce((sum, o) => sum + o.montant, 0);
  const totalEnRetard = obligations
    .filter((o) => o.statut === "EN_RETARD")
    .reduce((sum, o) => sum + o.montant, 0);

  const filteredFusionCandidates = fusionCandidates.filter((candidate) => {
    const q = fusionSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      candidate.code_permis.toLowerCase().includes(q) ||
      candidate.type_label.toLowerCase().includes(q) ||
      candidate.titulaire.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (!fusionModalOpen || !selectedFusionPermisId) return;
    void checkFusionEligibility(selectedFusionPermisId);
  }, [fusionModalOpen, selectedFusionPermisId]);

  if (loading) {
    return (
      <InvestorLayout>
        <div className={styles.container}>
          <div className={tabsStyles.loadingState}>
            <RefreshCw className="w-8 h-8 animate-spin" />
            <p>Chargement du permis...</p>
          </div>
        </div>
      </InvestorLayout>
    );
  }

  if (error || !permis) {
    return (
      <InvestorLayout>
        <div className={styles.container}>
          <div className={tabsStyles.errorState}>
            <FileWarning className="w-10 h-10" />
            <h2>Permis introuvable</h2>
            <p>{error || "Aucune information disponible."}</p>
            <Button onClick={() => navigate("/operateur/permisdashboard/mes-permis")}>
              Retour à la liste
            </Button>
          </div>
        </div>
      </InvestorLayout>
    );
  }

  return (
    <InvestorLayout>
      <div className={styles.container}>
        <div className={`${styles.heroHeader} ${heroStyles.heroHeader}`}>
          <div className={`${styles.heroContent} ${heroStyles.heroContent}`}>
            <div className={`${styles.heroNav} ${heroStyles.heroNav}`}>
              <Button
                variant="ghost"
                className={`${styles.backBtn} ${heroStyles.backBtn}`}
                onClick={() => navigate("/operateur/permisdashboard/mes-permis")}
              >
                <ArrowLeft className="w-4 h-4" />
                Retour à la liste
              </Button>
              <Button className={`${styles.downloadBtn} ${heroStyles.downloadBtn}`}>
                <Download className="w-4 h-4" />
                Télécharger le permis (PDF)
              </Button>
            </div>

            <div className={styles.heroInfo}>
              <div className={styles.heroIcon}>{getTypeEmoji(typeLabel)}</div>
              <div className={styles.heroText}>
                <h1 className={styles.heroCode}>{permis?.code_permis ?? permis?.code ?? "--"}</h1>
                <div className={styles.heroMeta}>
                  <span className={styles.heroType}>
                    <Award className="w-4 h-4" />
                    Permis de {typeLabel}
                  </span>
                  <span className={`${styles.heroBadge} ${statutConfig.className}`}>
                    <StatusIcon className="w-4 h-4" />
                    {statutConfig.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.mainContent}>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(parsePermisTab(value) || "general")}
            className={tabsStyles.tabs}
          >
            <TabsList className={tabsStyles.tabsList}>
              <TabsTrigger value="general" className={tabsStyles.tabTrigger}>
                <Eye className="w-4 h-4" />
                <span>Aperçu</span>
              </TabsTrigger>
              <TabsTrigger value="substances" className={tabsStyles.tabTrigger}>
                <Gem className="w-4 h-4" />
                <span>Substances</span>
              </TabsTrigger>
              <TabsTrigger value="procedures" className={tabsStyles.tabTrigger}>
                <Gavel className="w-4 h-4" />
                <span>Procédures liées</span>
              </TabsTrigger>
              <TabsTrigger value="documents" className={tabsStyles.tabTrigger}>
                <FileText className="w-4 h-4" />
                <span>Documents associés</span>
              </TabsTrigger>
              <TabsTrigger value="obligations" className={tabsStyles.tabTrigger}>
                <DollarSign className="w-4 h-4" />
                <span>Obligations fiscales</span>
              </TabsTrigger>
              <TabsTrigger value="historique" className={tabsStyles.tabTrigger}>
                <Clock className="w-4 h-4" />
                <span>Historique & Renouvellements</span>
              </TabsTrigger>
              <TabsTrigger value="actions" className={tabsStyles.tabTrigger}>
                <Scale className="w-4 h-4" />
                <span>Actions rapides</span>
              </TabsTrigger>
              <TabsTrigger value="messages" className={tabsStyles.tabTrigger}>
                <MessageSquareText className="w-4 h-4" />
                <span>Commentaires / Messages</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className={tabsStyles.tabContent}>
              <div className={styles.sectionGrid}>
                <div className={styles.infoCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Informations générales</h2>
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Code permis</span>
                        <span className={styles.infoValue}>{permis?.code_permis ?? permis?.code ?? "--"}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Type</span>
                        <span className={styles.infoValue}>{typeLabel}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Titulaire</span>
                        <span className={styles.infoValue}>{titulaireLabel}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Statut</span>
                        <span className={styles.infoValue}>{statutConfig.label}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Date d'octroi</span>
                        <span className={styles.infoValue}>{formatShortDate(dateOctroi)}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Date d'expiration</span>
                        <span className={styles.infoValue}>{formatShortDate(dateExpiration)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.infoCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <MapPin className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Localisation</h2>
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Wilaya</span>
                        <span className={styles.infoValue}>{wilayaLabel}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Daïra</span>
                        <span className={styles.infoValue}>{dairaLabel}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Commune</span>
                        <span className={styles.infoValue}>{communeLabel}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Lieu-dit</span>
                        <span className={styles.infoValue}>{permis?.lieu_ditFR ?? "--"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`${styles.infoCard} ${styles.sectionFull}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <Map className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Superficie & Périmètre</h2>
                  </div>
                  <div className={styles.cardContent}>
                    <div style={{ marginBottom: "1rem" }}>
                      <span className={styles.infoLabel}>Superficie totale</span>
                      <span className={styles.infoValueLarge}>{superficieLabel}</span>
                    </div>
                    <div className={tabsStyles.mapFrame}>
                      {perimetrePoints.length >= 3 ? (
                        <div className={tabsStyles.mapCanvas}>
                          <ArcGISMap
                            ref={mapRef}
                            points={perimetrePoints}
                            superficie={0}
                            isDrawing={false}
                            coordinateSystem="UTM"
                            utmZone={perimetreZone}
                            utmHemisphere={perimetreHemisphere ?? "N"}
                            editable={false}
                            disableEnterpriseLayers
                          />
                          <div className={tabsStyles.simpleLegend}>
                            <span className={tabsStyles.legendSwatch} />
                            <span>Votre périmètre</span>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.mapPlaceholder}>
                          <MapPin className="w-8 h-8" />
                          <p>Aucun périmètre disponible</p>
                        </div>
                      )}
                    </div>
                    <PerimeterCoordinatesTable
                      points={perimetrePoints}
                      title="Coordonnees du perimetre"
                      emptyMessage="Aucun perimetre defini pour ce permis."
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="substances" className={tabsStyles.tabContent}>
              <div className={styles.sectionGrid}>
                <div className={`${styles.infoCard} ${styles.sectionFull}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <Gem className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Substances minières</h2>
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.substancesList}>
                      {substances.length > 0 ? (
                        substances.map((sub, index) => (
                          <span key={index} className={styles.substanceBadge}>
                            {sub}
                          </span>
                        ))
                      ) : (
                        <span className={styles.emptyText}>Aucune substance renseignée.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="procedures" className={tabsStyles.tabContent}>
              <div className={styles.sectionGrid}>
                <div className={`${styles.infoCard} ${styles.sectionFull}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <Gavel className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Procédures liées</h2>
                  </div>
                  <div className={styles.cardContent}>
                    {procedures.length > 0 ? (
                      <div className={styles.proceduresList}>
                        {procedures.map((proc, index) => {
                          const procStatut = getProcedureStatutConfig(proc.statut);
                          return (
                            <div key={index} className={styles.procedureItem}>
                              <div className={styles.procedureInfo}>
                                <div className={styles.procedureCode}>{proc.code}</div>
                                <div className={styles.procedureType}>
                                  <span className={`${styles.procedureTypeBadge} ${getProcedureTypeBadgeClass(proc.type)}`}>
                                    {proc.type}
                                  </span>
                                </div>
                                <div className={styles.procedureDates}>
                                  <span>Dépôt: {formatShortDate(proc.dateDepot)}</span>
                                  {proc.dateTraitement && (
                                    <span> • Traité: {formatShortDate(proc.dateTraitement)}</span>
                                  )}
                                </div>
                              </div>
                              <span className={`${styles.procedureBadge} ${procStatut.className}`}>
                                {procStatut.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className={styles.emptyText}>Aucune procédure liée à ce permis.</p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="documents" className={tabsStyles.tabContent}>
              <div className={styles.sectionGrid}>
                <div className={`${styles.infoCard} ${styles.sectionFull}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Documents associés</h2>
                  </div>
                  <div className={styles.cardContent}>
                    {documents.length > 0 ? (
                      <div className={styles.documentsList}>
                        {documents.map((doc, index) => {
                          const status = String(doc.status ?? "").toLowerCase();
                          const validated = status.includes("valide") || status.includes("present");
                          const badgeClass = validated ? styles.docValidated : styles.docPending;
                          const fileUrl = doc.url
                            ? doc.url.startsWith("http")
                              ? doc.url
                              : `${apiURL}${doc.url}`
                            : null;

                          return (
                            <div key={index} className={styles.documentItem}>
                              <div className={styles.documentIcon}>
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className={styles.documentInfo}>
                                <p className={styles.documentName}>{doc.nom}</p>
                                <span className={styles.documentMeta}>
                                  {doc.type} • {doc.taille ? `${doc.taille} KB` : "--"} • {formatShortDate(doc.date_upload)}
                                </span>
                                {doc.procedureCode && (
                                  <span className={styles.documentMeta}>Procédure {doc.procedureCode}</span>
                                )}
                              </div>
                              <span className={`${styles.docStatusBadge} ${badgeClass}`}>
                                {validated ? "Validé" : doc.status || "En attente"}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={styles.documentDownload}
                                onClick={() => fileUrl && window.open(fileUrl, "_blank")}
                                disabled={!fileUrl}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className={styles.emptyText}>Aucun document associé.</p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="obligations" className={tabsStyles.tabContent}>
              <div className={styles.sectionGrid}>
                <div className={`${styles.infoCard} ${styles.sectionFull}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Obligations fiscales</h2>
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.fiscalStats}>
                      <div className={styles.fiscalStatCard}>
                        <span className={styles.fiscalStatLabel}>Total</span>
                        <span className={styles.fiscalStatValue}>
                          {totalObligations.toLocaleString("fr-FR")} DA
                        </span>
                      </div>
                      <div className={`${styles.fiscalStatCard} ${styles.fiscalPaid}`}>
                        <span className={styles.fiscalStatLabel}>Payé</span>
                        <span className={styles.fiscalStatValue}>
                          {totalPaye.toLocaleString("fr-FR")} DA
                        </span>
                      </div>
                      <div className={`${styles.fiscalStatCard} ${styles.fiscalPending}`}>
                        <span className={styles.fiscalStatLabel}>En attente</span>
                        <span className={styles.fiscalStatValue}>
                          {totalEnAttente.toLocaleString("fr-FR")} DA
                        </span>
                      </div>
                      <div className={`${styles.fiscalStatCard} ${styles.fiscalOverdue}`}>
                        <span className={styles.fiscalStatLabel}>En retard</span>
                        <span className={styles.fiscalStatValue}>
                          {totalEnRetard.toLocaleString("fr-FR")} DA
                        </span>
                      </div>
                    </div>

                    <div className={styles.fiscalProgress}>
                      <div className={styles.fiscalProgressHeader}>
                        <span>Progression des paiements</span>
                        <span>
                          {totalObligations > 0
                            ? Math.round((totalPaye / totalObligations) * 100)
                            : 0}
                          %
                        </span>
                      </div>
                      <Progress
                        value={
                          totalObligations > 0
                            ? (totalPaye / totalObligations) * 100
                            : 0
                        }
                        className={styles.progressBar}
                      />
                    </div>

                    <div className={styles.obligationsTable}>
                      <div className={styles.tableHeader}>
                        <span>Libellé</span>
                        <span>Montant</span>
                        <span>Échéance</span>
                        <span>Statut</span>
                        <span>Action</span>
                      </div>
                      {obligations.length > 0 ? (
                        obligations.map((obligation, index) => {
                          const obligStatut = getObligationStatutConfig(obligation.statut);
                          const ObligIcon = obligStatut.icon;
                          return (
                            <div key={index} className={styles.tableRow}>
                              <span className={styles.tableCellLibelle}>{obligation.libelle}</span>
                              <span className={styles.tableCellMontant}>
                                {obligation.montant.toLocaleString("fr-FR")} DA
                              </span>
                              <span className={styles.tableCellEcheance}>
                                {formatShortDate(obligation.echeance)}
                              </span>
                              <span className={`${styles.tableCellStatut} ${obligStatut.className}`}>
                                <ObligIcon className="w-3.5 h-3.5" />
                                {obligStatut.label}
                              </span>
                              <span className={styles.tableCellAction}>
                                {obligation.statut !== "PAYE" && (
                                  <Button size="sm" className={styles.payBtn}>
                                    Payer
                                  </Button>
                                )}
                                {obligation.statut === "PAYE" && (
                                  <Button variant="ghost" size="sm" className={styles.receiptBtn}>
                                    <Eye className="w-4 h-4" />
                                    Reçu
                                  </Button>
                                )}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className={styles.tableRow}>
                          <span className={styles.emptyText}>Aucune obligation enregistrée.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="historique" className={tabsStyles.tabContent}>
              <div className={styles.sectionGrid}>
                <div className={`${styles.infoCard} ${styles.sectionFull}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <Clock className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Historique & Renouvellements</h2>
                  </div>
                  <div className={styles.cardContent}>
                    {historique.length > 0 ? (
                      <div className={styles.timeline}>
                        {historique.map((event, index) => (
                          <div key={index} className={styles.timelineItem}>
                            <div className={styles.timelineDot} />
                            <div className={styles.timelineContent}>
                              <h4 className={styles.timelineTitle}>
                                {event.type || "Permis"}
                              </h4>
                              <p className={styles.timelineDate}>
                                {formatDate(event.date_octroi || event.date_expiration)}
                              </p>
                              <p className={styles.timelineDescription}>
                                {event.statut || "Statut non renseigné"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.emptyText}>Aucun historique disponible.</p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="actions" className={tabsStyles.tabContent}>
              <div className={styles.sectionGrid}>
                <div className={`${styles.infoCard} ${styles.sectionFull}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <Scale className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Actions rapides</h2>
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.actionsGrid}>
                      {actionsRapides.map((action) => {
                        const ActionIcon = action.icon;
                        const isExtensionAction = action.id === "extension";
                        const isFusionAction = action.id === "fusion";
                        const available = isExtensionAction
                          ? extensionEligible
                          : isFusionAction
                          ? fusionEligible
                          : action.available;
                        const actionTitle = isExtensionAction && !available
                          ? "Extension non disponible pour ce statut"
                          : isFusionAction && !available
                          ? "Fusion non disponible pour ce statut"
                          : action.description;
                        return (
                          <button
                            key={action.id}
                            className={`${styles.actionBtn} ${!available ? styles.actionDisabled : ""}`}
                            disabled={!available}
                            onClick={() => available && handleActionClick(action.id)}
                            title={actionTitle}
                          >
                            <div className={styles.actionIconWrapper}>
                              <ActionIcon className="w-5 h-5" />
                            </div>
                            <span className={styles.actionLabel}>{action.label}</span>
                            {!available && (
                              <span className={styles.actionRestricted}>
                                <Lock className="w-3 h-3" />
                                Accès restreint
                              </span>
                            )}
                            {available && <ChevronRight className={styles.actionArrow} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="messages" className={tabsStyles.tabContent}>
              <div className={styles.sectionGrid} id="messages-section" ref={messagesSectionRef}>
                <div className={`${styles.infoCard} ${styles.sectionFull}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <MessageSquareText className="w-5 h-5" />
                    </div>
                    <h2 className={styles.cardTitle}>Commentaires / Messages</h2>
                  </div>
                  <div className={styles.cardContent}>
                    <EntityMessagesPanel
                      entityType="permis"
                      entityCode={permis?.code_permis ?? permis?.code ?? String(id || "")}
                      autoFocusComposer={autoFocusMessagesComposer}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {extensionModalOpen && (
        <div className={styles.extensionModalOverlay} onClick={() => setExtensionModalOpen(false)}>
          <div className={styles.extensionModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.extensionModalHeader}>
              <h3>Choisir le type d&apos;extension</h3>
              <p>Sélectionnez le mode d&apos;extension à lancer pour ce permis.</p>
            </div>
            <div className={styles.extensionOptions}>
              <button
                type="button"
                className={styles.extensionOptionCard}
                onClick={async () => {
                  setExtensionModalOpen(false);
                  await startProcedureFlow("extension");
                }}
              >
                <div className={styles.extensionOptionIcon}>
                  <Map className="w-5 h-5" />
                </div>
                <div className={styles.extensionOptionBody}>
                  <h4>Extension du périmètre</h4>
                  <p>Augmenter la surface du permis.</p>
                </div>
                <ChevronRight className={styles.extensionOptionArrow} />
              </button>

              <button
                type="button"
                className={styles.extensionOptionCard}
                onClick={async () => {
                  setExtensionModalOpen(false);
                  await startProcedureFlow("extension_substance");
                }}
              >
                <div className={styles.extensionOptionIcon}>
                  <Gem className="w-5 h-5" />
                </div>
                <div className={styles.extensionOptionBody}>
                  <h4>Extension des substances</h4>
                  <p>Ajouter ou modifier les substances exploitées.</p>
                </div>
                <ChevronRight className={styles.extensionOptionArrow} />
              </button>
            </div>
            <div className={styles.extensionModalFooter}>
              <Button
                variant="outline"
                type="button"
                onClick={() => setExtensionModalOpen(false)}
              >
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}

      {fusionModalOpen && (
        <div className={styles.extensionModalOverlay} onClick={() => setFusionModalOpen(false)}>
          <div className={styles.extensionModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.extensionModalHeader}>
              <h3>Sélectionner le permis à fusionner</h3>
              <p>
                Choisissez un permis du même détenteur, vérifiez la frontière commune (100m), puis
                sélectionnez le permis principal à conserver.
              </p>
            </div>

            <div className={styles.fusionSearchWrap}>
              <Search className={styles.fusionSearchIcon} />
              <input
                className={styles.fusionSearchInput}
                type="text"
                value={fusionSearch}
                onChange={(e) => setFusionSearch(e.target.value)}
                placeholder="Rechercher par code, type ou titulaire..."
              />
            </div>

            <div className={styles.fusionCandidates}>
              {fusionLoadingCandidates ? (
                <div className={styles.fusionState}>Chargement des permis...</div>
              ) : filteredFusionCandidates.length === 0 ? (
                <div className={styles.fusionState}>Aucun permis disponible pour fusion.</div>
              ) : (
                filteredFusionCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className={`${styles.fusionCandidateBtn} ${
                      selectedFusionPermisId === candidate.id ? styles.fusionCandidateBtnActive : ""
                    }`}
                    onClick={() => setSelectedFusionPermisId(candidate.id)}
                  >
                    <div className={styles.fusionCandidateMain}>
                      <strong>{candidate.code_permis}</strong>
                      <span>{candidate.type_label}</span>
                    </div>
                    <small>{candidate.titulaire}</small>
                  </button>
                ))
              )}
            </div>

            <div className={styles.fusionEligibilityBox}>
              {fusionChecking ? (
                <div className={styles.fusionState}>Vérification frontière commune...</div>
              ) : fusionEligibility ? (
                <>
                  <div
                    className={`${styles.fusionEligibilityBadge} ${
                      fusionEligibility.ok
                        ? styles.fusionEligibilityOk
                        : styles.fusionEligibilityKo
                    }`}
                  >
                    {fusionEligibility.ok ? "Fusion possible" : "Fusion impossible"}
                  </div>
                  <p>{fusionEligibility.message}</p>
                  <div className={styles.fusionEligibilityMeta}>
                    <span>Frontière commune: {fusionEligibility.sharedBoundary.toFixed(2)} m</span>
                    {fusionEligibility.areaHa > 0 && (
                      <span>Superficie union: {fusionEligibility.areaHa.toFixed(2)} ha</span>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.fusionState}>
                  Sélectionnez un permis pour lancer la vérification.
                </div>
              )}
            </div>

            <div className={styles.fusionPrincipalSection}>
              <h4>Permis principal à conserver</h4>
              <label className={styles.fusionRadioRow}>
                <input
                  type="radio"
                  name="fusion-principal"
                  checked={fusionPrincipalId === Number(permis?.id)}
                  onChange={() => setFusionPrincipalId(Number(permis?.id))}
                  disabled={!fusionEligibility?.ok}
                />
                <span>Conserver le permis actuel ({permis?.code_permis ?? permis?.code ?? id})</span>
              </label>
              <label className={styles.fusionRadioRow}>
                <input
                  type="radio"
                  name="fusion-principal"
                  checked={fusionPrincipalId === selectedFusionPermisId}
                  onChange={() =>
                    setFusionPrincipalId(
                      Number.isFinite(Number(selectedFusionPermisId))
                        ? Number(selectedFusionPermisId)
                        : null,
                    )
                  }
                  disabled={!fusionEligibility?.ok || !selectedFusionPermisId}
                />
                <span>
                  Conserver le permis sélectionné (
                  {fusionCandidates.find((c) => c.id === selectedFusionPermisId)?.code_permis || "--"})
                </span>
              </label>
            </div>

            <textarea
              className={styles.fusionMotifInput}
              value={fusionMotif}
              onChange={(e) => setFusionMotif(e.target.value)}
              placeholder="Motif de fusion (optionnel)"
            />

            <div className={styles.extensionModalFooter}>
              <Button
                variant="outline"
                type="button"
                onClick={() => setFusionModalOpen(false)}
                disabled={fusionSubmitting}
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleStartFusion}
                disabled={
                  fusionSubmitting ||
                  !fusionEligibility?.ok ||
                  !selectedFusionPermisId ||
                  !fusionPrincipalId ||
                  !!fusionExistingProcedureId
                }
              >
                {fusionSubmitting ? "Création..." : "Continuer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </InvestorLayout>
  );
};

export default PermisDetailsOperateur;
