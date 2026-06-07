'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import axios from 'axios';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiClock,
  FiDownload,
  FiFileText,
  FiEye,
  FiMapPin,
  FiMessageSquare,
  FiX,
} from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Navbar from '@/pages/navbar/Navbar';
import Sidebar from '@/pages/sidebar/Sidebar';
import EntityMessagesPanel from '@/components/chat/EntityMessagesPanel';
import PerimeterCoordinatesTable from '@/components/perimeter/PerimeterCoordinatesTable';
import type { ArcGISMapRef, Coordinate } from '@/components/arcgismap/ArcgisMap';
import { useViewNavigator } from '@/src/hooks/useViewNavigator';
import { useAuthStore } from '@/src/store/useAuthStore';
import jsPDF from 'jspdf';
import styles from './gestion_demande_detail.module.css';

const ArcGISMap = dynamic<any>(() => import('@/components/arcgismap/ArcgisMap'), {
  ssr: false,
});

const buildApiUrl = (base: string, endpoint: string) => {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const normalizedBase = String(base || '').trim().replace(/\/+$/, '');
  if (!normalizedBase) return normalizedEndpoint;
  return `${normalizedBase}${normalizedEndpoint}`;
};

type StatusAction = 'ACCEPTEE' | 'REJETEE' | 'EN_COMPLEMENT';

type UserMini = {
  id?: number;
  username?: string | null;
  email?: string | null;
  nom?: string | null;
  prenom?: string | null;
  Prenom?: string | null;
  detenteur?: {
    nom_societeFR?: string | null;
    nom_societeAR?: string | null;
  } | null;
};

type ProcedureEtapeItem = {
  id_etape?: number;
  statut?: string | null;
  date_debut?: string | null;
  date_fin?: string | null;
  etape?: {
    nom_etape?: string | null;
    lib_etape?: string | null;
    ordre_etape?: number | null;
  } | null;
};

type PaiementItem = {
  id?: number;
  montant_paye?: number | null;
  etat_paiement?: string | null;
  date_paiement?: string | null;
};

type DemandeDetail = {
  id_demande: number;
  short_code?: string | null;
  code_demande?: string | null;
  statut_demande?: string | null;
  date_demande?: string | null;
  date_instruction?: string | null;
  date_refus?: string | null;
  date_fin_instruction?: string | null;
  remarques?: string | null;
  Nom_Prenom_Resp_Enregist?: string | null;
  montant_produit?: number | null;
  budget_prevu?: number | null;
  montant_paye_total?: number | null;
  superficie?: number | null;
  lieu_ditFR?: string | null;
  utilisateurId?: number;
  utilisateur?: UserMini | null;
  detenteur?: {
    nom_societeFR?: string | null;
    nom_societeAR?: string | null;
    email?: string | null;
  } | null;
  detenteurdemande?: Array<{
    detenteur?: {
      nom_societeFR?: string | null;
      nom_societeAR?: string | null;
      email?: string | null;
    } | null;
  }> | null;
  typePermis?: { id?: number; code_type?: string | null; lib_type?: string | null } | null;
  typeProcedure?: { id?: number; libelle?: string | null } | null;
  wilaya?: { nom_wilayaFR?: string | null } | null;
  daira?: { nom_dairaFR?: string | null } | null;
  commune?: { nom_communeFR?: string | null } | null;
  facture?: {
    id_facture?: number;
    montant_total?: number | null;
    statut?: string | null;
    paiements?: PaiementItem[];
  } | null;
  procedure?: {
    id_proc?: number;
    statut_proc?: string | null;
    date_fin_proc?: string | null;
    ProcedureEtape?: ProcedureEtapeItem[];
  } | null;
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

type MissingSummaryEntry = {
  id_doc: number;
  nom_doc: string;
};

type ProcedureDocumentsResponse = {
  documents?: Array<{
    id_doc: number;
    nom_doc?: string | null;
    statut?: string | null;
    status?: string | null;
    file_url?: string | null;
    is_required?: boolean;
    reject_message?: string | null;
  }>;
  missingSummary?: {
    requiredMissing?: MissingSummaryEntry[];
    blocking?: MissingSummaryEntry[];
    blockingNext?: MissingSummaryEntry[];
    warnings?: MissingSummaryEntry[];
  };
};

type DocProblemCode =
  | 'expire'
  | 'date_invalide'
  | 'illisible'
  | 'non_signe'
  | 'incoherent'
  | 'autre';

type ComplementDocDecision = 'conforme' | 'manquant' | 'probleme';

type ComplementDocForm = {
  id_doc: number;
  nom_doc: string;
  statutActuel: string;
  isRequired: boolean;
  rejectMessage?: string | null;
  file_url?: string | null;
  decision: ComplementDocDecision;
  problems: DocProblemCode[];
  comment: string;
};

type ComplementDetailsPayload = {
  delaiJours: number | null;
  effetAbsence: string | null;
  modeNotification: string | null;
  adminMessage: string | null;
  documents: Array<{
    id_doc: number;
    nom_doc: string;
    decision: ComplementDocDecision;
    problems: DocProblemCode[];
    comment: string | null;
    statutActuel: string;
  }>;
};

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
    decision: ComplementDocDecision | 'inconnu';
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

const formatDate = (value?: string | null) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('fr-FR');
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const safeText = (value?: string | null) => {
  const normalized = String(value ?? '').trim();
  return normalized || '--';
};

const toTimestamp = (value?: string | null) => {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
};

const formatMoney = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'DZD',
    maximumFractionDigits: 2,
  }).format(value);
};

const isTruthyQueryFlag = (value?: string | null) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'oui';
};

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const computeBbox = (points: Array<{ x: number; y: number }>) => {
  if (!Array.isArray(points) || points.length === 0) return null;
  const xs = points.map((p) => p.x).filter((v) => Number.isFinite(v));
  const ys = points.map((p) => p.y).filter((v) => Number.isFinite(v));
  if (!xs.length || !ys.length) return null;
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
};

const normalizeProcedureEtapes = (value: unknown): ProcedureEtapeItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((step: any) => {
      const etapeRaw = step?.etape ?? null;
      return {
        id_etape: toFiniteNumber(step?.id_etape) ?? undefined,
        statut: step?.statut != null ? String(step.statut) : null,
        date_debut: step?.date_debut ?? step?.dateDebut ?? null,
        date_fin: step?.date_fin ?? step?.dateFin ?? null,
        etape: etapeRaw
          ? {
              nom_etape: etapeRaw?.nom_etape ?? etapeRaw?.nomEtape ?? etapeRaw?.lib_etape ?? null,
              lib_etape: etapeRaw?.lib_etape ?? etapeRaw?.nom_etape ?? etapeRaw?.nomEtape ?? null,
              ordre_etape: toFiniteNumber(etapeRaw?.ordre_etape ?? etapeRaw?.ordreEtape),
            }
          : null,
      } as ProcedureEtapeItem;
    })
    .filter(
      (step) =>
        step.id_etape != null ||
        !!step.statut ||
        !!step.date_debut ||
        !!step.date_fin ||
        !!step.etape?.nom_etape ||
        !!step.etape?.lib_etape,
    );
};

const getTitulaire = (item?: DemandeDetail | null) => {
  if (!item) return '--';
  const detenteurDirect = item.detenteur;
  const detenteurFromDemande = item.detenteurdemande?.find((entry) => !!entry?.detenteur)?.detenteur;
  const detenteurFromUser = item.utilisateur?.detenteur;
  const societe =
    detenteurDirect?.nom_societeFR ||
    detenteurDirect?.nom_societeAR ||
    detenteurFromDemande?.nom_societeFR ||
    detenteurFromDemande?.nom_societeAR ||
    detenteurFromUser?.nom_societeFR ||
    detenteurFromUser?.nom_societeAR;
  if (societe) return societe;
  const fullName = [item.utilisateur?.nom, item.utilisateur?.Prenom ?? item.utilisateur?.prenom]
    .filter(Boolean)
    .join(' ')
    .trim();
  return fullName || item.utilisateur?.username || item.utilisateur?.email || '--';
};

const getResponsable = (item?: DemandeDetail | null) => {
  if (!item) return '--';
  if (item.Nom_Prenom_Resp_Enregist) return item.Nom_Prenom_Resp_Enregist;
  const fullName = [item.utilisateur?.nom, item.utilisateur?.Prenom ?? item.utilisateur?.prenom]
    .filter(Boolean)
    .join(' ')
    .trim();
  return fullName || item.utilisateur?.username || item.utilisateur?.email || '--';
};

const getMontantValue = (item?: DemandeDetail | null): number | null => {
  if (!item) return null;
  const paid = toFiniteNumber(item.montant_paye_total);
  if (paid !== null) return paid;
  const legacyMontantProduit = toFiniteNumber(item.montant_produit);
  if (legacyMontantProduit !== null) return legacyMontantProduit;
  const legacyBudget = toFiniteNumber(item.budget_prevu);
  if (legacyBudget !== null) return legacyBudget;
  const factureMontant = toFiniteNumber(item.facture?.montant_total);
  return factureMontant;
};

const DEFAULT_COMPLEMENT_DELAY_DAYS = '15';
const DEFAULT_COMPLEMENT_ABSENCE_EFFECT =
  "Le dossier peut etre rejete ou classe selon la reglementation en vigueur.";
const DEFAULT_COMPLEMENT_NOTIFICATION_MODE = 'Plateforme + courrier electronique';

const DOC_PROBLEM_LABELS: Record<DocProblemCode, string> = {
  expire: 'Document expire',
  date_invalide: 'Date invalide',
  illisible: 'Document illisible',
  non_signe: 'Document non signe',
  incoherent: 'Information incoherente',
  autre: 'Autre probleme',
};

const DOC_PROBLEM_CODES: DocProblemCode[] = [
  'expire',
  'date_invalide',
  'illisible',
  'non_signe',
  'incoherent',
  'autre',
];

const formatComplementDecisionLabel = (
  decision?: ComplementDocDecision | 'inconnu',
) => {
  if (decision === 'manquant') return 'Manquant';
  if (decision === 'probleme') return 'Present avec probleme';
  return 'A verifier';
};

const sanitizePdfText = (value?: string | null) =>
  String(value ?? '--').replace(/[\u00A0\u202F]/g, ' ');

const normalizeDocStatusValue = (value?: string | null) => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'present' || raw === 'valide' || raw === 'conforme') return 'present';
  if (raw === 'manquant' || raw === 'missing') return 'manquant';
  if (raw === 'attente' || raw === 'pending' || raw === 'en_attente') return 'attente';
  return raw || 'attente';
};

const formatDocStatusLabel = (value?: string | null) => {
  const status = normalizeDocStatusValue(value);
  if (status === 'present') return 'Present';
  if (status === 'manquant') return 'Manquant';
  if (status === 'attente') return 'En attente';
  return value || '--';
};

