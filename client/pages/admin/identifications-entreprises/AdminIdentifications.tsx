'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import {
  FiAlertCircle,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiEye,
  FiRefreshCw,
  FiSearch,
  FiX,
} from 'react-icons/fi';
import Navbar from '@/pages/navbar/Navbar';
import Sidebar from '@/pages/sidebar/Sidebar';
import { useViewNavigator } from '@/src/hooks/useViewNavigator';
import { useAuthStore } from '@/src/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import styles from './admin-identifications.module.css';

type IdentificationStatus = 'EN_ATTENTE' | 'CONFIRMEE' | 'REFUSEE';
type StatusFilter = 'ALL' | IdentificationStatus;
type DetenteurStatus =
  | 'PERSONNE_MORALE_ALGERIENNE'
  | 'PERSONNE_MORALE_ETRANGERE'
  | 'PERSONNE_PHYSIQUE_ALGERIENNE';
type DetenteurStatusFilter = 'ALL' | DetenteurStatus;

type IdentificationRow = {
  id: number;
  userId?: number | null;
  utilisateur: {
    id?: number | null;
    username?: string | null;
    email?: string | null;
    fullName?: string | null;
  };
  nomEntreprise?: string | null;
  nif?: string | null;
  email?: string | null;
  telephone?: string | null;
  statutDetenteur?: DetenteurStatus | null;
  dateDemande?: string | null;
  statut: IdentificationStatus;
  decisionAt?: string | null;
};

