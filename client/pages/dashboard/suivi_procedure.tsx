'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import axios, { AxiosError, CancelTokenSource } from 'axios';
import {
  FiSearch, FiChevronRight, FiClock,
  FiAlertTriangle, FiCheck, FiX,
  FiTrash2, FiFilter, FiRefreshCw,
  FiDownload, FiEye, FiEdit3,
  FiPlus, FiMoreVertical, FiChevronDown,
  FiChevronUp, FiInfo, FiExternalLink
} from 'react-icons/fi';
import styles from './suivi.module.css';
import { useLoading } from '@/components/globalspinner/LoadingContext';
import Navbar from '../navbar/Navbar';
import dynamic from 'next/dynamic';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useViewNavigator } from '../../src/hooks/useViewNavigator';
import { useAuthReady } from '../../src/hooks/useAuthReady';
import { STEP_LABELS } from '../../src/constants/steps';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import router from 'next/router';

// Interfaces
interface Detenteur {
  id_detenteur?: number;
  nom_societeFR: string;
  adresse?: string;
  email?: string;
  telephone?: string;
}

interface TypeProcedure {
  id_type?: number;
  id?: number;
  nom?: string;
  libelle?: string;
  description?: string | null;
  code?: string | null;
  duree_validite?: number | null;
}

interface Etape {
  id_etape: number;
  lib_etape: string;
  ordre_etape: number;
  description?: string;
  delai_jours?: number;
  link?: string;
}

interface ProcedureEtape {
  id_proc_etape?: number;
  id_proc?: number;
  id_etape?: number;
  link?: string | null;
  statut: 'EN_COURS' | 'TERMINEE' | 'NON_DEBUTEE' | 'EN_RETARD';
  date_debut?: string;
  date_fin?: string;
  commentaire?: string;
  etape?: Etape;
}

interface Permis {
  id_permis?: number;
  num_permis?: string;
  id?: number;
  code_permis?: string;
  typePermis?: {
    id?: number;
    code_type?: string | null;
    lib_type?: string | null;
  };
  detenteur?: Detenteur;
  procedures?: Procedure[];
}

interface PermisProcedure {
  permis: Permis;
}

interface Procedure {
  id_proc: number;
  num_proc: string;
  statut_proc: string;
  date_creation: string;
  date_modification?: string;
  permis: Permis[];
  permisProcedure?: PermisProcedure[];
  ProcedureEtape: ProcedureEtape[];
  demandes: Demande[];
}

interface Demande {
  id_demande: number;
  code_demande: string;
  date_demande: string;
  date_instruction?: string;
  statut_demande?: string;
  detenteur?: Detenteur;
  detenteurdemande?: { detenteur?: Detenteur }[];
  typeProcedure?: TypeProcedure;
  typePermis?: {
    id?: number;
    code_type?: string | null;
    lib_type?: string | null;
  };
  procedure: Procedure;
}

interface FilterOptions {
  procedureType: string;
  permitCode: string;
  typePermis: string;
  sector: string;
  phase: string;
  status: string;
  dateRange: {
    start: string;
    end: string;
  };
}

interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}

interface SortConfig {
  key: keyof Demande | 'procedure.num_proc' | 'detenteur.nom_societeFR' | 'procedure.ProcedureEtape';
  direction: 'asc' | 'desc';
}

const apiURL = process.env.NEXT_PUBLIC_API_URL;

// Constants
const LIB_PHASES = STEP_LABELS;

const STATUS_CONFIG = {
  'Identification': { bg: styles['bg-blue-100'], text: styles['text-blue-800'], icon: <FiClock className={styles['text-blue-500']} /> },
  'Capacités': { bg: styles['bg-blue-100'], text: styles['text-blue-800'], icon: <FiClock className={styles['text-blue-500']} /> },
  'Substances & Travaux': { bg: styles['bg-blue-100'], text: styles['text-blue-800'], icon: <FiClock className={styles['text-blue-500']} /> },
  'Documents': { bg: styles['bg-yellow-100'], text: styles['text-yellow-800'], icon: <FiAlertTriangle className={styles['text-yellow-500']} /> },
  'Cadastre': { bg: styles['bg-orange-300'], text: styles['text-orange-800'], icon: <FiClock className={styles['text-orange-500']} /> },
  'Avis Wali': { bg: styles['bg-orange-100'], text: styles['text-orange-800'], icon: <FiClock className={styles['text-orange-500']} /> },
  'Comité de direction': { bg: styles['bg-purple-100'], text: styles['text-purple-800'], icon: <FiClock className={styles['text-purple-500']} /> },
  'Génération du permis': { bg: styles['bg-green-100'], text: styles['text-green-800'], icon: <FiCheck className={styles['text-green-500']} /> },
  'Paiement': { bg: styles['bg-green-100'], text: styles['text-green-800'], icon: <FiClock className={styles['text-green-500']} /> },
  'en_instruction': { bg: styles['bg-blue-100'], text: styles['text-blue-800'], icon: <FiClock className={styles['text-blue-500']} /> },
  'avis_wilaya': { bg: styles['bg-orange-100'], text: styles['text-orange-800'], icon: <FiClock className={styles['text-orange-500']} /> },
  'retard': { bg: styles['bg-red-100'], text: styles['text-red-800'], icon: <FiAlertTriangle className={styles['text-red-500']} /> },
  'acceptée': { bg: styles['bg-green-100'], text: styles['text-green-800'], icon: <FiCheck className={styles['text-green-500']} /> },
  'rejete': { bg: styles['bg-red-100'], text: styles['text-red-800'], icon: <FiX className={styles['text-red-500']} /> },
  'default': { bg: styles['bg-gray-100'], text: styles['text-gray-800'], icon: <FiClock className={styles['text-gray-500']} /> }
};

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function SuiviDemandes() {
  // State management
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { resetLoading } = useLoading();
  const { currentView, navigateTo } = useViewNavigator('procedures');
  const [searchTerm, setSearchTerm] = useState('');
  const { auth, isLoaded } = useAuthStore();
  const isAuthReady = useAuthReady();
  const [procedureToDelete, setProcedureToDelete] = useState<number | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'date_demande',
    direction: 'desc'
  });
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 0
  });
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Clear any stuck global spinner when landing here
  useEffect(() => {
    try { resetLoading(); } catch {}
  }, [resetLoading]);

  // Filters state
  const [filters, setFilters] = useState<FilterOptions>({
    procedureType: 'Tous les types',
    permitCode: 'Tous les codes',
    typePermis: 'Tous les types de permis',
    sector: 'Mine',
    phase: 'Toutes les phases',
    status: 'Tous les statuts',
    dateRange: {
      start: '',
      end: ''
    }
  });

  const Sidebar = dynamic(() => import('../sidebar/Sidebar'), { ssr: false });
  
  useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    // close dropdown if click isn't inside any dropdown wrapper
    if (!(event.target as HTMLElement).closest(`.${styles.dropdownWrapper}`)) {
      setOpenDropdown(null);
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);


  // Toggle dropdown visibility by unique demande id
