import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ArcGISMap, {
  type ArcGISMapRef,
  type Coordinate,
} from "@/components/arcgismap/ArcgisMap";
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  CreditCard,
  History,
  Download,
  Upload,
  MapPin,
  Building2,
  Calendar,
  Ruler,
  CheckCircle2,
  Clock,
  XCircle,
  FileCheck,
  AlertCircle,
  LifeBuoy,
  Gem,
  Eye,
  Banknote,
  Loader2,
} from "lucide-react";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import PerimeterCoordinatesTable from "@/components/perimeter/PerimeterCoordinatesTable";
import { OnboardingTour, type OnboardingStep } from "@/components/onboarding/OnboardingTour";
import { BrandLoader } from "@/components/loading/BrandLoader";
import styles from "./DemandeDetails.module.css";

type DemandeCommune = {
  principale?: boolean | null;
  commune?: {
    nom_communeFR?: string | null;
    daira?: {
      nom_dairaFR?: string | null;
      wilaya?: { nom_wilayaFR?: string | null } | null;
    } | null;
  } | null;
};

type DemandeDetail = {
  id_demande: number;
  code_demande?: string | null;
  statut_demande?: string | null;
  date_demande?: string | null;
  superficie?: number | null;
  superficie_ha?: number | string | null;
  superficieHa?: number | string | null;
  surface?: number | string | null;
  lieu_ditFR?: string | null;
  id_proc?: number | null;
  procedure?: { date_debut_proc?: string | null } | null;
  typePermis?: { lib_type?: string | null; code_type?: string | null } | null;
  typeProcedure?: { libelle?: string | null } | null;
  detenteur?: { nom_societeFR?: string | null; nom_societeAR?: string | null } | null;
  wilaya?: { nom_wilayaFR?: string | null } | null;
  daira?: { nom_dairaFR?: string | null } | null;
  commune?: { nom_communeFR?: string | null } | null;
  communes?: DemandeCommune[];
};

type ProcedureEtapeItem = {
  statut?: string | null;
  date_debut?: string | null;
  date_fin?: string | null;
  etape?: { lib_etape?: string | null; ordre_etape?: number | null } | null;
};

type DocumentItem = {
  idDoc: number | null;
  nom: string;
  statut: string;
  date?: string | null;
  size?: string | null;
  fileUrl?: string | null;
  updatedAt?: string | null;
};

type PaiementItem = {
  libelle: string;
  montant: string;
  statut: string;
  date?: string | null;
};

type ComplementDocDecision = "conforme" | "manquant" | "probleme" | "inconnu";

type DocProblemCode =
  | "expire"
  | "date_invalide"
  | "illisible"
  | "non_signe"
  | "incoherent"
  | "autre";

type ComplementDetailsState = {
  id_complement: number | null;
  statut: string | null;
  generatedAt: string | null;
  submittedAt: string | null;
  updatedAt: string | null;
  motif: string | null;
  delaiJours: number | null;
  effetAbsence: string | null;
  modeNotification: string | null;
  adminMessage: string | null;
  pdfUrl: string | null;
  pdfFilename: string | null;
  recepissePdfUrl: string | null;
  recepissePdfFilename: string | null;
  documents: Array<{
    id_item: number | null;
    id_doc: number | null;
    nom_doc: string;
    decision: ComplementDocDecision;
    problems: DocProblemCode[];
    comment: string | null;
    statutActuel: string | null;
    statutReponse: string | null;
    reponduAt: string | null;
    responseFileUrl: string | null;
    statutTraitement: string | null;
    traiteAt: string | null;
    traiteBy: number | null;
    noteTraitement: string | null;
  }>;
};

const apiURL =
  process.env.NEXT_PUBLIC_API_URL ||
  ((typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_API_URL) as string) ||
  "";

const buildApiUrl = (base: string, endpoint: string) => {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const normalizedBase = String(base || "").trim().replace(/\/+$/, "");
  if (!normalizedBase) return normalizedEndpoint;
  if (
    normalizedBase.endsWith("/api") &&
    (normalizedEndpoint === "/api" || normalizedEndpoint.startsWith("/api/"))
  ) {
    const strippedEndpoint = normalizedEndpoint.replace(/^\/api(?=\/|$)/, "") || "/";
    return `${normalizedBase}${strippedEndpoint}`;
  }
  return `${normalizedBase}${normalizedEndpoint}`;
};

const buildDemandeDocumentViewUrl = (
  base: string,
  idDemande?: number | null,
  idDoc?: number | null,
) => {
  if (!idDemande || !idDoc) return null;
  return buildApiUrl(base, `/api/demande/${idDemande}/document/${idDoc}/file`);
};

const buildComplementItemViewUrl = (
  base: string,
  idDemande?: number | null,
  idItem?: number | null,
) => {
  if (!idDemande || !idItem) return null;
  return buildApiUrl(
    base,
    `/api/demande/${idDemande}/complement/item/${idItem}/file`,
  );
};

const requestApiWithFallback = async (
  base: string,
  endpoint: string,
  config: any,
) => {
  const primaryUrl = buildApiUrl(base, endpoint);
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const fallbackEndpoint = normalizedEndpoint.startsWith("/api/")
    ? normalizedEndpoint.replace(/^\/api(?=\/|$)/, "") || "/"
    : `/api${normalizedEndpoint}`;
  const localUrl = buildApiUrl(base, fallbackEndpoint);

  try {
    return await axios({
      ...config,
      url: primaryUrl,
    });
  } catch (error: any) {
    const status = error?.response?.status ?? null;
    const shouldRetryLocally =
      status === 404 ||
      status === 502 ||
      status === 503 ||
      status === 504 ||
      error?.code === "ERR_NETWORK";

    if (!shouldRetryLocally || primaryUrl === localUrl) {
      throw error;
    }

    console.warn("[DemandeDetails] retrying request on local backend", {
      primaryUrl,
      localUrl,
      status,
      code: error?.code ?? null,
    });

    return axios({
      ...config,
      url: localUrl,
    });
  }
};

const DOC_DECISION_LABELS: Record<ComplementDocDecision, string> = {
  conforme: "Conforme",
  manquant: "Manquant",
  probleme: "Present avec probleme",
  inconnu: "A verifier",
};

const DOC_PROBLEM_LABELS: Record<DocProblemCode, string> = {
  expire: "Document expire",
  date_invalide: "Date invalide",
  illisible: "Document illisible",
  non_signe: "Document non signe",
  incoherent: "Incoherence des informations",
  autre: "Autre probleme",
};

const COMPLEMENT_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "completude-hero",
    target: '[data-onboarding-id="completude-hero"]',
    title: "Lire la demande de regularisation",
    description:
      "Commencez ici pour voir le statut global, le delai, et les actions prioritaires demandees par le service.",
    placement: "bottom",
  },
  {
    id: "completude-flow",
    target: '[data-onboarding-id="completude-flow"]',
    title: "Comprendre le parcours",
    description:
      "Le parcours suit quatre etapes: demande emise, documents corriges, soumission du complement, puis verification administrative.",
    placement: "bottom",
  },
  {
    id: "completude-docs",
    target: '[data-onboarding-id="completude-docs"]',
    title: "Corriger les documents signales",
    description:
      "Chaque carte resume le probleme detecte, l etat du fichier et le bouton Corriger / remplacer pour televerser une nouvelle version.",
    placement: "top",
  },
  {
    id: "completude-actions",
    target: '[data-onboarding-id="completude-actions"]',
    title: "Soumettre officiellement le complement",
    description:
      "Quand tous les documents demandes sont corriges, utilisez ce panneau pour telecharger la fiche ou soumettre le complement.",
    placement: "left",
  },
  {
    id: "completude-history",
    target: '[data-onboarding-id="completude-history"]',
    title: "Suivre la reverification",
    description:
      "L historique montre les corrections deja faites, la soumission, puis la reprise de l instruction par l administration.",
    placement: "top",
  },
];

const formatDate = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const isTruthyQueryFlag = (value?: string | null) => {
  const normalized = String(value || "").toLowerCase().trim();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "oui";
};

const coerceNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const pickFirstNumber = (...values: any[]): number | null => {
  for (const value of values) {
    const coerced = coerceNumber(value);
    if (coerced !== null) return coerced;
  }
  return null;
};