const mapComplementDocsFromProcedurePayload = (
  payload?: ProcedureDocumentsResponse | null,
): ComplementDocForm[] => {
  const missingRequiredIds = new Set(
    (payload?.missingSummary?.requiredMissing ?? []).map((entry) => Number(entry.id_doc)),
  );
  const docs = payload?.documents ?? [];
  return docs.map((doc) => {
    const idDoc = Number(doc.id_doc);
    const rawStatus = normalizeDocStatusValue(doc.statut ?? doc.status);
    const isMissing = missingRequiredIds.has(idDoc) || rawStatus === 'manquant';
    return {
      id_doc: idDoc,
      nom_doc: String(doc.nom_doc || `Document #${idDoc}`),
      statutActuel: rawStatus,
      isRequired: Boolean(doc.is_required),
      rejectMessage: doc.reject_message ?? null,
      file_url: doc.file_url ?? null,
      decision: isMissing ? 'manquant' : 'conforme',
      problems: [],
      comment: '',
    };
  });
};

const buildDocIssueSentence = (doc: ComplementDocForm) => {
  if (doc.decision === 'conforme') return '';
  if (doc.decision === 'manquant') {
    return `${doc.nom_doc}: manquant`;
  }
  const issues = doc.problems.length
    ? doc.problems.map((code) => DOC_PROBLEM_LABELS[code]).join(', ')
    : 'probleme signale';
  const comment = doc.comment.trim();
  return comment
    ? `${doc.nom_doc}: ${issues}. Detail: ${comment}`
    : `${doc.nom_doc}: ${issues}`;
};

const parseComplementDetailsPayload = (payload: unknown): ComplementDetailsState | null => {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Record<string, any>;
  const rawDocuments = Array.isArray(raw.documents)
    ? raw.documents
    : Array.isArray(raw.items)
      ? raw.items
      : [];

  const documents: ComplementDetailsState['documents'] = rawDocuments.map((entry: any) => {
    const normalizedDecision = String(entry?.decision || '').trim().toLowerCase();
    const decision: ComplementDocDecision | 'inconnu' =
      normalizedDecision === 'manquant' ||
      normalizedDecision === 'probleme' ||
      normalizedDecision === 'conforme'
        ? normalizedDecision
        : 'inconnu';
    const problems: DocProblemCode[] = Array.isArray(entry?.problems)
      ? entry.problems
          .map((item: any) => String(item || '').trim().toLowerCase())
          .filter((item: string): item is DocProblemCode => DOC_PROBLEM_CODES.includes(item as DocProblemCode))
      : [];
    return {
      id_item: Number.isFinite(Number(entry?.id_item)) ? Number(entry.id_item) : null,
      id_doc: Number.isFinite(Number(entry?.id_doc)) ? Number(entry.id_doc) : null,
      nom_doc: String(entry?.nom_doc || entry?.nom_doc_snapshot || 'Document'),
      decision,
      problems,
      comment: String(entry?.comment || entry?.commentaire || '').trim() || null,
      statutActuel:
        String(entry?.statutActuel || entry?.statut_actuel_snapshot || '').trim() || null,
      statutReponse:
        String(entry?.statutReponse || entry?.statut_reponse || '').trim() || null,
      reponduAt:
        (typeof entry?.reponduAt === 'string' && entry.reponduAt.trim()) ||
        (typeof entry?.repondu_at === 'string' && entry.repondu_at.trim()) ||
        null,
      responseFileUrl:
        String(entry?.responseFileUrl || entry?.reponse_file_url || '').trim() || null,
      statutTraitement:
        String(entry?.statutTraitement || entry?.statut_traitement || '').trim() || null,
      traiteAt:
        (typeof entry?.traiteAt === 'string' && entry.traiteAt.trim()) ||
        (typeof entry?.traite_at === 'string' && entry.traite_at.trim()) ||
        null,
      traiteBy:
        Number.isFinite(Number(entry?.traiteBy ?? entry?.traite_by))
          ? Number(entry?.traiteBy ?? entry?.traite_by)
          : null,
      noteTraitement:
        String(entry?.noteTraitement || entry?.note_traitement || '').trim() || null,
    };
  });

  const hasSignal =
    Boolean(raw?.statut || raw?.statut_complement || raw?.createdAt || raw?.submitted_at) ||
    documents.length > 0;
  if (!hasSignal) return null;

  return {
    id_complement: Number.isFinite(Number(raw.id_complement))
      ? Number(raw.id_complement)
      : null,
    statut:
      (typeof raw.statut === 'string' && raw.statut.trim()) ||
      (typeof raw.statut_complement === 'string' && raw.statut_complement.trim()) ||
      null,
    generatedAt:
      (typeof raw.generatedAt === 'string' && raw.generatedAt.trim()) ||
      (typeof raw.createdAt === 'string' && raw.createdAt.trim()) ||
      (typeof raw.created_at === 'string' && raw.created_at.trim()) ||
      null,
    submittedAt:
      (typeof raw.submittedAt === 'string' && raw.submittedAt.trim()) ||
      (typeof raw.submitted_at === 'string' && raw.submitted_at.trim()) ||
      null,
    updatedAt:
      (typeof raw.updatedAt === 'string' && raw.updatedAt.trim()) ||
      (typeof raw.updated_at === 'string' && raw.updated_at.trim()) ||
      null,
    motif: (typeof raw.motif === 'string' && raw.motif.trim()) || null,
    delaiJours:
      Number.isFinite(Number(raw.delaiJours ?? raw.delai_jours)) &&
      Number(raw.delaiJours ?? raw.delai_jours) > 0
        ? Math.trunc(Number(raw.delaiJours ?? raw.delai_jours))
        : null,
    effetAbsence:
      (typeof raw.effetAbsence === 'string' && raw.effetAbsence.trim()) ||
      (typeof raw.effet_absence === 'string' && raw.effet_absence.trim()) ||
      null,
    modeNotification:
      (typeof raw.modeNotification === 'string' && raw.modeNotification.trim()) ||
      (typeof raw.mode_notification === 'string' && raw.mode_notification.trim()) ||
      null,
    adminMessage:
      (typeof raw.adminMessage === 'string' && raw.adminMessage.trim()) ||
      (typeof raw.admin_message === 'string' && raw.admin_message.trim()) ||
      null,
    pdfUrl:
      (typeof raw.pdfUrl === 'string' && raw.pdfUrl.trim()) ||
      (typeof raw.pdf_url === 'string' && raw.pdf_url.trim()) ||
      null,
    pdfFilename:
      (typeof raw.pdfFilename === 'string' && raw.pdfFilename.trim()) ||
      (typeof raw.pdf_filename === 'string' && raw.pdf_filename.trim()) ||
      null,
    recepissePdfUrl:
      (typeof raw.recepissePdfUrl === 'string' && raw.recepissePdfUrl.trim()) ||
      (typeof raw.recepisse_pdf_url === 'string' && raw.recepisse_pdf_url.trim()) ||
      null,
    recepissePdfFilename:
      (typeof raw.recepissePdfFilename === 'string' && raw.recepissePdfFilename.trim()) ||
      (typeof raw.recepisse_pdf_filename === 'string' && raw.recepisse_pdf_filename.trim()) ||
      null,
    documents,
  };
};

const isComplementSubmitted = (statut?: string | null) =>
  String(statut || '').trim().toUpperCase() === 'SOUMISE';

const isComplementProcessed = (statut?: string | null) => {
  const key = String(statut || '').trim().toUpperCase();
  return key === 'TRAITEE' || key === 'CLOTUREE' || key === 'VALIDEE';
};

const getComplementResponseStatus = (value?: string | null) =>
  String(value || '').trim().toUpperCase();

const isDocumentPresentStatus = (value?: string | null) =>
  normalizeDocStatusValue(value) === 'present';

