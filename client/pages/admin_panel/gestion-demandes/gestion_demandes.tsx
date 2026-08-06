'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import {
  FiAlertCircle,
  FiCheck,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiEye,
  FiFileText,
  FiFilter,
  FiRefreshCcw,
  FiSearch,
  FiTrash2,
  FiTrendingUp,
  FiX,
} from 'react-icons/fi';
import { MdHourglassTop } from 'react-icons/md';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Navbar from '@/pages/navbar/Navbar';
import Sidebar from '@/pages/sidebar/Sidebar';
import { BrandLoader } from '@/components/loading/BrandLoader';
import { useViewNavigator } from '@/src/hooks/useViewNavigator';
import { useAuthStore } from '@/src/store/useAuthStore';
import styles from './gestion_demandes.module.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type SortOrder = 'asc' | 'desc';
type StatusAction = 'ACCEPTEE' | 'REJETEE' | 'EN_COMPLEMENT';

type Wilaya = {
  id_wilaya: number;
  nom_wilayaFR: string;
};

type TypeProcedure = {
  id: number;
  libelle?: string | null;
};

type UserMini = {
  id: number;
  username?: string | null;
  email?: string | null;
  nom?: string | null;
  prenom?: string | null;
  Prenom?: string | null;
  detenteur?: {
    id_detenteur?: number;
    nom_societeFR?: string | null;
    nom_societeAR?: string | null;
    email?: string | null;
  } | null;
};

type DemandeItem = {
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
  utilisateurId?: number;
  detenteur?: {
    id_detenteur?: number;
    nom_societeFR?: string | null;
    nom_societeAR?: string | null;
    email?: string | null;
  } | null;
  utilisateur?: UserMini | null;
  typeProcedure?: { id: number; libelle?: string | null } | null;
  typePermis?: { id: number; code_type?: string | null; lib_type?: string | null } | null;
  wilaya?: { id_wilaya: number; nom_wilayaFR?: string | null } | null;
  commune?: { id_commune: number; nom_communeFR?: string | null } | null;
  detenteurdemande?: Array<{
    detenteur?: {
      id_detenteur?: number;
      nom_societeFR?: string | null;
      nom_societeAR?: string | null;
      email?: string | null;
    } | null;
  }>;
  facture?: {
    id_facture?: number;
    montant_total?: number | null;
    statut?: string | null;
    paiements?: Array<{
      id?: number;
      montant_paye?: number | null;
      etat_paiement?: string | null;
      date_paiement?: string | null;
    }>;
  } | null;
};

type DemandesListResponse = {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  items: DemandeItem[];
};

type StatsResponse = {
  total: number;
  byStatut: Array<{ statut_demande: string; _count: { _all: number } }>;
  last7?: number;
  avgInstructionDays?: number | null;
};

type DetailsResponse = DemandeItem & {
  procedure?: {
    id_proc?: number;
    statut_proc?: string | null;
    date_fin_proc?: string | null;
    ProcedureEtape?: Array<{
      id_etape?: number;
      statut?: string | null;
      date_debut?: string | null;
      date_fin?: string | null;
      etape?: { nom_etape?: string | null } | null;
    }>;
  } | null;
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

type FilterState = {
  search: string;
  statut: string;
  typeProcId: string;
  wilayaId: string;
  fromDate: string;
  toDate: string;
  titulaire: string;
};

type SortState = {
  key:
    | 'code_demande'
    | 'typeProcedure'
    | 'titulaire'
    | 'wilaya'
    | 'date_demande'
    | 'statut_demande'
    | 'responsable'
    | 'montant'
    | 'last_action';
  order: SortOrder;
};

const DEFAULT_FILTERS: FilterState = {
  search: '',
  statut: '',
  typeProcId: '',
  wilayaId: '',
  fromDate: '',
  toDate: '',
  titulaire: '',
};

function normalizeText(value?: string | null) {
  return (value ?? '').trim().toLowerCase();
}

function formatDate(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('fr-FR');
}

function formatDateTime(value?: string | null) {
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
}

function formatMoney(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'DZD',
    maximumFractionDigits: 2,
  }).format(value);
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getMontantValue(item: DemandeItem): number | null {
  const paid = toFiniteNumber(item.montant_paye_total);
  if (paid !== null) return paid;

  const legacyMontantProduit = toFiniteNumber(item.montant_produit);
  if (legacyMontantProduit !== null) return legacyMontantProduit;

  const legacyBudget = toFiniteNumber(item.budget_prevu);
  if (legacyBudget !== null) return legacyBudget;

  return null;
}

function getTitulaire(item: DemandeItem) {
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
}

function getSocieteFR(item: DemandeItem) {
  const detenteurDirect = item.detenteur;
  const detenteurFromDemande = item.detenteurdemande?.find((entry) => !!entry?.detenteur)?.detenteur;
  const detenteurFromUser = item.utilisateur?.detenteur;
  return (
    detenteurDirect?.nom_societeFR ||
    detenteurFromDemande?.nom_societeFR ||
    detenteurFromUser?.nom_societeFR ||
    '--'
  );
}

function getWilayaCommune(item: DemandeItem) {
  const w = item.wilaya?.nom_wilayaFR || '--';
  const c = item.commune?.nom_communeFR || '--';
  return `${w} / ${c}`;
}

function getResponsable(item: DemandeItem) {
  if (item.Nom_Prenom_Resp_Enregist) return item.Nom_Prenom_Resp_Enregist;
  const user = item.utilisateur;
  if (!user) return '--';
  const fullName = [user.nom, user.Prenom ?? user.prenom].filter(Boolean).join(' ').trim();
  return fullName || user.username || user.email || `Utilisateur #${item.utilisateurId ?? '--'}`;
}

function getUtilisateurHint(item: DemandeItem) {
  return (
    item.utilisateur?.username ||
    item.utilisateur?.email ||
    (item.utilisateurId ? `Utilisateur #${item.utilisateurId}` : '--')
  );
}

function getStatusMeta(statut?: string | null) {
  const key = (statut ?? '').toUpperCase();
  if (key === 'ACCEPTEE') {
    return { label: 'Acceptee', className: styles.statusSuccess, icon: <FiCheck /> };
  }
  if (key === 'REJETEE') {
    return { label: 'Rejetee', className: styles.statusRejected, icon: <FiX /> };
  }
  if (key === 'EN_COMPLEMENT') {
    return { label: 'Complement', className: styles.statusComplement, icon: <FiAlertCircle /> };
  }
  if (key === 'EN_COURS' || key === 'EN_ATTENTE' || key === 'EN_INSTRUCTION') {
    return { label: 'En cours', className: styles.statusPending, icon: <MdHourglassTop /> };
  }
  return { label: statut || 'N/A', className: styles.statusDefault, icon: <FiAlertCircle /> };
}