type ListResponse = {
  items: IdentificationRow[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

type DetailResponse = {
  user: {
    id: number;
    username?: string | null;
    email?: string | null;
    nom?: string | null;
    Prenom?: string | null;
    telephone?: string | null;
    createdAt?: string | null;
    modifieLe?: string | null;
  };
  status: IdentificationStatus;
  dateDemande?: string | null;
  decisionAt?: string | null;
  rejectionReason?: string | null;
  detenteur?: any;
  registre?: any[];
  representant?: any;
  actionnaires?: any[];
};

type StatsState = {
  total: number;
  pending: number;
  confirmed: number;
  rejected: number;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'Tous statuts' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'CONFIRMEE', label: 'Confirmees' },
  { value: 'REFUSEE', label: 'Refusees' },
];

const DETENTEUR_STATUS_OPTIONS: Array<{
  value: DetenteurStatusFilter;
  label: string;
}> = [
  { value: 'ALL', label: 'Tous statuts detenteur' },
  { value: 'PERSONNE_MORALE_ALGERIENNE', label: 'Personne morale algerienne' },
  { value: 'PERSONNE_MORALE_ETRANGERE', label: 'Personne morale etrangere' },
  { value: 'PERSONNE_PHYSIQUE_ALGERIENNE', label: 'Personne physique algerienne' },
];

function safeText(value?: string | null) {
  return String(value || '').trim();
}

function formatDate(value?: string | null) {
  if (!value) return '--';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '--';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function detenteurStatusLabel(value?: string | null) {
  if (value === 'PERSONNE_MORALE_ALGERIENNE') return 'Personne morale algerienne';
  if (value === 'PERSONNE_MORALE_ETRANGERE') return 'Personne morale etrangere';
  if (value === 'PERSONNE_PHYSIQUE_ALGERIENNE') return 'Personne physique algerienne';
  return '--';
}

function statusMeta(status: IdentificationStatus) {
  if (status === 'CONFIRMEE') {
    return { label: 'Confirmee', className: styles.statusConfirmed };
  }
  if (status === 'REFUSEE') {
    return { label: 'Refusee', className: styles.statusRejected };
  }
  return { label: 'En attente', className: styles.statusPending };
}

export default function AdminIdentifications() {
  const router = useRouter();
  const { currentView, navigateTo } = useViewNavigator('manage_identifications');
  const isLoaded = useAuthStore((state) => state.isLoaded);
  const permissions = useAuthStore((state) => state.auth.permissions);
  const apiURL =
    process.env.NEXT_PUBLIC_API_URL || (import.meta as any)?.env?.VITE_API_URL || '';
  const canAccessAdminPanel = useMemo(
    () => Array.isArray(permissions) && permissions.includes('Admin-Panel'),
    [permissions],
  );

  const [rows, setRows] = useState<IdentificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [statutDetenteur, setStatutDetenteur] = useState<DetenteurStatusFilter>('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [stats, setStats] = useState<StatsState>({
    total: 0,
    pending: 0,
    confirmed: 0,
    rejected: 0,
  });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailItem, setDetailItem] = useState<DetailResponse | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailUserId, setDetailUserId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [highlightUserId, setHighlightUserId] = useState<number | null>(null);
  const [highlightActive, setHighlightActive] = useState(false);
  const autoOpenedRef = useRef(false);
  const highlightTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 320);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (!success) return;
    const timeout = window.setTimeout(() => setSuccess(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [success]);

  const loadRows = useCallback(async () => {
    if (!apiURL) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page,
        pageSize,
      };
      if (status !== 'ALL') params.status = status;
      if (statutDetenteur !== 'ALL') params.statutDetenteur = statutDetenteur;
      if (search) params.search = search;

      const res = await axios.get<ListResponse>(
        `${apiURL}/api/admin/identifications-entreprises`,
        {
          params,
          withCredentials: true,
        },
      );

      setRows(Array.isArray(res.data?.items) ? res.data.items : []);
      setTotal(Number(res.data?.total || 0));
      setPages(Math.max(1, Number(res.data?.pages || 1)));
    } catch (err: any) {
      console.error('Erreur chargement identifications entreprises', err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Impossible de charger les demandes.',
      );
    } finally {
      setLoading(false);
    }
  }, [apiURL, page, pageSize, search, status, statutDetenteur]);

  const loadStats = useCallback(async () => {
    if (!apiURL) return;
    try {
      const baseParams = {
        page: 1,
        pageSize: 1,
        ...(statutDetenteur !== 'ALL' ? { statutDetenteur } : {}),
        ...(search ? { search } : {}),
      };

      const [allRes, pendingRes, confirmedRes, rejectedRes] = await Promise.all([
        axios.get<ListResponse>(`${apiURL}/api/admin/identifications-entreprises`, {
          params: baseParams,
          withCredentials: true,
        }),
        axios.get<ListResponse>(`${apiURL}/api/admin/identifications-entreprises`, {
          params: { ...baseParams, status: 'EN_ATTENTE' },
          withCredentials: true,
        }),
        axios.get<ListResponse>(`${apiURL}/api/admin/identifications-entreprises`, {
          params: { ...baseParams, status: 'CONFIRMEE' },
          withCredentials: true,
        }),
        axios.get<ListResponse>(`${apiURL}/api/admin/identifications-entreprises`, {
          params: { ...baseParams, status: 'REFUSEE' },
          withCredentials: true,
        }),
      ]);

      setStats({
        total: Number(allRes.data?.total || 0),
        pending: Number(pendingRes.data?.total || 0),
        confirmed: Number(confirmedRes.data?.total || 0),
        rejected: Number(rejectedRes.data?.total || 0),
      });
    } catch (err) {
      console.warn('Stats identifications indisponibles', err);
    }
  }, [apiURL, search, statutDetenteur]);

  const openDetail = useCallback(
    async (userId: number) => {
      if (!apiURL) return;
      if (!Number.isFinite(Number(userId)) || Number(userId) <= 0) {
        setError("Impossible d'ouvrir le dossier: identifiant utilisateur manquant.");
        return;
      }
      setDetailOpen(true);
      setDetailUserId(Number(userId));
      setDetailLoading(true);
      setDetailItem(null);
      setDetailError(null);
      setRejectReason('');
      setError(null);
      try {
        const res = await axios.get<DetailResponse>(
          `${apiURL}/api/admin/identifications-entreprises/${userId}`,
          { withCredentials: true },
        );
        setDetailItem(res.data);
      } catch (err: any) {
        console.error('Erreur chargement detail identification', err);
        const message =
          err?.response?.data?.message ||
            err?.message ||
            'Impossible de charger le detail.';
        setError(message);
        setDetailError(message);
      } finally {
        setDetailLoading(false);
      }
    },
    [apiURL],
  );

  const handleConfirm = useCallback(async () => {
    const userId = Number(detailItem?.user?.id || 0);
    if (!apiURL || !userId) return;
    setConfirming(true);
    setError(null);
    try {
      await axios.post(
        `${apiURL}/api/admin/identifications-entreprises/${userId}/confirm`,
        {},
        { withCredentials: true },
      );
      setSuccess(`Identification #${userId} confirmee.`);
      await Promise.all([loadRows(), loadStats(), openDetail(userId)]);
    } catch (err: any) {
      console.error('Erreur confirmation identification', err);
      setError(
        err?.response?.data?.message || err?.message || 'Confirmation impossible.',
      );
    } finally {
      setConfirming(false);
    }
  }, [apiURL, detailItem?.user?.id, loadRows, loadStats, openDetail]);

  const handleReject = useCallback(async () => {
    const userId = Number(detailItem?.user?.id || 0);
    if (!apiURL || !userId) return;
    setRejecting(true);
    setError(null);
    try {
      await axios.post(
        `${apiURL}/api/admin/identifications-entreprises/${userId}/reject`,
        { reason: rejectReason.trim() || undefined },
        { withCredentials: true },
      );
      setSuccess(`Identification #${userId} refusee.`);
      await Promise.all([loadRows(), loadStats(), openDetail(userId)]);
    } catch (err: any) {
      console.error('Erreur refus identification', err);
      setError(err?.response?.data?.message || err?.message || 'Refus impossible.');
    } finally {
      setRejecting(false);
    }
  }, [apiURL, detailItem?.user?.id, loadRows, loadStats, openDetail, rejectReason]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!canAccessAdminPanel) {
      void router.replace('/investisseur/InvestorDashboard');
      return;
    }
    void loadRows();
  }, [canAccessAdminPanel, isLoaded, loadRows]);

  useEffect(() => {
    if (!isLoaded || !canAccessAdminPanel) return;
    void loadStats();
  }, [canAccessAdminPanel, isLoaded, loadStats]);

  useEffect(() => {
    if (!router.isReady || autoOpenedRef.current) return;
    const queryValue = Number(router.query.userId || 0);
    if (!Number.isFinite(queryValue) || queryValue <= 0) return;
    autoOpenedRef.current = true;
    void openDetail(queryValue);
  }, [openDetail, router.isReady, router.query.userId]);

  useEffect(() => {
    if (!router.isReady) return;
    const highlightValue = Number(router.query.highlightUserId || 0);
    if (!Number.isFinite(highlightValue) || highlightValue <= 0) return;

    setHighlightUserId(highlightValue);
    setHighlightActive(true);

    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightActive(false);
    }, 5000);
  }, [router.isReady, router.query.highlightUserId]);

  useEffect(
    () => () => {
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
    },
    [],
  );

  const rangeText = useMemo(() => {
    if (!total) return 'Aucun resultat';
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    return `Affichage ${from}-${to} sur ${total}`;
  }, [page, pageSize, total]);

  const quickStatusOptions = useMemo(
    () => [
      { value: 'ALL' as StatusFilter, label: 'Tous', count: stats.total },
      { value: 'EN_ATTENTE' as StatusFilter, label: 'En attente', count: stats.pending },
      { value: 'CONFIRMEE' as StatusFilter, label: 'Confirmees', count: stats.confirmed },
      { value: 'REFUSEE' as StatusFilter, label: 'Refusees', count: stats.rejected },
    ],
    [stats],
  );

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

  if (!isLoaded) {
    return <div className={styles.loadingScreen}>Chargement...</div>;
  }

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.mainContent}>
          <header className={styles.pageHeader}>
            <div>
              <h1>Gestion des Identifications Entreprises</h1>
              <p>
                Verification manuelle des demandes d identification avant activation
                definitive des comptes.
              </p>
            </div>
            <div className={styles.headerActions}>
              <Button
                className={`${styles.refreshBtn} btn-primary`}
                onClick={() => {
                  void loadRows();
                  void loadStats();
                }}
              >
                <FiRefreshCw /> Actualiser
              </Button>
            </div>
          </header>

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
              <button onClick={() => setSuccess(null)} className={styles.alertClose}>
                Fermer
              </button>
            </div>
          )}

          <section className={styles.statsGrid}>
            <Card className={`${styles.statCard} ${styles.statTotal}`}>
              <CardContent className={styles.statContent}>
                <div>
                  <p className={styles.statLabel}>Total</p>
                  <p className={styles.statValue}>{stats.total}</p>
                </div>
                <FiEye className={styles.statIcon} />
              </CardContent>
            </Card>
            <Card className={`${styles.statCard} ${styles.statPending}`}>
              <CardContent className={styles.statContent}>
                <div>
                  <p className={styles.statLabel}>En attente</p>
                  <p className={styles.statValue}>{stats.pending}</p>
                </div>
                <FiClock className={styles.statIcon} />
              </CardContent>
            </Card>
            <Card className={`${styles.statCard} ${styles.statConfirmed}`}>
              <CardContent className={styles.statContent}>
                <div>
                  <p className={styles.statLabel}>Confirmees</p>
                  <p className={styles.statValue}>{stats.confirmed}</p>
                </div>
                <FiCheck className={styles.statIcon} />
              </CardContent>
            </Card>
            <Card className={`${styles.statCard} ${styles.statRejected}`}>
              <CardContent className={styles.statContent}>
                <div>
                  <p className={styles.statLabel}>Refusees</p>
                  <p className={styles.statValue}>{stats.rejected}</p>
                </div>
                <FiX className={styles.statIcon} />
              </CardContent>
            </Card>
          </section>

          <section className={styles.filtersCard}>
            <div className={styles.filterSearch}>
              <FiSearch />
              <Input
                placeholder="Rechercher par utilisateur, email, societe, NIF..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className={styles.filterRight}>
              <label className={styles.filterField}>
                <span>Statut</span>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as StatusFilter);
                    setPage(1);
                  }}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.filterField}>
                <span>Statut detenteur</span>
                <select
                  value={statutDetenteur}
                  onChange={(e) => {
                    setStatutDetenteur(e.target.value as DetenteurStatusFilter);
                    setPage(1);
                  }}
                >
                  {DETENTEUR_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.filterField}>
                <span>Par page</span>
                <select
                  value={String(pageSize)}
                  onChange={(e) => {
                    setPage(1);
                    setPageSize(Number(e.target.value));
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.quickStatusRow}>
              {quickStatusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.quickStatusBtn} ${
                    status === option.value ? styles.quickStatusBtnActive : ''
                  }`}
                  onClick={() => {
                    setStatus(option.value);
                    setPage(1);
                  }}
                >
                  <span>{option.label}</span>
                  <strong>{option.count}</strong>
                </button>
              ))}
              <Button
                variant="outline"
                className={styles.resetFiltersBtn}
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setStatus('ALL');
                  setStatutDetenteur('ALL');
                  setPage(1);
                  setPageSize(20);
                }}
              >
                Reinitialiser filtres
              </Button>
            </div>
          </section>

          <section className={styles.tableCard}>
            <div className={styles.tableMeta}>
              <span>{rangeText}</span>
              <div className={styles.tableMetaBadges}>
                {search ? (
                  <Badge className={styles.metaBadge}>Recherche: {search}</Badge>
                ) : null}
                {status !== 'ALL' ? (
                  <Badge className={styles.metaBadge}>{statusMeta(status).label}</Badge>
                ) : null}
                {statutDetenteur !== 'ALL' ? (
                  <Badge className={styles.metaBadge}>
                    {detenteurStatusLabel(statutDetenteur)}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className={styles.tableWrap}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Nom entreprise</TableHead>
                    <TableHead>Statut detenteur</TableHead>
                    <TableHead>NIF</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telephone</TableHead>
                    <TableHead>Date demande</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className={styles.centerCell}>
                        Chargement...
                      </TableCell>
                    </TableRow>
                  ) : rows.length ? (
                    rows.map((row) => {
                      const statusStyle = statusMeta(row.statut);
                      const targetUserId = Number(
                        row.userId || row.utilisateur?.id || row.id || 0,
                      );
                      const isHighlightedRow =
                        highlightActive && Number(highlightUserId) === Number(targetUserId);
                      return (
                        <TableRow
                          key={row.id}
                          className={`${styles.tableRowHover} ${
                            isHighlightedRow ? styles.tableRowHighlight : ''
                          }`}
                          onDoubleClick={() => void openDetail(targetUserId)}
                        >
                          <TableCell>
                            <div className={styles.idCell}>
                              <span>#{row.id}</span>
                              {isHighlightedRow && (
                                <span className={styles.newPulseBadge}>Nouveau</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className={styles.userCellPrimary}>
                              {safeText(row.utilisateur?.fullName) ||
                                safeText(row.utilisateur?.username) ||
                                '--'}
                            </div>
                            <div className={styles.userCellSecondary}>
                              {safeText(row.utilisateur?.email) || '--'}
                            </div>
                          </TableCell>
                          <TableCell>{safeText(row.nomEntreprise) || '--'}</TableCell>
                          <TableCell>{detenteurStatusLabel(row.statutDetenteur)}</TableCell>
                          <TableCell>{safeText(row.nif) || '--'}</TableCell>
                          <TableCell>{safeText(row.email) || '--'}</TableCell>
                          <TableCell>{safeText(row.telephone) || '--'}</TableCell>
                          <TableCell>{formatDate(row.dateDemande)}</TableCell>
                          <TableCell>
                            <Badge className={statusStyle.className}>{statusStyle.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              className={`${styles.verifyBtn} btn-primary`}
                              onClick={() => void openDetail(targetUserId)}
                            >
                              <FiEye /> Verifier
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className={styles.centerCell}>
                        Aucune demande trouvee.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className={styles.pagination}>
              <div>
                Affichage {rows.length} / {total} identifications
              </div>
              <div className={styles.paginationControls}>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                >
                  <FiChevronLeft /> <FiChevronLeft />
                </button>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  <FiChevronLeft />
                </button>
                {pageNumbers.map((value, index) =>
                  value === '...' ? (
                    <span key={`dots-${index}`} className={styles.pageDots}>
                      ...
                    </span>
                  ) : (
                    <button
                      type="button"
                      key={value}
                      className={value === page ? styles.pageActive : ''}
                      onClick={() => setPage(value)}
                    >
                      {value}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={page >= pages}
                  onClick={() => setPage((prev) => Math.min(pages, prev + 1))}
                >
                  <FiChevronRight />
                </button>
                <button
                  type="button"
                  disabled={page >= pages}
                  onClick={() => setPage(pages)}
                >
                  <FiChevronRight /> <FiChevronRight />
                </button>
              </div>
            </div>
          </section>

          {detailOpen && (
            <div
              className={styles.detailOverlay}
              role="dialog"
              aria-modal="true"
              onClick={() => {
                setDetailOpen(false);
                setDetailError(null);
                setDetailItem(null);
                setRejectReason('');
              }}
            >
              <div className={styles.detailModal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.detailHeader}>
                  <div className={styles.detailHeaderMain}>
                    <div>
                      <h3 className={styles.detailTitle}>Verification identification entreprise</h3>
                      <p className={styles.detailDescription}>
                        Controle complet du dossier avant confirmation ou refus.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={styles.detailCloseBtn}
                      onClick={() => {
                        setDetailOpen(false);
                        setDetailError(null);
                        setDetailItem(null);
                        setRejectReason('');
                      }}
                      aria-label="Fermer la fenetre"
                    >
                      <FiX />
                    </button>
                  </div>
                </div>

                {detailLoading ? (
                  <div className={styles.detailLoading}>Chargement du detail...</div>
                ) : detailError ? (
                  <div className={styles.detailErrorBox}>
                    <FiAlertCircle />
                    <span>{detailError}</span>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (detailUserId) {
                          void openDetail(detailUserId);
                        }
                      }}
                    >
                      Reessayer
                    </Button>
                  </div>
                ) : !detailItem ? (
                  <div className={styles.detailLoading}>Aucun detail disponible.</div>
                ) : (
                  <div className={styles.detailBody}>
                    <div className={styles.detailStatusRow}>
                      <Badge className={statusMeta(detailItem.status).className}>
                        {statusMeta(detailItem.status).label}
                      </Badge>
                      <div className={styles.detailStatusMeta}>
                        <span className={styles.detailMetaChip}>
                          Date demande: {formatDate(detailItem.dateDemande)}
                        </span>
                        <span className={styles.detailMetaChip}>
                          Date decision:{' '}
                          {detailItem.decisionAt ? formatDate(detailItem.decisionAt) : '--'}
                        </span>
                      </div>
                    </div>

                    <div className={styles.detailGrid}>
                      <div className={styles.detailSection}>
                        <h4>Utilisateur</h4>
                        <p>
                          <strong>ID:</strong> #{detailItem.user?.id}
                        </p>
                        <p>
                          <strong>Nom:</strong>{' '}
                          {[safeText(detailItem.user?.nom), safeText(detailItem.user?.Prenom)]
                            .filter(Boolean)
                            .join(' ') || '--'}
                        </p>
                        <p>
                          <strong>Username:</strong> {safeText(detailItem.user?.username) || '--'}
                        </p>
                        <p>
                          <strong>Email:</strong> {safeText(detailItem.user?.email) || '--'}
                        </p>
                        <p>
                          <strong>Telephone:</strong>{' '}
                          {safeText(detailItem.user?.telephone) || '--'}
                        </p>
                      </div>

                      <div className={styles.detailSection}>
                        <h4>Entreprise</h4>
                        <p>
                          <strong>Nom societe (FR):</strong>{' '}
                          {safeText(detailItem.detenteur?.nom_societeFR) || '--'}
                        </p>
                        <p>
                          <strong>Nom societe (AR):</strong>{' '}
                          {safeText(detailItem.detenteur?.nom_societeAR) || '--'}
                        </p>
                        <p>
                          <strong>Adresse:</strong>{' '}
                          {safeText(detailItem.detenteur?.adresse_siege) || '--'}
                        </p>
                        <p>
                          <strong>Email:</strong>{' '}
                          {safeText(detailItem.detenteur?.email) || '--'}
                        </p>
                        <p>
                          <strong>Telephone:</strong>{' '}
                          {safeText(detailItem.detenteur?.telephone) || '--'}
                        </p>
                        <p>
                          <strong>Statut detenteur:</strong>{' '}
                          {detenteurStatusLabel(detailItem.detenteur?.statutDetenteur)}
                        </p>
                      </div>
                    </div>

                    <div className={`${styles.detailSection} ${styles.detailSectionWide}`}>
                      <h4>Registre de commerce</h4>
                      {(detailItem.registre || []).length ? (
                        (detailItem.registre || []).map((registre: any, index: number) => (
                          <div key={`registre-${index}`} className={styles.detailBlock}>
                            <p>
                              <strong>RC:</strong> {safeText(registre?.numero_rc) || '--'}
                            </p>
                            <p>
                              <strong>NIF:</strong> {safeText(registre?.nif) || '--'}
                            </p>
                            <p>
                              <strong>NIS:</strong> {safeText(registre?.nis) || '--'}
                            </p>
                            <p>
                              <strong>Date enregistrement:</strong>{' '}
                              {formatDate(registre?.date_enregistrement)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p>--</p>
                      )}
                    </div>

                    <div className={styles.detailGrid}>
                      <div className={styles.detailSection}>
                        <h4>Representant legal</h4>
                        <p>
                          <strong>Nom complet:</strong>{' '}
                          {[
                            safeText(detailItem.representant?.nomFR),
                            safeText(detailItem.representant?.prenomFR),
                          ]
                            .filter(Boolean)
                            .join(' ') || '--'}
                        </p>
                        <p>
                          <strong>Email:</strong>{' '}
                          {safeText(detailItem.representant?.email) || '--'}
                        </p>
                        <p>
                          <strong>Telephone:</strong>{' '}
                          {safeText(detailItem.representant?.telephone) || '--'}
                        </p>
                        <p>
                          <strong>NIN:</strong>{' '}
                          {safeText(detailItem.representant?.num_carte_identite) || '--'}
                        </p>
                      </div>

                      <div className={styles.detailSection}>
                        <h4>Actionnaires ({(detailItem.actionnaires || []).length})</h4>
                        {(detailItem.actionnaires || []).length ? (
                          <ul className={styles.actionnaireList}>
                            {(detailItem.actionnaires || []).map((item: any) => (
                              <li key={`act-${item?.id_actionnaire || item?.id_fonctionDetent}`}>
                                <span>
                                  {safeText(item?.nomFR)} {safeText(item?.prenomFR)}
                                </span>
                                <span>{safeText(item?.num_carte_identite) || '--'}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>--</p>
                        )}
                      </div>
                    </div>

                    <div className={`${styles.detailSection} ${styles.detailSectionWide}`}>
                      <h4>Motif de refus (optionnel)</h4>
                      <Textarea
                        rows={4}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Ex: NIF incoherent, document incomplet..."
                      />
                      {detailItem.rejectionReason && !rejectReason && (
                        <p className={styles.previousReason}>
                          Dernier motif: {detailItem.rejectionReason}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className={styles.detailFooter}>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailOpen(false);
                      setDetailError(null);
                      setDetailItem(null);
                      setRejectReason('');
                    }}
                    disabled={confirming || rejecting}
                  >
                    Fermer
                  </Button>
                  <Button
                    className={`${styles.rejectBtn} btn-danger`}
                    onClick={() => void handleReject()}
                    disabled={detailLoading || confirming || rejecting || !!detailError || !detailItem}
                  >
                    {rejecting ? 'Traitement...' : 'Rejeter'}
                  </Button>
                  <Button
                    className={`${styles.confirmBtn} btn-success`}
                    onClick={() => void handleConfirm()}
                    disabled={detailLoading || confirming || rejecting || !!detailError || !detailItem}
                  >
                    {confirming ? 'Traitement...' : 'Confirmer'}
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