export default function GestionDemandeDetailAdminPage() {
  const apiURL = process.env.NEXT_PUBLIC_API_URL || '';
  const router = useRouter();
  const { auth, isLoaded, hasPermission } = useAuthStore();
  const { currentView, navigateTo } = useViewNavigator('manage_demandes');

  const demandeId = useMemo(() => {
    if (!router.isReady) return null;

    const fromQuery = Array.isArray(router.query.id_demande)
      ? router.query.id_demande[0]
      : router.query.id_demande;
    const queryValue = String(fromQuery || '').trim();
    if (queryValue) {
      return decodeURIComponent(queryValue);
    }

    const fromPath = String(router.asPath || '').match(
      /\/admin_panel\/gestion-demandes\/([^/?#]+)/i,
    )?.[1];
    if (fromPath) {
      return decodeURIComponent(fromPath);
    }

    return null;
  }, [router.asPath, router.isReady, router.query.id_demande]);

  const hasValidId = typeof demandeId === 'string' && demandeId.trim().length > 0;

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [demande, setDemande] = useState<DemandeDetail | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [complementDetails, setComplementDetails] = useState<ComplementDetailsState | null>(null);
  const [selectedComplementItemIds, setSelectedComplementItemIds] = useState<number[]>([]);
  const [complementProcessingNote, setComplementProcessingNote] = useState<string>('');
  const [validatingComplementItems, setValidatingComplementItems] = useState<boolean>(false);
  const [mapPoints, setMapPoints] = useState<Coordinate[]>([]);
  const [mapZone, setMapZone] = useState<number | undefined>(undefined);
  const [procedureEtapes, setProcedureEtapes] = useState<ProcedureEtapeItem[]>([]);
  const mapRef = useRef<ArcGISMapRef | null>(null);
  const loadedIdRef = useRef<string | null>(null);

  const [motifModalOpen, setMotifModalOpen] = useState<boolean>(false);
  const [motifAction, setMotifAction] = useState<StatusAction>('REJETEE');
  const [motifText, setMotifText] = useState<string>('');
  const [complementDocsLoading, setComplementDocsLoading] = useState<boolean>(false);
  const [complementDocsError, setComplementDocsError] = useState<string | null>(null);
  const [complementDocs, setComplementDocs] = useState<ComplementDocForm[]>([]);
  const [complementDelayDays, setComplementDelayDays] = useState<string>(
    DEFAULT_COMPLEMENT_DELAY_DAYS,
  );
  const [complementAbsenceEffect, setComplementAbsenceEffect] = useState<string>(
    DEFAULT_COMPLEMENT_ABSENCE_EFFECT,
  );
  const [complementNotificationMode, setComplementNotificationMode] = useState<string>(
    DEFAULT_COMPLEMENT_NOTIFICATION_MODE,
  );
  const messagesSectionRef = useRef<HTMLElement | null>(null);

  const isAdmin =
    hasPermission('Admin-Panel') ||
    String(auth?.role ?? '')
      .toLowerCase()
      .includes('admin');

  const codeDemande = useMemo(() => {
    if (!demande) return hasValidId ? String(demandeId) : '--';
    return demande.code_demande || `DEM-${demande.id_demande}`;
  }, [demande, demandeId, hasValidId]);
  const demandeurUserId = useMemo(() => {
    const candidate = Number(demande?.utilisateurId || demande?.utilisateur?.id || 0);
    if (!Number.isFinite(candidate) || candidate <= 0) return null;
    return Math.trunc(candidate);
  }, [demande?.utilisateur?.id, demande?.utilisateurId]);

  const shouldJumpToMessages = useMemo(() => {
    const tabRaw = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab;
    const focusComposerRaw = Array.isArray(router.query.focusComposer)
      ? router.query.focusComposer[0]
      : router.query.focusComposer;
    const focusMessageRaw = Array.isArray(router.query.focusMessageId)
      ? router.query.focusMessageId[0]
      : router.query.focusMessageId;
    const tab = String(tabRaw || '').trim().toLowerCase();
    return (
      tab === 'messages' ||
      isTruthyQueryFlag(focusComposerRaw ? String(focusComposerRaw) : '') ||
      Number(focusMessageRaw || 0) > 0
    );
  }, [router.query.focusComposer, router.query.focusMessageId, router.query.tab]);

  const documentsById = useMemo(() => {
    const map = new Map<number, DocumentItem>();
    documents.forEach((doc) => {
      if (typeof doc.idDoc === 'number' && Number.isFinite(doc.idDoc) && doc.idDoc > 0) {
        map.set(doc.idDoc, doc);
      }
    });
    return map;
  }, [documents]);

  const buildDocumentViewUrl = useCallback(
    (idDoc?: number | null) => {
      if (!hasValidId || !idDoc) return null;
      return buildApiUrl(apiURL, `/api/demande/${demandeId}/document/${idDoc}/file`);
    },
    [apiURL, demandeId, hasValidId],
  );

  const buildComplementItemViewUrl = useCallback(
    (idItem?: number | null) => {
      if (!hasValidId || !idItem) return null;
      return buildApiUrl(
        apiURL,
        `/api/demande/${demandeId}/complement/item/${idItem}/file`,
      );
    },
    [apiURL, demandeId, hasValidId],
  );

  const complementPdfDownloadUrl = useMemo(() => {
    if (!hasValidId) return null;
    return buildApiUrl(apiURL, `/api/demande/${demandeId}/mise-en-demeure.pdf`);
  }, [apiURL, demandeId, hasValidId]);

  const complementRecepisseDownloadUrl = useMemo(() => {
    if (!hasValidId) return null;
    return buildApiUrl(apiURL, `/api/demande/${demandeId}/complement/recepisse.pdf`);
  }, [apiURL, demandeId, hasValidId]);

  const getCurrentComplementDocument = useCallback(
    (docItem: ComplementDetailsState['documents'][number]) => {
      if (typeof docItem.id_doc !== 'number' || docItem.id_doc <= 0) {
        return null;
      }
      return documentsById.get(docItem.id_doc) ?? null;
    },
    [documentsById],
  );

  const isComplementDocumentReady = useCallback(
    (docItem: ComplementDetailsState['documents'][number]) => {
      const responseStatus = getComplementResponseStatus(docItem.statutReponse);
      if (responseStatus === 'SOUMIS') {
        return true;
      }

      const currentDoc = getCurrentComplementDocument(docItem);
      const hasCurrentFile = Boolean(currentDoc?.fileUrl);
      const currentStatus = normalizeDocStatusValue(currentDoc?.statut);
      const isCurrentlyPresent = currentStatus === 'present' || hasCurrentFile;
      if (!isCurrentlyPresent) {
        return false;
      }

      const generatedTs = toTimestamp(complementDetails?.generatedAt || null);
      const updatedTs =
        toTimestamp(docItem.reponduAt || null) ??
        toTimestamp(currentDoc?.updatedAt || null) ??
        toTimestamp(currentDoc?.date || null);
      const replacedAfterRequest =
        generatedTs != null && updatedTs != null ? updatedTs >= generatedTs : false;

      if (
        responseStatus === 'DOCUMENT_REMPLACE' &&
        (isCurrentlyPresent || Boolean(docItem.responseFileUrl))
      ) {
        return true;
      }

      if (
        Boolean(docItem.responseFileUrl) &&
        (docItem.decision === 'manquant' || replacedAfterRequest)
      ) {
        return true;
      }

      if (!isComplementSubmitted(complementDetails?.statut)) {
        return false;
      }

      if (docItem.decision === 'manquant') {
        return true;
      }

      return replacedAfterRequest;
    },
    [complementDetails?.generatedAt, complementDetails?.statut, getCurrentComplementDocument],
  );

  const isComplementDocumentResponded = useCallback(
    (docItem: ComplementDetailsState['documents'][number]) => {
      const responseStatus = getComplementResponseStatus(docItem.statutReponse);
      if (responseStatus === 'DOCUMENT_REMPLACE' || responseStatus === 'SOUMIS') {
        return true;
      }

      const currentDoc = getCurrentComplementDocument(docItem);
      const hasCurrentFile = Boolean(currentDoc?.fileUrl);
      const currentStatus = normalizeDocStatusValue(currentDoc?.statut);
      const isCurrentlyPresent = currentStatus === 'present' || hasCurrentFile;

      const generatedTs = toTimestamp(complementDetails?.generatedAt || null);
      const updatedTs =
        toTimestamp(currentDoc?.updatedAt || null) ??
        toTimestamp(currentDoc?.date || null);
      const replacedAfterRequest =
        generatedTs != null && updatedTs != null ? updatedTs >= generatedTs : false;

      if (docItem.decision === 'manquant') {
        return isCurrentlyPresent;
      }

      return isCurrentlyPresent && replacedAfterRequest;
    },
    [complementDetails?.generatedAt, getCurrentComplementDocument],
  );

  const complementStatusDescriptor = useMemo(() => {
    if (!complementDetails) return null;
    const statut = String(complementDetails.statut || '').trim().toUpperCase();
    const respondedCount = complementDetails.documents.filter((docItem) =>
      isComplementDocumentResponded(docItem),
    ).length;
    const processedCount = complementDetails.documents.filter(
      (docItem) =>
        String(docItem.statutTraitement || '').trim().toUpperCase() === 'TRAITEE',
    ).length;
    const totalCount = complementDetails.documents.length;
    if (isComplementProcessed(statut)) {
      return {
        label: 'Complement reverifie',
        description:
          "Le service instructeur a traite la reponse du demandeur et le dossier a repris son cycle normal.",
        className: styles.docStatusSuccess,
        toneClassName: styles.complementStateSuccess,
      };
    }
    if (respondedCount > 0 && !isComplementSubmitted(statut)) {
      return {
        label: 'Documents remplaces',
        description: `${respondedCount} document(s) ont ete corriges. Le demandeur doit encore soumettre officiellement le complement.`,
        className: styles.docStatusSuccess,
        toneClassName: styles.complementStateSuccess,
      };
    }
    if (isComplementSubmitted(statut)) {
      if (processedCount > 0 && processedCount < totalCount) {
        return {
          label: 'Verification en cours',
          description: `${processedCount} document(s) ont deja ete traites. Le reliquat reste en cours de reverification.`,
          className: styles.docStatusWarning,
          toneClassName: styles.complementStatePending,
        };
      }
      return {
        label: 'Complement recu',
        description:
          "Le demandeur a soumis les documents corriges. Une reverification administrative est attendue.",
        className: styles.docStatusSuccess,
        toneClassName: styles.complementStateSuccess,
      };
    }
    return {
      label: 'Complement en attente',
      description:
        "Une demande de regularisation est ouverte et attend encore une reponse du demandeur.",
      className: styles.docStatusWarning,
      toneClassName: styles.complementStatePending,
    };
  }, [complementDetails, isComplementDocumentReady, isComplementDocumentResponded]);

  const complementProcessingStats = useMemo(() => {
    if (!complementDetails) {
      return {
        total: 0,
        processed: 0,
        remaining: 0,
        selectableIds: [] as number[],
        ready: 0,
        responded: 0,
      };
    }

    const responded = complementDetails.documents.filter((docItem) =>
      isComplementDocumentResponded(docItem),
    ).length;
    const selectableIds = complementDetails.documents
      .filter(
        (docItem) =>
          typeof docItem.id_item === 'number' &&
          docItem.id_item > 0 &&
          String(docItem.statutTraitement || '').trim().toUpperCase() !== 'TRAITEE' &&
          isComplementDocumentReady(docItem),
      )
      .map((docItem) => Number(docItem.id_item));

    const processed = complementDetails.documents.filter(
      (docItem) =>
        String(docItem.statutTraitement || '').trim().toUpperCase() === 'TRAITEE',
    ).length;

    return {
      total: complementDetails.documents.length,
      processed,
      remaining: Math.max(0, complementDetails.documents.length - processed),
      selectableIds,
      ready: selectableIds.length,
      responded,
    };
  }, [complementDetails, isComplementDocumentReady, isComplementDocumentResponded]);

  const complementHistoryRows = useMemo(() => {
    if (!complementDetails) return [];

    const rows: Array<{
      key: string;
      title: string;
      description: string;
      date: string | null;
      state: 'done' | 'active' | 'pending';
    }> = [];

    rows.push({
      key: 'requested',
      title: 'Demande de complement emise',
      description:
        safeText(complementDetails.motif || complementDetails.adminMessage) !== '--'
          ? safeText(complementDetails.motif || complementDetails.adminMessage)
          : "L'administration a demande une regularisation du dossier.",
      date: complementDetails.generatedAt,
      state: 'done',
    });

    const updatedDocs = complementDetails.documents.filter((docItem) =>
      isComplementDocumentResponded(docItem),
    );

    if (updatedDocs.length > 0) {
      const latestUpdate =
        updatedDocs
          .map(
            (docItem) =>
              docItem.reponduAt ||
              documentsById.get(Number(docItem.id_doc))?.updatedAt ||
              null,
          )
          .filter(Boolean)
          .sort()
          .at(-1) || null;

      rows.push({
        key: 'updated',
        title: 'Documents corriges par le demandeur',
        description: `${updatedDocs.length} document(s) ont ete remplaces ou remis a jour apres notification.`,
        date: latestUpdate,
        state: isComplementSubmitted(complementDetails.statut) || isComplementProcessed(complementDetails.statut)
          ? 'done'
          : 'active',
      });
    }

    if (complementDetails.submittedAt) {
      rows.push({
        key: 'submitted',
        title: 'Complement soumis',
        description:
          "Le dossier est repasse en cours et attend maintenant la reverification du service instructeur.",
        date: complementDetails.submittedAt,
        state: isComplementProcessed(complementDetails.statut) ? 'done' : 'active',
      });
    } else {
      rows.push({
        key: 'waiting',
        title: 'Soumission en attente',
        description: 'Le demandeur doit encore soumettre officiellement son complement.',
        date: null,
        state: 'pending',
      });
    }

    const processedDocs = complementDetails.documents.filter(
      (docItem) =>
        String(docItem.statutTraitement || '').trim().toUpperCase() === 'TRAITEE',
    );
    if (processedDocs.length > 0) {
      const latestProcessedAt =
        processedDocs
          .map((docItem) => docItem.traiteAt)
          .filter(Boolean)
          .sort()
          .at(-1) || null;

      rows.push({
        key: 'processed-docs',
        title: 'Documents traites par l administration',
        description: `${processedDocs.length} document(s) de complÃ©tude ont ete valides apres controle.`,
        date: latestProcessedAt,
        state: processedDocs.length === complementDetails.documents.length ? 'done' : 'active',
      });
    }

    if (isComplementProcessed(complementDetails.statut)) {
      rows.push({
        key: 'processed',
        title: 'Reverification administrative',
        description:
          "Le complement a ete repris dans l'instruction et n'est plus en attente cote administration.",
        date: complementDetails.submittedAt || complementDetails.generatedAt,
        state: 'done',
      });
    }

    return rows;
  }, [complementDetails, documentsById, isComplementDocumentResponded]);

  useEffect(() => {
    setSelectedComplementItemIds([]);
    setComplementProcessingNote('');
  }, [complementDetails?.id_complement, complementDetails?.updatedAt]);

  const timelineRows = useMemo(() => {
    const rows: Array<{ title: string; date: string; state: 'done' | 'active' | 'pending' }> = [];
    if (!demande) return rows;

    if (demande.date_demande) rows.push({ title: 'Depot de la demande', date: demande.date_demande, state: 'done' });
    const inlineEtapes = normalizeProcedureEtapes(
      (demande as any)?.procedure?.ProcedureEtape ??
        (demande as any)?.procedure?.procedureEtapes ??
        (demande as any)?.ProcedureEtape ??
        [],
    );
    const etapesSource = procedureEtapes.length > 0 ? procedureEtapes : inlineEtapes;
    const etapes = Array.isArray(etapesSource)
      ? [...etapesSource].sort(
          (a, b) => Number(a.etape?.ordre_etape || 0) - Number(b.etape?.ordre_etape || 0),
        )
      : [];
    etapes.forEach((step) => {
      const raw = String(step.statut || '').toUpperCase();
      const state = raw.includes('TERM') ? 'done' : raw.includes('COURS') ? 'active' : 'pending';
      rows.push({
        title: step.etape?.nom_etape || step.etape?.lib_etape || 'Etape',
        date: step.date_fin || step.date_debut || '',
        state,
      });
    });
    if (demande.date_instruction) rows.push({ title: 'Instruction', date: demande.date_instruction, state: 'done' });
    if (demande.date_refus) rows.push({ title: 'Rejet', date: demande.date_refus, state: 'done' });
    if (demande.date_fin_instruction) {
      rows.push({ title: 'Fin instruction', date: demande.date_fin_instruction, state: 'done' });
    }
    if (rows.length === 0 && demande.statut_demande) {
      rows.push({ title: `Statut actuel: ${demande.statut_demande}`, date: '', state: 'active' });
    }
    return rows;
  }, [demande, procedureEtapes]);

  const fetchDetails = useCallback(async () => {
    if (!apiURL || !hasValidId) return;
    setLoading(true);
    setError(null);
    try {
      const detailRes = await axios.get<DemandeDetail>(
        `${apiURL}/demandes_dashboard/${encodeURIComponent(String(demandeId))}`,
        {
          withCredentials: true,
        },
      );
      const payload = detailRes.data ?? null;
      const resolvedDemandeId = Number((payload as any)?.id_demande);
      if (!Number.isFinite(resolvedDemandeId) || resolvedDemandeId <= 0) {
        throw new Error('Identifiant interne de demande introuvable');
      }
      setDemande(payload);
      const procedureId = toFiniteNumber((payload as any)?.procedure?.id_proc ?? (payload as any)?.id_proc);

      const [docsRes, provRes, coordsRes, complementRes] = await Promise.all([
        axios
          .get(`${apiURL}/api/procedure/${resolvedDemandeId}/documents`, {
            withCredentials: true,
          })
          .catch(() => null),
        procedureId
          ? axios.get(`${apiURL}/inscription-provisoire/procedure/${procedureId}`, {
              withCredentials: true,
            }).catch(() => null)
          : Promise.resolve(null),
        procedureId
          ? axios.get(`${apiURL}/coordinates/procedure/${procedureId}`, {
              withCredentials: true,
            }).catch(() => null)
          : Promise.resolve(null),
        axios
          .get(`${apiURL}/api/demande/${resolvedDemandeId}/complements/latest`, {
            withCredentials: true,
          })
          .catch(() => null),
      ]);

      const docsPayload = Array.isArray((docsRes as any)?.data?.documents) ? (docsRes as any).data.documents : [];
      const dossierDate = (docsRes as any)?.data?.dossierFournis?.date_depot ?? null;
      const mappedDocs = docsPayload.map((doc: any) => ({
        idDoc: Number.isFinite(Number(doc?.id_doc)) ? Number(doc.id_doc) : null,
        nom: String(doc?.nom_doc || 'Document'),
        statut: String(doc?.statut || 'EN_ATTENTE'),
        date: dossierDate,
        size: doc?.taille_doc ? String(doc.taille_doc) : null,
        fileUrl: doc?.file_url || null,
        updatedAt: doc?.updated_at || null,
      }));
      setDocuments(mappedDocs);
      setComplementDetails(parseComplementDetailsPayload((complementRes as any)?.data ?? null));

      const detailEtapes = normalizeProcedureEtapes(
        (payload as any)?.procedure?.ProcedureEtape ??
          (payload as any)?.procedure?.procedureEtapes ??
          (payload as any)?.ProcedureEtape,
      );
      if (detailEtapes.length > 0) {
        setProcedureEtapes(detailEtapes);
      } else if (procedureId) {
        const etapesRes = await axios
          .get(`${apiURL}/api/procedure-etape/procedure/${procedureId}`, {
            withCredentials: true,
          })
          .catch(() => null);
        const etapesPayload = (etapesRes as any)?.data;
        const fallbackEtapes = normalizeProcedureEtapes(
          etapesPayload?.ProcedureEtape ?? etapesPayload?.procedureEtapes ?? etapesPayload?.etapes ?? [],
        );
        setProcedureEtapes(fallbackEtapes);
      } else {
        setProcedureEtapes([]);
      }

      const provisionalPoints = Array.isArray((provRes as any)?.data?.points)
        ? (provRes as any).data.points
        : [];
      const coordsPayload = Array.isArray((coordsRes as any)?.data) ? (coordsRes as any).data : [];
      const pointsSource = coordsPayload.length > 0 ? coordsPayload : provisionalPoints;
      const pointsSourceName =
        coordsPayload.length > 0 ? 'coordinates/procedure' : 'inscription_provisoire.points';
      const mappedPoints = pointsSource
        .map((item: any, index: number) => {
          const coord = item?.coordonnee ?? item;
          const x = Number(coord?.x);
          const y = Number(coord?.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
          const zoneRaw = coord?.zone;
          const zone = zoneRaw != null ? Number(zoneRaw) : undefined;
          const hemisphere: 'N' = 'N';
          const system = (coord?.system as Coordinate['system']) || 'UTM';
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

      const zoneValues = Array.from(
        new Set(
          mappedPoints
            .map((point: any) => point?.zone)
            .filter((zone: any) => Number.isFinite(zone))
            .map((zone: number) => Number(zone)),
        ),
      );
      const hemisphereValues = Array.from(
        new Set(
          mappedPoints
            .map((point: any) => point?.hemisphere)
            .filter((hemisphere: any) => typeof hemisphere === 'string' && hemisphere.length > 0),
        ),
      );
      const systemValues = Array.from(
        new Set(
          mappedPoints
            .map((point: any) => point?.system)
            .filter((system: any) => typeof system === 'string' && system.length > 0),
        ),
      );
      const uniqueCoordinatesCount = new Set(
        mappedPoints.map((point: any) => `${Number(point?.x).toFixed(6)}|${Number(point?.y).toFixed(6)}`),
      ).size;
      const bbox = computeBbox(mappedPoints as Array<{ x: number; y: number }>);
      const diagnosticId = (payload as any)?.code_demande || `id_demande=${resolvedDemandeId}`;
      console.groupCollapsed(`[AdminDemandeMap] Diagnostics ${diagnosticId}`);
      console.log('source', {
        sourceType: pointsSourceName,
        rawSourcePoints: pointsSource.length,
        provisionalPoints: provisionalPoints.length,
        coordinatesPoints: coordsPayload.length,
      });
      console.log('mapped', {
        mappedPoints: mappedPoints.length,
        filteredOut: Math.max(0, pointsSource.length - mappedPoints.length),
        uniqueCoordinatesCount,
        systems: systemValues,
        zones: zoneValues,
        hemispheres: hemisphereValues,
        bbox,
      });
      if (mappedPoints.length < 3) {
        console.warn(
          `[AdminDemandeMap] Polygon will not render: only ${mappedPoints.length} usable points (needs >= 3).`,
        );
      } else if (uniqueCoordinatesCount < 3) {
        console.warn(
          `[AdminDemandeMap] Polygon may fail: only ${uniqueCoordinatesCount} unique coordinate pairs.`,
        );
      }
      console.groupEnd();

      setMapPoints(mappedPoints);
      setMapZone(mappedPoints.find((point: any) => Number.isFinite(point?.zone))?.zone);
    } catch (err) {
      console.error('Erreur chargement detail demande admin', err);
      loadedIdRef.current = null;
      setError('Impossible de charger la fiche detaillee de la demande.');
      setDemande(null);
      setDocuments([]);
      setComplementDetails(null);
      setProcedureEtapes([]);
      setMapPoints([]);
      setMapZone(undefined);
    } finally {
      setLoading(false);
    }
  }, [apiURL, demandeId, hasValidId]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isAdmin) {
      router.replace('/unauthorized/page?reason=missing_permissions');
      return;
    }
    if (!router.isReady) return;
    if (!hasValidId) {
      loadedIdRef.current = null;
      setLoading(false);
      setError('Identifiant de demande invalide.');
      return;
    }
    if (loadedIdRef.current === String(demandeId)) return;
    loadedIdRef.current = String(demandeId);
    fetchDetails();
  }, [demandeId, fetchDetails, hasValidId, isAdmin, isLoaded, router, router.isReady]);

  useEffect(() => {
    if (!isLoaded || !isAdmin) return;
    if (!router.isReady || !hasValidId || !apiURL) return;

    const triggerRefresh = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      void fetchDetails();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerRefresh();
      }
    };

    window.addEventListener('focus', triggerRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', triggerRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [apiURL, fetchDetails, hasValidId, isAdmin, isLoaded, router.isReady]);

  useEffect(() => {
    if (!success) return;
    const timeoutId = window.setTimeout(() => setSuccess(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [success]);

  useEffect(() => {
    if (mapPoints.length < 3) return;
    const timeoutId = window.setTimeout(() => {
      mapRef.current?.zoomToCurrentPolygon?.();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [mapPoints]);

  useEffect(() => {
    if (!router.isReady || loading || !shouldJumpToMessages) return;
    if (!messagesSectionRef.current) return;
    const timeoutId = window.setTimeout(() => {
      messagesSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 140);
    return () => window.clearTimeout(timeoutId);
  }, [loading, router.isReady, shouldJumpToMessages]);

  const buildDemandeComplementPdf = (
    item: DemandeDetail,
    motif: string,
    fileName: string,
    complementDetails?: ComplementDetailsPayload,
  ) => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginX = 14;
    const contentWidth = pageWidth - marginX * 2;
    const fieldsX = marginX + 8;
    const fieldsWidth = contentWidth - 16;
    let y = 10;

    const codeDemande = sanitizePdfText(
      item.code_demande || item.short_code || `DEM-${item.id_demande}`,
    );
    const referenceComplement = `DRC-${new Date().getFullYear()}-${String(item.id_demande ?? '0').padStart(6, '0')}`;
    const generationTs = formatDateTime(new Date().toISOString());
    const typePermis = sanitizePdfText(
      item.typePermis?.lib_type || item.typePermis?.code_type || '--',
    );
    const titulaire = sanitizePdfText(getTitulaire(item));
    const responsable = sanitizePdfText(getResponsable(item));
    const delaiLabel =
      complementDetails?.delaiJours && complementDetails.delaiJours > 0
        ? `${complementDetails.delaiJours} jours calendaires a compter de la notification`
        : '15 jours calendaires a compter de la notification';
    const effetAbsenceLabel =
      complementDetails?.effetAbsence?.trim() || DEFAULT_COMPLEMENT_ABSENCE_EFFECT;
    const modeNotificationLabel =
      complementDetails?.modeNotification?.trim() ||
      DEFAULT_COMPLEMENT_NOTIFICATION_MODE;
    const flaggedDocuments = (complementDetails?.documents ?? [])
      .filter((entry) => entry.decision !== 'conforme')
      .map((entry) => {
        if (entry.decision === 'manquant') return `${entry.nom_doc}: manquant`;
        const issueLabels = entry.problems.length
          ? entry.problems.map((code) => DOC_PROBLEM_LABELS[code]).join(', ')
          : 'probleme signale';
        const comment = String(entry.comment || '').trim();
        return comment
          ? `${entry.nom_doc}: ${issueLabels}. Detail: ${comment}`
          : `${entry.nom_doc}: ${issueLabels}`;
      });
    const champ1Label =
      flaggedDocuments.length > 0 ? flaggedDocuments.join(' | ') : motif || '--';

    const drawLabelValue = (label: string, value: string) => {
      const cleanValue = sanitizePdfText(value || '--');
      const labelWidth = 63;
      const valueWidth = fieldsWidth - labelWidth - 2;
      const valueLines = pdf.splitTextToSize(cleanValue, valueWidth);
      const blockHeight = Math.max(6.8, valueLines.length * 4 + 1.8);

      pdf.setTextColor(44, 57, 70);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.4);
      pdf.text(`${label} :`, fieldsX, y + 4.8);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.4);
      pdf.text(valueLines, fieldsX + labelWidth, y + 4.8);

      y += blockHeight + 3.5;
    };

    pdf.setDrawColor(25, 71, 106);
    pdf.setLineWidth(0.6);
    pdf.rect(marginX, y, contentWidth, pageHeight - 20, 'S');

    pdf.setTextColor(30, 53, 73);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.7);
    pdf.text('REPUBLIQUE ALGERIENNE DEMOCRATIQUE ET POPULAIRE', pageWidth / 2, y + 6, {
      align: 'center',
    });
    pdf.setFontSize(8.4);
    pdf.text('MINISTERE DE L\'ENERGIE ET DES MINES', pageWidth / 2, y + 10.6, {
      align: 'center',
    });
    pdf.setFontSize(8.1);
    pdf.text('AGENCE NATIONALE DES ACTIVITES MINIERES (ANAM)', pageWidth / 2, y + 15, {
      align: 'center',
    });
    pdf.setDrawColor(25, 71, 106);
    pdf.line(marginX + 3, y + 18, pageWidth - marginX - 3, y + 18);
    pdf.setFontSize(11.7);
    pdf.text('DEMANDE DE REGULARISATION / PIECES COMPLEMENTAIRES', pageWidth / 2, y + 24, {
      align: 'center',
    });
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(88, 97, 106);
    pdf.setFontSize(8);
    pdf.text('Document de suivi pour demande de complement', pageWidth / 2, y + 28, {
      align: 'center',
    });
    y += 33;

    pdf.setTextColor(25, 71, 106);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10.2);
    pdf.text('Informations de regularisation', fieldsX, y);
    pdf.setDrawColor(25, 71, 106);
    pdf.line(fieldsX, y + 1.8, fieldsX + fieldsWidth, y + 1.8);
    y += 6.5;

    const rows: Array<[string, string]> = [
      ['Reference demande complement', referenceComplement],
      ['Code demande', codeDemande],
      ['Pieces manquantes ou irregularites', champ1Label],
      ['Delai imparti', delaiLabel],
      ['Effet de l\'absence de reponse', effetAbsenceLabel],
      ['Mode de notification', modeNotificationLabel],
      ['Titulaire / Demandeur', titulaire],
      ['Type de permis', typePermis],
      ['Responsable instruction', responsable],
    ];
    rows.forEach((row) => drawLabelValue(row[0], row[1]));

    pdf.setTextColor(100, 109, 118);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.2);
    pdf.text(`Code demande: ${codeDemande}`, marginX, pageHeight - 11);
    pdf.text(`Genere le ${generationTs}`, pageWidth - marginX, pageHeight - 11, { align: 'right' });
    pdf.save(fileName);
  };

  const resetComplementForm = () => {
    setComplementDocsLoading(false);
    setComplementDocsError(null);
    setComplementDocs([]);
    setComplementDelayDays(DEFAULT_COMPLEMENT_DELAY_DAYS);
    setComplementAbsenceEffect(DEFAULT_COMPLEMENT_ABSENCE_EFFECT);
    setComplementNotificationMode(DEFAULT_COMPLEMENT_NOTIFICATION_MODE);
  };

  const resolveInternalDemandeId = () => {
    const internalDemandeId = Number(demande?.id_demande ?? demandeId);
    if (!Number.isFinite(internalDemandeId) || internalDemandeId <= 0) {
      return null;
    }
    return Math.trunc(internalDemandeId);
  };

  const loadComplementDocuments = async (internalDemandeId: number) => {
    if (!apiURL) return;
    setComplementDocsLoading(true);
    setComplementDocsError(null);
    try {
      const response = await axios.get<ProcedureDocumentsResponse>(
        `${apiURL}/api/procedure/${internalDemandeId}/documents`,
        { withCredentials: true },
      );
      setComplementDocs(mapComplementDocsFromProcedurePayload(response.data));
    } catch (err) {
      console.error('Erreur chargement docs complement (detail)', err);
      setComplementDocs([]);
      setComplementDocsError(
        "Impossible de precharger les documents. Vous pouvez saisir un motif manuel.",
      );
    } finally {
      setComplementDocsLoading(false);
    }
  };

  const updateComplementDocDecision = (
    idDoc: number,
    decision: ComplementDocDecision,
  ) => {
    setComplementDocs((prev) =>
      prev.map((entry) => {
        if (entry.id_doc !== idDoc) return entry;
        if (decision === 'conforme') {
          return {
            ...entry,
            decision,
            problems: [],
            comment: '',
          };
        }
        if (decision === 'manquant') {
          return {
            ...entry,
            decision,
            problems: [],
          };
        }
        return {
          ...entry,
          decision,
        };
      }),
    );
  };

  const toggleComplementProblem = (idDoc: number, code: DocProblemCode) => {
    setComplementDocs((prev) =>
      prev.map((entry) => {
        if (entry.id_doc !== idDoc) return entry;
        const exists = entry.problems.includes(code);
        return {
          ...entry,
          problems: exists
            ? entry.problems.filter((problem) => problem !== code)
            : [...entry.problems, code],
        };
      }),
    );
  };

  const updateComplementComment = (idDoc: number, comment: string) => {
    setComplementDocs((prev) =>
      prev.map((entry) =>
        entry.id_doc === idDoc
          ? {
              ...entry,
              comment,
            }
          : entry,
      ),
    );
  };

  const runStatusAction = async (
    action: StatusAction,
    motif?: string,
    complementDetails?: ComplementDetailsPayload,
  ) => {
    if (!apiURL || !hasValidId) return false;
    const internalDemandeId = resolveInternalDemandeId();
    if (!internalDemandeId) {
      setError("Impossible de determiner l'identifiant interne de la demande.");
      return false;
    }
    try {
      setSubmitting(true);
      setError(null);
      await axios.put(
        `${apiURL}/api/demande/${internalDemandeId}/status`,
        {
          statut_demande: action,
          rejectionReason: motif,
          complementDetails,
        },
        { withCredentials: true },
      );

      if (action === 'EN_COMPLEMENT' && demande) {
        const code = sanitizePdfText(
          demande.code_demande || demande.short_code || `DEM-${demande.id_demande}`,
        );
        const safeCode = code.replace(/[^a-zA-Z0-9-_]/g, '_');
        buildDemandeComplementPdf(
          demande,
          motif || '',
          `demande_complement_${safeCode}.pdf`,
          complementDetails,
        );
      }

      setSuccess(
        action === 'ACCEPTEE'
          ? 'Demande validee avec succes.'
          : action === 'REJETEE'
          ? 'Demande rejetee avec succes.'
          : 'Demande marquee en complement.',
      );
      await fetchDetails();
      return true;
    } catch (err) {
      console.error('Erreur action statut (detail admin)', err);
      setError("Echec de l'operation de changement de statut.");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const openMotifModal = async (action: StatusAction) => {
    setError(null);
    setMotifAction(action);
    setMotifText('');
    resetComplementForm();
    setMotifModalOpen(true);

    if (action !== 'EN_COMPLEMENT') return;
    const internalDemandeId = resolveInternalDemandeId();
    if (!internalDemandeId) {
      setComplementDocsError('Identifiant interne de demande introuvable.');
      return;
    }
    await loadComplementDocuments(internalDemandeId);
  };

  const confirmMotifAction = async () => {
    const trimmedMotif = motifText.trim();
    if (motifAction === 'REJETEE' && !trimmedMotif) {
      setError('Le motif est obligatoire pour cette action.');
      return;
    }

    let finalMotif = trimmedMotif;
    let complementDetails: ComplementDetailsPayload | undefined = undefined;

    if (motifAction === 'EN_COMPLEMENT') {
      const flaggedDocs = complementDocs.filter((entry) => entry.decision !== 'conforme');
      const invalidProblemDoc = flaggedDocs.find(
        (entry) =>
          entry.decision === 'probleme' &&
          entry.problems.length === 0 &&
          !entry.comment.trim(),
      );

      if (invalidProblemDoc) {
        setError(
          `Precisez le probleme pour "${invalidProblemDoc.nom_doc}" (case a cocher ou commentaire).`,
        );
        return;
      }

      if (flaggedDocs.length === 0 && !trimmedMotif) {
        setError('Selectionnez au moins un document a completer ou saisissez un motif.');
        return;
      }

      const parsedDelay = Number.parseInt(complementDelayDays, 10);
      const safeDelay =
        Number.isFinite(parsedDelay) && parsedDelay > 0 ? parsedDelay : null;
      const documentLines = flaggedDocs
        .map((entry) => buildDocIssueSentence(entry))
        .filter((line) => line.length > 0);

      const motifFromDocs =
        documentLines.length > 0
          ? `Documents a completer: ${documentLines.join(' | ')}`
          : '';
      finalMotif = [motifFromDocs, trimmedMotif].filter(Boolean).join(' ; ');

      complementDetails = {
        delaiJours: safeDelay,
        effetAbsence: complementAbsenceEffect.trim() || null,
        modeNotification: complementNotificationMode.trim() || null,
        adminMessage: trimmedMotif || null,
        documents: flaggedDocs.map((entry) => ({
          id_doc: entry.id_doc,
          nom_doc: entry.nom_doc,
          decision: entry.decision,
          problems: entry.problems,
          comment: entry.comment.trim() || null,
          statutActuel: entry.statutActuel,
        })),
      };
    }

    const success = await runStatusAction(motifAction, finalMotif, complementDetails);
    if (success) {
      setMotifModalOpen(false);
      resetComplementForm();
    }
  };

  const complementGeneratedLabel = formatDateTime(complementDetails?.generatedAt || null);
  const complementSubmittedLabel = formatDateTime(complementDetails?.submittedAt || null);
  const complementDelaiLabel =
    complementDetails?.delaiJours && complementDetails.delaiJours > 0
      ? `${complementDetails.delaiJours} jours`
      : '--';
  const complementStatutLabel = useMemo(() => {
    if (!complementDetails) return '--';

    const statut = String(complementDetails.statut || '').trim().toUpperCase();
    if (isComplementProcessed(statut)) {
      return 'Traite et valide';
    }
    if (isComplementSubmitted(statut)) {
      return 'Soumis pour verification';
    }
    if (complementProcessingStats.responded > 0) {
      return `Documents corriges (${complementProcessingStats.responded} reponse(s))`;
    }
    return 'En attente de reponse';
  }, [complementDetails, complementProcessingStats.responded]);
  const getAdminComplementDocumentState = (
    docItem: ComplementDetailsState['documents'][number],
  ) => {
    const currentDoc = getCurrentComplementDocument(docItem);
    const responseStatus = getComplementResponseStatus(docItem.statutReponse);
    const liveStatus = normalizeDocStatusValue(currentDoc?.statut ?? docItem.statutActuel);
    const generatedTs = toTimestamp(complementDetails?.generatedAt || null);
    const updatedTs =
      toTimestamp(docItem.reponduAt || currentDoc?.updatedAt || null) ??
      toTimestamp(currentDoc?.date || null);
    const replacedAfterRequest =
      generatedTs != null && updatedTs != null ? updatedTs >= generatedTs : false;
    const isReadyForValidation = isComplementDocumentReady(docItem);
    if (String(docItem.statutTraitement || '').trim().toUpperCase() === 'TRAITEE') {
      return {
        label: 'Traite',
        helper:
          docItem.traiteAt != null
            ? `Document valide par l'administration le ${formatDateTime(docItem.traiteAt)}.`
            : "Document valide par l'administration.",
        className: styles.docStatusSuccess,
        cardClassName: styles.complementDocItemSuccess,
      };
    }
    if (isComplementProcessed(complementDetails?.statut)) {
      return {
        label: 'Reverifie',
        helper: "Le document a deja ete repris dans le controle administratif.",
        className: styles.docStatusSuccess,
        cardClassName: styles.complementDocItemSuccess,
      };
    }
    if (responseStatus === 'SOUMIS') {
      return {
        label: 'Soumis au service',
        helper:
          "Le demandeur a finalise ce document dans sa soumission de complement. Il est pret pour verification administrative.",
        className: styles.docStatusSuccess,
        cardClassName: styles.complementDocItemSuccess,
      };
    }
    if (responseStatus === 'DOCUMENT_REMPLACE') {
      return {
        label: 'Corrige par le demandeur',
        helper:
          'Une nouvelle version a ete televersee. Le demandeur doit encore soumettre officiellement le complement.',
        className: styles.docStatusSuccess,
        cardClassName: styles.complementDocItemResponded,
      };
    }
    if (isReadyForValidation) {
      return {
        label: liveStatus === 'present' ? 'Present' : 'Corrige',
        helper:
          replacedAfterRequest || docItem.decision === 'manquant'
            ? "Le document remplace est bien importe et pret pour validation admin."
            : 'Le document est present et peut etre traite.',
        className: styles.docStatusSuccess,
        cardClassName: styles.complementDocItemSuccess,
      };
    }
    if (isComplementSubmitted(complementDetails?.statut)) {
      return {
        label: 'Soumis',
        helper: 'Le document a ete transmis avec la soumission de completude.',
        className: styles.docStatusSuccess,
        cardClassName: styles.complementDocItemResponded,
      };
    }
    if (docItem.decision === 'manquant') {
      return {
        label: 'Attendu',
        helper: 'Aucun depot corrige n a encore ete fourni pour cette piece.',
        className: styles.docStatusDanger,
        cardClassName: styles.complementDocItemDanger,
      };
    }
    return {
      label: 'Correction attendue',
      helper: 'Le fichier existe mais reste non conforme selon la demande de complement.',
      className: styles.docStatusWarning,
      cardClassName: styles.complementDocItemWarning,
    };
  };

  const toggleComplementItemSelection = (itemId: number) => {
    setSelectedComplementItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId],
    );
  };

  const selectAllPendingComplementItems = () => {
    setSelectedComplementItemIds(complementProcessingStats.selectableIds);
  };

  const clearComplementItemSelection = () => {
    setSelectedComplementItemIds([]);
  };

  const handleValidateSelectedComplementItems = async () => {
    if (!apiURL || validatingComplementItems) return;
    const internalDemandeId = resolveInternalDemandeId();
    if (!internalDemandeId) {
      setError("Impossible de determiner l'identifiant interne de la demande.");
      return;
    }

    const targetItemIds =
      selectedComplementItemIds.length > 0
        ? selectedComplementItemIds
        : complementProcessingStats.selectableIds;

    if (!targetItemIds.length) {
      setError('Aucun document de completude pret a etre traite.');
      return;
    }

    try {
      setValidatingComplementItems(true);
      setError(null);
      const response = await axios.put(
        `${apiURL}/api/demande/${internalDemandeId}/complement/items/validate`,
        {
          itemIds: targetItemIds,
          noteTraitement: complementProcessingNote.trim() || null,
        },
        { withCredentials: true },
      );

      const mappedComplement = parseComplementDetailsPayload(
        response?.data?.complement ?? null,
      );
      if (mappedComplement) {
        setComplementDetails(mappedComplement);
      } else {
        await fetchDetails();
      }

      setSuccess(
        typeof response?.data?.message === 'string' && response.data.message.trim()
          ? response.data.message
          : 'Documents de complÃ©tude traites avec succes.',
      );
      setSelectedComplementItemIds([]);
      setComplementProcessingNote('');
    } catch (processingError: any) {
      console.error('Erreur validation complement admin', processingError);
      const apiMessage =
        typeof processingError?.response?.data?.message === 'string'
          ? processingError.response.data.message
          : null;
      setError(apiMessage || "Impossible de valider les documents selectionnes.");
    } finally {
      setValidatingComplementItems(false);
    }
  };

  if (!isLoaded || !isAdmin) {
    return (
      <div className={styles.loadingScreen}>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.mainContent}>
          <section className={styles.hero}>
            <div className={styles.heroTop}>
              <Button variant="outline" className={styles.backBtn} onClick={() => router.push('/admin_panel/gestion-demandes')}>
                <FiArrowLeft /> Retour a la liste
              </Button>
              <div className={styles.heroActions}>
                <Button className={styles.validateBtn} disabled={submitting || loading} onClick={() => runStatusAction('ACCEPTEE')}>
                  <FiCheck /> Valider
                </Button>
                <Button className={styles.rejectBtn} disabled={submitting || loading} onClick={() => openMotifModal('REJETEE')}>
                  <FiX /> Rejeter
                </Button>
                <Button className={styles.complementBtn} disabled={submitting || loading} onClick={() => openMotifModal('EN_COMPLEMENT')}>
                  <FiAlertCircle /> Demander pieces
                </Button>
              </div>
            </div>
            <h1>{codeDemande}</h1>
            <p>
              {demande?.typePermis?.lib_type || demande?.typePermis?.code_type || '--'} |{' '}
              {demande?.typeProcedure?.libelle || '--'}
            </p>
            <div className={styles.heroMeta}>
              <Badge className={styles.metaBadge}>Statut: {demande?.statut_demande || '--'}</Badge>
              <Badge className={styles.metaBadge}>Depot: {formatDate(demande?.date_demande)}</Badge>
              <Badge className={styles.metaBadge}>Titulaire: {getTitulaire(demande)}</Badge>
            </div>
          </section>

          {error && (
            <div className={`${styles.alert} ${styles.alertError}`}>
              <FiAlertCircle />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className={`${styles.alert} ${styles.alertSuccess}`}>
              <FiCheck />
              <span>{success}</span>
            </div>
          )}

          <section className={styles.cardsGrid}>
            <article className={styles.card}>
              <h3>Informations generales</h3>
              <div className={styles.infoGrid}>
                <div><strong>Code</strong><span>{codeDemande}</span></div>
                <div><strong>Type procedure</strong><span>{demande?.typeProcedure?.libelle || '--'}</span></div>
                <div><strong>Type permis</strong><span>{demande?.typePermis?.lib_type || '--'}</span></div>
                <div><strong>Montant</strong><span>{formatMoney(getMontantValue(demande))}</span></div>
                <div><strong>Date depot</strong><span>{formatDate(demande?.date_demande)}</span></div>
                <div><strong>Responsable</strong><span>{getResponsable(demande)}</span></div>
              </div>
            </article>

            <article className={styles.card}>
              <h3>Titulaire et localisation</h3>
              <div className={styles.infoGrid}>
                <div><strong>Titulaire</strong><span>{getTitulaire(demande)}</span></div>
                <div><strong>Email</strong><span>{demande?.utilisateur?.email || '--'}</span></div>
                <div><strong>Wilaya</strong><span>{demande?.wilaya?.nom_wilayaFR || '--'}</span></div>
                <div><strong>Daira</strong><span>{demande?.daira?.nom_dairaFR || '--'}</span></div>
                <div><strong>Commune</strong><span>{demande?.commune?.nom_communeFR || '--'}</span></div>
                <div><strong>Lieu-dit</strong><span>{demande?.lieu_ditFR || '--'}</span></div>
              </div>
            </article>
          </section>

          <section className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3><FiMapPin /> Carte ArcGIS du perimetre</h3>
              <span>{mapPoints.length} points</span>
            </div>
            <div className={styles.mapWrap}>
              {mapPoints.length >= 3 ? (
                <div className={styles.mapCanvas}>
                  <ArcGISMap
                    ref={mapRef as any}
                    points={mapPoints}
                    superficie={Number(demande?.superficie || 0)}
                    isDrawing={false}
                    coordinateSystem="UTM"
                    utmZone={mapZone}
                    utmHemisphere="N"
                    editable={false}
                    disableEnterpriseLayers
                  />
                  <div className={styles.simpleLegend}>
                    <span className={styles.legendSwatch} />
                    <span>Perimetre de la demande</span>
                  </div>
                </div>
              ) : (
                <div className={styles.mapPlaceholder}>
                  <FiMapPin />
                  <p>Aucune geometrie disponible pour cette demande.</p>
                </div>
              )}
            </div>
            <PerimeterCoordinatesTable
              points={mapPoints}
              emptyMessage="Aucun perimetre defini pour cette demande."
              className={styles.coordinatesBlock}
            />
          </section>

          <section className={styles.splitGrid}>
            <article className={styles.card}>
              <h3><FiClock /> Timeline / Historique</h3>
              {loading ? (
                <p className={styles.muted}>Chargement...</p>
              ) : timelineRows.length === 0 ? (
                <p className={styles.muted}>Aucun historique disponible.</p>
              ) : (
                <div className={styles.timeline}>
                  {timelineRows.map((row, idx) => (
                    <div key={`${row.title}-${idx}`} className={styles.timelineRow}>
                      <span className={`${styles.dot} ${styles[row.state]}`} />
                      <div>
                        <p>{row.title}</p>
                        <small>{formatDate(row.date)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className={styles.card}>
              <h3><FiFileText /> Documents</h3>
              {documents.length === 0 ? (
                <p className={styles.muted}>Aucun document recupere.</p>
              ) : (
                <div className={styles.docsList}>
                  {documents.map((doc, idx) => {
                    const fileUrl = buildDocumentViewUrl(doc.idDoc);
                    return (
                      <div key={`${doc.nom}-${idx}`} className={styles.docRow}>
                        <div>
                          <p>{doc.nom}</p>
                          <small>{doc.size || '--'} | {formatDate(doc.date)}</small>
                        </div>
                        <div className={styles.docActions}>
                          <Badge className={styles.docStatus}>{doc.statut}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fileUrl && window.open(fileUrl, '_blank')}
                            disabled={!fileUrl}
                          >
                            <FiDownload /> Ouvrir
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          </section>

          <section className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3><FiAlertCircle /> Suivi de completude</h3>
              <span>
                {complementDetails ? 'Cycle de regularisation' : 'Aucune demande de complement'}
              </span>
            </div>
            {!complementDetails ? (
              <p className={styles.muted}>
                Aucune fiche de complÃ©tude n a encore ete enregistree pour cette demande.
              </p>
            ) : (
              <div className={styles.complementSection}>
                {complementStatusDescriptor && (
                  <div
                    className={`${styles.complementStateBanner} ${complementStatusDescriptor.toneClassName}`}
                  >
                    <div className={styles.complementStateHeader}>
                      <h4>Etat de la complÃ©tude</h4>
                      <Badge className={complementStatusDescriptor.className}>
                        {complementStatusDescriptor.label}
                      </Badge>
                    </div>
                    <p>{complementStatusDescriptor.description}</p>
                  </div>
                )}

                <div className={styles.complementSummaryGrid}>
                  <div className={styles.complementSummaryCard}>
                    <span>Date de notification</span>
                    <strong>{complementGeneratedLabel}</strong>
                  </div>
                  <div className={styles.complementSummaryCard}>
                    <span>Date de soumission</span>
                    <strong>{complementSubmittedLabel}</strong>
                  </div>
                  <div className={styles.complementSummaryCard}>
                    <span>Delai de reponse</span>
                    <strong>{complementDelaiLabel}</strong>
                  </div>
                  <div className={styles.complementSummaryCard}>
                    <span>Mode de notification</span>
                    <strong>{safeText(complementDetails.modeNotification)}</strong>
                  </div>
                  <div className={styles.complementSummaryCard}>
                    <span>Statut complement</span>
                    <strong>{complementStatutLabel}</strong>
                  </div>
                  <div className={styles.complementSummaryCard}>
                    <span>Statut demande</span>
                    <strong>{safeText(demande?.statut_demande)}</strong>
                  </div>
                </div>

                <div className={styles.complementActionRow}>
                  {complementPdfDownloadUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.open(complementPdfDownloadUrl, '_blank')}
                    >
                      <FiDownload /> Telecharger la fiche de complement
                    </Button>
                  )}
                  {complementRecepisseDownloadUrl &&
                    (complementDetails.recepissePdfUrl || complementDetails.submittedAt) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.open(complementRecepisseDownloadUrl, '_blank')}
                    >
                      <FiDownload /> Telecharger le recepisse de completude
                    </Button>
                  )}
                </div>

                <div className={styles.complementBatchPanel}>
                  <div className={styles.complementBatchHeader}>
                    <div>
                      <h4>Traitement admin des documents</h4>
                      <p>
                        {complementProcessingStats.processed} / {complementProcessingStats.total}{' '}
                        document(s) deja traites.
                      </p>
                    </div>
                    <Badge
                      className={
                        complementProcessingStats.remaining === 0
                          ? styles.docStatusSuccess
                          : styles.docStatusWarning
                      }
                    >
                      {complementProcessingStats.remaining === 0
                        ? 'Tout traite'
                        : `${complementProcessingStats.remaining} restant(s)`}
                    </Badge>
                  </div>

                  {complementProcessingStats.selectableIds.length > 0 ? (
                    <>
                      <label className={styles.complementBatchNote}>
                        <span>Note de traitement admin</span>
                        <textarea
                          rows={3}
                          value={complementProcessingNote}
                          onChange={(e) => setComplementProcessingNote(e.target.value)}
                          placeholder="Observation interne ou note de validation (optionnel)"
                        />
                      </label>
                      <div className={styles.complementBatchActions}>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={selectAllPendingComplementItems}
                          disabled={validatingComplementItems}
                        >
                          Tout cocher
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={clearComplementItemSelection}
                          disabled={
                            validatingComplementItems || complementProcessingStats.selectableIds.length === 0
                          }
                        >
                          Reinitialiser
                        </Button>
                        <Button
                          type="button"
                          className={styles.complementValidateBtn}
                          onClick={handleValidateSelectedComplementItems}
                          disabled={
                            validatingComplementItems || complementProcessingStats.selectableIds.length === 0
                          }
                        >
                          {validatingComplementItems
                            ? 'Validation...'
                            : selectedComplementItemIds.length > 0
                              ? `Valider la selection (${selectedComplementItemIds.length})`
                              : `Valider les documents prets (${complementProcessingStats.selectableIds.length})`}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className={styles.complementBatchMuted}>
                      {complementProcessingStats.remaining === 0
                        ? 'Tous les documents de cette complÃ©tude sont deja traites.'
                        : 'Les documents doivent etre corriges puis soumis officiellement par le demandeur avant validation admin.'}
                    </p>
                  )}
                </div>

                {(complementDetails.motif || complementDetails.adminMessage) && (
                  <div className={styles.complementNoticeBlock}>
                    <h4>Motif admin</h4>
                    <p>{safeText(complementDetails.motif || complementDetails.adminMessage)}</p>
                  </div>
                )}

                {complementDetails.effetAbsence && (
                  <div className={styles.complementNoticeBlock}>
                    <h4>Effet en cas d'absence de reponse</h4>
                    <p>{safeText(complementDetails.effetAbsence)}</p>
                  </div>
                )}

                <div className={styles.complementSubsection}>
                  <div className={styles.sectionHeader}>
                    <h3><FiFileText /> Documents concernes</h3>
                    <span>
                      {complementDetails.documents.length} document
                      {complementDetails.documents.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  {complementDetails.documents.length === 0 ? (
                    <p className={styles.muted}>
                      La fiche existe mais ne contient aucun document detaille.
                    </p>
                  ) : (
                    <div className={styles.tableSection}>
                      <div className={styles.tableWrap}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Document</th>
                              <th>Details</th>
                              <th className={styles.checkboxCol}>Systeme coche</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {complementDetails.documents.map((docItem, index) => {
                              const problemsLabel = docItem.problems
                                .map((problem) => DOC_PROBLEM_LABELS[problem] || problem)
                                .join(', ');
                              const docState = getAdminComplementDocumentState(docItem);
                              const decisionClass =
                                docItem.decision === 'manquant'
                                  ? styles.docStatusDanger
                                  : docItem.decision === 'probleme'
                                    ? styles.docStatusWarning
                                    : styles.docStatus;
                              const currentDoc =
                                typeof docItem.id_doc === 'number' && docItem.id_doc > 0
                                  ? documentsById.get(docItem.id_doc)
                                  : null;
                              const currentFileUrl =
                                buildComplementItemViewUrl(docItem.id_item) ||
                                buildDocumentViewUrl(currentDoc?.idDoc ?? docItem.id_doc);
                              const currentStatusLabel = formatDocStatusLabel(
                                currentDoc?.statut ?? docItem.statutActuel,
                              );
                              const itemId =
                                typeof docItem.id_item === 'number' ? docItem.id_item : null;
                              const canValidateDoc =
                                itemId != null &&
                                itemId > 0 &&
                                String(docItem.statutTraitement || '')
                                  .trim()
                                  .toUpperCase() !== 'TRAITEE' &&
                                isComplementDocumentReady(docItem);
                              const isSelected =
                                itemId != null ? selectedComplementItemIds.includes(itemId) : false;
                              const responseStatus = getComplementResponseStatus(docItem.statutReponse);
                              const systemChecked = canValidateDoc || isSelected;

                              return (
                                <tr
                                  key={`admin-complement-doc-${docItem.id_doc ?? index}`}
                                  className={`${styles.dataRow} ${
                                    isSelected ? styles.complementTableRowSelected : ''
                                  }`}
                                >
                                  <td>
                                    <div className={styles.complementTableDocCell}>
                                      <div className={styles.complementTableDocTitle}>
                                        <span className={styles.complementTableDocIndex}>
                                          {index + 1}
                                        </span>
                                        <div>
                                          <h4>{docItem.nom_doc}</h4>
                                          <small>Document #{index + 1}</small>
                                        </div>
                                      </div>
                                      <div className={styles.complementTableDocBadges}>
                                        <Badge className={decisionClass}>Motif initial</Badge>
                                        <Badge className={docState.className}>{docState.label}</Badge>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <div className={styles.complementTableDetails}>
                                      <p>
                                        <span>Motif:</span>{' '}
                                        {formatComplementDecisionLabel(docItem.decision)}
                                      </p>
                                      <p>
                                        <span>Initial:</span>{' '}
                                        {formatDocStatusLabel(docItem.statutActuel)}
                                      </p>
                                      <p>
                                        <span>Actuel:</span> {currentStatusLabel}
                                      </p>
                                      <p>
                                        <span>Suivi:</span> {docState.helper}
                                      </p>
                                      {docItem.reponduAt && (
                                        <p>
                                          <span>Corrige le:</span> {formatDateTime(docItem.reponduAt)}
                                        </p>
                                      )}
                                      {currentDoc?.updatedAt && (
                                        <p>
                                          <span>Mise a jour:</span>{' '}
                                          {formatDateTime(currentDoc.updatedAt)}
                                        </p>
                                      )}
                                      {problemsLabel && (
                                        <p>
                                          <span>Problemes:</span> {problemsLabel}
                                        </p>
                                      )}
                                      {docItem.comment && (
                                        <p>
                                          <span>Commentaire:</span> {docItem.comment}
                                        </p>
                                      )}
                                      {docItem.noteTraitement && (
                                        <p>
                                          <span>Note:</span> {docItem.noteTraitement}
                                        </p>
                                      )}
                                    </div>
                                  </td>
                                  <td className={styles.complementTableCheckCell}>
                                    <label className={styles.complementSystemCheck}>
                                      <input
                                        type="checkbox"
                                        checked={systemChecked}
                                        readOnly
                                        disabled
                                      />
                                      <span>{systemChecked ? 'Oui' : 'Non'}</span>
                                    </label>
                                    <span className={styles.complementDocFileState}>
                                      {currentFileUrl
                                        ? responseStatus === 'SOUMIS'
                                          ? 'Soumis'
                                          : responseStatus === 'DOCUMENT_REMPLACE'
                                            ? 'Pret a soumettre'
                                            : 'Depose'
                                        : 'Aucun fichier'}
                                    </span>
                                  </td>
                                  <td>
                                    <div className={styles.complementTableActions}>
                                      {currentFileUrl && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className={styles.complementTableActionBtn}
                                          onClick={() => window.open(currentFileUrl, '_blank')}
                                        >
                                          <FiEye /> Ouvrir
                                        </Button>
                                      )}
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className={styles.complementTableActionBtn}
                                        disabled={!canValidateDoc}
                                        onClick={() => {
                                          if (itemId == null) return;
                                          toggleComplementItemSelection(itemId);
                                        }}
                                      >
                                        <FiCheck />
                                        {isSelected ? 'Retirer' : 'Traiter'}
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.complementSubsection}>
                  <div className={styles.sectionHeader}>
                    <h3><FiClock /> Historique de completude</h3>
                    <span>
                      {complementHistoryRows.length} action
                      {complementHistoryRows.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className={styles.timeline}>
                    {complementHistoryRows.map((row) => (
                      <div key={row.key} className={styles.timelineRow}>
                        <span className={`${styles.dot} ${styles[row.state]}`} />
                        <div>
                          <p>{row.title}</p>
                          <small>
                            {row.description}
                            {row.date ? ` | ${formatDateTime(row.date)}` : ''}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className={styles.card}>
            <h3>Paiements</h3>
            {demande?.facture?.paiements?.length ? (
              <div className={styles.paymentList}>
                {demande.facture.paiements.map((pay, idx) => (
                  <div key={`${pay.id || idx}`} className={styles.paymentRow}>
                    <span>Paiement #{idx + 1}</span>
                    <span>{formatMoney(pay.montant_paye)}</span>
                    <span>{pay.etat_paiement || '--'}</span>
                    <span>{formatDate(pay.date_paiement)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.muted}>Aucun paiement enregistre.</p>
            )}
          </section>

          <section className={styles.card} id="messages-section" ref={messagesSectionRef}>
            <div className={styles.sectionHeader}>
              <h3><FiMessageSquare /> Commentaires / Messages</h3>
              <span>Thread demande</span>
            </div>
            <EntityMessagesPanel
              entityType="demande"
              entityCode={codeDemande}
              autoFocusComposer={shouldJumpToMessages}
              defaultRecipientId={demandeurUserId}
              lockRecipient
            />
          </section>

          {motifModalOpen && (
            <div className={styles.modalOverlay}>
              <div className={styles.modalCard}>
                <h3>
                  {motifAction === 'REJETEE'
                    ? 'Motif de rejet'
                    : 'Motif de demande de pieces complementaires'}
                </h3>
                {motifAction === 'EN_COMPLEMENT' ? (
                  <>
                    <p>
                      Selectionnez les documents manquants ou en anomalie, puis validez la fiche.
                    </p>
                    {complementDocsLoading && (
                      <div className={styles.complementLoading}>
                        Chargement des documents...
                      </div>
                    )}
                    {complementDocsError && (
                      <div className={styles.complementError}>{complementDocsError}</div>
                    )}
                    {!complementDocsLoading && complementDocs.length > 0 && (
                      <div className={styles.complementDocsPanel}>
                        {complementDocs.map((docItem) => {
                          const fileUrl = buildDocumentViewUrl(docItem.id_doc);
                          return (
                            <div
                              key={`complement-doc-${docItem.id_doc}`}
                              className={styles.complementDocRow}
                            >
                              <div className={styles.complementDocHead}>
                                <div>
                                  <p>{docItem.nom_doc}</p>
                                  <small>
                                    Statut actuel: {formatDocStatusLabel(docItem.statutActuel)}
                                    {docItem.isRequired ? ' | obligatoire' : ' | optionnel'}
                                  </small>
                                  {docItem.rejectMessage && (
                                    <small className={styles.docHint}>
                                      Regle: {docItem.rejectMessage}
                                    </small>
                                  )}
                                </div>
                                {fileUrl && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => window.open(fileUrl, '_blank')}
                                  >
                                    Ouvrir
                                  </Button>
                                )}
                              </div>
                              <div className={styles.complementDecisionGroup}>
                                <label>
                                  <input
                                    type="radio"
                                    checked={docItem.decision === 'conforme'}
                                    onChange={() =>
                                      updateComplementDocDecision(docItem.id_doc, 'conforme')
                                    }
                                  />
                                  Conforme
                                </label>
                                <label>
                                  <input
                                    type="radio"
                                    checked={docItem.decision === 'manquant'}
                                    onChange={() =>
                                      updateComplementDocDecision(docItem.id_doc, 'manquant')
                                    }
                                  />
                                  Manquant
                                </label>
                                <label>
                                  <input
                                    type="radio"
                                    checked={docItem.decision === 'probleme'}
                                    onChange={() =>
                                      updateComplementDocDecision(docItem.id_doc, 'probleme')
                                    }
                                  />
                                  Present avec probleme
                                </label>
                              </div>

                              {docItem.decision === 'probleme' && (
                                <div className={styles.complementProblemsPanel}>
                                  <div className={styles.complementProblemGrid}>
                                    {DOC_PROBLEM_CODES.map((problemCode) => (
                                      <label key={`${docItem.id_doc}-${problemCode}`}>
                                        <input
                                          type="checkbox"
                                          checked={docItem.problems.includes(problemCode)}
                                          onChange={() =>
                                            toggleComplementProblem(docItem.id_doc, problemCode)
                                          }
                                        />
                                        {DOC_PROBLEM_LABELS[problemCode]}
                                      </label>
                                    ))}
                                  </div>
                                  <textarea
                                    rows={2}
                                    value={docItem.comment}
                                    onChange={(e) =>
                                      updateComplementComment(
                                        docItem.id_doc,
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Commentaire detaille (optionnel)"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className={styles.complementMetaGrid}>
                      <label className={styles.complementField}>
                        <span>Delai (jours calendaires)</span>
                        <input
                          type="number"
                          min={1}
                          value={complementDelayDays}
                          onChange={(e) => setComplementDelayDays(e.target.value)}
                        />
                      </label>
                      <label className={styles.complementField}>
                        <span>Mode de notification</span>
                        <input
                          type="text"
                          value={complementNotificationMode}
                          onChange={(e) => setComplementNotificationMode(e.target.value)}
                        />
                      </label>
                      <label className={`${styles.complementField} ${styles.complementFieldFull}`}>
                        <span>Effet de l'absence de reponse</span>
                        <textarea
                          rows={2}
                          value={complementAbsenceEffect}
                          onChange={(e) => setComplementAbsenceEffect(e.target.value)}
                        />
                      </label>
                    </div>

                    <textarea
                      rows={3}
                      value={motifText}
                      onChange={(e) => setMotifText(e.target.value)}
                      placeholder="Message libre ajoute par l'admin (optionnel)"
                    />
                  </>
                ) : (
                  <>
                    <p>Ce motif sera enregistre dans la decision admin.</p>
                    <textarea
                      rows={6}
                      value={motifText}
                      onChange={(e) => setMotifText(e.target.value)}
                      placeholder="Saisissez le motif..."
                    />
                  </>
                )}
                <div className={styles.modalActions}>
                  <Button
                    className={styles.modalCancelBtn}
                    variant="outline"
                    onClick={() => {
                      setMotifModalOpen(false);
                      resetComplementForm();
                    }}
                    disabled={submitting}
                  >
                    Annuler
                  </Button>
                  <Button
                    className={styles.modalConfirmBtn}
                    onClick={confirmMotifAction}
                    disabled={submitting}
                  >
                    {submitting ? 'Envoi...' : 'Confirmer'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