function getProcedureBadgeClass(label?: string | null) {
  const text = normalizeText(label);
  if (text.includes('renouvel')) return styles.procRenouvellement;
  if (text.includes('extension') && text.includes('substance')) return styles.procExtSub;
  if (text.includes('extension')) return styles.procExtension;
  if (text.includes('transfert')) return styles.procTransfert;
  if (text.includes('cession')) return styles.procCession;
  if (text.includes('fusion')) return styles.procFusion;
  if (text.includes('renonciation')) return styles.procRenonciation;
  if (text.includes('modification')) return styles.procModification;
  if (text.includes('initial')) return styles.procInitiale;
  return styles.procDefault;
}

function getLastActionLabel(item: DemandeItem) {
  const status = (item.statut_demande ?? '').toUpperCase();
  const resp = getResponsable(item);
  if (status === 'ACCEPTEE' && item.date_instruction) {
    return `Validee par ${resp} le ${formatDate(item.date_instruction)}`;
  }
  if (status === 'REJETEE' && item.date_refus) {
    return `Rejetee par ${resp} le ${formatDate(item.date_refus)}`;
  }
  if (status === 'EN_COMPLEMENT') {
    return `Complement demande par ${resp}`;
  }
  if (item.date_demande) {
    return `Depot le ${formatDate(item.date_demande)}`;
  }
  return '--';
}

function sanitizePdfText(value?: string | null) {
  return String(value ?? '--').replace(/[\u00A0\u202F]/g, ' ');
}

function buildHistory(item?: DetailsResponse | null) {
  if (!item) return [];
  const rows: Array<{ label: string; value: string }> = [];
  if (item.date_demande) rows.push({ label: 'Depot', value: formatDate(item.date_demande) });
  if (item.date_instruction) rows.push({ label: 'Instruction', value: formatDate(item.date_instruction) });
  if (item.date_refus) rows.push({ label: 'Rejet', value: formatDate(item.date_refus) });
  if (item.procedure?.date_fin_proc) {
    rows.push({ label: 'Fin procedure', value: formatDate(item.procedure.date_fin_proc) });
  }
  return rows;
}

const SORTABLE_HEADERS: Array<{ key: SortState['key']; label: string }> = [
  { key: 'code_demande', label: 'Code' },
  { key: 'typeProcedure', label: 'Type procedure' },
  { key: 'titulaire', label: 'Societe (FR)' },
  { key: 'wilaya', label: 'Wilaya / Commune' },
  { key: 'date_demande', label: 'Date depot' },
  { key: 'statut_demande', label: 'Statut' },
  { key: 'responsable', label: 'Responsable' },
  { key: 'montant', label: 'Montant' },
  { key: 'last_action', label: 'Derniere action' },
];

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

function normalizeDocStatusValue(value?: string | null) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'present' || raw === 'valide' || raw === 'conforme') return 'present';
  if (raw === 'manquant' || raw === 'missing') return 'manquant';
  if (raw === 'attente' || raw === 'pending' || raw === 'en_attente') return 'attente';
  return raw || 'attente';
}

function formatDocStatusLabel(value?: string | null) {
  const status = normalizeDocStatusValue(value);
  if (status === 'present') return 'Present';
  if (status === 'manquant') return 'Manquant';
  if (status === 'attente') return 'En attente';
  return value || '--';
}

function mapComplementDocsFromProcedurePayload(
  payload?: ProcedureDocumentsResponse | null,
): ComplementDocForm[] {
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
}

function buildDocIssueSentence(doc: ComplementDocForm) {
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
}