const pickName = (obj: any, keys: string[]) => {
  if (!obj || typeof obj !== "object") return null;
  for (const key of keys) {
    const value = obj?.[key];
    if (value && typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return null;
};

const formatPersonName = (obj: any): string | null => {
  if (!obj) return null;
  if (typeof obj === "string") return obj;
  const company = pickName(obj, [
    "nom_societeFR",
    "nom_societeAR",
    "nom_societe",
    "raison_sociale",
    "nom_entreprise",
    "nomEntreprise",
  ]);
  if (company) return company;
  const nom = pickName(obj, ["nom", "nom_fr", "nom_ar", "nom_responsable", "nom_gerant"]);
  const prenom = pickName(obj, ["prenom", "prenom_fr", "prenom_ar"]);
  if (nom && prenom) return `${nom} ${prenom}`.trim();
  return nom || prenom || null;
};

const resolveTitulaire = (...payloads: any[]): string | null => {
  const candidates: any[] = [];
  payloads.forEach((payload) => {
    if (!payload) return;
    candidates.push(
      payload?.titulaire,
      payload?.detenteur,
      payload?.detenteurdemande?.[0]?.detenteur,
      payload?.demandeur,
      payload?.societe,
      payload?.entreprise,
      payload?.personne_morale,
      payload?.personneMorale,
      payload?.personne_physique,
      payload?.personnePhysique,
    );
  });
  for (const candidate of candidates) {
    const name = formatPersonName(candidate);
    if (name) return name;
  }
  return null;
};

const safeText = (value: unknown, fallback = "--"): string => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toTimestamp = (value?: string | null) => {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const parseComplementDetailsPayload = (
  payload: unknown,
  fallbackGeneratedAt?: string | null,
): ComplementDetailsState | null => {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload as Record<string, any>;
  const rawDocuments = Array.isArray(raw.documents)
    ? raw.documents
    : Array.isArray(raw.items)
      ? raw.items
      : [];

  const mappedDocuments = rawDocuments
    .map((entry: any) => {
      const numericId = Number(entry?.id_doc);
      const normalizedDecision = String(entry?.decision || "")
        .toLowerCase()
        .trim();
      const decision: ComplementDocDecision =
        normalizedDecision === "conforme" ||
        normalizedDecision === "manquant" ||
        normalizedDecision === "probleme"
          ? normalizedDecision
          : "inconnu";
      const problems = Array.isArray(entry?.problems)
        ? entry.problems
            .map((item: any) => String(item || "").toLowerCase().trim())
            .filter(
              (item: string): item is DocProblemCode =>
                item === "expire" ||
                item === "date_invalide" ||
                item === "illisible" ||
                item === "non_signe" ||
                item === "incoherent" ||
                item === "autre",
            )
        : [];

      const commentValue = String(entry?.comment || entry?.commentaire || "").trim();
      const statusValue = String(
        entry?.statutActuel || entry?.statut_actuel_snapshot || "",
      ).trim();

      return {
        id_item: Number.isFinite(Number(entry?.id_item)) ? Number(entry.id_item) : null,
        id_doc: Number.isFinite(numericId) && numericId > 0 ? numericId : null,
        nom_doc: String(entry?.nom_doc || entry?.nom_doc_snapshot || "").trim() || "Document",
        decision,
        problems,
        comment: commentValue.length > 0 ? commentValue : null,
        statutActuel: statusValue.length > 0 ? statusValue : null,
        statutReponse:
          String(entry?.statutReponse || entry?.statut_reponse || "").trim() || null,
        reponduAt:
          (typeof entry?.reponduAt === "string" && entry.reponduAt.trim()) ||
          (typeof entry?.repondu_at === "string" && entry.repondu_at.trim()) ||
          null,
        responseFileUrl:
          String(entry?.responseFileUrl || entry?.reponse_file_url || "").trim() || null,
        statutTraitement:
          String(entry?.statutTraitement || entry?.statut_traitement || "").trim() || null,
        traiteAt:
          (typeof entry?.traiteAt === "string" && entry.traiteAt.trim()) ||
          (typeof entry?.traite_at === "string" && entry.traite_at.trim()) ||
          null,
        traiteBy:
          Number.isFinite(Number(entry?.traiteBy ?? entry?.traite_by))
            ? Number(entry?.traiteBy ?? entry?.traite_by)
            : null,
        noteTraitement:
          String(entry?.noteTraitement || entry?.note_traitement || "").trim() || null,
      };
    })
    .filter((entry: ComplementDetailsState["documents"][number]) => entry.decision !== "conforme");

  const parsedDelai = Number(raw.delaiJours ?? raw.delai_jours);
  const generatedAt =
    (typeof raw.generatedAt === "string" && raw.generatedAt.trim()) ||
    (typeof raw.createdAt === "string" && raw.createdAt.trim()) ||
    (typeof raw.generated_at === "string" && raw.generated_at.trim()) ||
    (typeof fallbackGeneratedAt === "string" && fallbackGeneratedAt.trim()) ||
    null;
  const submittedAt =
    (typeof raw.submittedAt === "string" && raw.submittedAt.trim()) ||
    (typeof raw.submitted_at === "string" && raw.submitted_at.trim()) ||
    (typeof raw.updatedAt === "string" && raw.updatedAt.trim()) ||
    (typeof raw.updated_at === "string" && raw.updated_at.trim()) ||
    null;
  const statut =
    (typeof raw.statut === "string" && raw.statut.trim()) ||
    (typeof raw.statut_complement === "string" && raw.statut_complement.trim()) ||
    null;
  const motif =
    (typeof raw.motif === "string" && raw.motif.trim()) || null;
  const adminMessage =
    (typeof raw.adminMessage === "string" && raw.adminMessage.trim()) ||
    (typeof raw.admin_message === "string" && raw.admin_message.trim()) ||
    null;
  const effetAbsence =
    (typeof raw.effetAbsence === "string" && raw.effetAbsence.trim()) ||
    (typeof raw.effet_absence === "string" && raw.effet_absence.trim()) ||
    null;
  const modeNotification =
    (typeof raw.modeNotification === "string" && raw.modeNotification.trim()) ||
    (typeof raw.mode_notification === "string" && raw.mode_notification.trim()) ||
    null;
  const pdfUrl =
    (typeof raw.pdfUrl === "string" && raw.pdfUrl.trim()) ||
    (typeof raw.pdf_url === "string" && raw.pdf_url.trim()) ||
    null;
  const pdfFilename =
    (typeof raw.pdfFilename === "string" && raw.pdfFilename.trim()) ||
    (typeof raw.pdf_filename === "string" && raw.pdf_filename.trim()) ||
    null;
  const recepissePdfUrl =
    (typeof raw.recepissePdfUrl === "string" && raw.recepissePdfUrl.trim()) ||
    (typeof raw.recepisse_pdf_url === "string" && raw.recepisse_pdf_url.trim()) ||
    null;
  const recepissePdfFilename =
    (typeof raw.recepissePdfFilename === "string" && raw.recepissePdfFilename.trim()) ||
    (typeof raw.recepisse_pdf_filename === "string" && raw.recepisse_pdf_filename.trim()) ||
    null;
  const delaiJours =
    Number.isFinite(parsedDelai) && parsedDelai > 0 ? Math.trunc(parsedDelai) : null;

  const hasSignal = Boolean(
    statut ||
    generatedAt ||
      submittedAt ||
      motif ||
      adminMessage ||
      effetAbsence ||
      modeNotification ||
      pdfUrl ||
      recepissePdfUrl ||
      mappedDocuments.length > 0,
  );
  if (!hasSignal) return null;

  return {
    id_complement: Number.isFinite(Number(raw.id_complement))
      ? Number(raw.id_complement)
      : null,
    statut,
    generatedAt,
    submittedAt,
    updatedAt:
      (typeof raw.updatedAt === "string" && raw.updatedAt.trim()) ||
      (typeof raw.updated_at === "string" && raw.updated_at.trim()) ||
      null,
    motif,
    delaiJours,
    effetAbsence,
    modeNotification,
    adminMessage,
    pdfUrl,
    pdfFilename,
    recepissePdfUrl,
    recepissePdfFilename,
    documents: mappedDocuments,
  };
};

const mapDemandDocumentsPayload = (payload: any): DocumentItem[] => {
  const docsPayload = Array.isArray(payload?.documents) ? payload.documents : [];
  const dossierDate = payload?.dossierFournis?.date_depot ?? null;
  return docsPayload.map((doc: any) => ({
    idDoc:
      Number.isFinite(Number(doc.id_doc)) && Number(doc.id_doc) > 0
        ? Number(doc.id_doc)
        : null,
    nom: doc.nom_doc,
    statut: doc.statut,
    date: dossierDate,
    size: doc.taille_doc ? String(doc.taille_doc) : null,
    fileUrl: doc.file_url || null,
    updatedAt: doc.updated_at || null,
  }));
};

const isComplementSubmitted = (statut?: string | null) =>
  String(statut || "").trim().toUpperCase() === "SOUMISE";

const isComplementProcessed = (statut?: string | null) => {
  const key = String(statut || "").trim().toUpperCase();
  return key === "TRAITEE" || key === "CLOTUREE" || key === "VALIDEE";
};

const getComplementResponseStatus = (value?: string | null) =>
  String(value || "").trim().toUpperCase();

const hasComplementDocumentResponse = (
  docItem: ComplementDetailsState["documents"][number],
) => {
  const responseStatus = getComplementResponseStatus(docItem.statutReponse);
  return (
    responseStatus === "DOCUMENT_REMPLACE" ||
    responseStatus === "SOUMIS" ||
    Boolean(String(docItem.responseFileUrl || "").trim()) ||
    Boolean(String(docItem.reponduAt || "").trim())
  );
};

const formatDocumentStatusLabel = (value?: string | null) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "present" || normalized === "valide" || normalized === "conforme") {
    return "Present";
  }
  if (normalized === "manquant" || normalized === "missing") {
    return "Manquant";
  }
  if (normalized === "attente" || normalized === "pending" || normalized === "en_attente") {
    return "En attente";
  }
  return safeText(value || "--");
};

const toFileSafe = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

const pickFilenameFromDisposition = (headerValue?: string | null): string | null => {
  if (!headerValue) return null;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(headerValue);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).trim();
    } catch {
      return utf8Match[1].trim();
    }
  }
  const plainMatch = /filename="?([^"]+)"?/i.exec(headerValue);
  if (plainMatch?.[1]) return plainMatch[1].trim();
  return null;
};

const loadImageAsDataUrl = async (src: string): Promise<string | null> => {
  if (typeof window === "undefined") return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
};

