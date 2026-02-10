'use client';
import styles from './PermisDashboard.module.css';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { 
  FiCalendar, 
  FiFileText, 
  FiActivity, 
  FiUsers, 
  FiRefreshCw,
  FiTrendingUp,
  FiX,
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiEdit,
  FiEye,
  FiTrash2,
  FiDownload,
  FiFilter,
  FiPlus,
  FiAlertTriangle,
  FiChevronDown
} from 'react-icons/fi';
import axios from 'axios';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import Navbar from '../../pages/navbar/Navbar';
import Sidebar from '../../pages/sidebar/Sidebar';
import { ViewType } from '../../src/types/viewtype';
import router from 'next/router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useViewNavigator } from '../../src/hooks/useViewNavigator';
import { useAuthReady } from '@/src/hooks/useAuthReady';
import { format, addMonths, isBefore, isAfter, differenceInDays, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { format as formatDate } from 'date-fns';
import { computePermisSuperficie, getPermisWilayaName, getPermisTitulaireName, getPermisSubstances } from '@/utils/permisHelpers';
import { fetchRecentActivities, generateActivitiesFromPermis } from '@/src/types/activityService';
import RecentActivities from './RecentActivities';
import { useLoading } from '@/components/globalspinner/LoadingContext';
export interface RecentActivity {
  id: number;
  type: 'permis' | 'demande' | 'modification' | 'expiration' | 'renouvellement';
  title: string;
  description: string;
  timestamp: Date;
  status?: 'success' | 'warning' | 'error' | 'info';
  code?: string;
  user?: string;
}

// Types
type DashboardStats = {
  total: number;
  actifs: number;
  enCours: number;
  expires: number;
  expiringSoon: number;
};

type EvolutionData = {
  year: string;
  value: number;
};

type TypeDistribution = {
  name: string;
  value: number;
  color: string;
};

type RegionStat = {
  label: string;
  value: number;
  code?: string | null;
  id_antenne?: number | null;
};

type TopSubstance = {
  id: number;
  name: string;
  count: number;
};

export type Permis = {
  id: number;
  code_permis: string;
  date_octroi: string;
  date_expiration: string;
  superficie?: number;
  typePermis: {
    code_type: string;
    lib_type: string;
  };
  detenteur?: {
    nom_societeFR: string;
  };
  statut?: {
    lib_statut: string;
  };
  commune?: {
    nom_communeFR: string;
    daira?: {
      wilaya?: {
        nom_wilayaFR: string;
        nom_wilayaAR: string;
      };
    };
  };
  procedures?: {
    SubstanceAssocieeDemande: {
      substance: {
        nom_subFR: string;
      };
    }[];
  }[];
};

type Demande = {
  id_demande: number;
  code_demande: string;
  date_demande: string;
  statut_juridique_terrain: string;
  procedure: {
    num_proc: string;
    statut_proc: string;
  };
  detenteur?: {
    nom_societeFR: string;
  };
};


type ExportFormat = 'csv' | 'excel';

export default function PermisDashboard() {
  // Safety: ensure global route spinner is not stuck when landing here
  const { resetLoading } = useLoading();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const { auth } = useAuthStore();
  const isAuthReady = useAuthReady();
  const { currentView, navigateTo } = useViewNavigator('dashboard');
  const isCardsDisabled = auth?.role?.toLowerCase() === 'user';

  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    actifs: 0,
    enCours: 0,
    expires: 0,
    expiringSoon: 0
  });
  const [wilayaStats, setWilayaStats] = useState<RegionStat[]>([]);
  const [antenneStats, setAntenneStats] = useState<RegionStat[]>([]);
  const [now, setNow] = useState<Date>(new Date());
  
  const [evolutionData, setEvolutionData] = useState<EvolutionData[]>([]);
  const [typeData, setTypeData] = useState<TypeDistribution[]>([]);
  const [statusData, setStatusData] = useState<TypeDistribution[]>([]);
  const displayTypeData = useMemo(() => {
    if (typeData.length === 0) return [];
    const sorted = [...typeData].sort((a, b) => b.value - a.value);
    const MAX_SLICES = 8;
    const topSlices = sorted.slice(0, MAX_SLICES);
    const rest = sorted.slice(MAX_SLICES);
    if (!rest.length) {
      return topSlices;
    }
    const othersValue = rest.reduce((sum, entry) => sum + entry.value, 0);
    return [
      ...topSlices,
      {
        name: 'Autres',
        value: othersValue,
        color: '#94a3b8'
      }
    ];
  }, [typeData]);
  const totalTypeCount = useMemo(
    () => displayTypeData.reduce((sum, entry) => sum + entry.value, 0),
    [displayTypeData],
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);
  const didInitialFetchRef = useRef(false);

  // Modal states
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalTitle, setModalTitle] = useState<string>('');
  const [modalContent, setModalContent] = useState<React.ReactNode>(null);
  
  // Data states
  const [permisData, setPermisData] = useState<Permis[]>([]);
  const [activePermisData, setActivePermisData] = useState<Permis[]>([]);
  const [expiredPermisData, setExpiredPermisData] = useState<Permis[]>([]);
  const [demandesData, setDemandesData] = useState<Demande[]>([]);
  const [expiringSoonPermis, setExpiringSoonPermis] = useState<Permis[]>([]);
  const [expiringSoonFromApi, setExpiringSoonFromApi] = useState(false);
  const [currentDataType, setCurrentDataType] = useState<'total' | 'En vigueur' | 'enCours' | 'expires' | 'expiringSoon'>('total');
  const [apiSurfaceStats, setApiSurfaceStats] = useState<{ total: number; avg: number; max: number } | null>(null);
  const [topTitulaires, setTopTitulaires] = useState<{ name: string; count: number }[]>([]);
  const [topSubstances, setTopSubstances] = useState<TopSubstance[]>([]);
  // Surfaces et titulaires (vision operationnelle)
  
  const baseDetenteurRanking = useMemo(() => {
    const counter: Record<string, number> = {};
    (permisData || []).forEach((p) => {
      const name = getPermisTitulaireName(p) || 'Sans titulaire';
      counter[name] = (counter[name] || 0) + 1;
    });
    return Object.entries(counter)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [permisData]);

  const detenteurRanking = useMemo(
    () => (topTitulaires.length ? topTitulaires : baseDetenteurRanking),
    [topTitulaires, baseDetenteurRanking],
  );

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  // On mount: hard-reset any pending global spinner
  useEffect(() => {
    try { resetLoading(); } catch {}
  }, [resetLoading]);

  // Horloge temps r?el
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000 * 60);
    return () => clearInterval(timer);
  }, []);

  // Filter states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<{start: Date | null, end: Date | null}>({start: null, end: null});
  const [advancedFilters, setAdvancedFilters] = useState<boolean>(false);
  
  // Permis list states

  const [totalPermisCount, setTotalPermisCount] = useState(0);
  const [isLoadingPermis, setIsLoadingPermis] = useState(false);
  const [permisList, setPermisList] = useState<Permis[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [permisTypes, setPermisTypes] = useState<string[]>([]);
  const [currentPermisPage, setCurrentPermisPage] = useState(1);
  const [permisPerPage, setPermisPerPage] = useState(50); 
  // Add these to your existing state declarations
const [expirationFilter, setExpirationFilter] = useState<string>('all');
const [surfaceFilter, setSurfaceFilter] = useState<{min: number | null, max: number | null}>({min: null, max: null});
const [substanceFilter, setSubstanceFilter] = useState<string>('all');
const [substancesList, setSubstancesList] = useState<string[]>([]);
const [selectedWilayas, setSelectedWilayas] = useState<string[]>([]);
const [wilayaDropdownOpen, setWilayaDropdownOpen] = useState<boolean>(false);
const [wilayaSearch, setWilayaSearch] = useState<string>('');
const [wilayaList, setWilayaList] = useState<string[]>([]);
const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
const [loadingActivities, setLoadingActivities] = useState(true);
const [selectedRegionMode, setSelectedRegionMode] = useState<'wilaya' | 'antenne'>('wilaya');

const fetchActivities = useCallback(async () => {
  setLoadingActivities(true);
  try {
    // Try to fetch from API first
    const activities = await fetchRecentActivities();
    
    if (activities.length > 0) {
      setRecentActivities(activities);
    } else {
      // Fallback: generate activities from permis data
      const generatedActivities = generateActivitiesFromPermis(permisList);
      setRecentActivities(generatedActivities);
    }
  } catch (error) {
    console.error('Error loading activities:', error);
    // Fallback: generate activities from permis data
    const generatedActivities = generateActivitiesFromPermis(permisList);
    setRecentActivities(generatedActivities);
  } finally {
    setLoadingActivities(false);
  }
}, [permisList]);

// Call this when permisList changes or on component mount
useEffect(() => {
  if (permisList.length > 0) {
    fetchActivities();
  }
}, [permisList, fetchActivities]);

// Add this useEffect to extract wilayas from permis data
useEffect(() => {
  const wilayas = new Set<string>();
  permisList.forEach(permis => {
    const wilayaName = getPermisWilayaName(permis);
    if (wilayaName) {
      wilayas.add(wilayaName);
    }
  });
  setWilayaList(Array.from(wilayas).sort());
}, [permisList]);


// Helper function to get wilaya name from permis
const getWilayaName = useCallback((permis: Permis): string => {
  return getPermisWilayaName(permis) || 'N/A';
}, []);

const topWilayaStats = useMemo(
  () => [...wilayaStats].sort((a, b) => b.value - a.value).slice(0, 8),
  [wilayaStats],
);

const topAntenneStats = useMemo(
  () => [...antenneStats].sort((a, b) => b.value - a.value).slice(0, 8),
  [antenneStats],
);

const regionChartData = useMemo(() => {
  const source = selectedRegionMode === 'wilaya' ? topWilayaStats : topAntenneStats;
  return source.map((item) => ({
    label: item.label?.length > 18 ? `${item.label.slice(0, 17)}?` : item.label,
    value: item.value,
  }));
}, [selectedRegionMode, topWilayaStats, topAntenneStats]);

const expiringBuckets = useMemo(() => {
  const buckets = { within30: 0, within90: 0, within180: 0 };
  const today = new Date();
  expiringSoonPermis.forEach((permis) => {
    if (!permis.date_expiration) return;
    const expDate = new Date(permis.date_expiration);
    const daysLeft = differenceInDays(expDate, today);
    if (daysLeft < 0) return;
    if (daysLeft <= 30) buckets.within30 += 1;
    else if (daysLeft <= 90) buckets.within90 += 1;
    else if (daysLeft <= 180) buckets.within180 += 1;
  });
  return buckets;
}, [expiringSoonPermis]);

const expiringTimeline = useMemo(() => {
  const base = startOfMonth(new Date());
  const months = Array.from({ length: 6 }, (_, idx) => addMonths(base, idx));
  return months.map((monthStart) => {
    const monthEnd = endOfMonth(monthStart);
    const count = expiringSoonPermis.reduce((acc, permis) => {
      if (!permis.date_expiration) return acc;
      const expDate = new Date(permis.date_expiration);
      if (expDate >= monthStart && expDate <= monthEnd) return acc + 1;
      return acc;
    }, 0);
    return {
      month: format(monthStart, 'MMM yyyy', { locale: fr }),
      count,
    };
  });
}, [expiringSoonPermis]);

 // Helper function to check if dates are equal (ignoring time)
  const isEqualDate = (date1: Date, date2: Date): boolean => {
    return date1.toDateString() === date2.toDateString();
  };

  // Filtered permis based on search and status
  const filteredPermis = useMemo(() => {
    return permisList.filter((permis) => {
      const query = (searchQuery ?? '').toLowerCase();
      const titulaire = (getPermisTitulaireName(permis) ?? '').toLowerCase();
      const codePermis = (permis.code_permis ?? '').toLowerCase();
      const typePermisLabel = (permis.typePermis?.lib_type ?? '').toLowerCase();
      const matchesSearch =
        codePermis.includes(query) ||
        typePermisLabel.includes(query) ||
        titulaire.includes(query);
      
      const now = new Date();
      const isExpired = !!permis.date_expiration && new Date(permis.date_expiration) < now;
      const isActive = permis.statut?.lib_statut === 'En vigueur';
      
      let matchesStatus: boolean = true;
      if (statusFilter === 'active') matchesStatus = !!isActive;
      else if (statusFilter === 'expired') matchesStatus = !!isExpired;
      
      let matchesType: boolean = true;
      if (typeFilter !== 'all') {
        matchesType = permis.typePermis?.lib_type === typeFilter;
      }
      
      let matchesDate: boolean = true;
      if (dateFilter.start && permis.date_octroi) {
        const octroiDate = new Date(permis.date_octroi);
        matchesDate = isAfter(octroiDate, dateFilter.start) || isEqualDate(octroiDate, dateFilter.start);
      }
      if (dateFilter.end && permis.date_octroi) {
        const octroiDate = new Date(permis.date_octroi);
        matchesDate = matchesDate && (isBefore(octroiDate, dateFilter.end) || isEqualDate(octroiDate, dateFilter.end));
      }
      
      let matchesExpiration = true;
    if (expirationFilter !== 'all') {
      const now = new Date();
      const expDate = permis.date_expiration ? new Date(permis.date_expiration) : null;
      const sixMonthsLater = addMonths(now, 6);
      
      if (expirationFilter === 'expiring_soon') {
        matchesExpiration = expDate ? (expDate > now && expDate <= sixMonthsLater) : false;
      } else if (expirationFilter === 'expired') {
        matchesExpiration = expDate ? expDate < now : false;
      } else if (expirationFilter === 'valid') {
        matchesExpiration = expDate ? expDate > now : false;
      }
    }
    
    let matchesSurface = true;
    const surfaceValue = computePermisSuperficie(permis);
    if (surfaceFilter.min !== null && surfaceValue !== null) {
      matchesSurface = surfaceValue >= surfaceFilter.min;
    }
    if (surfaceFilter.max !== null && surfaceValue !== null) {
      matchesSurface = matchesSurface && surfaceValue <= surfaceFilter.max;
    }
    
    let matchesSubstance = true;
    if (substanceFilter !== 'all') {
      const substances = getSubstancesForPermis(permis);
      matchesSubstance = substances.includes(substanceFilter);
    }
    
    let matchesWilaya = true;
    if (selectedWilayas.length > 0) {
      const wilayaName = getWilayaName(permis);
      matchesWilaya = selectedWilayas.includes(wilayaName);
    }
    
    return matchesSearch && matchesStatus && matchesType && matchesDate && 
           matchesExpiration && matchesSurface && matchesSubstance && matchesWilaya;
  });
}, [permisList, searchQuery, statusFilter, typeFilter, dateFilter, 
    expirationFilter, surfaceFilter, substanceFilter, selectedWilayas, getWilayaName]);
 
  // Calculate expiring soon permis
  useEffect(() => {
    if (expiringSoonFromApi) return;
    const now = new Date();
    const sixMonthsLater = addMonths(now, 6);

    const expiring = permisList.filter(permis => {
      if (!permis.date_expiration) return false;
      
      const expDate = new Date(permis.date_expiration);
      return expDate > now && expDate <= sixMonthsLater;
    });

    setExpiringSoonPermis(expiring);
  }, [permisList, expiringSoonFromApi]);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [
        statsResponse,
        evolutionResponse,
        typesResponse,
        statusResponse,
        expiringResponse,
        wilayaResponse,
        antenneResponse,
        topSubstancesResponse,
      ] = await Promise.all([
        axios.get(`${apiURL}/api/dashboard/stats`),
        axios.get(`${apiURL}/api/dashboard/evolution`),
        axios.get(`${apiURL}/api/dashboard/types`),
        axios.get(`${apiURL}/api/dashboard/status-distribution`),
        axios.get(`${apiURL}/api/dashboard/expiring-soon`),
        axios.get(`${apiURL}/api/dashboard/by-wilaya`),
        axios.get(`${apiURL}/api/dashboard/by-antenne`),
        axios.get(`${apiURL}/api/dashboard/top-substances`).catch(() => ({ data: [] })),
      ]);

      const expSoonList = Array.isArray(expiringResponse.data) ? expiringResponse.data : [];
      setExpiringSoonPermis(expSoonList);
      setExpiringSoonFromApi(true);
      setTopTitulaires(statsResponse.data?.topTitulaires || []);
      setApiSurfaceStats(statsResponse.data?.surface || null);
      setWilayaStats(Array.isArray(wilayaResponse.data) ? wilayaResponse.data : []);
      setAntenneStats(Array.isArray(antenneResponse.data) ? antenneResponse.data : []);
      setTopSubstances(Array.isArray(topSubstancesResponse.data) ? topSubstancesResponse.data : []);

      setStats({
        total: statsResponse.data?.total ?? 0,
        actifs: statsResponse.data?.actifs ?? 0,
        enCours: statsResponse.data?.enCours ?? 0,
        expires: statsResponse.data?.expires ?? 0,
        expiringSoon: expSoonList.length || statsResponse.data?.expiringSoon || 0,
      });
      setEvolutionData(evolutionResponse.data);
      // Normalize pie data to display code_type only
      const palette = ['#3B82F6', '#22D3EE', '#F59E0B', '#10B981', '#6366F1', '#EC4899', '#8B5CF6', '#14B8A6'];
      const normalizedTypes = (typesResponse.data ?? []).map((t: any, idx: number) => ({
        name: t?.code_type ?? t?.name ?? `Type ${idx + 1}`,
        value: t?.value ?? t?.count ?? 0,
        color: t?.color ?? palette[idx % palette.length],
      }));
      setTypeData(normalizedTypes);
      setStatusData(statusResponse.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Echec du chargement des donnees du tableau de bord');
    } finally {
      setLoading(false);
    }
  }, [apiURL]);


  useEffect(() => {
    setStats((prev) => ({
      ...prev,
      expiringSoon: expiringSoonPermis.length,
    }));
  }, [expiringSoonPermis.length]);

  // Fetch permis list
  const fetchPermisList = useCallback(async (page: number = 1) => {
    if (!apiURL || !isAuthReady) return;
    setIsLoadingPermis(true);
    try {
      const response = await axios.get(`${apiURL}/Permisdashboard`, {
        params: {
          page: Number(page),
          limit: Number(permisPerPage),
          ...(auth?.antenneId ? { id_antenne: auth.antenneId } : {})
        },
        withCredentials: true,
      });
      
      const raw = response.data?.data ?? response.data ?? [];
      const data: Permis[] = Array.isArray(raw) ? (raw as Permis[]) : [];
      console.log('Fetched permis data length:', data.length);
      setPermisList(data);
      setTotalPermisCount(response.data?.totalCount ?? data.length);

      // Extract unique types for filter
      const types = [...new Set(
        data
          .map((p: Permis) => p.typePermis?.code_type)
          .filter((v): v is string => Boolean(v))
      )];
      setPermisTypes(types);
    } catch (error) {
      console.error('Error fetching permis list:', error);
    } finally {
      setIsLoadingPermis(false);
    }
  }, [apiURL, isAuthReady, permisPerPage, auth?.antenneId]);

  // Fetch detailed data for modal
  const fetchDetailedData = useCallback(async (type: 'total' | 'En vigueur' | 'enCours' | 'expires') => {
    if (!apiURL || !isAuthReady) return;
    try {
      setLoading(true);
      
      let endpoint = '';
      let title = '';
      
      switch (type) {
        case 'total':
          endpoint = `${apiURL}/Permisdashboard`;
          title = 'Tous les permis';
          break;
        case 'En vigueur':
          endpoint = `${apiURL}/Permisdashboard/actifs`;
          title = 'Permis En vigueur';
          break;
        case 'enCours':
          endpoint = `${apiURL}/Demandesdashboard/en-cours`;
          title = 'Demandes en cours';
          break;
        case 'expires':
          endpoint = `${apiURL}/Permisdashboard/expires`;
          title = 'Permis Expir?e';
          break;
      }
      
      const response = await axios.get(endpoint, {
        params: auth?.antenneId ? { id_antenne: auth.antenneId } : undefined,
        withCredentials: true,
      });
      const raw = response.data?.data ?? response.data ?? [];
      const payload = Array.isArray(raw) ? raw : [];
      
      if (type === 'total') {
        setPermisData(payload as Permis[]);
      } else if (type === 'En vigueur') {
        setActivePermisData(payload as Permis[]);
      } else if (type === 'expires') {
        setExpiredPermisData(payload as Permis[]);
      } else if (type === 'enCours') {
        setDemandesData(payload as Demande[]);
      }
      
      setModalTitle(title);
      setModalOpen(true);
    } catch (err) {
      console.error('Failed to fetch detailed data:', err);
      setError('?chec du chargement des données d?taill?es');
    } finally {
      setLoading(false);
    }
  }, [apiURL, isAuthReady, auth?.antenneId]);

  // Get substances for a permis using shared helper
  const getSubstancesForPermis = useCallback((permis: Permis) => {
    return getPermisSubstances(permis);
  }, []);

  const formatSurfaceValue = useCallback((value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value)) return '--';
    return value.toFixed(2);
  }, []);
  useEffect(() => {
  const substances = new Set<string>();
  permisList.forEach(permis => {
    getSubstancesForPermis(permis).forEach(sub => substances.add(sub));
  });
  setSubstancesList(Array.from(substances).sort());
}, [permisList, getSubstancesForPermis]);

  // Handle pagination change
  const handlePermisPageChange = useCallback((page: number) => {
    setCurrentPermisPage(page);
    fetchPermisList(page);
  }, [fetchPermisList]);

  // Handle card click
  const handleCardClick = useCallback(async (type: 'total' | 'En vigueur' | 'enCours' | 'expires' | 'expiringSoon') => {
    if (isCardsDisabled) return;
    setCurrentPage(1);
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
    setDateFilter({start: null, end: null});
    setCurrentDataType(type);
    
    if (type === 'expiringSoon') {
      setModalTitle('Permis expirant dans moins de 6 mois');
      setModalOpen(true);
      return;
    }
    
    await fetchDetailedData(type);
  }, [fetchDetailedData, isCardsDisabled]);

  // View permis details
  const handleViewPermis = useCallback((permisId: number) => {
    router.push(`/permis_dashboard/view/permisdetails?id=${permisId}`);
  }, []);

  // Edit permis
  const handleEditPermis = useCallback((permisId: number) => {
    router.push(`/permis_dashboard/edit/${permisId}`);
  }, []);

  // Delete permis
  const handleDeletePermis = useCallback(async (permisId: number) => {
    if (!confirm('?tes-vous s?r de vouloir supprimer ce permis?')) return;
    
    try {
      await axios.delete(`${apiURL}/Permisdashboard/${permisId}`);
      setPermisList(prev => prev.filter(p => p.id !== permisId));
      alert('Permis supprim? avec succès');
    } catch (error) {
      console.error('Error deleting permis:', error);
      alert('Erreur lors de la suppression du permis');
    }
  }, [apiURL]);

  // Export data to CSV
  const exportToCSV = useCallback((data: any[], filename: string) => {
    if (data.length === 0) {
      alert('Aucune donn?e ? exporter');
      return;
    }

    // Get headers from the first object
    const headers = Object.keys(data[0]);
    
    // Create CSV content
    let csvContent = headers.join(',') + '\n';
    
    // Add rows
    data.forEach(item => {
      const row = headers.map(header => {
        // Handle nested objects
        const value = header.includes('.') 
          ? header.split('.').reduce((obj, key) => obj && obj[key], item)
          : item[header];
        
        // Format the value for CSV (escape quotes and wrap in quotes if needed)
        const formattedValue = String(value || '').replace(/"/g, '""');
        return `"${formattedValue}"`;
      });
      csvContent += row.join(',') + '\n';
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // Export data to Excel (using CSV as fallback)
  const exportToExcel = useCallback((data: any[], filename: string) => {
    // For frontend-only solution, we'll use CSV as Excel can open CSV files
    // In a real implementation, you might use a library like xlsx
    exportToCSV(data, filename);
  }, [exportToCSV]);

  // Handle export data
  const handleExportData = useCallback(async (format: ExportFormat, dataType: 'permis' | 'demandes' = 'permis') => {
    try {
      setExporting(true);
      
      // Determine which data to export based on current context
      let dataToExport: any[] = [];
      let filename = '';
      
      if (modalOpen) {
        // Export modal data
        switch (currentDataType) {
          case 'total':
            dataToExport = permisData;
            filename = 'tous_les_permis';
            break;
          case 'En vigueur':
            dataToExport = activePermisData;
            filename = 'permis_En_vigueur';
            break;
          case 'expires':
            dataToExport = expiredPermisData;
            filename = 'permis_expires';
            break;
          case 'expiringSoon':
            dataToExport = expiringSoonPermis;
            filename = 'permis_expirant_bientot';
            break;
          case 'enCours':
            dataToExport = demandesData;
            filename = 'demandes_en_cours';
            dataType = 'demandes';
            break;
        }
      } else {
        // Export main table data
        dataToExport = filteredPermis;
        filename = 'liste_des_permis';
      }
      
      // Flatten the data for export
      const permisById = new Map<number, Permis>();
      permisList.forEach((p) => {
        if (p && typeof p.id === 'number') permisById.set(p.id, p);
      });
      const resolvePermisForExport = (permis: Permis) =>
        (permis && typeof permis.id === 'number' && permisById.get(permis.id)) || permis;

      const flattenedData = dataToExport.map(item => {
        if (dataType === 'permis') {
          const permis = resolvePermisForExport(item as Permis);
          const surface = computePermisSuperficie(permis);
          const titulaire = getPermisTitulaireName(permis) || 'N/A';
          return {
            'Code Permis': permis.code_permis,
            'Type': permis.typePermis?.lib_type || 'N/A',
            'Titulaire': titulaire,
            'Statut': permis.statut?.lib_statut || 'N/A',
'Date Octroi': permis.date_octroi
  ? formatDate(new Date(permis.date_octroi), 'dd/MM/yyyy', { locale: fr })
  : 'N/A',

'Date Expiration': permis.date_expiration
  ? formatDate(new Date(permis.date_expiration), 'dd/MM/yyyy', { locale: fr })
  : 'N/A',

            'Surface (HA)': surface != null ? surface.toFixed(2) : 'N/A',
            'Substances': getSubstancesForPermis(permis).join(', ')
          };
        } else {
          const demande = item as Demande;
          return {
            'Code Demande': demande.code_demande,
            'Titulaire': demande.detenteur?.nom_societeFR || 'N/A',
            'Date Demande': formatDate(new Date(demande.date_demande), 'dd/MM/yyyy', { locale: fr }),
            'Statut Terrain': demande.statut_juridique_terrain || 'N/A',
            'Statut Proc?dure': demande.procedure.statut_proc
          };
        }
      });
      
      // Export based on format
      if (format === 'csv') {
        exportToCSV(flattenedData, filename);
      } else if (format === 'excel') {
        exportToExcel(flattenedData, filename);
      }
      
    } catch (error) {
      console.error('Export error:', error);
      alert('Erreur lors de l\'exportation des données');
    } finally {
      setExporting(false);
    }
  }, [
    modalOpen, currentDataType, permisData, activePermisData, 
    expiredPermisData, expiringSoonPermis, demandesData, 
    filteredPermis, exportToCSV, exportToExcel, getSubstancesForPermis, permisList
  ]);

  // Render permis modal
  const renderPermisModal = useCallback((title: string, data: Permis[]) => {
    const filteredData = data.filter(permis => {
      const searchTermLower = (searchTerm ?? '').toLowerCase();
      const titulaireLower = (getPermisTitulaireName(permis) ?? '').toLowerCase();
      const codePermisLower = (permis.code_permis ?? '').toLowerCase();
      const typePermisLower = (permis.typePermis?.lib_type ?? '').toLowerCase();
      const matchesSearch = 
        codePermisLower.includes(searchTermLower) ||
        titulaireLower.includes(searchTermLower) ||
        typePermisLower.includes(searchTermLower);
      
      let matchesStatus = true;
      if (statusFilter === 'active') {
        matchesStatus = permis.statut?.lib_statut === 'En vigueur';
      } else if (statusFilter === 'expired') {
        matchesStatus = !!permis.date_expiration && new Date(permis.date_expiration) < new Date();
      }
      
      let matchesType = true;
      if (typeFilter !== 'all') {
        matchesType = permis.typePermis?.lib_type === typeFilter;
      }
      
      let matchesDate = true;
      if (dateFilter.start && permis.date_octroi) {
        const octroiDate = new Date(permis.date_octroi);
        matchesDate = isAfter(octroiDate, dateFilter.start) || isEqualDate(octroiDate, dateFilter.start);
      }
      if (dateFilter.end && permis.date_octroi) {
        const octroiDate = new Date(permis.date_octroi);
        matchesDate = matchesDate && (isBefore(octroiDate, dateFilter.end) || isEqualDate(octroiDate, dateFilter.end));
      }
      
      return matchesSearch && matchesStatus && matchesType && matchesDate;
    });

    const paginatedData = filteredData.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );

    const modalContent = (
      <div className={styles.modalContentContainer}>
        <div className={styles.modalFilters}>
          <div className={styles.searchInputContainer}>
            <FiSearch className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Rechercher..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          
          <div className={styles.filterRow}>
            <select 
              className={styles.filterSelect}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">Tous les statuts</option>
              <option value="active">En vigueur</option>
              <option value="expired">Expirés</option>
            </select>
            
            <select 
              className={styles.filterSelect}
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">Tous les types</option>
              {permisTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            
            <button 
              className={styles.advancedFilterButton}
              onClick={() => setAdvancedFilters(!advancedFilters)}
            >
              <FiFilter /> Filtres avancés
            </button>
          </div>
          
          {advancedFilters && (
            <div className={styles.dateFilterContainer}>
              <label>Date d'octroi:</label>
              <input
                type="date"
                value={dateFilter.start ? format(dateFilter.start, 'yyyy-MM-dd') : ''}
                onChange={(e) => setDateFilter({...dateFilter, start: e.target.value ? new Date(e.target.value) : null})}
              />
              <span>?</span>
              <input
                type="date"
                value={dateFilter.end ? format(dateFilter.end, 'yyyy-MM-dd') : ''}
                onChange={(e) => setDateFilter({...dateFilter, end: e.target.value ? new Date(e.target.value) : null})}
              />
            </div>
          )}
        </div>
        
        <div className={styles.tableContainer}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Code Permis</th>
                <th>Type</th>
                <th>D?tenteur</th>
                <th>Date Octroi</th>
                <th>Date Expiration</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((permis) => (
                <tr key={permis.id}>
                  <td>{permis.code_permis}</td>
                  <td>{permis.typePermis?.lib_type || 'N/A'}</td>
                  <td>{getPermisTitulaireName(permis) || 'N/A'}</td>
                  <td>{permis.date_octroi ? format(new Date(permis.date_octroi), 'dd/MM/yyyy', { locale: fr }) : 'N/A'}</td>
                  <td>{permis.date_expiration ? format(new Date(permis.date_expiration), 'dd/MM/yyyy', { locale: fr }) : 'N/A'}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${
                      permis.statut?.lib_statut === 'En vigueur' ? styles.statusActive : 
                      permis.date_expiration && new Date(permis.date_expiration) < new Date() ? styles.statusExpired : ''
                    }`}>
                      {permis.statut?.lib_statut || 'N/A'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionButtons}>
                      <button 
                        className={styles.viewButton}
                        onClick={() => handleViewPermis(permis.id)}
                        title="Voir d?tails"
                      >
                        <FiEye size={18} />
                      </button>
                      <button 
                        className={styles.editButton}
                        onClick={() => handleEditPermis(permis.id)}
                        title="Modifier"
                      >
                        <FiEdit size={18} />
                      </button>
                      {/** delete action intentionally omitted on this view */}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredData.length > itemsPerPage && (
          <div className={styles.pagination}>
            <button
              className={styles.paginationButton}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              <FiChevronLeft />
            </button>
            
            {Array.from({ length: Math.ceil(filteredData.length / itemsPerPage) }, (_, i) => (
              <button
                key={i + 1}
                className={`${styles.paginationButton} ${currentPage === i + 1 ? styles.active : ''}`}
                onClick={() => setCurrentPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
            
            <button
              className={styles.paginationButton}
              disabled={currentPage === Math.ceil(filteredData.length / itemsPerPage)}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              <FiChevronRight />
            </button>
          </div>
        )}
        
        <div className={styles.modalFooter}>
          <div className={styles.totalCount}>
            Total: {filteredData.length} {filteredData.length === 1 ? 'permis' : 'permis'}
          </div>
          <div className={styles.exportButtons}>
            <button 
              className={styles.exportButton}
              onClick={() => handleExportData('csv')}
              disabled={exporting}
            >
              <FiDownload /> Exporter CSV
            </button>
            <button 
              className={styles.exportButton}
              onClick={() => handleExportData('excel')}
              disabled={exporting}
            >
              <FiDownload /> Exporter Excel
            </button>
          </div>
        </div>
      </div>
    );
    
    setModalContent(modalContent);
  }, [searchTerm, statusFilter, typeFilter, dateFilter, currentPage, permisTypes, advancedFilters, exporting, handleViewPermis, handleEditPermis, handleExportData]);

  // Render demandes modal
  const renderDemandesModal = useCallback((title: string, data: Demande[]) => {
    const filteredData = data.filter(demande => {
      const searchTermLower = (searchTerm ?? '').toLowerCase();
      const codeDemandeLower = (demande.code_demande ?? '').toLowerCase();
      const detenteurLower = (demande.detenteur?.nom_societeFR ?? '').toLowerCase();
      return codeDemandeLower.includes(searchTermLower) || detenteurLower.includes(searchTermLower);
    });
    
    const paginatedData = filteredData.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
    
    const modalContent = (
      <div className={styles.modalContentContainer}>
        <div className={styles.modalFilters}>
          <div className={styles.searchInputContainer}>
            <FiSearch className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Rechercher..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
        
        <div className={styles.tableContainer}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Code Demande</th>
                <th>D?tenteur</th>
                <th>Date Demande</th>
                <th>Statut Terrain</th>
                <th>Statut Proc?dure</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((demande) => (
                <tr key={demande.id_demande}>
                  <td>{demande.code_demande}</td>
                  <td>{demande.detenteur?.nom_societeFR || 'N/A'}</td>
                  <td>{format(new Date(demande.date_demande), 'dd/MM/yyyy', { locale: fr })}</td>
                  <td>{demande.statut_juridique_terrain || 'N/A'}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles.statusPending}`}>
                      {demande.procedure.statut_proc}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredData.length > itemsPerPage && (
          <div className={styles.pagination}>
            <button
              className={styles.paginationButton}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              <FiChevronLeft />
            </button>
            
            {Array.from({ length: Math.ceil(filteredData.length / itemsPerPage) }, (_, i) => (
              <button
                key={i + 1}
                className={`${styles.paginationButton} ${currentPage === i + 1 ? styles.active : ''}`}
                onClick={() => setCurrentPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
            
            <button
              className={styles.paginationButton}
              disabled={currentPage === Math.ceil(filteredData.length / itemsPerPage)}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              <FiChevronRight />
            </button>
          </div>
        )}
        
        <div className={styles.modalFooter}>
          <div className={styles.totalCount}>
            Total: {filteredData.length} {filteredData.length === 1 ? 'demande' : 'demandes'}
          </div>
          <div className={styles.exportButtons}>
            <button 
              className={styles.exportButton}
              onClick={() => handleExportData('csv', 'demandes')}
              disabled={exporting}
            >
              <FiDownload /> Exporter CSV
            </button>
            <button 
              className={styles.exportButton}
              onClick={() => handleExportData('excel', 'demandes')}
              disabled={exporting}
            >
              <FiDownload /> Exporter Excel
            </button>
          </div>
        </div>
      </div>
    );
    
    setModalContent(modalContent);
  }, [searchTerm, currentPage, handleExportData, exporting]);

  // Close modal
  const closeModal = useCallback(() => {
    setModalOpen(false);
    setModalContent(null);
    setAdvancedFilters(false);
  }, []);

  // Initial data loading
  useEffect(() => {
    if (didInitialFetchRef.current) return;
    if (!isAuthReady) return;
    didInitialFetchRef.current = true;
    fetchDashboardData();
    fetchPermisList();
  }, [fetchDashboardData, fetchPermisList, isAuthReady]);

  // Re-render modal when filters or data change
  useEffect(() => {
    if (modalOpen) {
      if (currentDataType === 'expiringSoon') {
        renderPermisModal(modalTitle, expiringSoonPermis);
      } else if (currentDataType === 'enCours') {
        renderDemandesModal(modalTitle, demandesData);
      } else {
        const data = 
          currentDataType === 'total' ? permisData :
          currentDataType === 'En vigueur' ? activePermisData :
          currentDataType === 'expires' ? expiredPermisData : [];
        renderPermisModal(modalTitle, data);
      }
    }
  }, [searchTerm, statusFilter, typeFilter, dateFilter, currentPage, modalOpen, currentDataType, 
      permisData, activePermisData, expiredPermisData, demandesData, expiringSoonPermis, 
      renderPermisModal, renderDemandesModal, modalTitle]);

  // Loading state
  if (loading && !modalOpen) {
    return (
      <div className={styles.dashboardContainer}>
        <div className={styles.loading}>
          <FiRefreshCw className={styles.spinner} size={24} />
          <span>Chargement des données...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !modalOpen) {
    return (
      <div className={styles.dashboardContainer}>
        <div className={styles.error}>
          <FiAlertTriangle size={32} />
          <p>{error}</p>
          <button 
            onClick={fetchDashboardData}
            className={styles.retryButton}
          >
            R?essayer
          </button>
        </div>
      </div>
    );
  }

  return (
   <div className={styles['app-container']}>
      <Navbar />
      <div className={styles['app-content']}>
      <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles['main-content']}>
          <div className={styles.container}>
            <div className={styles.contentWrapper}>
                {/* Dashboard Header */}
                <div className={styles.header}>
                  <div className={styles.headerTitle}>
                    <h1>Tableau de Bord SIGAM</h1>
                    <p>Bienvenue, {auth?.username || 'Utilisateur'}</p>
                  </div>
                  <div className={styles.headerActions}>
                    <div className={styles.timestamp}>
                      Dernière mise à jour: {format(now, 'dd MMMM yyyy HH:mm', { locale: fr })}
                    </div>
                    <button 
                      onClick={() => {
                        fetchDashboardData();
                        fetchPermisList(currentPermisPage);
                      }} 
                      className={styles.refreshButton}
                    >
                      <FiRefreshCw size={16} />
                      Actualiser
                    </button>
                    
                  </div>
                </div>

                {/* Stats Cards */}
                <div className={styles.cardRow}>
                  <div 
                    className={`${styles.card} ${styles.teal} ${isCardsDisabled ? styles.cardDisabled : ''}`}
                    onClick={isCardsDisabled ? undefined : () => handleCardClick('total')}
                    aria-disabled={isCardsDisabled}
                  >
                    <FiFileText className={styles.cardIcon} />
                    <div className={styles.cardContent}>
                      <h4>Total des permis</h4>
                      <p>{stats.total.toLocaleString()}</p>
                    </div>
                  </div>

                  <div 
                    className={`${styles.card} ${styles.yellow} ${isCardsDisabled ? styles.cardDisabled : ''}`}
                    onClick={isCardsDisabled ? undefined : () => handleCardClick('En vigueur')}
                    aria-disabled={isCardsDisabled}
                  >
                    <FiActivity className={styles.cardIcon} />
                    <div className={styles.cardContent}>
                      <h4>Permis En vigueur</h4>
                      <p>{stats.actifs.toLocaleString()}</p>
                      <div className={styles.cardPercentage}>
                        {stats.total > 0 ? `${Math.round((stats.actifs / stats.total) * 100)}% du total` : 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div 
                    className={`${styles.card} ${styles.blue} ${isCardsDisabled ? styles.cardDisabled : ''}`}
                    onClick={isCardsDisabled ? undefined : () => handleCardClick('enCours')}
                    aria-disabled={isCardsDisabled}
                  >
                    <FiUsers className={styles.cardIcon} />
                    <div className={styles.cardContent}>
                      <h4>Demandes en cours</h4>
                      <p>{stats.enCours.toLocaleString()}</p>
                    </div>
                  </div>

                  <div 
                    className={`${styles.card} ${styles.pink} ${isCardsDisabled ? styles.cardDisabled : ''}`}
                    onClick={isCardsDisabled ? undefined : () => handleCardClick('expires')}
                    aria-disabled={isCardsDisabled}
                  >
                    <FiCalendar className={styles.cardIcon} />
                    <div className={styles.cardContent}>
                      <h4>Permis expirés</h4>
                      <p>{stats.expires.toLocaleString()}</p>
                      <div className={styles.cardPercentage}>
                        {stats.actifs > 0 ? `${Math.round((stats.expires / stats.actifs) * 100)}% des En vigueur` : 'N/A'}
                      </div>
                    </div>
                  </div>
                  
                  <div 
                    className={`${styles.card} ${styles.orange} ${isCardsDisabled ? styles.cardDisabled : ''}`}
                    onClick={isCardsDisabled ? undefined : () => handleCardClick('expiringSoon')}
                    aria-disabled={isCardsDisabled}
                  >
                    <FiAlertTriangle className={styles.cardIcon} />
                    <div className={styles.cardContent}>
                      <h4>Expirent bientôt</h4>
                      <p>{expiringSoonPermis.length.toLocaleString()}</p>
                      <div className={styles.cardWarning}>
                        Dans les 6 mois
                      </div>
                    </div>
                  </div>
                </div>

                                                {/* Charts Grid */}
                <div className={styles.chartsGrid}>
                  <div className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                      <h4 className={styles.chartTitle}>Evolution des permis</h4>
                      <div className={styles.chartTrend}>
                        <FiTrendingUp />
                        <span>
                          {evolutionData.length > 1 && `${((evolutionData[evolutionData.length - 1].value - evolutionData[evolutionData.length - 2].value) > 0 ? '+' : '')}${evolutionData[evolutionData.length - 1].value - evolutionData[evolutionData.length - 2].value} vs. derniere annee`}
                        </span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={evolutionData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <defs>
                          <linearGradient id="permitsLineGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.3} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="year" tick={{ fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} />
                        <YAxis tick={{ fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickFormatter={(value) => value.toLocaleString()} />
                        <Tooltip
                          formatter={(value) => [value.toLocaleString(), 'Nombre de permis']}
                          labelFormatter={(label) => `Annee: ${label}`}
                          contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="url(#permitsLineGradient)"
                          strokeWidth={3}
                          dot={{ r: 6, fill: '#2563eb' }}
                          activeDot={{ r: 8, stroke: '#1D4ED8', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                      <h4 className={styles.chartTitle}>Repartition par type</h4>
                      <span className={styles.chartMeta}>{totalTypeCount.toLocaleString()} permis</span>
                    </div>
                    <div className={styles.typeDistribution}>
                      <div className={styles.typeChart}>
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie
                              data={displayTypeData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={52}
                              outerRadius={76}
                              paddingAngle={2}
                              label={false}
                              labelLine={false}
                            >
                              {displayTypeData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value, name, props) => [
                                value.toLocaleString(),
                                name,
                                `${((props.payload.percent || 0) * 100).toFixed(1)}%`,
                              ]}
                              contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className={styles.typeLegend}>
                        {displayTypeData.length === 0 && <span className={styles.muted}>Aucune donnee</span>}
                        {displayTypeData.map((entry) => {
                          const percent = totalTypeCount ? (entry.value / totalTypeCount) * 100 : 0;
                          return (
                            <div key={entry.name} className={styles.typeLegendItem}>
                              <span className={styles.typeSwatch} style={{ backgroundColor: entry.color }} />
                              <div className={styles.typeLegendText}>
                                <span className={styles.typeLegendName}>{entry.name}</span>
                                <span className={styles.typeLegendMeta}>
                                  {entry.value.toLocaleString()} · {percent.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                </div>

                <div className={styles.enrichedGrid}>
                  <div className={styles.enrichedCard}>
                    <div className={styles.chartHeader}>
                      <h4 className={styles.chartTitle}>Top titulaires</h4>
                      <span className={styles.chartMeta}>Top 10</span>
                    </div>
                    <ul className={styles.leaderboardList}>
                      {detenteurRanking.length === 0 && <li className={styles.muted}>Aucun titulaire disponible</li>}
                      {detenteurRanking.map((row, idx) => {
                        const max = detenteurRanking[0]?.count || 0;
                        const width = max ? Math.round((row.count / max) * 100) : 0;
                        return (
                          <li key={row.name} className={styles.leaderRow}>
                            <div className={styles.leaderMeta}>
                              <span className={styles.rankBadge}>#{idx + 1}</span>
                              <span className={styles.leaderName}>{row.name}</span>
                            </div>
                            <div className={styles.leaderBar}>
                              <span style={{ width: `${width}%` }} />
                            </div>
                            <span className={styles.leaderValue}>{row.count}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className={styles.enrichedCard}>
                    <div className={styles.chartHeader}>
                      <h4 className={styles.chartTitle}>Top substances</h4>
                      <span className={styles.chartMeta}>Top 10</span>
                    </div>
                    <ul className={styles.leaderboardList}>
                      {topSubstances.length === 0 && <li className={styles.muted}>Aucune substance disponible</li>}
                      {topSubstances.map((sub, idx) => {
                        const max = topSubstances[0]?.count || 0;
                        const width = max ? Math.round((sub.count / max) * 100) : 0;
                        return (
                          <li key={sub.id} className={styles.leaderRow}>
                            <div className={styles.leaderMeta}>
                              <span className={styles.rankBadge}>#{idx + 1}</span>
                              <span className={styles.leaderName}>{sub.name}</span>
                            </div>
                            <div className={`${styles.leaderBar} ${styles.leaderBarWarm}`}>
                              <span style={{ width: `${width}%` }} />
                            </div>
                            <span className={styles.leaderValue}>{sub.count}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>

                <div className={styles.chartsGrid}>
                  <div className={styles.chartCard}>
                    <h4 className={styles.chartTitle}>Repartition par statut</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={statusData}>
                        <defs>
                          <linearGradient id="statusBarGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.7} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#cbd5e1' }} />
                        <YAxis tick={{ fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickFormatter={(value) => value.toLocaleString()} />
                        <Tooltip
                          formatter={(value) => [value.toLocaleString(), 'Nombre']}
                          contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Bar dataKey="value" fill="url(#statusBarGradient)" radius={[4, 4, 0, 0]}>
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className={styles.chartCard}>
                    <div className={styles.chartHeader} style={{ justifyContent: 'space-between', gap: '1rem' }}>
                      <div>
                        <h4 className={styles.chartTitle}>Permis par {selectedRegionMode === 'wilaya' ? 'wilaya' : 'antenne'}</h4>
                        <span className={styles.chartMeta}>
                          Total: {(selectedRegionMode === 'wilaya' ? wilayaStats : antenneStats)
                            .reduce((sum, w) => sum + (w.value || 0), 0)
                            .toLocaleString()}
                        </span>
                      </div>
                      <div className={styles.segmentedControl}>
                        <button
                          className={selectedRegionMode === 'wilaya' ? styles.segmentActive : styles.segment}
                          onClick={() => setSelectedRegionMode('wilaya')}
                        >
                          Wilaya
                        </button>
                        <button
                          className={selectedRegionMode === 'antenne' ? styles.segmentActive : styles.segment}
                          onClick={() => setSelectedRegionMode('antenne')}
                        >
                          Antenne
                        </button>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={320}>
                      <RadarChart data={regionChartData} outerRadius="80%">
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="label" tick={{ fill: '#475569', fontSize: 12 }} />
                        <PolarRadiusAxis tick={{ fill: '#94a3b8' }} />
                        <Radar
                          name="Permis"
                          dataKey="value"
                          stroke="#3b82f6"
                          fill={selectedRegionMode === 'wilaya' ? '#22c55e' : '#6366f1'}
                          fillOpacity={0.6}
                        />
                        <Tooltip
                          formatter={(value, name, props) => [
                            Number(value).toLocaleString(),
                            props?.payload?.label || name,
                          ]}
                          contentStyle={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                          }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* <div className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                      <h4 className={styles.chartTitle}>Calendrier des expirations</h4>
                      <span className={styles.chartMeta}>6 prochains mois</span>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={expiringTimeline}>
                        <defs>
                          <linearGradient id="expiringBarGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f97316" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="#fb7185" stopOpacity={0.7} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#cbd5e1' }} />
                        <YAxis tick={{ fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} allowDecimals={false} />
                        <Tooltip
                          formatter={(value) => [Number(value).toLocaleString(), 'Permis']}
                          contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Bar dataKey="count" fill="url(#expiringBarGradient)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div> */}
                </div>

                <div className={styles.recentActivitiesSection}>
                  <RecentActivities 
                    activities={recentActivities} 
                    loading={loadingActivities}
                    onRefresh={fetchActivities}
                  />
                </div>

                {/* Modal */}
                {modalOpen && (
                  <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                      <div className={styles.modalHeader}>
                        <h2>{modalTitle}</h2>
                        <button onClick={closeModal} className={styles.closeButton}>
                          <FiX size={24} />
                        </button>
                      </div>
                      <div className={styles.modalBody}>
                        {modalContent}
                      </div>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