export default function GestionDemandesAdminPage() {
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const router = useRouter();
  const { auth, isLoaded, hasPermission } = useAuthStore();
  const { currentView, navigateTo } = useViewNavigator('Admin-Panel');

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [items, setItems] = useState<DemandeItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [pages, setPages] = useState<number>(1);

  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [typeProcedures, setTypeProcedures] = useState<TypeProcedure[]>([]);

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filtersRunNonce, setFiltersRunNonce] = useState<number>(0);
  const [sortState, setSortState] = useState<SortState>({
    key: 'date_demande',
    order: 'desc',
  });

  const [filtersOpen, setFiltersOpen] = useState<boolean>(true);
  const [openActionMenu, setOpenActionMenu] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [motifModalOpen, setMotifModalOpen] = useState<boolean>(false);
  const [motifAction, setMotifAction] = useState<StatusAction>('REJETEE');
  const [motifTargetIds, setMotifTargetIds] = useState<number[]>([]);
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

  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailData, setDetailData] = useState<DetailsResponse | null>(null);

  const isAdmin =
    hasPermission('Admin-Panel') ||
    String(auth?.role ?? '')
      .toLowerCase()
      .includes('admin');

  useEffect(() => {
    if (!isLoaded) return;
    if (!isAdmin) {
      router.replace('/unauthorized/page?reason=missing_permissions');
    }
  }, [isLoaded, isAdmin, router]);

  useEffect(() => {
    const onDocumentClick = () => setOpenActionMenu(null);
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, []);

  const backendSortKey = useMemo(() => {
    switch (sortState.key) {
      case 'code_demande':
      case 'date_demande':
      case 'statut_demande':
        return sortState.key;
      default:
        return 'date_demande';
    }
  }, [sortState.key]);

  const fetchReferenceData = useCallback(async () => {
    if (!apiURL) return;
    const [wilayasRes, typeProcRes] = await Promise.all([
      axios.get<Wilaya[]>(`${apiURL}/api/wilayas`, { withCredentials: true }),
      axios.get<TypeProcedure[]>(`${apiURL}/type-procedures`, { withCredentials: true }),
    ]);
    setWilayas(Array.isArray(wilayasRes.data) ? wilayasRes.data : []);
    setTypeProcedures(Array.isArray(typeProcRes.data) ? typeProcRes.data : []);
  }, [apiURL]);

  const fetchData = useCallback(async () => {
    if (!apiURL) {
      setError("NEXT_PUBLIC_API_URL n'est pas defini.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const mergedSearch = filters.search.trim();

      const params = {
        page,
        pageSize,
        search: mergedSearch || undefined,
        societe: filters.titulaire.trim() || undefined,
        statut: filters.statut || undefined,
        typeProcId: filters.typeProcId ? Number(filters.typeProcId) : undefined,
        wilayaId: filters.wilayaId ? Number(filters.wilayaId) : undefined,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        sortBy: backendSortKey,
        sortOrder: sortState.order,
      };

      const [listRes, statsRes] = await Promise.all([
        axios.get<DemandesListResponse>(`${apiURL}/demandes_dashboard`, {
          params,
          withCredentials: true,
        }),
        axios.get<StatsResponse>(`${apiURL}/demandes_dashboard/stats`, {
          params: {
            statut: params.statut,
            societe: params.societe,
            typeProcId: params.typeProcId,
            wilayaId: params.wilayaId,
            fromDate: params.fromDate,
            toDate: params.toDate,
          },
          withCredentials: true,
        }),
      ]);

      const payload = listRes.data;
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setTotal(Number(payload?.total ?? 0));
      setPages(Number(payload?.pages ?? 1));
      setStats(statsRes.data ?? null);
    } catch (err) {
      console.error('Erreur chargement des demandes admin', err);
      setError('Impossible de charger les demandes admin.');
    } finally {
      setLoading(false);
    }
  }, [
    apiURL,
    page,
    pageSize,
    filters.search,
    filters.titulaire,
    filters.statut,
    filters.typeProcId,
    filters.wilayaId,
    filters.fromDate,
    filters.toDate,
    sortState.order,
    backendSortKey,
    filtersRunNonce,
  ]);

  useEffect(() => {
    if (!isLoaded || !isAdmin) return;
    (async () => {
      try {
        await fetchReferenceData();
      } catch (err) {
        console.error('Erreur chargement references', err);
      }
    })();
  }, [isLoaded, isAdmin, fetchReferenceData]);

  useEffect(() => {
    if (!isLoaded || !isAdmin) return;
    fetchData();
  }, [isLoaded, isAdmin, fetchData]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const pageIds = new Set(items.map((item) => item.id_demande));
      const next = new Set<number>();
      prev.forEach((id) => {
        if (pageIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [items]);

  const filteredItems = useMemo(() => {
    const term = normalizeText(filters.titulaire);
    if (!term) return items;
    return items.filter((item) => normalizeText(getSocieteFR(item)).includes(term));
  }, [items, filters.titulaire]);

  const sortedItems = useMemo(() => {
    const rows = [...filteredItems];
    const multiplier = sortState.order === 'asc' ? 1 : -1;

    rows.sort((a, b) => {
      const getValue = (item: DemandeItem) => {
        switch (sortState.key) {
          case 'code_demande':
            return item.code_demande || `DEM-${item.id_demande}`;
          case 'typeProcedure':
            return item.typeProcedure?.libelle || '';
          case 'titulaire':
            return getSocieteFR(item);
          case 'wilaya':
            return getWilayaCommune(item);
          case 'date_demande':
            return item.date_demande ? new Date(item.date_demande).getTime() : 0;
          case 'statut_demande':
            return item.statut_demande || '';
          case 'responsable':
            return getResponsable(item);
          case 'montant':
            return getMontantValue(item) ?? 0;
          case 'last_action':
            return getLastActionLabel(item);
          default:
            return '';
        }
      };

      const va = getValue(a);
      const vb = getValue(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * multiplier;
      return String(va).localeCompare(String(vb), 'fr', { sensitivity: 'base' }) * multiplier;
    });
    return rows;
  }, [filteredItems, sortState]);

  const allOnPageSelected =
    sortedItems.length > 0 && sortedItems.every((item) => selectedIds.has(item.id_demande));

  const statsByStatus = useMemo(() => {
    const map = new Map<string, number>();
    (stats?.byStatut ?? []).forEach((entry) => {
      map.set((entry.statut_demande || '').toUpperCase(), Number(entry._count?._all ?? 0));
    });
    return {
      total: Number(stats?.total ?? total ?? 0),
      enCours:
        Number(map.get('EN_COURS') ?? 0) +
        Number(map.get('EN_ATTENTE') ?? 0) +
        Number(map.get('EN_INSTRUCTION') ?? 0),
      acceptees: Number(map.get('ACCEPTEE') ?? 0),
      rejetees: Number(map.get('REJETEE') ?? 0),
      complements: Number(map.get('EN_COMPLEMENT') ?? 0),
    };
  }, [stats, total]);

  const toggleSort = (key: SortState['key']) => {
    setSortState((prev) => {
      if (prev.key === key) {
        return { ...prev, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { key, order: 'asc' };
    });
  };

  const handleToggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        sortedItems.forEach((item) => next.delete(item.id_demande));
      } else {
        sortedItems.forEach((item) => next.add(item.id_demande));
      }
      return next;
    });
  };

  const handleToggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setPage(1);
    setFiltersRunNonce((prev) => prev + 1);
  };

  useEffect(() => {
    const searchChanged = draftFilters.search !== filters.search;
    const titulaireChanged = draftFilters.titulaire !== filters.titulaire;
    if (!searchChanged && !titulaireChanged) return;

    const timeoutId = window.setTimeout(() => {
      setFilters((prev) => {
        if (
          prev.search === draftFilters.search &&
          prev.titulaire === draftFilters.titulaire
        ) {
          return prev;
        }
        return {
          ...prev,
          search: draftFilters.search,
          titulaire: draftFilters.titulaire,
        };
      });
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [
    draftFilters.search,
    draftFilters.titulaire,
    filters.search,
    filters.titulaire,
  ]);

  const resetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setSortState({ key: 'date_demande', order: 'desc' });
    setPage(1);
    setFiltersRunNonce((prev) => prev + 1);
  };

  const resetComplementForm = () => {
    setComplementDocsLoading(false);
    setComplementDocsError(null);
    setComplementDocs([]);
    setComplementDelayDays(DEFAULT_COMPLEMENT_DELAY_DAYS);
    setComplementAbsenceEffect(DEFAULT_COMPLEMENT_ABSENCE_EFFECT);
    setComplementNotificationMode(DEFAULT_COMPLEMENT_NOTIFICATION_MODE);
  };

  const loadComplementDocuments = async (idDemande: number) => {
    if (!apiURL) return;
    setComplementDocsLoading(true);
    setComplementDocsError(null);
    try {
      const response = await axios.get<ProcedureDocumentsResponse>(
        `${apiURL}/api/procedure/${idDemande}/documents`,
        { withCredentials: true },
      );
      const docs = mapComplementDocsFromProcedurePayload(response.data);
      setComplementDocs(docs);
    } catch (err) {
      console.error('Erreur chargement docs complement', err);
      setComplementDocs([]);
      setComplementDocsError(
        "Impossible de precharger les documents. Vous pouvez saisir un motif manuel.",
      );
    } finally {
      setComplementDocsLoading(false);
    }
  };

  const openMotifModal = async (action: StatusAction, ids: number[]) => {
    setError(null);
    setMotifAction(action);
    setMotifTargetIds(ids);
    setMotifText('');
    resetComplementForm();
    setMotifModalOpen(true);

    if (action !== 'EN_COMPLEMENT') return;
    if (ids.length !== 1) {
      setComplementDocsError(
        'Selection multiple: la fiche detaillee des documents est disponible en traitement unitaire.',
      );
      return;
    }
    await loadComplementDocuments(ids[0]);
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

  const updateStatus = async (
    id: number,
    action: StatusAction,
    motif?: string,
    complementDetails?: ComplementDetailsPayload,
  ) => {
    if (!apiURL) return;
    await axios.put(
      `${apiURL}/api/demande/${id}/status`,
      {
        statut_demande: action,
        rejectionReason: motif,
        complementDetails,
      },
      { withCredentials: true },
    );
  };

  const executeStatusAction = async (
    action: StatusAction,
    ids: number[],
    motif?: string,
    complementDetails?: ComplementDetailsPayload,
  ) => {
    if (ids.length === 0) return false;
    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      await Promise.all(
        ids.map((id) => updateStatus(id, action, motif, complementDetails)),
      );

      if (action === 'EN_COMPLEMENT') {
        const motifValue = (motif ?? '').trim();
        ids.forEach((id) => {
          const target = items.find((item) => item.id_demande === id);
          if (!target) return;
          const code = sanitizePdfText(
            target.code_demande || target.short_code || `DEM-${target.id_demande}`,
          );
          const safeCode = code.replace(/[^a-zA-Z0-9-_]/g, '_');
          buildDemandeComplementPdf(
            target,
            motifValue,
            `demande_complement_${safeCode}.pdf`,
            complementDetails,
          );
        });
      }

      setSuccess(
        action === 'ACCEPTEE'
          ? 'Demande(s) validee(s) avec succes.'
          : action === 'REJETEE'
          ? 'Demande(s) rejetee(s) avec succes.'
          : 'Demande(s) marquee(s) en complement.',
      );
      setSelectedIds(new Set());
      await fetchData();
      return true;
    } catch (err) {
      console.error('Erreur action statut', err);
      setError("Echec de l'operation de changement de statut.");
      return false;
    } finally {
      setSubmitting(false);
    }
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

    const success = await executeStatusAction(
      motifAction,
      motifTargetIds,
      finalMotif,
      complementDetails,
    );
    if (success) {
      setMotifModalOpen(false);
      resetComplementForm();
    }
  };

  const handleDeleteDemande = async (id: number) => {
    if (!apiURL) return;

    const confirmed = window.confirm(
      `Confirmer la suppression definitive de la demande #${id} ? Cette action est irreversible.`,
    );
    if (!confirmed) return;

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      setOpenActionMenu(null);

      await axios.delete(`${apiURL}/demandes_dashboard/${id}`, {
        withCredentials: true,
      });

      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setSuccess(`Demande #${id} supprimee avec succes.`);

      const isLastRowOnPage = sortedItems.length === 1;
      if (isLastRowOnPage && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        await fetchData();
      }
    } catch (err) {
      console.error('Erreur suppression demande', err);
      const serverMessage =
        axios.isAxiosError(err) &&
        typeof (err.response?.data as { message?: unknown } | undefined)?.message === 'string'
          ? ((err.response?.data as { message: string }).message ?? null)
          : null;
      setError(serverMessage || "Echec de la suppression de la demande.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetails = async (idOrCode: string) => {
    if (!apiURL) return;
    setDetailModalOpen(true);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await axios.get<DetailsResponse>(
        `${apiURL}/demandes_dashboard/${encodeURIComponent(idOrCode)}`,
        {
          withCredentials: true,
        },
      );
      setDetailData(res.data ?? null);
    } catch (err) {
      console.error('Erreur details demande', err);
      setError('Impossible de charger le detail de la demande.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetailsPage = (idOrCode: string) => {
    router.push(`/admin_panel/gestion-demandes/${encodeURIComponent(idOrCode)}`);
  };

  const mapRowsForExport = useCallback((rows: DemandeItem[]) => {
    return rows.map((item) => ({
      Code: item.code_demande || `DEM-${item.id_demande}`,
      TypeProcedure: item.typeProcedure?.libelle || '--',
      Titulaire: getTitulaire(item),
      Wilaya: item.wilaya?.nom_wilayaFR || '--',
      Commune: item.commune?.nom_communeFR || '--',
      DateDepot: formatDate(item.date_demande),
      Statut: item.statut_demande || '--',
      Responsable: getResponsable(item),
      Utilisateur: getUtilisateurHint(item),
      Montant: getMontantValue(item),
      DerniereAction: getLastActionLabel(item),
    }));
  }, []);

  const fetchExportDataset = useCallback(async () => {
    if (!apiURL) return sortedItems;

    const mergedSearch = filters.search.trim();
    const response = await axios.get<DemandesListResponse>(`${apiURL}/demandes_dashboard`, {
      params: {
        page: 1,
        pageSize: 10000,
        search: mergedSearch || undefined,
        societe: filters.titulaire.trim() || undefined,
        statut: filters.statut || undefined,
        typeProcId: filters.typeProcId ? Number(filters.typeProcId) : undefined,
        wilayaId: filters.wilayaId ? Number(filters.wilayaId) : undefined,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        sortBy: backendSortKey,
        sortOrder: sortState.order,
      },
      withCredentials: true,
    });

    const list = Array.isArray(response.data?.items) ? response.data.items : [];
    const titulaireTerm = normalizeText(filters.titulaire);
    const filtered = titulaireTerm
      ? list.filter((item) => normalizeText(getTitulaire(item)).includes(titulaireTerm))
      : list;
    return filtered;
  }, [
    apiURL,
    sortedItems,
    filters.search,
    filters.titulaire,
    filters.statut,
    filters.typeProcId,
    filters.wilayaId,
    filters.fromDate,
    filters.toDate,
    backendSortKey,
    sortState.order,
  ]);

  const handleExportExcel = async () => {
    try {
      const data = await fetchExportDataset();
      const exportRows = mapRowsForExport(data);
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Demandes');
      XLSX.writeFile(wb, `demandes_admin_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Erreur export excel', err);
      setError("Impossible d'exporter le fichier Excel.");
    }
  };

  const buildRecapPdf = (rows: Array<Record<string, unknown>>, fileName: string) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(12);
    doc.text('Gestion des demandes - Export', 40, 32);
    autoTable(doc, {
      startY: 46,
      head: [['Code', 'Type', 'Titulaire', 'Wilaya/Commune', 'Date', 'Statut', 'Responsable', 'Montant']],
      body: rows.map((r) => [
        String(r.Code ?? ''),
        String(r.TypeProcedure ?? ''),
        String(r.Titulaire ?? ''),
        `${String(r.Wilaya ?? '--')} / ${String(r.Commune ?? '--')}`,
        String(r.DateDepot ?? ''),
        String(r.Statut ?? ''),
        String(r.Responsable ?? ''),
        r.Montant === null || r.Montant === undefined ? '--' : String(r.Montant),
      ]),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [116, 43, 122] },
    });
    doc.save(fileName);
  };

  const buildFicheRegistrePdf = (item: DemandeItem, fileName: string) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 14;
    const contentWidth = pageWidth - marginX * 2;
    const fieldsX = marginX + 8;
    const fieldsWidth = contentWidth - 16;
    let y = 10;

    const codeDemande = sanitizePdfText(item.code_demande || item.short_code || `DEM-${item.id_demande}`);
    const referenceFiche = `FRD-${new Date().getFullYear()}-${String(item.id_demande ?? '0').padStart(6, '0')}`;
    const numeroChronologique = String(item.id_demande ?? '--');
    const dateOpposable = formatDateTime(item.date_demande);
    const categorieDroit = sanitizePdfText(
      item.typeProcedure?.libelle || item.typePermis?.lib_type || item.typePermis?.code_type || '--',
    );
    const identiteDemandeur = sanitizePdfText(getTitulaire(item));
    const perimetreSubstance = sanitizePdfText(item.typePermis?.lib_type || item.typePermis?.code_type || '--');
    const statutInitial = sanitizePdfText(item.statut_demande || '--');
    const refDossierNumerique = codeDemande;
    const responsable = sanitizePdfText(getResponsable(item));
    const generationTs = formatDateTime(new Date().toISOString());
    const drawLabelValue = (label: string, value: string) => {
      const cleanValue = sanitizePdfText(value || '--');
      const labelWidth = 59;
      const valueWidth = fieldsWidth - labelWidth - 2;
      const valueLines = doc.splitTextToSize(cleanValue, valueWidth);
      const blockHeight = Math.max(6.8, valueLines.length * 4 + 1.8);

      doc.setTextColor(44, 57, 70);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.4);
      doc.text(`${label} :`, fieldsX, y + 4.8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.4);
      doc.text(valueLines, fieldsX + labelWidth, y + 4.8);

      y += blockHeight + 3.5;
    };

    doc.setDrawColor(25, 71, 106);
    doc.setLineWidth(0.6);
    doc.rect(marginX, y, contentWidth, pageHeight - 20, 'S');

    doc.setTextColor(30, 53, 73);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.7);
    doc.text('REPUBLIQUE ALGERIENNE DEMOCRATIQUE ET POPULAIRE', pageWidth / 2, y + 6, {
      align: 'center',
    });
    doc.setFontSize(8.4);
    doc.text('MINISTERE DE L\'ENERGIE ET DES MINES', pageWidth / 2, y + 10.6, {
      align: 'center',
    });
    doc.setFontSize(8.1);
    doc.text('AGENCE NATIONALE DES ACTIVITES MINIERES (ANAM)', pageWidth / 2, y + 15, {
      align: 'center',
    });
    doc.setDrawColor(25, 71, 106);
    doc.line(marginX + 3, y + 18, pageWidth - marginX - 3, y + 18);
    doc.setFontSize(12.1);
    doc.text('FICHE D\'ENREGISTREMENT AU REGISTRE DES DEMANDES', pageWidth / 2, y + 24, {
      align: 'center',
    });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(88, 97, 106);
    doc.setFontSize(8);
    doc.text('Document interne de tracabilite du registre des demandes', pageWidth / 2, y + 28, {
      align: 'center',
    });
    y += 33;

    doc.setTextColor(25, 71, 106);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.2);
    doc.text('Informations du registre', fieldsX, y);
    doc.setDrawColor(25, 71, 106);
    doc.line(fieldsX, y + 1.8, fieldsX + fieldsWidth, y + 1.8);
    y += 6.5;

    const rows: Array<[string, string]> = [
      ['Reference fiche', referenceFiche],
      ['Code demande', codeDemande],
      ['Numero chronologique', numeroChronologique],
      ['Date et heure opposables', dateOpposable],
      ['Categorie de droit', categorieDroit],
      ['Identite du demandeur', identiteDemandeur],
      ['Perimetre / substance', perimetreSubstance],
      ['Statut initial de la demande', statutInitial],
      ['Reference du dossier numerique', refDossierNumerique],
      ['Acteur emetteur', 'Guichet ANAM'],
      ['Responsable de reference', responsable],
    ];

    rows.forEach((row) => drawLabelValue(row[0], row[1]));

    doc.setTextColor(100, 109, 118);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.text(`Code demande: ${codeDemande}`, marginX, pageHeight - 11);
    doc.text(`Genere le ${generationTs}`, pageWidth - marginX, pageHeight - 11, { align: 'right' });

    doc.save(fileName);
  };

  const buildDemandeComplementPdf = (
    item: DemandeItem,
    motif: string,
    fileName: string,
    complementDetails?: ComplementDetailsPayload,
  ) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 14;
    const contentWidth = pageWidth - marginX * 2;
    const fieldsX = marginX + 8;
    const fieldsWidth = contentWidth - 16;
    let y = 10;

    const codeDemande = sanitizePdfText(item.code_demande || item.short_code || `DEM-${item.id_demande}`);
    const referenceComplement = `DRC-${new Date().getFullYear()}-${String(item.id_demande ?? '0').padStart(6, '0')}`;
    const generationTs = formatDateTime(new Date().toISOString());
    const typePermis = sanitizePdfText(item.typePermis?.lib_type || item.typePermis?.code_type || '--');
    const titulaire = sanitizePdfText(getTitulaire(item));
    const responsable = sanitizePdfText(getResponsable(item));
    const delaiLabel =
      complementDetails?.delaiJours && complementDetails.delaiJours > 0
        ? `${complementDetails.delaiJours} jours calendaires a compter de la notification`
        : '15 jours calendaires a compter de la notification';
    const effetAbsenceLabel =
      complementDetails?.effetAbsence?.trim() ||
      DEFAULT_COMPLEMENT_ABSENCE_EFFECT;
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
      const valueLines = doc.splitTextToSize(cleanValue, valueWidth);
      const blockHeight = Math.max(6.8, valueLines.length * 4 + 1.8);

      doc.setTextColor(44, 57, 70);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.4);
      doc.text(`${label} :`, fieldsX, y + 4.8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.4);
      doc.text(valueLines, fieldsX + labelWidth, y + 4.8);

      y += blockHeight + 3.5;
    };

    doc.setDrawColor(25, 71, 106);
    doc.setLineWidth(0.6);
    doc.rect(marginX, y, contentWidth, pageHeight - 20, 'S');

    doc.setTextColor(30, 53, 73);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.7);
    doc.text('REPUBLIQUE ALGERIENNE DEMOCRATIQUE ET POPULAIRE', pageWidth / 2, y + 6, {
      align: 'center',
    });
    doc.setFontSize(8.4);
    doc.text('MINISTERE DE L\'ENERGIE ET DES MINES', pageWidth / 2, y + 10.6, {
      align: 'center',
    });
    doc.setFontSize(8.1);
    doc.text('AGENCE NATIONALE DES ACTIVITES MINIERES (ANAM)', pageWidth / 2, y + 15, {
      align: 'center',
    });
    doc.setDrawColor(25, 71, 106);
    doc.line(marginX + 3, y + 18, pageWidth - marginX - 3, y + 18);
    doc.setFontSize(11.7);
    doc.text('DEMANDE DE REGULARISATION / PIECES COMPLEMENTAIRES', pageWidth / 2, y + 24, {
      align: 'center',
    });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(88, 97, 106);
    doc.setFontSize(8);
    doc.text('Document de suivi pour demande de complement', pageWidth / 2, y + 28, {
      align: 'center',
    });
    y += 33;

    doc.setTextColor(25, 71, 106);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.2);
    doc.text('Informations de regularisation', fieldsX, y);
    doc.setDrawColor(25, 71, 106);
    doc.line(fieldsX, y + 1.8, fieldsX + fieldsWidth, y + 1.8);
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

    doc.setTextColor(100, 109, 118);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.text(`Code demande: ${codeDemande}`, marginX, pageHeight - 11);
    doc.text(`Genere le ${generationTs}`, pageWidth - marginX, pageHeight - 11, { align: 'right' });

    doc.save(fileName);
  };

  const handleExportPdf = async () => {
    try {
      const data = await fetchExportDataset();
      const exportRows = mapRowsForExport(data);
      buildRecapPdf(exportRows, `demandes_admin_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Erreur export pdf', err);
      setError("Impossible d'exporter le PDF.");
    }
  };

  const handleDownloadRecapRow = (item: DemandeItem) => {
    const code = sanitizePdfText(item.code_demande || item.short_code || `DEM-${item.id_demande}`);
    const safeCode = code.replace(/[^a-zA-Z0-9-_]/g, '_');
    buildFicheRegistrePdf(item, `fiche_registre_demande_${safeCode}.pdf`);
  };

  const pageNumbers = useMemo(() => {
    const result: Array<number | '...'> = [];
    if (pages <= 7) {
      for (let i = 1; i <= pages; i += 1) result.push(i);
      return result;
    }
    result.push(1);
    if (page > 3) result.push('...');
    const start = Math.max(2, page - 1);
    const end = Math.min(pages - 1, page + 1);
    for (let i = start; i <= end; i += 1) result.push(i);
    if (page < pages - 2) result.push('...');
    result.push(pages);
    return result;
  }, [page, pages]);

  if (!isLoaded || !isAdmin) {
    return <BrandLoader fullScreen label="Chargement des demandes..." />;
  }

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.mainContent}>
          <section className={styles.pageHeader}>
            <div>
              <h1>Gestion des demandes</h1>
              <p>Back-office admin: suivi, validation et pilotage des demandes.</p>
            </div>
            <div className={styles.headerActions}>
              <div className={styles.exportActionsCard}>
                <div className={styles.exportActionsLabel}>
                  <span className={styles.exportActionsTitle}>Exports</span>
                  <span className={styles.exportActionsHint}>Exporter la liste filtree</span>
                </div>
                <div className={styles.exportActionsButtons}>
                  <Button
                    className={`${styles.exportBtn} ${styles.exportExcelBtn} btn-success`}
                    onClick={handleExportExcel}
                    disabled={loading}
                  >
                    <FiDownload /> Export Excel
                  </Button>
                  <Button
                    className={`${styles.exportBtn} ${styles.exportPdfBtn} btn-primary`}
                    onClick={handleExportPdf}
                    disabled={loading}
                  >
                    <FiFileText /> Export PDF
                  </Button>
                </div>
              </div>
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

          <section className={styles.statsGrid}>
            <Card className={`${styles.statCard} ${styles.statTotal}`}>
              <CardContent className={styles.statContent}>
                <div>
                  <p className={styles.statLabel}>Total</p>
                  <p className={styles.statValue}>{statsByStatus.total}</p>
                </div>
                <FiTrendingUp className={styles.statIcon} />
              </CardContent>
            </Card>
            <Card className={`${styles.statCard} ${styles.statPending}`}>
              <CardContent className={styles.statContent}>
                <div>
                  <p className={styles.statLabel}>En cours</p>
                  <p className={styles.statValue}>{statsByStatus.enCours}</p>
                </div>
                <MdHourglassTop className={styles.statIcon} />
              </CardContent>
            </Card>
            <Card className={`${styles.statCard} ${styles.statAccepted}`}>
              <CardContent className={styles.statContent}>
                <div>
                  <p className={styles.statLabel}>Acceptees</p>
                  <p className={styles.statValue}>{statsByStatus.acceptees}</p>
                </div>
                <FiCheck className={styles.statIcon} />
              </CardContent>
            </Card>
            <Card className={`${styles.statCard} ${styles.statRejected}`}>
              <CardContent className={styles.statContent}>
                <div>
                  <p className={styles.statLabel}>Rejetees</p>
                  <p className={styles.statValue}>{statsByStatus.rejetees}</p>
                </div>
                <FiX className={styles.statIcon} />
              </CardContent>
            </Card>
          </section>

          <section className={styles.filterPanel}>
            <div className={styles.filterHead}>
              <div className={styles.filterTitle}>
                <FiFilter />
                <span>Filtres</span>
              </div>
              <button
                type="button"
                className={styles.filterToggle}
                onClick={() => setFiltersOpen((prev) => !prev)}
              >
                <FiChevronDown className={filtersOpen ? styles.rotated : ''} />
              </button>
            </div>

            <div className={`${styles.filterBody} ${filtersOpen ? styles.filterBodyOpen : ''}`}>
              <div className={styles.filtersGrid}>
                <div className={styles.field}>
                  <label>Recherche globale</label>
                  <div className={styles.searchWrap}>
                    <FiSearch />
                    <Input
                      value={draftFilters.search}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({ ...prev, search: e.target.value }))
                      }
                      placeholder="Code, projet, expert..."
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label>Societe (FR)</label>
                  <Input
                    value={draftFilters.titulaire}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, titulaire: e.target.value }))
                    }
                    placeholder="Recherche partielle"
                  />
                </div>

                <div className={styles.field}>
                  <label>Statut</label>
                  <select
                    value={draftFilters.statut}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, statut: e.target.value }))
                    }
                  >
                    <option value="">Tous les statuts</option>
                    <option value="EN_COURS">En cours</option>
                    <option value="EN_ATTENTE">En attente</option>
                    <option value="EN_INSTRUCTION">En instruction</option>
                    <option value="EN_COMPLEMENT">En complement</option>
                    <option value="ACCEPTEE">Acceptee</option>
                    <option value="REJETEE">Rejetee</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label>Type de procedure</label>
                  <select
                    value={draftFilters.typeProcId}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, typeProcId: e.target.value }))
                    }
                  >
                    <option value="">Tous les types</option>
                    {typeProcedures.map((tp) => (
                      <option key={tp.id} value={tp.id}>
                        {tp.libelle || `Type #${tp.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label>Wilaya</label>
                  <select
                    value={draftFilters.wilayaId}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, wilayaId: e.target.value }))
                    }
                  >
                    <option value="">Toutes les wilayas</option>
                    {wilayas.map((wilaya) => (
                      <option key={wilaya.id_wilaya} value={wilaya.id_wilaya}>
                        {wilaya.nom_wilayaFR}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.field}>
                  <label>Date depot du</label>
                  <Input
                    type="date"
                    value={draftFilters.fromDate}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, fromDate: e.target.value }))
                    }
                  />
                </div>

                <div className={styles.field}>
                  <label>Date depot au</label>
                  <Input
                    type="date"
                    value={draftFilters.toDate}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, toDate: e.target.value }))
                    }
                  />
                </div>

                <div className={styles.field}>
                  <label>Elements / page</label>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <div className={styles.filterActions}>
                <Button type="button" className={styles.filterApplyBtn} onClick={applyFilters}>
                  <FiSearch /> Appliquer filtres
                </Button>
                <Button type="button" className={styles.filterResetBtn} variant="outline" onClick={resetFilters}>
                  <FiRefreshCcw /> Reinitialiser
                </Button>
              </div>
            </div>
          </section>

          {selectedIds.size > 0 && (
            <section className={styles.batchBar}>
              <div>
                <strong>{selectedIds.size}</strong> demande(s) selectionnee(s)
              </div>
              <div className={styles.batchActions}>
                <Button
                  className={`${styles.batchAccept} btn-success`}
                  disabled={submitting}
                  onClick={() => executeStatusAction('ACCEPTEE', Array.from(selectedIds))}
                >
                  Valider en masse
                </Button>
                <Button
                  className={`${styles.batchReject} btn-danger`}
                  disabled={submitting}
                  onClick={() => openMotifModal('REJETEE', Array.from(selectedIds))}
                >
                  Rejeter en masse
                </Button>
                <Button
                  className={`${styles.batchComplement} btn-primary`}
                  disabled={submitting}
                  onClick={() => openMotifModal('EN_COMPLEMENT', Array.from(selectedIds))}
                >
                  Demander complement
                </Button>
              </div>
            </section>
          )}

          <section className={styles.tableSection}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.checkboxCol}>
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={handleToggleAll}
                        aria-label="selectionner tout"
                      />
                    </th>
                    {SORTABLE_HEADERS.map((header) => (
                      <th
                        key={header.key}
                        onClick={() => toggleSort(header.key)}
                        className={styles.sortable}
                      >
                        <span>{header.label}</span>
                        {sortState.key === header.key && (
                          <span className={styles.sortIndicator}>
                            {sortState.order === 'asc' ? '^' : 'v'}
                          </span>
                        )}
                      </th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={11} className={styles.loadingRow}>
                        Chargement des demandes...
                      </td>
                    </tr>
                  ) : sortedItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className={styles.emptyRow}>
                        Aucune demande trouvee avec ces filtres.
                      </td>
                    </tr>
                  ) : (
                    sortedItems.map((item) => {
                      const statusMeta = getStatusMeta(item.statut_demande);
                      const typeLabel = item.typeProcedure?.libelle || '--';
                      const typeClass = getProcedureBadgeClass(typeLabel);
                      const montant = getMontantValue(item);
                      return (
                        <tr
                          key={item.id_demande}
                          className={styles.dataRow}
                          onClick={() =>
                            handleViewDetails(item.short_code || String(item.id_demande))
                          }
                        >
                          <td className={styles.checkboxCol}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(item.id_demande)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => handleToggleOne(item.id_demande)}
                              aria-label={`selection demande ${item.id_demande}`}
                            />
                          </td>
                          <td>{item.code_demande || `DEM-${item.id_demande}`}</td>
                          <td>
                            <span className={`${styles.procBadge} ${typeClass}`}>{typeLabel}</span>
                          </td>
                          <td>{getSocieteFR(item)}</td>
                          <td>{getWilayaCommune(item)}</td>
                          <td>{formatDate(item.date_demande)}</td>
                          <td>
                            <Badge className={`${styles.statusBadge} ${statusMeta.className}`}>
                              <span className={styles.statusIcon}>{statusMeta.icon}</span>
                              {statusMeta.label}
                            </Badge>
                          </td>
                          <td>
                            <div>{getResponsable(item)}</div>
                            <small className={styles.userHint}>
                              {getUtilisateurHint(item)}
                            </small>
                          </td>
                          <td>{formatMoney(montant)}</td>
                          <td>{getLastActionLabel(item)}</td>
                          <td>
                            <div
                              className={styles.actionMenuWrap}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className={styles.actionMenuButton}
                                onClick={() =>
                                  setOpenActionMenu((prev) =>
                                    prev === item.id_demande ? null : item.id_demande,
                                  )
                                }
                              >
                                Actions
                              </button>
                              {openActionMenu === item.id_demande && (
                                <div className={styles.actionMenu}>
                                  <button
                                    onClick={() =>
                                      handleOpenDetailsPage(
                                        item.short_code || String(item.id_demande),
                                      )
                                    }
                                  >
                                    <FiEye /> Afficher details
                                  </button>
                                  <button onClick={() => handleDownloadRecapRow(item)}>
                                    <FiDownload /> Telecharger fiche d'enregistremt
                                  </button>
                                  <button
                                    onClick={() =>
                                      executeStatusAction('ACCEPTEE', [item.id_demande])
                                    }
                                  >
                                    <FiCheck /> Valider
                                  </button>
                                  <button
                                    onClick={() => openMotifModal('REJETEE', [item.id_demande])}
                                  >
                                    <FiX /> Rejeter
                                  </button>
                                  <button
                                    onClick={() =>
                                      openMotifModal('EN_COMPLEMENT', [item.id_demande])
                                    }
                                  >
                                    <FiAlertCircle /> Demander complement
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleViewDetails(
                                        item.short_code || String(item.id_demande),
                                      )
                                    }
                                  >
                                    <FiFileText /> Vue rapide (popup)
                                  </button>
                                  <button
                                    className={styles.actionMenuDanger}
                                    disabled={submitting}
                                    onClick={() => handleDeleteDemande(item.id_demande)}
                                  >
                                    <FiTrash2 /> Supprimer
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.paginationBar}>
              <div>
                Affichage {sortedItems.length} / {total} demandes
              </div>
              <div className={styles.paginationControls}>
                <button disabled={page <= 1} onClick={() => setPage(1)}>
                  <FiChevronLeft /> <FiChevronLeft />
                </button>
                <button disabled={page <= 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>
                  <FiChevronLeft />
                </button>
                {pageNumbers.map((p, index) =>
                  p === '...' ? (
                    <span key={`dots-${index}`} className={styles.pageDots}>
                      ...
                    </span>
                  ) : (
                    <button
                      key={p}
                      className={page === p ? styles.pageActive : ''}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  disabled={page >= pages}
                  onClick={() => setPage((prev) => Math.min(prev + 1, pages))}
                >
                  <FiChevronRight />
                </button>
                <button disabled={page >= pages} onClick={() => setPage(pages)}>
                  <FiChevronRight /> <FiChevronRight />
                </button>
              </div>
            </div>
          </section>

          {motifModalOpen && (
            <div className={styles.modalOverlay}>
              <div className={styles.modalCard}>
                <h3>
                  {motifAction === 'REJETEE'
                    ? 'Motif de rejet'
                    : 'Motif de demande de complement'}
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
                          const fileUrl = docItem.file_url
                            ? docItem.file_url.startsWith('http')
                              ? docItem.file_url
                              : `${apiURL || ''}${docItem.file_url}`
                            : null;
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
                    <p>Cette action exige un motif obligatoire.</p>
                    <textarea
                      rows={5}
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
                  >
                    Annuler
                  </Button>
                  <Button
                    className={styles.modalConfirmBtn}
                    onClick={confirmMotifAction}
                    disabled={submitting}
                  >
                    Confirmer
                  </Button>
                </div>
              </div>
            </div>
          )}

          {detailModalOpen && (
            <div className={styles.modalOverlay} onClick={() => setDetailModalOpen(false)}>
              <div className={styles.modalCardLarge} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h3>Details de la demande</h3>
                  <button onClick={() => setDetailModalOpen(false)}>
                    <FiX />
                  </button>
                </div>

                {detailLoading ? (
                  <div className={styles.detailLoading}>Chargement...</div>
                ) : !detailData ? (
                  <div className={styles.detailLoading}>Aucune donnee disponible.</div>
                ) : (
                  <div className={styles.detailBody}>
                    <div className={styles.detailGrid}>
                      <div>
                        <strong>Code</strong>
                        <p>{detailData.code_demande || `DEM-${detailData.id_demande}`}</p>
                      </div>
                      <div>
                        <strong>Type procedure</strong>
                        <p>{detailData.typeProcedure?.libelle || '--'}</p>
                      </div>
                      <div>
                        <strong>Titulaire</strong>
                        <p>{getTitulaire(detailData)}</p>
                      </div>
                      <div>
                        <strong>Localisation</strong>
                        <p>{getWilayaCommune(detailData)}</p>
                      </div>
                      <div>
                        <strong>Date depot</strong>
                        <p>{formatDate(detailData.date_demande)}</p>
                      </div>
                      <div>
                        <strong>Statut</strong>
                        <p>{detailData.statut_demande || '--'}</p>
                      </div>
                      <div>
                        <strong>Montant</strong>
                        <p>{formatMoney(getMontantValue(detailData))}</p>
                      </div>
                      <div>
                        <strong>Responsable</strong>
                        <p>{getResponsable(detailData)}</p>
                      </div>
                    </div>

                    <div className={styles.historyBox}>
                      <h4>Historique des actions</h4>
                      {buildHistory(detailData).length === 0 ? (
                        <p>Aucun historique disponible.</p>
                      ) : (
                        <ul>
                          {buildHistory(detailData).map((row, idx) => (
                            <li key={`${row.label}-${idx}`}>
                              <span>{row.label}</span>
                              <strong>{row.value}</strong>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

