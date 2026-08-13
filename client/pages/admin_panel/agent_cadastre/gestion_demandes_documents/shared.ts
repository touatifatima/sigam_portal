import axios from "axios";

export const apiURL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");

export const buildApiUrl = (path: string) =>
  /^https?:\/\//i.test(path) ? path : `${apiURL}${path.startsWith("/") ? path : `/${path}`}`;

export type CadastreStatus =
  | "ENREGISTREE"
  | "VERIFIEE"
  | "EN_COURS_EXAMEN"
  | "ACCEPTEE"
  | "EN_COMPLEMENT"
  | "REJETEE"
  | "GENEREE"
  | "DELIVREE";

export type CadastreDocumentRequest = {
  id: number;
  referenceDemande: string;
  typeDocument?: string | null;
  statut?: CadastreStatus | string | null;
  dateDemande?: string | null;
  dateSoumission?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  numeroRc?: string | null;
  titulaire?: string | null;
  qrCodeTitre?: string | null;
  codePermis?: string | null;
  typePermis?: string | null;
  nin?: string | null;
  nom?: string | null;
  prenom?: string | null;
  emailContact?: string | null;
  telephoneContact?: string | null;
  canalVerification?: string | null;
  otpVerifiedAt?: string | null;
  objetDemande?: string | null;
  qualiteDemandeur?: string | null;
  baseCommunication?: string | null;
  preuvePaiementUrl?: string | null;
  utilisateur?: {
    id?: number;
    username?: string | null;
    email?: string | null;
    nom?: string | null;
    Prenom?: string | null;
    telephone?: string | null;
    detenteur?: {
      nom_societeFR?: string | null;
      nom_societeAR?: string | null;
      email?: string | null;
    } | null;
  } | null;
  permis?: {
    id?: number;
    code_permis?: string | null;
    qr_code?: string | null;
    typePermis?: { lib_type?: string | null; code_type?: string | null } | null;
  } | null;
  piecesJointes?: Array<{
    id: number;
    typePiece?: string | null;
    fichierUrl?: string | null;
    nomFichierOriginal?: string | null;
    mimeType?: string | null;
    tailleOctets?: number | null;
    createdAt?: string | null;
  }>;
  documentsGeneres?: Array<{
    id: number;
    referenceDocument?: string | null;
    typeDocument?: string | null;
    fichierUrl?: string | null;
    dateGeneration?: string | null;
    dateDelivrance?: string | null;
    agentEmetteur?: string | null;
  }>;
  historique?: Array<{
    id: number;
    action?: string | null;
    dateAction?: string | null;
    agentEmetteur?: string | null;
    detailsCommunication?: string | null;
  }>;
};

export type AdminListResponse = {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  items: CadastreDocumentRequest[];
};

export type AdminStats = {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  documentsGenerated: number;
  averageProcessingDays: number;
  byStatus?: Record<string, number>;
  societes?: string[];
};

export const statusLabel = (status?: string | null) => {
  switch (String(status || "").toUpperCase()) {
    case "ENREGISTREE": return "En attente";
    case "VERIFIEE": return "Vérifiée";
    case "EN_COURS_EXAMEN": return "En cours d’examen";
    case "ACCEPTEE": return "Acceptée";
    case "EN_COMPLEMENT": return "Complément demandé";
    case "REJETEE": return "Refusée";
    case "GENEREE": return "Document généré";
    case "DELIVREE": return "Délivrée";
    default: return status || "Inconnu";
  }
};

export const statusClass = (status?: string | null) => {
  const normalized = String(status || "").toUpperCase();
  if (["ACCEPTEE", "GENEREE", "DELIVREE"].includes(normalized)) return "success";
  if (["REJETEE"].includes(normalized)) return "danger";
  if (["EN_COURS_EXAMEN", "VERIFIEE", "EN_COMPLEMENT"].includes(normalized)) return "info";
  return "warning";
};

export const documentLabel = (type?: string | null) =>
  String(type || "").includes("PLAN") ? "Plan cadastral officiel" : "Extrait certifié conforme";

export const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("fr-FR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
};

export const formatBytes = (value?: number | null) => {
  if (!value || value < 1024) return value ? `${value} o` : "—";
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} Ko`;
  return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
};

export const displayName = (item?: CadastreDocumentRequest | null) =>
  [item?.prenom || item?.utilisateur?.Prenom, item?.nom || item?.utilisateur?.nom]
    .filter(Boolean)
    .join(" ") || item?.utilisateur?.username || "Demandeur non renseigné";

export const organizationName = (item?: CadastreDocumentRequest | null) =>
  item?.utilisateur?.detenteur?.nom_societeFR || item?.utilisateur?.detenteur?.nom_societeAR || item?.titulaire || "—";

export const handleApiError = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return String(error.response?.data?.message || fallback);
  }
  return fallback;
};