const DemandeDetails = () => {
  const { id, code, demandeId } = useParams();
  const navigate = useNavigate();

  const demandeKey = useMemo(() => {
    const raw = id || demandeId || code || "";
    const normalized = String(raw).trim();
    return normalized.length > 0 ? normalized : null;
  }, [id, demandeId, code]);
  const backPath = useMemo(() => {
    if (typeof window === "undefined") return "/investisseur/demandes";
    const pathname = window.location.pathname.toLowerCase();
    if (pathname.includes("/demand_dashboard/")) return "/demand_dashboard";
    if (pathname.includes("/admin_panel/gestion-demandes/")) {
      return "/admin_panel/gestion-demandes";
    }
    return "/investisseur/demandes";
  }, [demandeKey]);
  const isAdminDetailView = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.location.pathname
      .toLowerCase()
      .includes("/admin_panel/gestion-demandes/");
  }, [demandeKey]);

  const [demande, setDemande] = useState<DemandeDetail | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [paiements, setPaiements] = useState<PaiementItem[]>([]);
  const [substances, setSubstances] = useState<string[]>([]);
  const [complementDetails, setComplementDetails] =
    useState<ComplementDetailsState | null>(null);
  const [procedureEtapes, setProcedureEtapes] = useState<ProcedureEtapeItem[]>([]);
  const [factureId, setFactureId] = useState<number | null>(null);
  const [factureMontant, setFactureMontant] = useState<number | null>(null);
  const [factureStatut, setFactureStatut] = useState<string | null>(null);
  const [titulaireOverride, setTitulaireOverride] = useState<string | null>(null);
  const [superficieCadastrale, setSuperficieCadastrale] = useState<number | null>(
    null,
  );
  const [perimetrePoints, setPerimetrePoints] = useState<Coordinate[]>([]);
  const [perimetreZone, setPerimetreZone] = useState<number | undefined>(undefined);
  const [perimetreHemisphere, setPerimetreHemisphere] = useState<
    "N" | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState<
    | "general"
    | "substances"
    | "documents"
    | "completude"
    | "paiements"
    | "historique"
  >("general");
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [isComplementPdfDownloading, setIsComplementPdfDownloading] = useState(false);
  const [isComplementRecepisseDownloading, setIsComplementRecepisseDownloading] = useState(false);
  const [isSubmittingComplement, setIsSubmittingComplement] = useState(false);
  const [uploadingDocIds, setUploadingDocIds] = useState<Record<number, boolean>>({});
  const [showComplementGuide, setShowComplementGuide] = useState(false);
  const mapRef = useRef<ArcGISMapRef | null>(null);
  const complementUploadInputsRef = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    const requestedTab = (search.get("tab") || "").trim().toLowerCase();
    if (
      requestedTab === "general" ||
      requestedTab === "substances" ||
      requestedTab === "documents" ||
      requestedTab === "completude" ||
      requestedTab === "paiements" ||
      requestedTab === "historique"
    ) {
      setActiveTab(requestedTab);
    }
    const requestedGuide = (search.get("guide") || "").trim().toLowerCase();
    if (
      requestedTab === "completude" &&
      (requestedGuide === "completude" || isTruthyQueryFlag(search.get("onboarding")))
    ) {
      setShowComplementGuide(true);
    }
  }, [demandeKey]);

  useEffect(() => {
    let active = true;

    if (!demandeKey) {
      setError("Demande invalide.");
      setIsLoading(false);
      return;
    }
    if (!apiURL) {
      setError("API URL manquant.");
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const demandeRes = await axios.get(
          `${apiURL}/demandes/${encodeURIComponent(demandeKey)}`,
          {
            withCredentials: true,
          },
        );
        if (!active) return;
        const demandeData = demandeRes.data as DemandeDetail;
        const resolvedDemandeId = Number(demandeData?.id_demande);
        if (!Number.isFinite(resolvedDemandeId) || resolvedDemandeId <= 0) {
          throw new Error("Demande introuvable");
        }
        setDemande(demandeData);

        const idProc = demandeData?.id_proc;

        const [
          substancesRes,
          documentsRes,
          complementRes,
          factureRes,
          procedureRes,
          verificationRes,
          coordsRes,
          demandeProcRes,
          inscriptionRes,
        ] = await Promise.all([
            requestApiWithFallback(
              apiURL,
              `/api/substances/demande/${resolvedDemandeId}/substances`,
              {
                method: "get",
                withCredentials: true,
              },
            )
              .catch(() => null),
            requestApiWithFallback(
              apiURL,
              `/api/procedure/${resolvedDemandeId}/documents`,
              {
                method: "get",
                withCredentials: true,
              },
            )
              .catch(() => null),
            requestApiWithFallback(
              apiURL,
              `/api/demande/${resolvedDemandeId}/complements/latest`,
              {
                method: "get",
                withCredentials: true,
              },
            )
              .catch(() => null),
            requestApiWithFallback(
              apiURL,
              `/api/facture/demande/${resolvedDemandeId}`,
              {
                method: "get",
                withCredentials: true,
              },
            )
              .catch(() => null),
            idProc
              ? requestApiWithFallback(
                  apiURL,
                  `/api/procedure-etape/procedure/${idProc}`,
                  {
                    method: "get",
                    withCredentials: true,
                  },
                )
                  .catch(() => null)
              : Promise.resolve(null),
            axios
              .get(`${apiURL}/verification-geo/demande/${resolvedDemandeId}`, {
                withCredentials: true,
              })
              .catch(() => null),
            idProc
              ? axios
                  .get(`${apiURL}/coordinates/procedure/${idProc}`, {
                    withCredentials: true,
                  })
                  .catch(() => null)
              : Promise.resolve(null),
            idProc
              ? requestApiWithFallback(
                  apiURL,
                  `/api/procedures/${idProc}/demande`,
                  {
                    method: "get",
                    withCredentials: true,
                  },
                )
                  .catch(() => null)
              : Promise.resolve(null),
            idProc
              ? axios
                  .get(`${apiURL}/inscription-provisoire/procedure/${idProc}`, {
                    withCredentials: true,
                  })
                  .catch(() => null)
              : Promise.resolve(null),
          ]);

        if (!active) return;

        const subsPayload = Array.isArray(substancesRes?.data)
          ? substancesRes?.data
          : [];
        const subsNames = subsPayload
          .map((s: any) => s?.nom_subFR || s?.nom_subAR || s?.code_sub)
          .filter(Boolean);
        setSubstances(subsNames);

        setDocuments(mapDemandDocumentsPayload(documentsRes?.data));

        const fallbackGeneratedAt =
          documentsRes?.data?.dossierFournis?.date_mise_en_demeure ?? null;
        const fromDedicatedEndpoint = parseComplementDetailsPayload(
          complementRes?.data,
          fallbackGeneratedAt,
        );
        const fromLegacyPayload = parseComplementDetailsPayload(
          documentsRes?.data?.dossierFournis?.pieces_manquantes,
          fallbackGeneratedAt,
        );
        setComplementDetails(fromDedicatedEndpoint || fromLegacyPayload);

        const facture = factureRes?.data?.facture ?? null;
        if (facture) {
          setFactureId(facture.id_facture ?? null);
          const montantValue =
            typeof facture.montant_total === "number" ? facture.montant_total : null;
          setFactureMontant(montantValue);
          setFactureStatut(facture.statut ?? null);
          const montantLabel = montantValue != null
            ? `${montantValue.toLocaleString("fr-FR")} DZD`
            : facture.montant_total
            ? `${facture.montant_total} DZD`
            : "--";
          setPaiements([
            {
              libelle: "Facture",
              montant: montantLabel,
              statut: facture.statut || "EN_ATTENTE",
              date: facture.date_emission || null,
            },
          ]);
        } else {
          setFactureId(null);
          setFactureMontant(null);
          setFactureStatut(null);
          setPaiements([]);
        }

        const steps = Array.isArray(procedureRes?.data?.ProcedureEtape)
          ? procedureRes?.data?.ProcedureEtape
          : [];
        setProcedureEtapes(steps);

        const verifSurface = pickFirstNumber(
          verificationRes?.data?.superficie_cadastrale,
          verificationRes?.data?.superficie_cadastrale_ha,
          verificationRes?.data?.superficie,
          verificationRes?.data?.surface,
        );

        const coordsPayload = Array.isArray(coordsRes?.data) ? coordsRes?.data : [];
        const mappedPoints = coordsPayload
          .map((item: any, index: number) => {
            const coord = item?.coordonnee ?? item;
            const x = Number(coord?.x);
            const y = Number(coord?.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            const zoneRaw = coord?.zone;
            const zone = zoneRaw != null ? Number(zoneRaw) : undefined;
            const hemisphere = "N";
            const system = (coord?.system as Coordinate["system"]) || "UTM";
            return {
              id: coord?.id_coordonnees ?? coord?.id ?? index + 1,
              idTitre: coord?.idTitre ?? 1007,
              h: coord?.h ?? 0,
              x,
              y,
              system,
              zone,
              hemisphere,
            } as Coordinate;
          })
          .filter(Boolean) as Coordinate[];
        setPerimetrePoints(mappedPoints);
        const detectedZone = mappedPoints.find((p) => Number.isFinite(p.zone as any))?.zone;
        const detectedHem = mappedPoints.find((p) => p.hemisphere)?.hemisphere;
        if (detectedZone !== undefined) {
          setPerimetreZone(detectedZone);
        } else {
          setPerimetreZone(undefined);
        }
        if (detectedHem === "N") {
          setPerimetreHemisphere(detectedHem);
        } else {
          setPerimetreHemisphere(undefined);
        }

        const demandeProcPayload = demandeProcRes?.data ?? null;
        const titulaireCandidate = resolveTitulaire(
          demandeData,
          demandeProcPayload,
        );
        setTitulaireOverride(titulaireCandidate);

        const extraSuperficie =
          coerceNumber(demandeProcPayload?.superficie_cadastrale) ??
          coerceNumber(demandeProcPayload?.superficie_cadastrale_ha) ??
          coerceNumber(demandeProcPayload?.superficie_declaree) ??
          coerceNumber(demandeProcPayload?.superficieDeclaree) ??
          coerceNumber(demandeProcPayload?.superficie_calculee) ??
          coerceNumber(demandeProcPayload?.superficie_sig) ??
          coerceNumber(demandeProcPayload?.superficie_ha) ??
          coerceNumber(demandeProcPayload?.superficieHa) ??
          coerceNumber(demandeProcPayload?.superficie);

        const inscriptionSuperficie =
          coerceNumber(inscriptionRes?.data?.superficie_declaree) ??
          coerceNumber(inscriptionRes?.data?.superficie);

        const demandeSuperficie = pickFirstNumber(
          demandeData?.superficie,
          demandeData?.superficie_ha,
          demandeData?.superficieHa,
          demandeData?.surface,
        );

        const finalSuperficie = pickFirstNumber(
          verifSurface,
          extraSuperficie,
          inscriptionSuperficie,
          demandeSuperficie,
        );

        setSuperficieCadastrale(finalSuperficie);
      } catch (err) {
        if (!active) return;
        console.error("Erreur chargement demande", err);
        setError("Erreur lors du chargement de la demande.");
        toast.error("Erreur lors du chargement de la demande.");
      } finally {
        if (!active) return;
        setIsLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [demandeKey, apiURL, reloadKey]);

  useEffect(() => {
    if (perimetrePoints.length < 3) return;
    const timer = window.setTimeout(() => {
      mapRef.current?.zoomToCurrentPolygon?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [perimetrePoints]);

  const getStatutConfig = (statut: string) => {
    const configs: Record<string, { label: string; icon: typeof Clock; className: string }> = {
      EN_COURS: { label: "En cours", icon: Clock, className: styles.badgeWarning },
      EN_ATTENTE: { label: "En attente", icon: Clock, className: styles.badgeWarning },
      EN_COMPLEMENT: {
        label: "Complement requis",
        icon: AlertCircle,
        className: styles.badgeWarning,
      },
      ACCEPTEE: { label: "Acceptee", icon: CheckCircle2, className: styles.badgeSuccess },
      REJETEE: { label: "Rejetee", icon: XCircle, className: styles.badgeDanger },
    };
    return configs[statut] || configs.EN_COURS;
  };

  const timelineItems = useMemo(() => {
    const items = procedureEtapes.map((item, index) => {
      const statutRaw = (item.statut || "EN_ATTENTE").toUpperCase();
      const state = statutRaw === "TERMINEE"
        ? "completed"
        : statutRaw === "EN_COURS"
        ? "active"
        : "pending";
      const label = state === "completed"
        ? "Completee"
        : state === "active"
        ? "En cours"
        : "En attente";
      const description = state === "completed"
        ? "Etape terminee"
        : state === "active"
        ? "Etape en cours de traitement"
        : "Etape en attente";

      return {
        etape: item.etape?.lib_etape || `Etape ${index + 1}`,
        ordre: item.etape?.ordre_etape ?? index + 1,
        statut: label,
        state,
        description,
        date: item.date_fin || item.date_debut || null,
      };
    });

    return items.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  }, [procedureEtapes]);

  const progressInfo = useMemo(() => {
    const total = timelineItems.length;
    if (!total) {
      return { percent: 0, label: "Aucune etape" };
    }
    const completed = timelineItems.filter((item) => item.state === "completed").length;
    const percent = Math.round((completed / total) * 100);
    const active = timelineItems.find((item) => item.state === "active");
    const label = active ? active.etape : completed === total ? "Dossier termine" : "En attente";
    return { percent, label };
  }, [timelineItems]);

  const documentsById = useMemo(() => {
    const map = new Map<number, DocumentItem>();
    documents.forEach((doc) => {
      if (typeof doc.idDoc === "number" && Number.isFinite(doc.idDoc) && doc.idDoc > 0) {
        map.set(doc.idDoc, doc);
      }
    });
    return map;
  }, [documents]);

  const complementStatusDescriptor = useMemo(() => {
    const statut = String(complementDetails?.statut || "").trim().toUpperCase();
    const respondedCount =
      complementDetails?.documents.filter((docItem) => {
        const responseStatus = getComplementResponseStatus(docItem.statutReponse);
        return responseStatus === "DOCUMENT_REMPLACE" || responseStatus === "SOUMIS";
      }).length || 0;
    const processedCount =
      complementDetails?.documents.filter(
        (docItem) =>
          String(docItem.statutTraitement || "").trim().toUpperCase() === "TRAITEE",
      ).length || 0;
    const totalCount = complementDetails?.documents.length || 0;
    const hasFullyProcessedItems =
      totalCount > 0 && processedCount === totalCount;

    if (isComplementProcessed(statut) || hasFullyProcessedItems) {
      return {
        label: "Complement reverifie",
        description: "Le service instructeur a repris l'examen du dossier.",
        className: styles.badgeSuccess,
        toneClassName: styles.complementStateSuccess,
      };
    }
    if (isComplementSubmitted(statut)) {
      if (processedCount > 0 && processedCount < totalCount) {
        return {
          label: "Verification en cours",
          description: `${processedCount} document(s) ont deja ete verifies par l'administration.`,
          className: styles.badgeWarning,
          toneClassName: styles.complementStatePending,
        };
      }
      return {
        label: "Complement soumis",
        description: "Les documents corriges ont ete transmis au service pour reverification.",
        className: styles.badgeSuccess,
        toneClassName: styles.complementStateSuccess,
      };
    }
    if (respondedCount > 0) {
      return {
        label: "Documents corriges",
        description: `${respondedCount} document(s) ont ete remplaces et attendent la soumission finale du complement.`,
        className: styles.badgeSuccess,
        toneClassName: styles.complementStateSuccess,
      };
    }
    return {
      label: "Complement a fournir",
      description: "Des pieces doivent etre corrigees ou remplacees avant reprise de l'instruction.",
      className: styles.badgeWarning,
      toneClassName: styles.complementStatePending,
    };
  }, [complementDetails]);

  const complementStatutLabel = useMemo(() => {
    if (!complementDetails) return "--";

    const statut = String(complementDetails.statut || "").trim().toUpperCase();
    const respondedCount = complementDetails.documents.filter((docItem) => {
      const responseStatus = getComplementResponseStatus(docItem.statutReponse);
      return responseStatus === "DOCUMENT_REMPLACE" || responseStatus === "SOUMIS";
    }).length;
    const processedCount = complementDetails.documents.filter(
      (docItem) =>
        String(docItem.statutTraitement || "").trim().toUpperCase() === "TRAITEE",
    ).length;
    const totalCount = complementDetails.documents.length;
    const hasFullyProcessedItems =
      totalCount > 0 && processedCount === totalCount;

    if (isComplementProcessed(statut) || hasFullyProcessedItems) {
      return totalCount > 0
        ? `Traite et valide (${processedCount}/${totalCount})`
        : "Traite et valide";
    }

    if (isComplementSubmitted(statut)) {
      if (processedCount > 0 && processedCount < totalCount) {
        return `Verification en cours (${processedCount}/${totalCount})`;
      }
      return "Soumis pour verification";
    }

    if (respondedCount > 0) {
      return `Documents corriges (${respondedCount}/${totalCount || respondedCount})`;
    }

    return "Complement a fournir";
  }, [complementDetails]);

  const complementStats = useMemo(() => {
    if (!complementDetails) {
      return {
        total: 0,
        corrected: 0,
        processed: 0,
        remaining: 0,
      };
    }

    const corrected = complementDetails.documents.filter((docItem) => {
      const responseStatus = getComplementResponseStatus(docItem.statutReponse);
      return responseStatus === "DOCUMENT_REMPLACE" || responseStatus === "SOUMIS";
    }).length;
    const processed = complementDetails.documents.filter(
      (docItem) =>
        String(docItem.statutTraitement || "").trim().toUpperCase() === "TRAITEE",
    ).length;
    const total = complementDetails.documents.length;

    return {
      total,
      corrected,
      processed,
      remaining: Math.max(0, total - corrected),
    };
  }, [complementDetails]);

  const complementCompletionRate =
    complementStats.total > 0
      ? Math.round((complementStats.corrected / complementStats.total) * 100)
      : 0;

  const complementHistoryItems = useMemo(() => {
    if (!complementDetails) return [];

    const items: Array<{
      key: string;
      title: string;
      description: string;
      date: string | null;
      state: "completed" | "active" | "pending";
    }> = [];

    items.push({
      key: "requested",
      title: "Demande de complement emise",
      description:
        safeText(complementDetails.motif || complementDetails.adminMessage) ||
        "Regularisation demandee par le service.",
      date: complementDetails.generatedAt,
      state: "completed",
    });

    const updatedRequestedDocs = complementDetails.documents.filter((docItem) => {
      const responseStatus = getComplementResponseStatus(docItem.statutReponse);
      if (responseStatus === "DOCUMENT_REMPLACE" || responseStatus === "SOUMIS") {
        return true;
      }
      if (typeof docItem.id_doc !== "number" || docItem.id_doc <= 0) return false;
      const currentDoc = documentsById.get(docItem.id_doc);
      return (
        (toTimestamp(currentDoc?.updatedAt) ?? 0) >=
        (toTimestamp(complementDetails.generatedAt) ?? Number.MAX_SAFE_INTEGER)
      );
    });

    if (updatedRequestedDocs.length > 0) {
      const latestUpdate = updatedRequestedDocs
        .map(
          (docItem) =>
            docItem.reponduAt ||
            documentsById.get(Number(docItem.id_doc))?.updatedAt ||
            null,
        )
        .filter(Boolean)
        .sort()
        .at(-1) || null;

      items.push({
        key: "updated",
        title: "Documents corriges par le demandeur",
        description: `${updatedRequestedDocs.length} document(s) ont ete corriges ou remplaces.`,
        date: latestUpdate,
        state: updatedRequestedDocs.length > 0 ? "completed" : "active",
      });
    }

    const processedDocs = complementDetails.documents.filter(
      (docItem) =>
        String(docItem.statutTraitement || "").trim().toUpperCase() === "TRAITEE",
    );

    if (complementDetails.submittedAt) {
      items.push({
        key: "submitted",
        title: "Complement soumis",
        description: "Le dossier attend maintenant la reverification administrative.",
        date: complementDetails.submittedAt,
        state:
          isComplementProcessed(complementDetails.statut) ||
          (processedDocs.length === complementDetails.documents.length &&
            complementDetails.documents.length > 0)
            ? "completed"
            : "active",
      });
    } else {
      items.push({
        key: "waiting",
        title: "Soumission du complement en attente",
        description: "Les documents corriges doivent encore etre soumis officiellement.",
        date: null,
        state: "pending",
      });
    }
    if (processedDocs.length > 0) {
      const latestProcessedAt =
        processedDocs
          .map((docItem) => docItem.traiteAt)
          .filter(Boolean)
          .sort()
          .at(-1) || null;

      items.push({
        key: "processed-docs",
        title: "Documents verifies par l'administration",
        description: `${processedDocs.length} document(s) ont deja ete verifies par le service.`,
        date: latestProcessedAt,
        state:
          processedDocs.length === complementDetails.documents.length
            ? "completed"
            : "active",
      });
    }

    if (
      isComplementProcessed(complementDetails.statut) ||
      (processedDocs.length === complementDetails.documents.length &&
        complementDetails.documents.length > 0)
    ) {
      items.push({
        key: "processed",
        title: "Reverification administrative",
        description: "Le service a repris le controle du dossier.",
        date: complementDetails.submittedAt || complementDetails.generatedAt,
        state: "completed",
      });
    }

    return items;
  }, [complementDetails, documentsById]);

  const handleDownloadPDF = async () => {
    if (isPdfGenerating) return;
    if (!demande) return;

    setIsPdfGenerating(true);
    try {
      const [{ default: JsPdf }, { default: autoTable }, logoDataUrl] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
        loadImageAsDataUrl("/anamlogo.png"),
      ]);

      const code = demande.code_demande || `DEM-${demande.id_demande}`;
      const typePermis = demande.typePermis?.lib_type || demande.typePermis?.code_type || "--";
      const typeProcedure = demande.typeProcedure?.libelle || "--";
      const titulaire =
        titulaireOverride ||
        demande.detenteur?.nom_societeFR ||
        demande.detenteur?.nom_societeAR ||
        "--";

      const commune =
        demande.commune?.nom_communeFR ||
        demande.communes?.find((item) => item.principale)?.commune?.nom_communeFR ||
        demande.communes?.[0]?.commune?.nom_communeFR ||
        "--";

      const daira =
        demande.daira?.nom_dairaFR ||
        demande.communes?.find((item) => item.principale)?.commune?.daira?.nom_dairaFR ||
        demande.communes?.[0]?.commune?.daira?.nom_dairaFR ||
        "--";

      const wilaya =
        demande.wilaya?.nom_wilayaFR ||
        demande.communes?.find((item) => item.principale)?.commune?.daira?.wilaya?.nom_wilayaFR ||
        demande.communes?.[0]?.commune?.daira?.wilaya?.nom_wilayaFR ||
        "--";

      const superficieValue = pickFirstNumber(
        superficieCadastrale,
        demande.superficie,
        demande.superficie_ha,
        demande.superficieHa,
        demande.surface,
      );
      const superficieLabel =
        typeof superficieValue === "number" ? `${superficieValue.toFixed(2)} ha` : "--";

      const timelineRows = timelineItems.map((item, idx) => [
        String(idx + 1),
        safeText(item.etape),
        safeText(item.statut),
        formatDate(item.date),
      ]);

      const substancesRows = substances.map((item, idx) => [
        String(idx + 1),
        safeText(item),
      ]);

      const documentsRows = documents.map((item, idx) => [
        String(idx + 1),
        safeText(item.nom),
        safeText(item.statut),
        safeText(item.size),
        formatDate(item.date),
      ]);

      const coordinatesRows = perimetrePoints.map((point, idx) => [
        String(idx + 1),
        Number(point.x).toFixed(3),
        Number(point.y).toFixed(3),
        safeText(point.zone ?? perimetreZone),
        safeText(point.system),
        safeText(point.hemisphere ?? perimetreHemisphere),
      ]);

      const paiementsRows = paiements.length
        ? paiements.map((item) => [
            safeText(item.libelle),
            safeText(item.montant),
            safeText(item.statut),
            formatDate(item.date),
          ])
        : [
            [
              "Facture",
              factureMontant != null
                ? `${factureMontant.toLocaleString("fr-FR")} DZD`
                : "--",
              safeText(factureStatut),
              "--",
            ],
          ];

      const doc = new JsPdf({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 14;
      const bodyWidth = pageWidth - marginX * 2;
      let currentY = 40;

      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, pageWidth, 32, "F");
      doc.setFillColor(22, 101, 52);
      doc.rect(0, 32, pageWidth, 2, "F");

      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, "PNG", 14, 5, 22, 22);
        } catch {
          // keep PDF generation even if logo cannot be rendered
        }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.text("PORTAIL ANAM", 40, 12);
      doc.setFontSize(12);
      doc.text("Recapitulatif professionnel de la demande", 40, 19);
      doc.setFontSize(9.5);
      doc.text(`Code: ${code}`, pageWidth - 14, 11, { align: "right" });
      doc.text(`Date: ${formatDateTime(new Date().toISOString())}`, pageWidth - 14, 17, {
        align: "right",
      });
      doc.text(`Reference interne: #${demande.id_demande}`, pageWidth - 14, 23, {
        align: "right",
      });

      const addSectionTitle = (title: string) => {
        if (currentY > pageHeight - 25) {
          doc.addPage();
          currentY = 18;
        }
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(marginX, currentY - 4, bodyWidth, 8, 2, 2, "F");
        doc.setFillColor(22, 101, 52);
        doc.roundedRect(marginX, currentY - 4, 2.4, 8, 1, 1, "F");
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);
        doc.text(title, marginX + 5, currentY + 1);
        currentY += 8;
      };

      const runTable = (head: string[][], body: string[][]) => {
        autoTable(doc, {
          startY: currentY,
          margin: { left: marginX, right: marginX },
          head,
          body,
          theme: "grid",
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontSize: 9,
            lineColor: [203, 213, 225],
            lineWidth: 0.2,
          },
          styles: {
            fontSize: 8.5,
            cellPadding: 2.2,
            textColor: [30, 41, 59],
            lineColor: [226, 232, 240],
            lineWidth: 0.2,
          },
          bodyStyles: { fillColor: [255, 255, 255] },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });
        currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 6;
      };

      addSectionTitle("Informations generales");
      runTable(
        [["Champ", "Valeur"]],
        [
          ["Code demande", code],
          ["Statut", safeText(demande.statut_demande)],
          ["Type permis", typePermis],
          ["Type procedure", typeProcedure],
          ["Date depot", formatDate(demande.date_demande || demande.procedure?.date_debut_proc || null)],
          ["Titulaire", safeText(titulaire)],
          ["Wilaya", safeText(wilaya)],
          ["Daira", safeText(daira)],
          ["Commune", safeText(commune)],
          ["Lieu-dit", safeText(demande.lieu_ditFR)],
          ["Superficie", superficieLabel],
        ],
      );

      addSectionTitle("Substances");
      runTable(
        [["#", "Substance"]],
        substancesRows.length > 0 ? substancesRows : [["1", "Aucune substance"]],
      );

      addSectionTitle("Perimetre et coordonnees");
      runTable(
        [["Point", "X", "Y", "Zone", "Systeme", "Hemisphere"]],
        coordinatesRows.length > 0
          ? coordinatesRows
          : [["--", "--", "--", "--", "--", "--"]],
      );

      addSectionTitle("Documents fournis");
      runTable(
        [["#", "Document", "Statut", "Taille", "Date"]],
        documentsRows.length > 0
          ? documentsRows
          : [["1", "Aucun document", "--", "--", "--"]],
      );

      addSectionTitle("Historique de traitement");
      runTable(
        [["#", "Etape", "Statut", "Date"]],
        timelineRows.length > 0 ? timelineRows : [["1", "Aucune etape", "--", "--"]],
      );

      addSectionTitle("Paiement");
      runTable([["Libelle", "Montant", "Statut", "Date"]], paiementsRows);

      const pageCount = doc.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setDrawColor(226, 232, 240);
        doc.line(marginX, pageHeight - 14, pageWidth - marginX, pageHeight - 14);
        doc.setFontSize(8.5);
        doc.setTextColor(107, 114, 128);
        doc.text("Document genere automatiquement par le Portail ANAM.", marginX, pageHeight - 8);
        doc.text(`Page ${page}/${pageCount}`, pageWidth - marginX, pageHeight - 8, {
          align: "right",
        });
      }

      doc.save(`demande_${toFileSafe(code)}_recapitulatif.pdf`);
      toast.success("Recapitulatif PDF telecharge avec succes.");
    } catch (error) {
      console.error("Erreur generation recapitulatif PDF", error);
      toast.error("Impossible de generer le recapitulatif PDF.");
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const handleDownloadComplementPdf = async () => {
    if (!demande || !apiURL || isComplementPdfDownloading) return;

    const code = demande.code_demande || `DEM-${demande.id_demande}`;
    const fallbackFilename =
      complementDetails?.pdfFilename || `demande_complement_${toFileSafe(code)}.pdf`;

    try {
      setIsComplementPdfDownloading(true);
      const response = await requestApiWithFallback(
        apiURL,
        `/api/demande/${demande.id_demande}/mise-en-demeure.pdf`,
        {
          method: "get",
          withCredentials: true,
          responseType: "blob",
        },
      );

      const contentDisposition = String(response.headers?.["content-disposition"] || "");
      const filename = pickFilenameFromDisposition(contentDisposition) || fallbackFilename;
      const contentType = String(response.headers?.["content-type"] || "application/pdf");
      const blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data], { type: contentType });

      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
      toast.success("Fiche de complement telechargee avec succes.");
    } catch (downloadError) {
      console.error("Erreur telechargement fiche complement", downloadError);
      toast.error("Impossible de telecharger la fiche de complement.");
    } finally {
      setIsComplementPdfDownloading(false);
    }
  };

  const handleDownloadComplementRecepissePdf = async () => {
    if (!demande || !apiURL || isComplementRecepisseDownloading) return;

    const code = demande.code_demande || `DEM-${demande.id_demande}`;
    const fallbackFilename =
      complementDetails?.recepissePdfFilename ||
      `recepisse_completude_${toFileSafe(code)}.pdf`;

    try {
      setIsComplementRecepisseDownloading(true);
      const response = await requestApiWithFallback(
        apiURL,
        `/api/demande/${demande.id_demande}/complement/recepisse.pdf`,
        {
          method: "get",
          withCredentials: true,
          responseType: "blob",
        },
      );

      const contentDisposition = String(response.headers?.["content-disposition"] || "");
      const filename = pickFilenameFromDisposition(contentDisposition) || fallbackFilename;
      const contentType = String(response.headers?.["content-type"] || "application/pdf");
      const blob =
        response.data instanceof Blob
          ? response.data
          : new Blob([response.data], { type: contentType });

      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
      toast.success("Recepisse de completude telecharge avec succes.");
    } catch (downloadError) {
      console.error("Erreur telechargement recepisse de completude", downloadError);
      toast.error("Impossible de telecharger le recepisse de completude.");
    } finally {
      setIsComplementRecepisseDownloading(false);
    }
  };

  const handleComplementDocumentUpload = async (
    docId: number,
    itemId: number | null,
    file: File,
  ) => {
    if (!demande || !apiURL || !docId || !itemId) return;

    try {
      setUploadingDocIds((prev) => ({ ...prev, [docId]: true }));
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await requestApiWithFallback(
        apiURL,
        `/api/demande/${demande.id_demande}/complement/item/${itemId}/upload`,
        {
          method: "post",
          data: formData,
          withCredentials: true,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      console.info("[DemandeDetails] complement upload response", {
        id_demande: demande.id_demande,
        docId,
        itemId,
        responseData: uploadResponse?.data,
      });

      const nowIso = new Date().toISOString();
      const uploadedFileUrl =
        typeof uploadResponse?.data?.fileUrl === "string" &&
        uploadResponse.data.fileUrl.trim().length > 0
          ? uploadResponse.data.fileUrl.trim()
          : null;

      const mappedDocuments = mapDemandDocumentsPayload(uploadResponse?.data);
      if (mappedDocuments.length > 0) {
        setDocuments(mappedDocuments);
      } else {
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.idDoc === docId
              ? {
                  ...doc,
                  statut: "present",
                  fileUrl: uploadedFileUrl || doc.fileUrl,
                  updatedAt: nowIso,
                }
              : doc,
          ),
        );
      }

      const mappedComplement = parseComplementDetailsPayload(
        uploadResponse?.data?.complement ?? null,
        complementDetails?.generatedAt || null,
      );
      console.info("[DemandeDetails] complement parsed result", {
        id_demande: demande.id_demande,
        docId,
        itemId,
        hasComplement: Boolean(mappedComplement),
        complementStatus: mappedComplement?.statut ?? null,
        itemStatus: mappedComplement?.documents?.find((entry) => entry.id_item === itemId)
          ?.statutReponse ?? null,
      });
      const baseComplement = mappedComplement || complementDetails;
      if (baseComplement) {
        setComplementDetails({
          ...baseComplement,
          documents: baseComplement.documents.map((entry) =>
            entry.id_item === itemId || entry.id_doc === docId
              ? {
                  ...entry,
                  statutReponse: "DOCUMENT_REMPLACE",
                  reponduAt: nowIso,
                  responseFileUrl: uploadedFileUrl || entry.responseFileUrl,
                }
              : entry,
          ),
        });
      }

      toast.success("Document corrige televerse avec succes.");
    } catch (uploadError: any) {
      console.error("Erreur televersement document de complement", uploadError);
      console.error("[DemandeDetails] complement upload error details", {
        id_demande: demande?.id_demande,
        docId,
        itemId,
        status: uploadError?.response?.status ?? null,
        data: uploadError?.response?.data ?? null,
      });
      const apiMessage =
        uploadError?.response?.data?.message &&
        typeof uploadError.response.data.message === "string"
          ? uploadError.response.data.message
          : null;
      toast.error(apiMessage || "Impossible de televerser le document de correction.");
    } finally {
      setUploadingDocIds((prev) => {
        const next = { ...prev };
        delete next[docId];
        return next;
      });
    }
  };

  const handleSubmitComplement = async () => {
    if (!demande || !apiURL || isSubmittingComplement) return;
    if (hasPendingComplementUploads) {
      toast.error("Patientez pendant la fin du televersement du document.");
      return;
    }
    if (!allComplementDocsResponded) {
      toast.error(
        "Veuillez corriger ou remplacer tous les documents demandes avant de soumettre le complement.",
      );
      return;
    }

    try {
      setIsSubmittingComplement(true);
      const submitResponse = await requestApiWithFallback(
        apiURL,
        `/api/demande/${demande.id_demande}/complement/submit`,
        {
          method: "put",
          data: {},
          withCredentials: true,
        },
      );

      const mappedComplement = parseComplementDetailsPayload(
        submitResponse?.data?.complement ?? null,
      );
      if (mappedComplement) {
        setComplementDetails(mappedComplement);
      }

      toast.success(
        "Complement soumis. Votre demande est renvoyee a l administration pour verification.",
      );
      setReloadKey((prev) => prev + 1);
    } catch (submitError: any) {
      const fallbackMessage = "Impossible de soumettre le complement.";
      const apiMessage =
        submitError?.response?.data?.message &&
        typeof submitError.response.data.message === "string"
          ? submitError.response.data.message
          : null;
      toast.error(apiMessage || fallbackMessage);
    } finally {
      setIsSubmittingComplement(false);
    }
  };

  const allComplementDocsResponded = useMemo(() => {
    if (!complementDetails) return false;
    if (complementDetails.documents.length === 0) return true;

    return complementDetails.documents.every((docItem) => {
      if (hasComplementDocumentResponse(docItem)) {
        return true;
      }

      if (typeof docItem.id_doc !== "number" || docItem.id_doc <= 0) {
        return false;
      }

      const currentDoc = documentsById.get(docItem.id_doc);
      const generatedTs = toTimestamp(complementDetails.generatedAt || null);
      const updatedTs = toTimestamp(currentDoc?.updatedAt || null);
      const replacedAfterRequest =
        generatedTs != null && updatedTs != null ? updatedTs >= generatedTs : false;
      const liveStatus = String(currentDoc?.statut || "").trim().toLowerCase();
      const hasFile = Boolean(currentDoc?.fileUrl);
      const isPresent = liveStatus === "present" || hasFile;

      if (docItem.decision === "manquant") {
        return isPresent;
      }

      return isPresent && replacedAfterRequest;
    });
  }, [complementDetails, documentsById]);
  const hasPendingComplementUploads = useMemo(
    () => Object.values(uploadingDocIds).some(Boolean),
    [uploadingDocIds],
  );

  if (isLoading) {
    return (
      <InvestorLayout>
        <BrandLoader label="Chargement de la demande..." />
      </InvestorLayout>
    );
  }

  if (error || !demande) {
    return (
      <InvestorLayout>
        <div className={styles.errorState}>
          <h2>Demande introuvable</h2>
          <p>{error || "Aucune information disponible pour cette demande."}</p>
          <Button onClick={() => navigate(backPath)}>Retour a la liste</Button>
        </div>
      </InvestorLayout>
    );
  }

  const statutValue = demande.statut_demande || "EN_COURS";
  const statutConfig = getStatutConfig(statutValue);
  const StatusIcon = statutConfig.icon;

  const codeDemande = demande.code_demande || `DEM-${demande.id_demande}`;
  const typePermisLabel =
    demande.typePermis?.lib_type || demande.typePermis?.code_type || "--";
  const typeProcedureLabel = demande.typeProcedure?.libelle || "--";
  const detenteurLabel =
    titulaireOverride ||
    demande.detenteur?.nom_societeFR ||
    demande.detenteur?.nom_societeAR ||
    "--";

  const primaryCommune =
    demande.commune?.nom_communeFR ||
    demande.communes?.find((item) => item.principale)?.commune?.nom_communeFR ||
    demande.communes?.[0]?.commune?.nom_communeFR ||
    "--";

  const primaryDaira =
    demande.daira?.nom_dairaFR ||
    demande.communes?.find((item) => item.principale)?.commune?.daira?.nom_dairaFR ||
    demande.communes?.[0]?.commune?.daira?.nom_dairaFR ||
    "--";

  const primaryWilaya =
    demande.wilaya?.nom_wilayaFR ||
    demande.communes?.find((item) => item.principale)?.commune?.daira?.wilaya?.nom_wilayaFR ||
    demande.communes?.[0]?.commune?.daira?.wilaya?.nom_wilayaFR ||
    "--";

  const superficieValue = pickFirstNumber(
    superficieCadastrale,
    demande.superficie,
    demande.superficie_ha,
    demande.superficieHa,
    demande.surface,
  );
  const superficieLabel =
    typeof superficieValue === "number" ? `${superficieValue.toFixed(2)} ha` : "--";

  const dateDepotLabel = formatDate(
    demande.date_demande || demande.procedure?.date_debut_proc || null,
  );

  const totalMontantLabel =
    factureMontant != null
      ? `${factureMontant.toLocaleString("fr-FR")} DZD`
      : "--";
  const paiementEffectue = (factureStatut || "").toUpperCase().includes("PAY");
  const montantPaye = totalMontantLabel !== "--" && paiementEffectue ? totalMontantLabel : "0 DZD";
  const montantRestant = totalMontantLabel !== "--" && paiementEffectue ? "0 DZD" : totalMontantLabel;

  const complementGeneratedLabel = formatDateTime(complementDetails?.generatedAt || null);
  const complementSubmittedLabel = formatDateTime(complementDetails?.submittedAt || null);
  const complementDelaiLabel =
    complementDetails?.delaiJours && complementDetails.delaiJours > 0
      ? `${complementDetails.delaiJours} jours`
      : "--";
  const getComplementDocumentState = (
    docItem: ComplementDetailsState["documents"][number],
  ) => {
    if (String(docItem.statutTraitement || "").trim().toUpperCase() === "TRAITEE") {
      return {
        label: "Valide par le service",
        helper:
          docItem.traiteAt != null
            ? `Valide le ${formatDateTime(docItem.traiteAt)}`
            : "Controle administratif termine",
        className: styles.badgeSuccess,
        cardClassName: styles.complementDocCardSuccess,
      };
    }

    const currentDoc =
      typeof docItem.id_doc === "number" && docItem.id_doc > 0
        ? documentsById.get(docItem.id_doc)
        : null;
    const responseStatus = getComplementResponseStatus(docItem.statutReponse);
    const hasUserResponse = hasComplementDocumentResponse(docItem);
    const generatedTs = toTimestamp(complementDetails?.generatedAt || null);
    const updatedTs = toTimestamp(docItem.reponduAt || currentDoc?.updatedAt || null);
    const replacedAfterRequest =
      generatedTs != null && updatedTs != null ? updatedTs >= generatedTs : false;

    if (isComplementProcessed(complementDetails?.statut)) {
      return {
        label: "Reverifie",
        helper: "Complement repris par l administration",
        className: styles.badgeSuccess,
        cardClassName: styles.complementDocCardSuccess,
      };
    }
    if (responseStatus === "SOUMIS") {
      return {
        label: "Soumis au service",
        helper: "En attente de verification",
        className: styles.badgeSuccess,
        cardClassName: styles.complementDocCardSuccess,
      };
    }
    if (responseStatus === "DOCUMENT_REMPLACE" || hasUserResponse || replacedAfterRequest) {
      return {
        label: "Document corrige",
        helper: "Pret pour la soumission finale",
        className: styles.badgeSuccess,
        cardClassName: styles.complementDocCardSuccess,
      };
    }
    if (isComplementSubmitted(complementDetails?.statut)) {
      return {
        label: "Soumis au service",
        helper: "Joint a la soumission",
        className: styles.badgeSuccess,
        cardClassName: styles.complementDocCardSuccess,
      };
    }
    if (docItem.decision === "manquant") {
      return {
        label: "Depot attendu",
        helper: "Piece toujours absente",
        className: styles.badgeDanger,
        cardClassName: styles.complementDocCardDanger,
      };
    }
    return {
      label: "Correction attendue",
      helper: "Une nouvelle version est attendue",
      className: styles.badgeWarning,
      cardClassName: styles.complementDocCardWarning,
    };
  };
  const canDownloadComplementRecepisse = Boolean(
    complementDetails?.recepissePdfUrl ||
      isComplementSubmitted(complementDetails?.statut),
  );
  const canSubmitComplement = Boolean(
    complementDetails &&
      allComplementDocsResponded &&
      !hasPendingComplementUploads &&
      !isComplementSubmitted(complementDetails.statut) &&
      !isComplementProcessed(complementDetails.statut),
  );
  const handleCloseComplementGuide = () => {
    setShowComplementGuide(false);
  };
  const handleCompleteComplementGuide = () => {
    setShowComplementGuide(false);
  };

  return (
    <InvestorLayout>
      <div className={styles.container}>
        <div className={styles.heroHeader}>
          <div className={styles.heroNav}>
            <Button
              variant="ghost"
              onClick={() => navigate(backPath)}
              className={styles.backButton}
            >
              <ArrowLeft className="w-4 h-4" />
              Retour a la liste
            </Button>
            <Button
              onClick={() => void handleDownloadPDF()}
              className={styles.pdfButton}
              disabled={isPdfGenerating}
            >
              {isPdfGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isPdfGenerating ? "Generation..." : "Telecharger recapitulatif PDF"}
            </Button>
          </div>

          <div className={styles.heroContent}>
            <div className={styles.heroInfo}>
              <div className={styles.heroLabel}>
                <FileCheck className="w-4 h-4" />
                <span>{typePermisLabel}</span>
              </div>
              <h1 className={styles.heroTitle}>{codeDemande}</h1>
              <div className={styles.heroMetaRow}>
                <span className={styles.heroMetaItem}>
                  <Building2 className="w-4 h-4" />
                  <span>{detenteurLabel}</span>
                </span>
                <span className={styles.heroMetaItem}>
                  <Calendar className="w-4 h-4" />
                  <span>Deposee le {dateDepotLabel}</span>
                </span>
              </div>
              <p className={styles.heroSubtitle}>{typeProcedureLabel}</p>
            </div>
            <div className={styles.heroAside}>
              <div className={`${styles.heroStatus} ${statutConfig.className}`}>
                <StatusIcon className="w-5 h-5" />
                <span>{statutConfig.label}</span>
              </div>
            </div>
          </div>

          <div className={styles.progressCard}>
            <div className={styles.progressInfo}>
              <div className={styles.progressLabel}>
                <Clock className="w-4 h-4" />
                <span>Progression du dossier</span>
              </div>
              <span className={styles.progressValue}>{progressInfo.percent}%</span>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progressInfo.percent}%` }} />
            </div>
            <p className={styles.progressStatus}>{progressInfo.label}</p>
          </div>
        </div>

        <div className={styles.mainContent}>
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(
                value as
                  | "general"
                  | "substances"
                | "documents"
                | "completude"
                | "paiements"
                | "historique",
              )
            }
            className={styles.tabs}
          >
            <TabsList className={styles.tabsList}>
              <TabsTrigger value="general" className={styles.tabTrigger}>
                <Eye className="w-4 h-4" />
                <span>Apercu</span>
              </TabsTrigger>
              <TabsTrigger value="substances" className={styles.tabTrigger}>
                <Gem className="w-4 h-4" />
                <span>Substances</span>
              </TabsTrigger>
              <TabsTrigger value="documents" className={styles.tabTrigger}>
                <FileText className="w-4 h-4" />
                <span>Documents</span>
              </TabsTrigger>
              <TabsTrigger value="completude" className={styles.tabTrigger}>
                <AlertCircle className="w-4 h-4" />
                <span>Completude</span>
              </TabsTrigger>
              <TabsTrigger value="paiements" className={styles.tabTrigger}>
                <CreditCard className="w-4 h-4" />
                <span>Paiements</span>
              </TabsTrigger>
              <TabsTrigger value="historique" className={styles.tabTrigger}>
                <History className="w-4 h-4" />
                <span>Historique</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className={styles.tabContent}>
              <div className={styles.infoGrid}>
                <Card className={`${styles.infoCard} ${styles.summaryCard}`}>
                  <CardHeader className={`${styles.cardHeader} ${styles.summaryHeader}`}>
                    <div className={styles.cardIcon}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <CardTitle className={styles.cardTitle}>Titulaire</CardTitle>
                  </CardHeader>
                  <CardContent className={styles.summaryCardContent}>
                    <p className={`${styles.infoValue} ${styles.summaryValue}`}>{detenteurLabel}</p>
                  </CardContent>
                </Card>

                <Card className={`${styles.infoCard} ${styles.summaryCard}`}>
                  <CardHeader className={`${styles.cardHeader} ${styles.summaryHeader}`}>
                    <div className={styles.cardIcon}>
                      <Calendar className="w-5 h-5" />
                    </div>
                    <CardTitle className={styles.cardTitle}>Date de depot</CardTitle>
                  </CardHeader>
                  <CardContent className={styles.summaryCardContent}>
                    <p className={`${styles.infoValue} ${styles.summaryValue}`}>{dateDepotLabel}</p>
                  </CardContent>
                </Card>

                <Card className={`${styles.infoCard} ${styles.summaryCard}`}>
                  <CardHeader className={`${styles.cardHeader} ${styles.summaryHeader}`}>
                    <div className={styles.cardIcon}>
                      <Ruler className="w-5 h-5" />
                    </div>
                    <CardTitle className={styles.cardTitle}>Superficie</CardTitle>
                  </CardHeader>
                  <CardContent className={styles.summaryCardContent}>
                    <p className={`${styles.infoValue} ${styles.summaryValue}`}>{superficieLabel}</p>
                  </CardContent>
                </Card>

                <Card className={`${styles.infoCard} ${styles.fullWidth}`}>
                  <CardHeader className={styles.cardHeader}>
                    <div className={styles.cardIcon}>
                      <MapPin className="w-5 h-5" />
                    </div>
                    <CardTitle className={styles.cardTitle}>Localisation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={styles.locationGrid}>
                      <div className={styles.locationItem}>
                        <span className={styles.locationLabel}>Wilaya</span>
                        <span className={styles.locationValue}>{primaryWilaya}</span>
                      </div>
                      <div className={styles.locationItem}>
                        <span className={styles.locationLabel}>Daira</span>
                        <span className={styles.locationValue}>{primaryDaira}</span>
                      </div>
                      <div className={styles.locationItem}>
                        <span className={styles.locationLabel}>Commune</span>
                        <span className={styles.locationValue}>{primaryCommune}</span>
                      </div>
                    </div>
                    <div className={styles.mapFrame}>
                      {perimetrePoints.length >= 3 ? (
                        <div className={styles.mapCanvas}>
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
                          <div className={styles.simpleLegend}>
                            <span className={styles.legendSwatch} />
                            <span>Votre perimetre</span>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.mapPlaceholder}>
                          <MapPin className="w-8 h-8" />
                          <p>Aucun perimetre disponible</p>
                        </div>
                      )}
                    </div>
                    <PerimeterCoordinatesTable
                      points={perimetrePoints}
                      emptyMessage="Aucun perimetre defini pour cette demande."
                      className={styles.coordinatesBlock}
                    />
                  </CardContent>
                </Card>

              </div>
            </TabsContent>

            <TabsContent value="substances" className={styles.tabContent}>
              <Card className={`${styles.infoCard} ${styles.fullWidth}`}>
                <CardHeader className={styles.cardHeader}>
                  <div className={styles.cardIcon}>
                    <Gem className="w-5 h-5" />
                  </div>
                  <CardTitle className={styles.cardTitle}>Substances minieres</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={styles.substancesList}>
                    {substances.length > 0 ? (
                      substances.map((sub, idx) => (
                        <Badge key={idx} variant="secondary" className={styles.substanceBadge}>
                          {sub}
                        </Badge>
                      ))
                    ) : (
                      <span className={styles.locationValue}>Aucune substance renseignee</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className={styles.tabContent}>
              <div className={styles.documentsList}>
                {documents.length === 0 && (
                  <Card className={styles.documentCard}>
                    <div className={styles.documentInfo}>
                      <h4>Aucun document trouve</h4>
                      <p>Les documents n'ont pas encore ete renseignes.</p>
                    </div>
                  </Card>
                )}
                {documents.map((doc, index) => {
                  const statut = (doc.statut || "").toUpperCase();
                  const isValid = statut.includes("PRESENT") || statut.includes("VALIDE");
                  const isMissing = statut.includes("MANQUANT") || statut.includes("ABSENT");
                  const badgeClass = isValid
                    ? styles.badgeSuccess
                    : isMissing
                    ? styles.badgeDanger
                    : styles.badgeWarning;
                  const badgeLabel = isValid
                    ? "Present"
                    : isMissing
                    ? "Manquant"
                    : doc.statut || "En attente";
                  const docDate = doc.date ? formatDate(doc.date) : "--";
                  const fileUrl = buildDemandeDocumentViewUrl(
                    apiURL,
                    demande?.id_demande,
                    doc.idDoc,
                  );

                  return (
                    <Card key={index} className={styles.documentCard}>
                      <div className={styles.documentIcon}>
                        <FileCheck className="w-6 h-6" />
                      </div>
                      <div className={styles.documentInfo}>
                        <h4>{doc.nom}</h4>
                        <p>
                          <span>{doc.size || "--"}</span>
                          <span>â€¢</span>
                          <span>Televerse le {docDate}</span>
                        </p>
                      </div>
                      <div className={styles.documentActions}>
                        <Badge className={badgeClass}>
                          {isValid ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : isMissing ? (
                            <XCircle className="w-3 h-3" />
                          ) : (
                            <AlertCircle className="w-3 h-3" />
                          )}
                          {badgeLabel}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={styles.downloadIconBtn}
                          onClick={() => fileUrl && window.open(fileUrl, "_blank")}
                          disabled={!fileUrl}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="completude" className={styles.tabContent}>
              <Card className={`${styles.infoCard} ${styles.fullWidth}`}>
                <CardHeader className={styles.cardHeader}>
                  <div className={styles.cardIcon}>
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div className={styles.complementHeaderText}>
                    <CardTitle className={`${styles.cardTitle} ${styles.complementTitle}`}>
                      Complétude du dossier
                    </CardTitle>
                    <p className={styles.complementHeaderHint}>
                      Corrigez les pièces manquantes puis envoyez.
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  {!complementDetails ? (
                    <div className={styles.complementEmpty}>
                      <h4>Aucune demande de completude active</h4>
                      <p>
                        Cette demande ne contient pas de pieces complementaires a fournir pour
                        le moment.
                      </p>
                    </div>
                  ) : (
                    <div className={styles.complementWrap}>
                      <div className={styles.complementHeroPanel} data-onboarding-id="completude-hero">
                        <div className={styles.complementHeroMain}>
                          <div className={styles.complementHeroTopline}>
                            <div className={styles.complementHeroHeading}>
                              <div className={styles.complementHeroIcon}>
                                <AlertCircle className="w-5 h-5" />
                              </div>
                              <div>
                                <h4>Complétude du dossier</h4>
                                <p>Corrigez les pièces manquantes puis envoyez.</p>
                              </div>
                            </div>
                            <Badge className={complementStatusDescriptor.className}>
                              {complementStatusDescriptor.label}
                            </Badge>
                          </div>

                          <div className={styles.complementGaugeRow}>
                            <div className={styles.complementGaugeBlock}>
                              <div
                                className={styles.complementGaugeRing}
                                style={{
                                  background: `conic-gradient(#d84d6b ${
                                    complementCompletionRate * 3.6
                                  }deg, #eceaf1 0deg)`,
                                }}
                              >
                                <div className={styles.complementGaugeInner}>
                                  <strong>{complementCompletionRate}%</strong>
                                </div>
                              </div>
                            </div>
                            <div className={styles.complementGaugeCopy}>
                              <strong>
                                {complementStats.corrected} / {complementStats.total} étapes validées
                              </strong>
                              <div className={styles.complementProgressBar}>
                                <span style={{ width: `${complementCompletionRate}%` }} />
                              </div>
                              <p>
                                {complementStats.remaining} document
                                {complementStats.remaining > 1 ? "s" : ""} à corriger
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className={styles.complementStatGrid}>
                          <div className={styles.complementStatCard}>
                            <div className={styles.complementStatIcon}>
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className={styles.complementStatCopy}>
                              <strong>{complementStats.total}</strong>
                              <span>Reçus</span>
                            </div>
                          </div>
                          <div className={styles.complementStatCard}>
                            <div className={styles.complementStatIcon}>
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div className={styles.complementStatCopy}>
                              <strong>{complementStats.corrected}</strong>
                              <span>Corrigés</span>
                            </div>
                          </div>
                          <div className={styles.complementStatCard}>
                            <div className={styles.complementStatIcon}>
                              <Clock className="w-4 h-4" />
                            </div>
                            <div className={styles.complementStatCopy}>
                              <strong>{complementStats.remaining}</strong>
                              <span>Restant</span>
                            </div>
                          </div>
                        </div>

                        <div className={styles.complementShortcutPanel} data-onboarding-id="completude-actions">
                          <h5>Raccourcis</h5>
                          <div className={styles.complementActionStack}>
                            <Button
                              type="button"
                              variant="outline"
                              className={styles.complementDownloadBtn}
                              onClick={() => void handleDownloadComplementPdf()}
                              disabled={isComplementPdfDownloading}
                            >
                              {isComplementPdfDownloading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                              {isComplementPdfDownloading ? "Chargement..." : "Télécharger la fiche"}
                            </Button>
                            {canDownloadComplementRecepisse && (
                              <Button
                                type="button"
                                variant="outline"
                                className={styles.complementRecepisseBtn}
                                onClick={() => void handleDownloadComplementRecepissePdf()}
                                disabled={isComplementRecepisseDownloading}
                              >
                                {isComplementRecepisseDownloading ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <FileCheck className="w-4 h-4" />
                                )}
                                {isComplementRecepisseDownloading ? "Chargement..." : "Télécharger le reçu"}
                              </Button>
                            )}
                            {!isAdminDetailView && canSubmitComplement && (
                              <Button
                                type="button"
                                className={styles.complementSubmitBtn}
                                onClick={() => void handleSubmitComplement()}
                                disabled={isSubmittingComplement}
                              >
                                {isSubmittingComplement ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                                {isSubmittingComplement ? "Envoi..." : "Envoyer"}
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              className={styles.complementGuideBtn}
                              onClick={() => setShowComplementGuide(true)}
                            >
                              <LifeBuoy className="w-4 h-4" />
                              Besoin d'aide ?
                            </Button>
                          </div>
                          <div className={styles.complementActionNotes}>
                            <span>{`Note: ${complementGeneratedLabel}`}</span>
                            <span>{`Delai: ${complementDelaiLabel}`}</span>
                            <span>{`Etat: ${complementStatutLabel}`}</span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.complementDocsSection} data-onboarding-id="completude-docs">
                        <div className={styles.complementDocsHeader}>
                          <h5>Pièces demandées ({complementDetails.documents.length})</h5>
                          <span>Filtrer par statut</span>
                        </div>

                        <div className={styles.complementTableSection}>
                          <div className={styles.complementTableWrap}>
                            <table className={styles.complementTable}>
                              <thead>
                                <tr>
                                  <th className={styles.complementTableIconHead}></th>
                                  <th className={styles.complementTableNameCol}>Pièce demandée</th>
                                  <th className={styles.complementTableStatusCol}>Statut</th>
                                  <th className={styles.complementTableDetailCol}>Détail</th>
                                  <th className={styles.complementTableDateCol}>Mise à jour</th>
                                  <th className={styles.complementTableActionCol}>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {complementDetails.documents.map((docItem, index) => {
                                  const decisionClass =
                                    docItem.decision === "manquant"
                                      ? styles.badgeDanger
                                      : docItem.decision === "probleme"
                                        ? styles.badgeWarning
                                        : styles.badgeMuted;
                                  const docState = getComplementDocumentState(docItem);
                                  const currentDoc = docItem.id_doc
                                    ? documentsById.get(docItem.id_doc)
                                    : null;
                                  const currentFileUrl =
                                    buildComplementItemViewUrl(
                                      apiURL,
                                      demande?.id_demande,
                                      docItem.id_item,
                                    ) ||
                                    buildDemandeDocumentViewUrl(
                                      apiURL,
                                      demande?.id_demande,
                                      currentDoc?.idDoc ?? docItem.id_doc,
                                    );
                                  const responseStatus = getComplementResponseStatus(
                                    docItem.statutReponse,
                                  );
                                  const generatedTs = toTimestamp(
                                    complementDetails?.generatedAt || null,
                                  );
                                  const updatedTs = toTimestamp(
                                    docItem.reponduAt || currentDoc?.updatedAt || null,
                                  );
                                  const replacedAfterRequest =
                                    generatedTs != null && updatedTs != null
                                      ? updatedTs >= generatedTs
                                      : false;
                                  const hasUserResponse = hasComplementDocumentResponse(docItem);
                                  const currentStatusLabel =
                                    responseStatus === "SOUMIS"
                                      ? "Soumis"
                                      : responseStatus === "DOCUMENT_REMPLACE" ||
                                          hasUserResponse ||
                                          replacedAfterRequest
                                        ? "Document corrigé"
                                        : formatDocumentStatusLabel(
                                            currentDoc?.statut || docItem.statutActuel || "--",
                                          );
                                  const fileStateLabel = !currentFileUrl
                                    ? "Aucun fichier"
                                    : responseStatus === "SOUMIS"
                                      ? "Soumis"
                                      : responseStatus === "DOCUMENT_REMPLACE" ||
                                          hasUserResponse ||
                                          replacedAfterRequest
                                        ? "Document corrigé"
                                        : "Déposé";
                                  const canUpload =
                                    typeof docItem.id_doc === "number" &&
                                    typeof docItem.id_item === "number" &&
                                    docItem.id_item > 0 &&
                                    docItem.id_doc > 0 &&
                                    !isComplementSubmitted(complementDetails?.statut) &&
                                    !isComplementProcessed(complementDetails?.statut);
                                  const docUploadId = canUpload ? docItem.id_doc : null;
                                  const isUploading =
                                    docUploadId != null ? Boolean(uploadingDocIds[docUploadId]) : false;
                                  const rowIconClass =
                                    docState.cardClassName === styles.complementDocCardSuccess
                                      ? styles.complementRowIconSuccess
                                      : docState.cardClassName === styles.complementDocCardDanger
                                        ? styles.complementRowIconDanger
                                        : styles.complementRowIconWarning;

                                  return (
                                    <tr key={`complement-doc-${docItem.id_doc ?? index}`}>
                                      <td className={styles.complementTableIconCell}>
                                        <span className={`${styles.complementRowIcon} ${rowIconClass}`}>
                                          {docState.cardClassName === styles.complementDocCardSuccess ? (
                                            <CheckCircle2 className="w-4 h-4" />
                                          ) : docState.cardClassName === styles.complementDocCardDanger ? (
                                            <XCircle className="w-4 h-4" />
                                          ) : (
                                            <Clock className="w-4 h-4" />
                                          )}
                                        </span>
                                      </td>
                                      <td className={styles.complementTableNameCol}>
                                        <div className={styles.complementDocNameBlock}>
                                          <div className={styles.complementDocNameLine}>
                                            <h4>{docItem.nom_doc}</h4>
                                          </div>
                                          <Badge className={decisionClass}>
                                            {DOC_DECISION_LABELS[docItem.decision]}
                                          </Badge>
                                          <div className={styles.complementDocIssues}>
                                            {docItem.problems.length > 0 ? (
                                              docItem.problems.map((problem) => (
                                                <span
                                                  key={`${docItem.id_item ?? index}-${problem}`}
                                                  className={styles.complementIssueTag}
                                                >
                                                  {DOC_PROBLEM_LABELS[problem] || problem}
                                                </span>
                                              ))
                                            ) : (
                                              <span className={styles.complementIssueTagMuted}>—</span>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                      <td className={styles.complementTableStatusCol}>
                                        <Badge className={docState.className}>{docState.label}</Badge>
                                      </td>
                                      <td className={styles.complementTableDetailCol}>
                                        <div className={styles.complementTableDetails}>
                                          <span>
                                            Initial : {safeText(docItem.statutActuel || "--")}
                                          </span>
                                          <span>Actuel : {currentStatusLabel}</span>
                                        </div>
                                      </td>
                                      <td className={styles.complementTableDateCol}>
                                        <span className={styles.complementTableDate}>
                                          {formatDateTime(docItem.reponduAt || currentDoc?.updatedAt || null)}
                                        </span>
                                      </td>
                                      <td className={styles.complementTableActionCol}>
                                        <div className={styles.complementTableActions}>
                                          {currentFileUrl && (
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className={styles.complementViewBtn}
                                              onClick={() => window.open(currentFileUrl, "_blank")}
                                            >
                                              <Eye className="w-4 h-4" />
                                              Voir
                                            </Button>
                                          )}
                                          {!isAdminDetailView && canUpload && docUploadId != null && (
                                            <>
                                              <input
                                                ref={(node) => {
                                                  complementUploadInputsRef.current[docUploadId] = node;
                                                }}
                                                type="file"
                                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                                                className={styles.hiddenFileInput}
                                                onChange={(event) => {
                                                  const file = event.target.files?.[0];
                                                  event.target.value = "";
                                                  if (!file) return;
                                                  void handleComplementDocumentUpload(
                                                    docUploadId,
                                                    docItem.id_item,
                                                    file,
                                                  );
                                                }}
                                              />
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className={styles.complementUploadBtn}
                                                disabled={isUploading}
                                                onClick={() =>
                                                  complementUploadInputsRef.current[docUploadId]?.click()
                                                }
                                              >
                                                {isUploading ? (
                                                  <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                  <Upload className="w-4 h-4" />
                                                )}
                                                {isUploading ? "Envoi..." : "Déposer"}
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          className={styles.complementHistoryLink}
                          onClick={() =>
                            document
                              .querySelector('[data-onboarding-id="completude-history"]')
                              ?.scrollIntoView({ behavior: "smooth", block: "start" })
                          }
                        >
                          Voir l'historique complet
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className={styles.complementHistorySection} data-onboarding-id="completude-history">
                        <div className={styles.complementDocsHeader}>
                          <h5>Historique</h5>
                          <span>
                            {complementHistoryItems.length} action
                            {complementHistoryItems.length > 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className={styles.timeline}>
                          {complementHistoryItems.map((item) => {
                            const isCompleted = item.state === "completed";
                            const isActive = item.state === "active";
                            return (
                              <div key={item.key} className={styles.timelineItem}>
                                <div
                                  className={`${styles.timelineDot} ${
                                    isCompleted
                                      ? styles.completed
                                      : isActive
                                      ? styles.active
                                      : styles.pending
                                  }`}
                                >
                                  {isCompleted ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                  ) : isActive ? (
                                    <Clock className="w-4 h-4" />
                                  ) : (
                                    <div className={styles.emptyDot} />
                                  )}
                                </div>
                                <div className={styles.timelineContent}>
                                  <div className={styles.timelineHeader}>
                                    <h4>{item.title}</h4>
                                    <Badge
                                      className={
                                        isCompleted
                                          ? styles.badgeSuccess
                                          : isActive
                                          ? styles.badgeWarning
                                          : styles.badgeMuted
                                      }
                                    >
                                      {isCompleted ? "Terminee" : isActive ? "En cours" : "En attente"}
                                    </Badge>
                                  </div>
                                  {item.date && (
                                    <span className={styles.timelineDate}>
                                      {formatDateTime(item.date)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className={styles.complementSupportCard}>
                        <div className={styles.complementSupportLeft}>
                          <div className={styles.complementSupportIcon}>
                            <LifeBuoy className="w-5 h-5" />
                          </div>
                          <div>
                            <h5>Besoin d'aide ?</h5>
                            <p>Consulter notre guide ou contacter le support.</p>
                          </div>
                        </div>
                        <div className={styles.complementSupportRight}>
                          <div className={styles.complementSupportState}>
                            <span>Statut du dossier</span>
                            <Badge className={complementStatusDescriptor.className}>
                              {complementStatusDescriptor.label}
                            </Badge>
                          </div>
                          <div className={styles.complementSupportDate}>
                            <Calendar className="w-4 h-4" />
                            <span>Depuis le {dateDepotLabel}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="paiements" className={styles.tabContent}>
              <div className={styles.paiementsList}>
                {paiements.length === 0 && (
                  <Card className={styles.paiementCard}>
                    <div className={styles.paiementInfo}>
                      <h4>Aucune facture disponible</h4>
                      <p>Le paiement n'a pas encore ete genere.</p>
                    </div>
                  </Card>
                )}
                {paiements.map((paiement, index) => {
                  const statut = (paiement.statut || "").toUpperCase();
                  const isPaid = statut.includes("PAY");
                  const badgeClass = isPaid ? styles.badgeSuccess : styles.badgeWarning;
                  const badgeLabel = isPaid ? "Paye" : paiement.statut || "En attente";

                  return (
                    <Card key={index} className={styles.paiementCard}>
                      <div className={styles.paiementIcon}>
                        <Banknote className="w-6 h-6" />
                      </div>
                      <div className={styles.paiementInfo}>
                        <h4>{paiement.libelle}</h4>
                        <p>
                          {paiement.date ? `Emise le ${formatDate(paiement.date)}` : "--"}
                        </p>
                      </div>
                      <div className={styles.paiementAmount}>
                        <span className={styles.amount}>{paiement.montant}</span>
                        <Badge className={badgeClass}>
                          {isPaid ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {badgeLabel}
                        </Badge>
                      </div>
                    </Card>
                  );
                })}

                <Card className={styles.totalCard}>
                  <div className={styles.totalInfo}>
                    <span>Total a payer</span>
                    <span className={styles.totalAmount}>{totalMontantLabel}</span>
                  </div>
                  <div className={styles.totalStatus}>
                    <span>Paye: {montantPaye}</span>
                    <span>Restant: {montantRestant}</span>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="historique" className={styles.tabContent}>
              {timelineItems.length === 0 ? (
                <Card className={styles.documentCard}>
                  <div className={styles.documentInfo}>
                    <h4>Aucun historique disponible</h4>
                    <p>Les etapes ne sont pas encore chargees.</p>
                  </div>
                </Card>
              ) : (
                <div className={styles.timeline}>
                  {timelineItems.map((item, index) => {
                    const isCompleted = item.state === "completed";
                    const isActive = item.state === "active";

                    return (
                      <div key={index} className={styles.timelineItem}>
                        <div
                          className={`${styles.timelineDot} ${
                            isCompleted
                              ? styles.completed
                              : isActive
                              ? styles.active
                              : styles.pending
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : isActive ? (
                            <Clock className="w-4 h-4" />
                          ) : (
                            <div className={styles.emptyDot} />
                          )}
                        </div>
                        <div className={styles.timelineContent}>
                          <div className={styles.timelineHeader}>
                            <h4>{item.etape}</h4>
                            <Badge
                              className={
                                isCompleted
                                  ? styles.badgeSuccess
                                  : isActive
                                  ? styles.badgeWarning
                                  : styles.badgeMuted
                              }
                            >
                              {item.statut}
                            </Badge>
                          </div>
                          <p className={styles.timelineDesc}>{item.description}</p>
                          {item.date && (
                            <span className={styles.timelineDate}>{formatDate(item.date)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

          </Tabs>
        </div>
      </div>
      <OnboardingTour
        isOpen={showComplementGuide}
        steps={COMPLEMENT_ONBOARDING_STEPS}
        onClose={handleCloseComplementGuide}
        onComplete={handleCompleteComplementGuide}
      />
    </InvestorLayout>
  );
};

export default DemandeDetails;