const toggleDropdown = (demandeId: number) => {
  setOpenDropdown(prev => prev === demandeId ? null : demandeId);
};


  const getProcedureType = useCallback((demande: Demande): TypeProcedure | null => {
    if (demande.typeProcedure) return demande.typeProcedure;
    const fromSameProc = demande.procedure?.demandes?.find((d: Demande) => d.typeProcedure)?.typeProcedure;
    return fromSameProc || null;
  }, []);

  const getProcedureTypeLabel = useCallback((demande: Demande): string => {
    const typeProc = getProcedureType(demande);
    return (
      typeProc?.libelle ||
      typeProc?.nom ||
      typeProc?.description ||
      typeProc?.code ||
      ''
    );
  }, [getProcedureType]);

  const getPermisType = useCallback((demande: Demande) => {
    return (
      demande.typePermis ||
      demande?.procedure?.permisProcedure?.[0]?.permis?.typePermis ||
      null
    );
  }, []);
  // Memoized data processing
  const procedureTypes = useMemo(() => {
    const types = new Set<string>();
    demandes.forEach(d => {
      const label = getProcedureTypeLabel(d);
      if (label) types.add(label);
    });
    return ['Tous les types', ...Array.from(types).sort()];
  }, [demandes, getProcedureTypeLabel]);

  const permitCodes = useMemo(() => {
    const codes = new Set<string>();
    demandes.forEach(d => {
      if (d.code_demande) {
        codes.add(d.code_demande.substring(0, 3)); // Extract prefix
      }
    });
    return ['Tous les codes', ...Array.from(codes)];
  }, [demandes]);

  
  const getPermisTypeCode = useCallback((demande: Demande): string => {
    return (getPermisType(demande)?.code_type || '').toString();
  }, [getPermisType]);


  const permitTypes = useMemo(() => {
    const types = new Set<string>();
    demandes.forEach(d => {
      const code = getPermisTypeCode(d);
      if (code) types.add(code);
    });
    return ['Tous les types de permis', ...Array.from(types).sort()];
  }, [demandes, getPermisTypeCode]);

  const phases = useMemo(() => {
    const allPhases = new Set<string>();
    demandes.forEach(d => {
      d.procedure?.ProcedureEtape?.forEach(pe => {
        if (pe.etape?.lib_etape && LIB_PHASES.includes(pe.etape.lib_etape)) {
          allPhases.add(pe.etape.lib_etape);
        }
      });
    });
    return ['Toutes les phases', ...Array.from(allPhases)];
  }, [demandes]);

  const statuses = useMemo(() => {
    const allStatuses = new Set<string>();
    demandes.forEach(d => {
      if (d.procedure?.statut_proc) {
        allStatuses.add(d.procedure.statut_proc);
      }
    });
    return ['Tous les statuts', ...Array.from(allStatuses)];
  }, [demandes]);

  // Data fetching with cancellation
  const fetchDemandes = useCallback(async (cancelToken: CancelTokenSource, isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    
    try {
      const res = await axios.get(`${apiURL}/api/procedures`, {
        withCredentials: true,
        cancelToken: cancelToken.token,
        params: {
          timestamp: new Date().getTime() // Prevent caching
        },
        // Opt-out of GlobalSpinner without adding a custom header (avoids CORS preflight issues)
        // Our interceptor checks this custom config flag.
        // @ts-expect-error custom config flag used by api-interceptor
        __noGlobalLoading: true,
      });
      
      setDemandes(res.data);
      setPagination(prev => ({
        ...prev,
        totalItems: res.data.length,
        totalPages: Math.ceil(res.data.length / prev.itemsPerPage)
      }));
      setError(null);
      
      if (isBackgroundRefresh) {
        toast.success('Données actualisées avec succès');
      }
    } catch (err: unknown) {
      if (axios.isCancel(err)) {
        console.log('Request canceled:', (err as Error).message);
      } else {
        const error = err as AxiosError<{ message?: string }>;
        console.error("Erreur de chargement des demandes :", error);
        setError(error.response?.data?.message || "Erreur lors du chargement des demandes");
        toast.error(error.response?.data?.message || 'Erreur lors du chargement des données');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (!auth.role && auth.permissions.length === 0) {
      router.push('/');
      return;
    }
  }, [isLoaded, auth, router]);

  // Safety: when local loading is done, ensure global spinner closes
  useEffect(() => {
    if (!isLoading && !isRefreshing) {
      try { resetLoading(); } catch {}
    }
  }, [isLoading, isRefreshing, resetLoading]);

  useEffect(() => {
    if (!isAuthReady || !isLoaded || currentView !== 'procedures') {
      return;
    }

    const controller = axios.CancelToken.source();
    let isMounted = true;

    if (isMounted) {
      fetchDemandes(controller, false);
    }

    return () => {
      isMounted = false;
      controller.cancel('Component unmounted');
    };
  }, [currentView, fetchDemandes, isAuthReady, isLoaded]);

  // Navigation functions
  const goToEtape = async (idProc: number, demande?: Demande) => {
    const toQueryString = (
      params: Record<string, string | number | null | undefined>,
    ) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        qs.set(key, String(value));
      });
      const str = qs.toString();
      return str ? `?${str}` : '';
    };

    const normalizeLabel = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    const resolvedType = demande ? getProcedureType(demande) : null;
    const rawTypeLabel =
      (resolvedType?.nom ??
        (resolvedType as any)?.libelle ??
        resolvedType?.description ??
        '')?.toString() ?? '';
    const numProc = demande?.procedure?.num_proc ?? '';

    const matchLabel = normalizeLabel(rawTypeLabel);
    const matchNumProc = normalizeLabel(numProc);

    const permis =
      demande?.procedure?.permisProcedure?.[0]?.permis ??
      demande?.procedure?.permis?.[0];
    const permisId = permis
      ? (permis.id ?? permis.id_permis ?? undefined)
      : undefined;
    const extractPermisCode = (value: string) => {
      const match = value
        .toUpperCase()
        .match(/\b(APM|TEC|TEM|TXM|TXC|AAM|AAC|AXW|AXH|ARO)\b/);
      return match ? match[1] : '';
    };
    const permisTypeCode = (
      permis?.typePermis?.code_type ||
      extractPermisCode(demande?.code_demande ?? '') ||
      extractPermisCode(numProc)
    ).toUpperCase();

    const kind = (() => {
      if (matchLabel.includes('extension') || matchLabel.includes('modification'))
        return 'extension';
      if (matchLabel.includes('renouvel')) return 'renouvellement';
      if (matchLabel.includes('fusion')) return 'fusion';
      if (matchLabel.includes('transfert') || matchLabel.includes('transfer'))
        return 'transfert';
      if (matchLabel.includes('demande')) return 'demande';

      if (matchNumProc.includes('ext')) return 'extension';
      if (matchNumProc.includes('ren')) return 'renouvellement';
      if (matchNumProc.includes('fus')) return 'fusion';
      if (matchNumProc.includes('trf') || matchNumProc.includes('transf'))
        return 'transfert';

      return 'demande';
    })();

    const startLink = demande
      ? (() => {
          switch (kind) {
            case 'extension':
              return `/extension_permis/step1/page1${toQueryString({
                procId: idProc,
                permisId,
                numProc,
              })}`;
            case 'renouvellement':
              return `/renouvellement/step1/page1${toQueryString({
                id: idProc,
                permisId,
                numProc,
              })}`;
            case 'fusion':
              return `/fusion_permis/step2/page2${toQueryString({
                id: idProc,
                permisId,
                numProc,
              })}`;
            case 'transfert':
              return `/transfert/step1/page1${toQueryString({
                id: idProc,
                permisId,
                numProc,
              })}`;
            case 'demande':
            default:
              const demandeBaseRoute = (() => {
                if (permisTypeCode === 'APM') {
                  return '/demande_apm/step1/page1';
                }
                if (permisTypeCode === 'TXM' || permisTypeCode === 'TXC') {
                  return '/demande_exploitation/step1/page1';
                }
                if (permisTypeCode === 'TEM') {
                  return '/demande_exploration_mines/step1/page1';
                }
                return '/demande/step1/page1';
              })();
              return `${demandeBaseRoute}${toQueryString({
                id: idProc,
                permisId,
                numProc,
              })}`;
          }
        })()
      : null;
    try {
      setIsLoading(true);
      const res = await axios.get(`${apiURL}/api/procedure-etape/current/${idProc}`,
        { withCredentials: true });
      const etape = res.data;
      // Fallback link if backend doesn't supply one
      const __fallbackLink = startLink ?? (typeof etape?.id_etape === 'number'
        ? `/demande/step${etape.id_etape}/page${etape.id_etape}?id=${idProc}`
        : (typeof etape?.etape?.id_etape === 'number'
            ? `/demande/step${etape.etape.id_etape}/page${etape.etape.id_etape}?id=${idProc}`
            : null));

      const backendLink =
        typeof etape === 'string'
          ? etape
          : (typeof etape?.link === 'string' && etape.link.trim() !== ''
              ? etape.link
              : null);

      if (!backendLink && __fallbackLink) {
        router.push(__fallbackLink);
        return;
      }
      if (backendLink) {
        router.push(backendLink);
      } else {
        setError("Lien de l'étape introuvable");
      }
    } catch (err) {
      if (startLink) {
        console.error(
          'Erreur lors de la récupération de la prochaine étape, utilisation du fallback :',
          err,
        );
        router.push(startLink);
        return;
      }
      console.error("Erreur lors de la récupération de l'étape :", err);
      setError("Impossible de récupérer l'étape actuelle");
    } finally {
      setIsLoading(false);
    }
  };

  const viewProcedureDetails = (idProc: number) => {
    router.push(`/procedures/details/${idProc}`);
  };

  const editProcedure = (idProc: number) => {
    router.push(`/procedures/edition/${idProc}`);
  };

  // Data processing functions
  const getCurrentPhase = useCallback((etapes: ProcedureEtape[]): ProcedureEtape | undefined => {
    if (!etapes || etapes.length === 0) return undefined;

    const getTime = (value?: string | Date | null) => {
      if (!value) return 0;
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? 0 : time;
    };
    const pickMostRecent = (items: ProcedureEtape[]) =>
      items
        .slice()
        .sort(
          (a, b) =>
            getTime(b.date_debut ?? b.date_fin) - getTime(a.date_debut ?? a.date_fin),
        )[0];

    const enCours = etapes.filter((et) => et.statut === 'EN_COURS');
    if (enCours.length) return pickMostRecent(enCours);

    const terminees = etapes.filter((et) => et.statut === 'TERMINEE');
    if (terminees.length) {
      return terminees
        .slice()
        .sort(
          (a, b) => getTime(b.date_fin ?? b.date_debut) - getTime(a.date_fin ?? a.date_debut),
        )[0];
    }

    return undefined;
  }, []);


  const getPermisTypeLabel = useCallback((demande: Demande): string => {
    const typePermis = getPermisType(demande);
    const code = typePermis?.code_type || '';
    const label = typePermis?.lib_type || '';
    if (code && label) return `${code} - ${label}`;
    return code || label || '---';
  }, [getPermisType]);

  const getStatusConfig = useCallback((status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.default;
  }, []);

  const getSocieteName = useCallback((demande: Demande): string => {
    // Try current demande direct detenteur
    if (demande.detenteur?.nom_societeFR) {
      return demande.detenteur.nom_societeFR;
    }
    // Try flattened detenteurdemande
    const detFromJoin = (demande as any)?.detenteurdemande?.[0]?.detenteur?.nom_societeFR;
    if (detFromJoin) return detFromJoin;

    // For procedures linked to permis, get the original demande's detenteur
    if (demande.procedure?.permis?.length > 0) {
      const permis = demande.procedure.permis[0];
      if (permis?.detenteur?.nom_societeFR) return permis.detenteur.nom_societeFR;
      const originalProcedure = permis.procedures![0];
      if (originalProcedure?.demandes[0]?.detenteur?.nom_societeFR) {
        return originalProcedure.demandes[0].detenteur.nom_societeFR;
      }
    }
    // via permisProcedure -> permis
    const permisViaLink = demande.procedure?.permisProcedure?.[0]?.permis?.detenteur?.nom_societeFR;
    if (permisViaLink) return permisViaLink;
    // Fallback: look at any demande on the procedure that has a detenteur
    const anyDemande = demande.procedure?.demandes?.find((d: Demande) => d.detenteur?.nom_societeFR);
    if (anyDemande?.detenteur?.nom_societeFR) {
      return anyDemande.detenteur.nom_societeFR;
    }
    const anyFromJoin = demande.procedure?.demandes?.find((d: any) => d.detenteurdemande?.[0]?.detenteur?.nom_societeFR);
    if (anyFromJoin?.detenteurdemande?.[0]?.detenteur?.nom_societeFR) {
      return anyFromJoin.detenteurdemande[0].detenteur.nom_societeFR;
    }

    return '---';
  }, []);

  // Filtering and sorting
  const filteredDemandes = useMemo(() => {
    let result = [...demandes];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(d => 
        d.procedure?.num_proc?.toLowerCase().includes(term) ||
        getSocieteName(d)?.toLowerCase().includes(term) ||
        d.code_demande?.toLowerCase().includes(term)
      );
    }

    // Apply procedure type filter
    if (filters.procedureType !== 'Tous les types') {
      result = result.filter(d => 
        getProcedureTypeLabel(d) === filters.procedureType
      );
    }

    // Apply permit code filter
    if (filters.permitCode !== 'Tous les codes') {
      result = result.filter(d => 
        d.code_demande?.startsWith(filters.permitCode)
      );
    }

    // Apply permit type filter
    if (filters.typePermis !== 'Tous les types de permis') {
      result = result.filter(d => getPermisTypeCode(d) === filters.typePermis);
    }

    // Apply phase filter
    if (filters.phase !== 'Toutes les phases') {
      result = result.filter(d => {
        const currentPhase = getCurrentPhase(d.procedure?.ProcedureEtape || []);
        return currentPhase?.etape?.lib_etape === filters.phase;
      });
    }

    // Apply status filter
    if (filters.status !== 'Tous les statuts') {
      result = result.filter(d => 
        d.procedure?.statut_proc === filters.status
      );
    }

    // Apply date range filter
    if (filters.dateRange.start) {
      result = result.filter(d => 
        new Date(d.date_demande) >= new Date(filters.dateRange.start)
      );
    }

    if (filters.dateRange.end) {
      result = result.filter(d => 
        new Date(d.date_demande) <= new Date(filters.dateRange.end)
      );
    }

    // Apply sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortConfig.key === 'procedure.num_proc') {
          aValue = a.procedure.num_proc;
          bValue = b.procedure.num_proc;
        } else if (sortConfig.key === 'detenteur.nom_societeFR') {
          aValue = getSocieteName(a);
          bValue = getSocieteName(b);
        } else if (sortConfig.key === 'procedure.ProcedureEtape') {
          const aPhase = getCurrentPhase(a.procedure.ProcedureEtape);
          const bPhase = getCurrentPhase(b.procedure.ProcedureEtape);
          aValue = aPhase?.etape?.ordre_etape || 0;
          bValue = bPhase?.etape?.ordre_etape || 0;
        } else {
          aValue = a[sortConfig.key as keyof Demande];
          bValue = b[sortConfig.key as keyof Demande];
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    // Update pagination info
    setPagination(prev => ({
      ...prev,
      totalItems: result.length,
      totalPages: Math.ceil(result.length / prev.itemsPerPage)
    }));

    return result;
  }, [
    demandes,
    searchTerm,
    filters,
    sortConfig,
    getSocieteName,
    getProcedureTypeLabel,
    getPermisTypeCode,
    getCurrentPhase,
  ]);

  // Paginated data
  const paginatedDemandes = useMemo(() => {
    const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
    return filteredDemandes.slice(startIndex, startIndex + pagination.itemsPerPage);
  }, [filteredDemandes, pagination.currentPage, pagination.itemsPerPage]);

  // Action handlers
  const handleDeleteProcedure = async (procedureId: number) => {
   
    // Optimistically remove the procedure from state
    setDemandes(prevDemandes =>
      prevDemandes.filter(d => d.procedure.id_proc !== procedureId)
    );

    try {
      const response = await axios.delete(`${apiURL}/api/procedures/${procedureId}`,
        {
          withCredentials: true,
          // @ts-expect-error custom config flag used by api-interceptor
          __noGlobalLoading: true,
        }
      );
      
      if (response.status === 200) {
        toast.success('Procédure supprimée avec succès');
        
        // Refresh data to ensure consistency
        const controller = axios.CancelToken.source();
        fetchDemandes(controller, true);
      } else {
        throw new Error("Échec de la suppression");
      }
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      
      // Revert optimistic update on error
      const controller = axios.CancelToken.source();
      fetchDemandes(controller, true);
      
      toast.error('Erreur lors de la suppression de la procédure');
    }
  };

  const handleRefreshData = () => {
    const controller = axios.CancelToken.source();
    fetchDemandes(controller, true);
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // In a real application, this would call a server endpoint
      // For now, we'll create a client-side export
      const csvContent = [
        ['Code Procédure', 'Titulaire', 'Type de Procédure', 'Type Permis', 'Date Demande', 'Statut', 'Phase Actuelle'],
        ...filteredDemandes.map(d => [
          d.procedure.num_proc,
          getSocieteName(d),
          getProcedureTypeLabel(d) || '---',
          getPermisTypeLabel(d),
          new Date(d.date_demande).toLocaleDateString('fr-FR'),
          d.procedure.statut_proc,
          getCurrentPhase(d.procedure.ProcedureEtape)?.etape?.lib_etape || 'Non démarrée'
        ])
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `demandes_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Export réalisé avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      toast.error('Erreur lors de l\'export des données');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSort = (key: SortConfig['key']) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleItemsPerPageChange = (value: number) => {
    setPagination(prev => ({
      ...prev,
      itemsPerPage: value,
      currentPage: 1, // Reset to first page
      totalPages: Math.ceil(prev.totalItems / value)
    }));
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  };

  // Render functions
  const renderSortIndicator = (key: SortConfig['key']) => {
    if (sortConfig.key !== key) return null;
    
    return sortConfig.direction === 'asc' 
      ? <FiChevronUp className={styles.sortIcon} /> 
      : <FiChevronDown className={styles.sortIcon} />;
  };

  const renderPagination = () => {
    if (pagination.totalPages <= 1) return null;
    
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, pagination.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          className={`${styles.pageButton} ${pagination.currentPage === i ? styles.activePage : ''}`}
          onClick={() => handlePageChange(i)}
        >
          {i}
        </button>
      );
    }
    
    return (
      <div className={styles.pagination}>
        <button
          className={styles.pageNavButton}
          disabled={pagination.currentPage === 1}
          onClick={() => handlePageChange(pagination.currentPage - 1)}
        >
          Précédent
        </button>
        
        {startPage > 1 && (
          <>
            <button
              className={styles.pageButton}
              onClick={() => handlePageChange(1)}
            >
              1
            </button>
            {startPage > 2 && <span className={styles.pageEllipsis}>...</span>}
          </>
        )}
        
        {pages}
        
        {endPage < pagination.totalPages && (
          <>
            {endPage < pagination.totalPages - 1 && <span className={styles.pageEllipsis}>...</span>}
            <button
              className={styles.pageButton}
              onClick={() => handlePageChange(pagination.totalPages)}
            >
              {pagination.totalPages}
            </button>
          </>
        )}
        
        <button
          className={styles.pageNavButton}
          disabled={pagination.currentPage === pagination.totalPages}
          onClick={() => handlePageChange(pagination.currentPage + 1)}
        >
          Suivant
        </button>
      </div>
    );
  };

  const renderViewContent = () => {
    switch (currentView) {
      case 'procedures':
        return (
          <>
            <div className={styles.breadcrumb}>
              <span>SIGAM</span>
              <FiChevronRight className={styles.breadcrumbArrow} />
              <span>Dashboard</span>
              <FiChevronRight className={styles.breadcrumbArrow} />
              <span className={styles.breadcrumbActive}>Suivi des demandes</span>
            </div>
            
            <div className={styles.headerSection}>
              <div className={styles.titleContainer}>
                <h1 className={styles.pageTitle}>
                  Suivi des demandes en cours d'instruction
                </h1>
                <p className={styles.pageSubtitle}>
                  Consultez, filtrez et gérez les demandes de permis en attente de traitement
                </p>
              </div>
              
              <div className={styles.actionButtons}>
                <button
                  className={styles.iconButton}
                  onClick={handleRefreshData}
                  disabled={isRefreshing}
                  title="Actualiser les données"
                >
                  <FiRefreshCw className={isRefreshing ? styles.spinning : ''} />
                </button>
                <button
                  className={styles.iconButton}
                  onClick={() => setShowFilters(!showFilters)}
                  title="Afficher/Masquer les filtres"
                >
                  <FiFilter />
                </button>
                <button
                  className={styles.iconButton}
                  onClick={handleExportData}
                  disabled={isExporting || filteredDemandes.length === 0}
                  title="Exporter les données"
                >
                  <FiDownload />
                </button>
                <button
                  className={styles.primaryButton}
                  onClick={() => router.push('/demand_dashboard')}
                >
                  <FiEye className={styles.buttonIcon} />
                  Dashboard demandes
                </button>
              </div>
            </div>
            
            {error && (
              <div className={styles.errorMessage}>
                <FiAlertTriangle className={styles.errorIcon} />
                <p>{error}</p>
                <button
                  className={styles.retryButton}
                  onClick={handleRefreshData}
                >
                  Réessayer
                </button>
              </div>
            )}

            {/* Filters Section */}
            <div className={`${styles.filtersCard} ${showFilters ? styles.expanded : ''}`}>
              <div className={styles.filtersHeader}>
                <h2 className={styles.filtersTitle}>
                  <FiFilter className={styles.filtersIcon} />
                  Filtres de recherche
                </h2>
                <button
                  className={styles.filtersToggle}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  {showFilters ? 'Masquer les filtres' : 'Afficher les filtres'}
                </button>
              </div>
              
              {showFilters && (
                <div className={styles.filtersContent}>
                  <div className={styles.filtersGrid}>
                    <div className={styles.filterGroup}>
                      <label className={styles.filterLabel}>Type de procédure</label>
                      <select
                        className={styles.filterSelect}
                        value={filters.procedureType}
                        onChange={(e) => setFilters({ ...filters, procedureType: e.target.value })}
                      >
                        {procedureTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.filterGroup}>
                      <label className={styles.filterLabel}>Code permis</label>
                      <select
                        className={styles.filterSelect}
                        value={filters.permitCode}
                        onChange={(e) => setFilters({ ...filters, permitCode: e.target.value })}
                      >
                        {permitCodes.map(code => (
                          <option key={code} value={code}>{code}</option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.filterGroup}>
                      <label className={styles.filterLabel}>Type permis</label>
                      <select
                        className={styles.filterSelect}
                        value={filters.typePermis}
                        onChange={(e) => setFilters({ ...filters, typePermis: e.target.value })}
                      >
                        {permitTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.filterGroup}>
                      <label className={styles.filterLabel}>Secteur</label>
                      <div className={styles.radioGroup}>
                        <label
                          className={`${styles.radioOption} ${filters.sector === 'Mine' ? styles.selected : ''}`}
                        >
                          <input
                            type="radio"
                            name="sector"
                            checked={filters.sector === 'Mine'}
                            onChange={() => setFilters({ ...filters, sector: 'Mine' })}
                          />
                          <span className={styles.radioCustom}></span>
                          Mine
                        </label>
                        <label
                          className={`${styles.radioOption} ${filters.sector === 'Carrière' ? styles.selected : ''}`}
                        >
                          <input
                            type="radio"
                            name="sector"
                            checked={filters.sector === 'Carrière'}
                            onChange={() => setFilters({ ...filters, sector: 'Carrière' })}
                          />
                          <span className={styles.radioCustom}></span>
                          Carrière
                        </label>
                      </div>
                    </div>

                    <div className={styles.filterGroup}>
                      <label className={styles.filterLabel}>Phase actuelle</label>
                      <select
                        className={styles.filterSelect}
                        value={filters.phase}
                        onChange={(e) => setFilters({ ...filters, phase: e.target.value })}
                      >
                        {phases.map(phase => (
                          <option key={phase} value={phase}>{phase}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className={styles.filterGroup}>
                      <label className={styles.filterLabel}>Statut</label>
                      <select
                        className={styles.filterSelect}
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                      >
                        {statuses.map(status => (
                          <option key={status} value={status}>{getStatutLabel(status)}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className={styles.filterGroup}>
                      <label className={styles.filterLabel}>Date de demande</label>
                      <div className={styles.dateRange}>
                        <input
                          type="date"
                          className={styles.dateInput}
                          value={filters.dateRange.start}
                          onChange={(e) => setFilters({ 
                            ...filters, 
                            dateRange: { ...filters.dateRange, start: e.target.value } 
                          })}
                        />
                        <span className={styles.dateSeparator}>au</span>
                        <input
                          type="date"
                          className={styles.dateInput}
                          value={filters.dateRange.end}
                          onChange={(e) => setFilters({ 
                            ...filters, 
                            dateRange: { ...filters.dateRange, end: e.target.value } 
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={styles.filterActions}>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => {
                        setFilters({
                          procedureType: 'Tous les types',
                          permitCode: 'Tous les codes',
                          typePermis: 'Tous les types de permis',
                          sector: 'Mine',
                          phase: 'Toutes les phases',
                          status: 'Tous les statuts',
                          dateRange: { start: '', end: '' }
                        });
                        setSearchTerm('');
                      }}
                    >
                      Réinitialiser les filtres
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Search Section */}
            <div className={styles.searchSection}>
              <div className={styles.searchContainer}>
                <FiSearch className={styles.searchIcon} />
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Rechercher par code, titulaire ou numéro de procédure..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    className={styles.clearSearch}
                    onClick={() => setSearchTerm('')}
                  >
                    <FiX />
                  </button>
                )}
              </div>
              
              <div className={styles.resultsInfo}>
                <span>
                  {filteredDemandes.length} résultat{filteredDemandes.length !== 1 ? 's' : ''} trouvé{filteredDemandes.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Demandes Table */}
            <div className={styles.tableContainer}>
              {isLoading ? (
                <div className={styles.loadingState}>
                  <div className={styles.spinner}></div>
                  <p>Chargement des demandes...</p>
                </div>
              ) : filteredDemandes.length === 0 ? (
                <div className={styles.emptyState}>
                  <FiInfo className={styles.emptyIcon} />
                  <h3>Aucune demande trouvée</h3>
                  <p>
                    {searchTerm || Object.values(filters).some(v => 
                      v !== 'Tous les types' && v !== 'Tous les codes' && v !== 'Tous les types de permis' &&
                      v !== 'Toutes les phases' && v !== 'Tous les statuts' &&
                      (typeof v !== 'object' || (v as any).start !== '')
                    ) 
                      ? 'Aucune demande ne correspond à vos critères de recherche. Veuillez modifier vos filtres.'
                      : 'Aucune demande en cours. Commencez par créer une nouvelle procédure.'
                    }
                  </p>
                  {(!searchTerm && !Object.values(filters).some(v => 
                    v !== 'Tous les types' && v !== 'Tous les codes' && v !== 'Tous les types de permis' &&
                    v !== 'Toutes les phases' && v !== 'Tous les statuts' &&
                    (typeof v !== 'object' || (v as any).start !== '')
                  )) && (
                    <button
                      className={styles.primaryButton}
                      onClick={() => router.push('/procedures/nouvelle')}
                    >
                      <FiPlus className={styles.buttonIcon} />
                      Créer une nouvelle procédure
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className={styles.tableResponsive}>
                    <table className={styles.suiviTable}>
                      <thead>
                        <tr>
                          <th 
                            className={styles.sortableHeader}
                            onClick={() => handleSort('procedure.num_proc')}
                          >
                            CODE PROCÉDURE
                            {renderSortIndicator('procedure.num_proc')}
                          </th>
                          <th
                            className={styles.sortableHeader}
                            onClick={() => handleSort('code_demande')}
                          >
                            CODE DEMANDE
                            {renderSortIndicator('code_demande')}
                          </th>
                          <th 
                            className={styles.sortableHeader}
                            onClick={() => handleSort('detenteur.nom_societeFR')}
                          >
                            TITULAIRE
                            {renderSortIndicator('detenteur.nom_societeFR')}
                          </th>
                          <th>TYPE DE PROCÉDURE</th>
                          <th>TYPE PERMIS</th>
                          <th 
                            className={styles.sortableHeader}
                            onClick={() => handleSort('date_demande')}
                          >
                            DATE DEMANDE
                            {renderSortIndicator('date_demande')}
                          </th>
                          <th>STATUT</th>
                          <th 
                            className={styles.sortableHeader}
                            onClick={() => handleSort('procedure.ProcedureEtape')}
                          >
                            PHASE ACTUELLE
                            {renderSortIndicator('procedure.ProcedureEtape')}
                          </th>
                          <th>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedDemandes.map((d: Demande) => {
                          const currentPhase = getCurrentPhase(d.procedure?.ProcedureEtape || []);
                          const phaseConfig = currentPhase
                            ? STATUS_CONFIG[
                                currentPhase.etape!.lib_etape as keyof typeof STATUS_CONFIG
                              ] || STATUS_CONFIG.default
                            : STATUS_CONFIG.default;
                          const statusConfig = getStatusConfig(d.procedure?.statut_proc);
                          const isExpanded = expandedRows.has(d.id_demande);

                          return (
                            <tr key={d.id_demande} className={isExpanded ? styles.expanded : ''}>
                              <td>
                                <span className={styles.codeHighlight}>{d.procedure?.num_proc}</span>
                              </td>
                              <td>
                                <span className={styles.codeHighlight}>{d.code_demande}</span>
                              </td>
                              <td>{getSocieteName(d)}</td>
                              <td>
                                <div className={styles.procedureType}>
                                  {getProcedureTypeLabel(d) || '---'}
                                  {getProcedureType(d)?.code && (
                                    <span className={styles.procedureCode}>
                                      ({getProcedureType(d)?.code})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>{getPermisTypeLabel(d)}</td>
                              <td>{new Date(d.date_demande).toLocaleDateString('fr-FR')}</td>
                              <td>
                                <div className={`${styles.statusTag} ${statusConfig.bg} ${statusConfig.text}`}>
                                  {statusConfig.icon}
                                  {getStatutLabel(d.procedure?.statut_proc)}
                                </div>
                              </td>
                              <td>
                                {currentPhase ? (
                                  <div className={`${styles.statusTag} ${phaseConfig.bg} ${phaseConfig.text}`}>
                                    {phaseConfig.icon}
                                    {currentPhase.etape!.lib_etape}
                                    {currentPhase.statut === 'EN_RETARD' && (
                                      <FiAlertTriangle className={styles.warningIcon} title="Phase en retard" />
                                    )}
                                  </div>
                                ) : (
                                  <div className={`${styles.statusTag} ${styles['bg-gray-100']} ${styles['text-gray-800']}`}>
                                    <FiClock className={styles['text-gray-500']} />
                                    Non démarrée
                                  </div>
                                )}
                              </td>
                              <td className={styles.actionsCell}>
  <div className={styles.dropdownWrapper}>
    <button
  className={styles.iconButton}
  onClick={() => toggleDropdown(d.id_demande)}
  aria-expanded={openDropdown === d.id_demande}
  aria-haspopup="menu"
  title="Actions"
>
  <FiMoreVertical />
</button>

{openDropdown === d.id_demande && (
  <div className={styles.dropdownMenu} role="menu" aria-label="Actions menu">
    <button
      className={styles.dropdownItem}
      onClick={() => {
        setOpenDropdown(null);
        goToEtape(d.procedure.id_proc, d);
      }}
    >
      <FiChevronRight className={styles.dropdownIcon} /> Continuer
    </button>
    <button
      className={styles.dropdownItem}
      onClick={() => {
        setOpenDropdown(null);
        // use the procedure id for deletion
        handleDeleteProcedure(d.procedure.id_proc);
      }}
    >
      <FiTrash2 className={styles.dropdownIcon} /> Supprimer
    </button>
  </div>
)}
  </div>
</td>
 
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Table footer with pagination */}
                  <div className={styles.tableFooter}>
                    <div className={styles.itemsPerPage}>
                      <span>Afficher</span>
                      <select
                        value={pagination.itemsPerPage}
                        onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                      >
                        {ITEMS_PER_PAGE_OPTIONS.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      <span>entrées par page</span>
                    </div>
                    
                    <div className={styles.paginationInfo}>
                      {pagination.totalItems > 0 ? (
                        <span>
                          Affichage de {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} à{' '}
                          {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} sur{' '}
                          {pagination.totalItems} entrées
                        </span>
                      ) : (
                        <span>Aucune entrée à afficher</span>
                      )}
                    </div>
                    
                    {renderPagination()}
                  </div>
                </>
              )}
            </div>

            {/* Delete Confirmation Modal */}
            {procedureToDelete !== null && (
              <div className={styles.confirmationModal}>
                <div className={styles.modalContent}>
                  <div className={styles.modalHeader}>
                    <FiAlertTriangle className={styles.modalIcon} />
                    <h3 className={styles.modalTitle}>Confirmer la suppression</h3>
                  </div>
                  <p className={styles.modalBody}>
                    Êtes-vous sûr de vouloir supprimer cette procédure et toutes ses
                    données associées ? Cette action est irréversible.
                  </p>
                  <div className={styles.modalActions}>
                    <button
                      className={styles.modalCancelBtn}
                      onClick={() => setProcedureToDelete(null)}
                    >
                      Annuler
                    </button>
                    <button
                      className={styles.modalConfirmBtn}
                      onClick={async () => {
                        await handleDeleteProcedure(procedureToDelete);
                        setProcedureToDelete(null);
                      }}
                    >
                      Supprimer définitivement
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.mainContent}>
          {renderViewContent()}
        </main>
      </div>
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
}

// Helper functions
function getStatutLabel(statut: string) {
  switch (statut) {
    case 'en_instruction': return 'En instruction';
    case 'avis_wilaya': return 'Avis Wilaya';
    case 'Comité de direction': return 'CD à convoquer';
    case 'retard': return 'En retard';
    case 'acceptée': return 'Acceptée';
    case 'rejete': return 'Rejetée';
    case 'Documents': return 'Réserves';
    default: return statut || '---';
  }
}