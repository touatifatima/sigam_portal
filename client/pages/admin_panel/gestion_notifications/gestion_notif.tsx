'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';
import {
  FiAlertCircle,
  FiBell,
  FiCheck,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiEye,
  FiFileText,
  FiFilter,
  FiMessageSquare,
  FiRefreshCw,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import { MdWarningAmber } from 'react-icons/md';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Navbar from '@/pages/navbar/Navbar';
import Sidebar from '@/pages/sidebar/Sidebar';
import { useViewNavigator } from '@/src/hooks/useViewNavigator';
import { useAuthStore } from '@/src/store/useAuthStore';
import {
  resolveNotificationTargetPathAsync,
} from '@/src/utils/notificationNavigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import styles from './gestion_notif.module.css';

type SortOrder = 'asc' | 'desc';

type NotificationType = 'INFO' | 'AVIS' | 'TAXE' | 'ALERTE' | 'REPONSE';
type NotificationCategory =
  | 'DEMANDE'
  | 'PERMIS'
  | 'MESSAGE_ADMIN'
  | 'PAIEMENT'
  | 'RELANCE'
  | 'SYSTEM';
type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

type NotificationUser = {
  id: number;
  username?: string | null;
  email?: string | null;
  nom?: string | null;
  Prenom?: string | null;
};

type NotificationItem = {
  id: number;
  userId: number;
  type: NotificationType;
  category?: NotificationCategory | null;
  priority: NotificationPriority;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  relatedEntityId?: number | null;
  relatedEntityType?: string | null;
  demandeId?: number | null;
  permisId?: number | null;
  messageId?: number | null;
  utilisateur?: NotificationUser | null;
};

type NotificationDetails = NotificationItem & {
  demande?: {
    id_demande: number;
    code_demande?: string | null;
    statut_demande?: string | null;
  } | null;
  permis?: {
    id: number;
    code_permis?: string | null;
    date_expiration?: string | null;
  } | null;
  messageRelated?: {
    id: number;
    content?: string | null;
    senderId?: number | null;
    receiverId?: number | null;
    conversation?: {
      id: number;
      entityType?: string | null;
      entityCode?: string | null;
    } | null;
  } | null;
};

type NotificationsListResponse = {
  items: NotificationItem[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

type NotificationsStatsResponse = {
  total: number;
  unread: number;
  read: number;
  urgent: number;
};

type FiltersState = {
  search: string;
  userQuery: string;
  type: NotificationType[];
  category: NotificationCategory[];
  priority: NotificationPriority[];
  isRead: 'all' | 'read' | 'unread';
  fromDate: string;
  toDate: string;
};

type SortState = {
  key:
    | 'id'
    | 'user'
    | 'type'
    | 'category'
    | 'priority'
    | 'title'
    | 'message'
    | 'isRead'
    | 'createdAt';
  order: SortOrder;
};

const TYPE_OPTIONS: Array<{ value: NotificationType; label: string }> = [
  { value: 'INFO', label: 'INFO' },
  { value: 'AVIS', label: 'AVIS' },
  { value: 'TAXE', label: 'TAXE' },
  { value: 'ALERTE', label: 'ALERTE' },
  { value: 'REPONSE', label: 'REPONSE' },
];

const CATEGORY_OPTIONS: Array<{ value: NotificationCategory; label: string }> = [
  { value: 'DEMANDE', label: 'DEMANDE' },
  { value: 'PERMIS', label: 'PERMIS' },
  { value: 'MESSAGE_ADMIN', label: 'MESSAGE_ADMIN' },
  { value: 'PAIEMENT', label: 'PAIEMENT' },
  { value: 'RELANCE', label: 'RELANCE' },
  { value: 'SYSTEM', label: 'SYSTEM' },
];

const PRIORITY_OPTIONS: Array<{ value: NotificationPriority; label: string }> = [
  { value: 'LOW', label: 'LOW' },
  { value: 'MEDIUM', label: 'MEDIUM' },
  { value: 'HIGH', label: 'HIGH' },
  { value: 'URGENT', label: 'URGENT' },
];

const DEFAULT_FILTERS: FiltersState = {
  search: '',
  userQuery: '',
  type: [],
  category: [],
  priority: [],
  isRead: 'all',
  fromDate: '',
  toDate: '',
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function safeText(value?: string | null) {
  return String(value || '').trim();
}

function getUserDisplay(user?: NotificationUser | null) {
  const fullName = [safeText(user?.nom), safeText(user?.Prenom)]
    .filter(Boolean)
    .join(' ')
    .trim();
  return fullName || safeText(user?.username) || safeText(user?.email) || '--';
}

function getUserSecondary(user?: NotificationUser | null) {
  return safeText(user?.email) || safeText(user?.username) || '--';
}

function truncateText(value: string, size = 88) {
  const text = safeText(value);
  if (text.length <= size) return text;
  return `${text.slice(0, Math.max(0, size - 3))}...`;
}

function formatRelativeDate(value?: string | null) {
  if (!value) return '--';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '--';
  const diffMs = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return 'A l instant';
  if (diffMs < hour) return `Il y a ${Math.floor(diffMs / minute)} min`;
  if (diffMs < day) return `Il y a ${Math.floor(diffMs / hour)} h`;
  if (diffMs < 7 * day) return `Il y a ${Math.floor(diffMs / day)} j`;
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  if (/[;"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadFile(content: BlobPart, type: string, fileName: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildAdminDemandeMessagesPath(demandeId: number, messageId?: number | null) {
  const params = new URLSearchParams();
  params.set('tab', 'messages');
  params.set('focusComposer', '1');
  if (Number(messageId || 0) > 0) {
    params.set('focusMessageId', String(Number(messageId)));
  }
  return `/admin_panel/gestion-demandes/${demandeId}?${params.toString()}`;
}

export default function GestionNotificationsPage() {
  const apiURL =
    process.env.NEXT_PUBLIC_API_URL || (import.meta as any)?.env?.VITE_API_URL || '';
  const router = useRouter();
  const { auth, isLoaded, hasPermission } = useAuthStore();
  const { currentView, navigateTo } = useViewNavigator('Admin-Panel');

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [stats, setStats] = useState<NotificationsStatsResponse>({
    total: 0,
    unread: 0,
    read: 0,
    urgent: 0,
  });

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [pages, setPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [filtersRunNonce, setFiltersRunNonce] = useState<number>(0);
  const [sortState, setSortState] = useState<SortState>({
    key: 'createdAt',
    order: 'desc',
  });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState<boolean>(true);
  const [processingBulk, setProcessingBulk] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [rowNavigatingId, setRowNavigatingId] = useState<number | null>(null);

  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailItem, setDetailItem] = useState<NotificationDetails | null>(null);

  const [replyModalOpen, setReplyModalOpen] = useState<boolean>(false);
  const [replyTarget, setReplyTarget] = useState<NotificationItem | null>(null);
  const [replyContent, setReplyContent] = useState<string>('');
  const [replySubmitting, setReplySubmitting] = useState<boolean>(false);

  const isAdmin =
    hasPermission('Admin-Panel') ||
    safeText(auth?.role)
      .toLowerCase()
      .includes('admin');

  useEffect(() => {
    if (!isLoaded) return;
    if (!isAdmin) {
      router.replace('/unauthorized/page?reason=missing_permissions');
    }
  }, [isLoaded, isAdmin, router]);

  useEffect(() => {
    if (!success) return;
    const timeoutId = window.setTimeout(() => setSuccess(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [success]);

  const authHeaders = useMemo(() => {
    const userId = Number(auth?.id);
    if (!Number.isFinite(userId) || userId <= 0) return undefined;
    return { 'x-user-id': String(userId) };
  }, [auth?.id]);

  const buildQueryString = useCallback(
    (params: {
      includePagination?: boolean;
      page?: number;
      pageSize?: number;
      filters: FiltersState;
      sort: SortState;
    }) => {
      const query = new URLSearchParams();
      if (params.includePagination) {
        query.set('page', String(params.page || 1));
        query.set('pageSize', String(params.pageSize || 10));
      }

      const f = params.filters;
      if (safeText(f.search)) query.set('search', safeText(f.search));
      if (safeText(f.userQuery)) query.set('userQuery', safeText(f.userQuery));
      if (f.isRead === 'read') query.set('isRead', 'true');
      if (f.isRead === 'unread') query.set('isRead', 'false');
      if (safeText(f.fromDate)) query.set('fromDate', f.fromDate);
      if (safeText(f.toDate)) query.set('toDate', f.toDate);
      f.type.forEach((value) => query.append('type', value));
      f.category.forEach((value) => query.append('category', value));
      f.priority.forEach((value) => query.append('priority', value));

      query.set('sortBy', params.sort.key);
      query.set('sortOrder', params.sort.order);
      return query.toString();
    },
    [],
  );

  const fetchData = useCallback(async () => {
    if (!apiURL) {
      setError("NEXT_PUBLIC_API_URL n'est pas defini.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const listQuery = buildQueryString({
        includePagination: true,
        page,
        pageSize,
        filters,
        sort: sortState,
      });
      const statsQuery = buildQueryString({
        includePagination: false,
        filters,
        sort: sortState,
      });

      const [listRes, statsRes] = await Promise.all([
        axios.get<NotificationsListResponse>(`${apiURL}/notifications/admin?${listQuery}`, {
          withCredentials: true,
          headers: authHeaders,
        }),
        axios.get<NotificationsStatsResponse>(`${apiURL}/notifications/admin/stats?${statsQuery}`, {
          withCredentials: true,
          headers: authHeaders,
        }),
      ]);

      const payload = listRes.data;
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setTotal(Number(payload.total || 0));
      setPages(Math.max(1, Number(payload.pages || 1)));
      setStats({
        total: Number(statsRes.data?.total || 0),
        unread: Number(statsRes.data?.unread || 0),
        read: Number(statsRes.data?.read || 0),
        urgent: Number(statsRes.data?.urgent || 0),
      });
      setSelectedIds(new Set());
    } catch (err: any) {
      console.error('Erreur chargement notifications admin', err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Impossible de charger les notifications.',
      );
      setItems([]);
      setTotal(0);
      setPages(1);
    } finally {
      setLoading(false);
    }
  }, [apiURL, authHeaders, buildQueryString, filters, page, pageSize, sortState, filtersRunNonce]);

  useEffect(() => {
    if (!isLoaded || !isAdmin) return;
    fetchData();
  }, [fetchData, isAdmin, isLoaded]);

  const toggleDraftMulti = useCallback(
    (key: 'type' | 'category' | 'priority', value: string) => {
      setDraftFilters((prev) => {
        const values = prev[key] as string[];
        const exists = values.includes(String(value));
        const next = exists
          ? values.filter((v) => v !== value)
          : [...values, String(value)];
        return { ...prev, [key]: next } as FiltersState;
      });
    },
    [],
  );

  const handleApplyFilters = () => {
    setPage(1);
    setFilters({ ...draftFilters });
    setFiltersRunNonce((prev) => prev + 1);
  };

  const handleResetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setPage(1);
    setFiltersRunNonce((prev) => prev + 1);
  };

  const handleSort = (key: SortState['key']) => {
    setPage(1);
    setSortState((prev) =>
      prev.key === key
        ? { key, order: prev.order === 'asc' ? 'desc' : 'asc' }
        : { key, order: 'asc' },
    );
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allPageSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));

  const toggleSelectAllPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        items.forEach((item) => next.delete(item.id));
      } else {
        items.forEach((item) => next.add(item.id));
      }
      return next;
    });
  };

  const handleToggleRead = async (item: NotificationItem, nextIsRead: boolean) => {
    if (!apiURL) return;
    try {
      await axios.post(
        `${apiURL}/notifications/admin/${item.id}/read`,
        { isRead: nextIsRead },
        { withCredentials: true, headers: authHeaders },
      );
      setSuccess(nextIsRead ? 'Notification marquee comme lue.' : 'Notification marquee comme non lue.');
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Mise a jour impossible.');
    }
  };

  const handleDeleteOne = async (item: NotificationItem) => {
    if (!apiURL) return;
    const ok = window.confirm(`Supprimer la notification #${item.id} ?`);
    if (!ok) return;
    try {
      await axios.delete(`${apiURL}/notifications/admin/${item.id}`, {
        withCredentials: true,
        headers: authHeaders,
      });
      setSuccess('Notification supprimee.');
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Suppression impossible.');
    }
  };

  const handleBulkAction = async (action: 'mark_read' | 'mark_unread' | 'delete') => {
    if (!apiURL || selectedIds.size === 0) return;
    if (action === 'delete') {
      const ok = window.confirm(`Supprimer ${selectedIds.size} notification(s) ?`);
      if (!ok) return;
    }
    setProcessingBulk(true);
    try {
      await axios.post(
        `${apiURL}/notifications/admin/bulk`,
        {
          action,
          ids: Array.from(selectedIds),
        },
        { withCredentials: true, headers: authHeaders },
      );
      if (action === 'mark_read') setSuccess('Notifications marquees comme lues.');
      if (action === 'mark_unread') setSuccess('Notifications marquees comme non lues.');
      if (action === 'delete') setSuccess('Notifications supprimees.');
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Action en masse impossible.');
    } finally {
      setProcessingBulk(false);
    }
  };

  const openDetails = async (id: number) => {
    if (!apiURL) return;
    setDetailModalOpen(true);
    setDetailLoading(true);
    setDetailItem(null);
    try {
      const res = await axios.get<NotificationDetails>(`${apiURL}/notifications/admin/${id}`, {
        withCredentials: true,
        headers: authHeaders,
      });
      setDetailItem(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Details indisponibles.');
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetailsFromMenu = (id: number) => {
    // Schedule after dropdown close to avoid focus/selection race in Radix menu
    window.setTimeout(() => {
      void openDetails(id);
    }, 0);
  };

  const handleRowNavigation = useCallback(
    async (item: NotificationItem) => {
      if (!apiURL) return;
      if (rowNavigatingId === item.id) return;

      setError(null);
      setRowNavigatingId(item.id);

      try {
        if (!item.isRead) {
          await axios.post(
            `${apiURL}/notifications/admin/${item.id}/read`,
            { isRead: true },
            { withCredentials: true, headers: authHeaders },
          );
          setItems((prev) =>
            prev.map((row) =>
              row.id === item.id
                ? { ...row, isRead: true, readAt: new Date().toISOString() }
                : row,
            ),
          );
          setStats((prev) => ({
            ...prev,
            unread: Math.max(0, Number(prev.unread || 0) - 1),
          }));
        }

        const target = await resolveNotificationTargetPathAsync(item, auth?.role, {
          apiURL,
          userId: Number(auth?.id || 0),
          headers: authHeaders,
        });

        if (target) {
          await router.push(target);
          return;
        }

        await openDetails(item.id);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Redirection impossible.');
      } finally {
        setRowNavigatingId(null);
      }
    },
    [apiURL, auth?.id, auth?.role, authHeaders, openDetails, rowNavigatingId, router],
  );

  const canReply = useCallback((item: NotificationItem) => {
    const relatedType = safeText(item.relatedEntityType).toLowerCase();
    return (
      item.category === 'MESSAGE_ADMIN' ||
      item.type === 'REPONSE' ||
      relatedType === 'message_portail'
    );
  }, []);

  const handleReplyNavigation = useCallback(
    async (item: NotificationItem) => {
      if (!apiURL) return;
      setError(null);
      try {
        if (!item.isRead) {
          await axios.post(
            `${apiURL}/notifications/admin/${item.id}/read`,
            { isRead: true },
            { withCredentials: true, headers: authHeaders },
          );
          setItems((prev) =>
            prev.map((row) =>
              row.id === item.id
                ? { ...row, isRead: true, readAt: new Date().toISOString() }
                : row,
            ),
          );
          setStats((prev) => ({
            ...prev,
            unread: Math.max(0, Number(prev.unread || 0) - 1),
          }));
        }

        const detailRes = await axios.get<NotificationDetails>(
          `${apiURL}/notifications/admin/${item.id}`,
          {
            withCredentials: true,
            headers: authHeaders,
          },
        );
        const detail = detailRes.data;
        const focusMessageId = Number(detail?.messageRelated?.id || item.messageId || 0);
        const relatedType = safeText(item.relatedEntityType).toLowerCase();
        const relatedId = Number(item.relatedEntityId || 0);
        let demandeId = Number(detail?.demande?.id_demande || item.demandeId || 0);

        if ((!demandeId || demandeId <= 0) && relatedType.includes('demande') && relatedId > 0) {
          demandeId = relatedId;
        }

        if (demandeId > 0) {
          await router.push(buildAdminDemandeMessagesPath(demandeId, focusMessageId || null));
          return;
        }

        const fallbackTarget = await resolveNotificationTargetPathAsync(
          {
            ...item,
            demandeId: demandeId > 0 ? demandeId : undefined,
            messageId: focusMessageId > 0 ? focusMessageId : undefined,
          },
          auth?.role,
          {
            apiURL,
            userId: Number(auth?.id || 0),
            headers: authHeaders,
          },
        );
        if (fallbackTarget) {
          await router.push(fallbackTarget);
          return;
        }

        setError('Impossible de trouver la discussion cible pour cette notification.');
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Redirection vers la discussion impossible.');
      }
    },
    [apiURL, auth?.role, authHeaders, router],
  );

  const openReplyModal = (item: NotificationItem) => {
    setError(null);
    setReplyTarget(item);
    setReplyContent('');
    setReplyModalOpen(true);
  };

  const submitReply = async () => {
    if (!apiURL || !replyTarget) return;
    const senderId = Number(auth?.id);
    if (!Number.isFinite(senderId) || senderId <= 0) {
      setError('Utilisateur admin introuvable.');
      return;
    }
    const content = safeText(replyContent);
    if (!content) {
      setError('Le message de reponse est vide.');
      return;
    }

    setError(null);
    setReplySubmitting(true);
    try {
      const detailRes = await axios.get<NotificationDetails>(
        `${apiURL}/notifications/admin/${replyTarget.id}`,
        {
          withCredentials: true,
          headers: authHeaders,
        },
      );
      const detail = detailRes.data;
      const sourceMessage = detail?.messageRelated;
      const originalSenderId = Number(sourceMessage?.senderId || 0);
      const originalReceiverId = Number(sourceMessage?.receiverId || 0);

      const receiverId =
        originalSenderId > 0 && originalSenderId !== senderId
          ? originalSenderId
          : originalReceiverId > 0 && originalReceiverId !== senderId
            ? originalReceiverId
            : 0;

      if (!Number.isFinite(receiverId) || receiverId <= 0) {
        setError('Impossible de determiner le destinataire de la reponse.');
        return;
      }

      const replyPayload: {
        receiverId: number;
        content: string;
        entityType?: string;
        entityCode?: string;
      } = {
        receiverId,
        content,
      };

      const conversationEntityType = safeText(
        sourceMessage?.conversation?.entityType,
      ).toUpperCase();
      const conversationEntityCode = safeText(
        sourceMessage?.conversation?.entityCode,
      );

      if (conversationEntityType) replyPayload.entityType = conversationEntityType;
      if (conversationEntityCode) replyPayload.entityCode = conversationEntityCode;

      await axios.post(
        `${apiURL}/api/chat/message`,
        replyPayload,
        {
          withCredentials: true,
          headers: {
            ...(authHeaders || {}),
            'x-user-id': String(senderId),
          },
        },
      );
      setReplyModalOpen(false);
      setReplyTarget(null);
      setReplyContent('');
      setSuccess('Reponse envoyee avec succes.');
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Envoi de la reponse impossible.');
    } finally {
      setReplySubmitting(false);
    }
  };

  const mapForExport = useCallback((rows: NotificationItem[]) => {
    return rows.map((item) => ({
      ID: item.id,
      Utilisateur: getUserDisplay(item.utilisateur),
      Email: getUserSecondary(item.utilisateur),
      Type: item.type,
      Categorie: item.category || '',
      Priorite: item.priority,
      Titre: item.title,
      Message: item.message,
      Statut: item.isRead ? 'Lue' : 'Non lue',
      'Date creation': formatDate(item.createdAt),
      'Date lecture': formatDate(item.readAt || null),
      'Entite liee': safeText(item.relatedEntityType),
      'ID entite liee': item.relatedEntityId ?? '',
    }));
  }, []);

  const fetchAllForExport = useCallback(async () => {
    if (!apiURL) return [] as NotificationItem[];
    const all: NotificationItem[] = [];
    const exportPageSize = 100;
    let currentPage = 1;
    let totalPages = 1;
    while (currentPage <= totalPages) {
      const query = buildQueryString({
        includePagination: true,
        page: currentPage,
        pageSize: exportPageSize,
        filters,
        sort: sortState,
      });
      const res = await axios.get<NotificationsListResponse>(
        `${apiURL}/notifications/admin?${query}`,
        {
          withCredentials: true,
          headers: authHeaders,
        },
      );
      const payload = res.data;
      all.push(...(Array.isArray(payload.items) ? payload.items : []));
      totalPages = Math.max(1, Number(payload.pages || 1));
      currentPage += 1;
      if (currentPage > 200) break;
    }
    return all;
  }, [apiURL, authHeaders, buildQueryString, filters, sortState]);

  const handleExportCsv = async () => {
    if (!apiURL) return;
    setExporting(true);
    setError(null);
    try {
      const rows = mapForExport(await fetchAllForExport());
      const headers = Object.keys(rows[0] || {
        ID: '',
        Utilisateur: '',
        Email: '',
        Type: '',
        Categorie: '',
        Priorite: '',
        Titre: '',
        Message: '',
        Statut: '',
        'Date creation': '',
        'Date lecture': '',
        'Entite liee': '',
        'ID entite liee': '',
      });
      const lines = [
        headers.map(csvEscape).join(';'),
        ...rows.map((row) => headers.map((h) => csvEscape((row as any)[h])).join(';')),
      ];
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      downloadFile(lines.join('\n'), 'text/csv;charset=utf-8', `notifications_admin_${ts}.csv`);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Erreur lors de l'export CSV.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!apiURL) return;
    setExporting(true);
    setError(null);
    try {
      const rows = mapForExport(await fetchAllForExport());
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Notifications');
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      XLSX.writeFile(wb, `notifications_admin_${ts}.xlsx`);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Erreur lors de l'export Excel.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!apiURL) return;
    setExporting(true);
    setError(null);
    try {
      const rows = mapForExport(await fetchAllForExport());
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const generatedAt = new Date().toLocaleString('fr-DZ');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Notifications - Export admin', 10, 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Genere le ${generatedAt}`, 10, 18);

      const head = [[
        'ID',
        'Utilisateur',
        'Email',
        'Type',
        'Categorie',
        'Priorite',
        'Titre',
        'Statut',
        'Date creation',
      ]];
      const body = rows.map((row: any) => [
        String(row.ID ?? ''),
        String(row.Utilisateur ?? ''),
        String(row.Email ?? ''),
        String(row.Type ?? ''),
        String(row.Categorie ?? ''),
        String(row.Priorite ?? ''),
        String(row.Titre ?? ''),
        String(row.Statut ?? ''),
        String(row['Date creation'] ?? ''),
      ]);

      autoTable(doc, {
        head,
        body,
        startY: 22,
        margin: { left: 8, right: 8, top: 8, bottom: 8 },
        styles: {
          font: 'helvetica',
          fontSize: 8,
          cellPadding: 1.4,
          lineColor: [229, 231, 235],
          lineWidth: 0.1,
        },
        headStyles: { fillColor: [31, 41, 55], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 11 },
          1: { cellWidth: 34 },
          2: { cellWidth: 45 },
          3: { cellWidth: 17 },
          4: { cellWidth: 24 },
          5: { cellWidth: 20 },
          6: { cellWidth: 75 },
          7: { cellWidth: 18 },
          8: { cellWidth: 28 },
        },
      });

      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      doc.save(`notifications_admin_${ts}.pdf`);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Erreur lors de l'export PDF.");
    } finally {
      setExporting(false);
    }
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
          <section className={styles.pageHeader}>
            <div>
              <h1>Gestion des Notifications</h1>
              <p>Suivi centralise des notifications envoyees aux utilisateurs du portail.</p>
            </div>
            <div className={styles.headerActions}>
              <div className={styles.exportActionsCard}>
                <div className={styles.exportActionsLabel}>
                  <span className={styles.exportActionsTitle}>Actions</span>
                  <span className={styles.exportActionsHint}>Actualiser et exporter la liste filtree</span>
                </div>
                <div className={styles.exportActionsButtons}>
                  <Button
                    className={`${styles.exportBtn} ${styles.exportRefreshBtn} btn-primary`}
                    onClick={fetchData}
                    disabled={loading}
                  >
                    <FiRefreshCw /> Actualiser
                  </Button>
                  <Button
                    className={`${styles.exportBtn} ${styles.exportExcelBtn} btn-success`}
                    onClick={handleExportExcel}
                    disabled={loading || exporting}
                  >
                    <FiDownload /> Export Excel
                  </Button>
                  <Button
                    className={`${styles.exportBtn} ${styles.exportPdfBtn} btn-primary`}
                    onClick={handleExportPdf}
                    disabled={loading || exporting}
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
                  <p className={styles.statLabel}>Total notifications</p>
                  <p className={styles.statValue}>{stats.total}</p>
                </div>
                <FiBell className={styles.statIcon} />
              </CardContent>
            </Card>
            <Card className={`${styles.statCard} ${styles.statUnread}`}>
              <CardContent className={styles.statContent}>
                <div>
                  <p className={styles.statLabel}>Non lues</p>
                  <p className={styles.statValue}>{stats.unread}</p>
                </div>
                <FiAlertCircle className={styles.statIcon} />
              </CardContent>
            </Card>
            <Card className={`${styles.statCard} ${styles.statRead}`}>
              <CardContent className={styles.statContent}>
                <div>
                  <p className={styles.statLabel}>Lues</p>
                  <p className={styles.statValue}>{stats.read}</p>
                </div>
                <FiCheck className={styles.statIcon} />
              </CardContent>
            </Card>
            <Card className={`${styles.statCard} ${styles.statUrgent}`}>
              <CardContent className={styles.statContent}>
                <div>
                  <p className={styles.statLabel}>Urgentes / Haute priorite</p>
                  <p className={styles.statValue}>{stats.urgent}</p>
                </div>
                <MdWarningAmber className={styles.statIcon} />
              </CardContent>
            </Card>
          </section>

          <section className={styles.filtersCard}>
            <div className={styles.filtersHead}>
              <div>
                <h2>Filtres avances</h2>
                <p>Recherche globale, utilisateur, type, categorie, priorite, statut et periode.</p>
              </div>
              <Button
                className={styles.toggleFiltersBtn}
                variant="outline"
                onClick={() => setFiltersOpen((prev) => !prev)}
              >
                <FiFilter /> {filtersOpen ? 'Masquer filtres' : 'Afficher filtres'}
              </Button>
            </div>

            {filtersOpen && (
              <div className={styles.filtersGrid}>
                <label className={styles.filterField}>
                  <span>Recherche globale</span>
                  <div className={styles.searchWrap}>
                    <FiFilter />
                    <Input
                      value={draftFilters.search}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({ ...prev, search: e.target.value }))
                      }
                      placeholder="Titre, message, utilisateur, type..."
                    />
                  </div>
                </label>

                <label className={styles.filterField}>
                  <span>Utilisateur</span>
                  <div className={styles.searchWrap}>
                    <FiFilter />
                    <Input
                      value={draftFilters.userQuery}
                      onChange={(e) =>
                        setDraftFilters((prev) => ({ ...prev, userQuery: e.target.value }))
                      }
                      placeholder="Nom, email, username..."
                    />
                  </div>
                </label>

                <label className={styles.filterField}>
                  <span>Statut lecture</span>
                  <select
                    value={draftFilters.isRead}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        isRead: e.target.value as FiltersState['isRead'],
                      }))
                    }
                  >
                    <option value="all">Tous</option>
                    <option value="read">Lues</option>
                    <option value="unread">Non lues</option>
                  </select>
                </label>

                <label className={styles.filterField}>
                  <span>Date debut</span>
                  <Input
                    type="date"
                    value={draftFilters.fromDate}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, fromDate: e.target.value }))
                    }
                  />
                </label>

                <label className={styles.filterField}>
                  <span>Date fin</span>
                  <Input
                    type="date"
                    value={draftFilters.toDate}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({ ...prev, toDate: e.target.value }))
                    }
                  />
                </label>

                <div className={styles.filterField}>
                  <span>Type</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className={styles.multiBtn} variant="outline">
                        Types ({draftFilters.type.length || 'Tous'}) <FiChevronDown />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className={styles.multiMenu} align="start">
                      <DropdownMenuLabel>Type notification</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {TYPE_OPTIONS.map((option) => (
                        <DropdownMenuCheckboxItem
                          key={option.value}
                          checked={draftFilters.type.includes(option.value)}
                          onCheckedChange={() => toggleDraftMulti('type', option.value)}
                        >
                          {option.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className={styles.filterField}>
                  <span>Categorie</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className={styles.multiBtn} variant="outline">
                        Categories ({draftFilters.category.length || 'Toutes'}) <FiChevronDown />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className={styles.multiMenu} align="start">
                      <DropdownMenuLabel>Categorie</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {CATEGORY_OPTIONS.map((option) => (
                        <DropdownMenuCheckboxItem
                          key={option.value}
                          checked={draftFilters.category.includes(option.value)}
                          onCheckedChange={() => toggleDraftMulti('category', option.value)}
                        >
                          {option.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className={styles.filterField}>
                  <span>Priorite</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className={styles.multiBtn} variant="outline">
                        Priorites ({draftFilters.priority.length || 'Toutes'}) <FiChevronDown />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className={styles.multiMenu} align="start">
                      <DropdownMenuLabel>Priorite</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {PRIORITY_OPTIONS.map((option) => (
                        <DropdownMenuCheckboxItem
                          key={option.value}
                          checked={draftFilters.priority.includes(option.value)}
                          onCheckedChange={() => toggleDraftMulti('priority', option.value)}
                        >
                          {option.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className={styles.filterActions}>
                  <Button type="button" className={`${styles.applyBtn} btn-primary`} onClick={handleApplyFilters}>
                    Appliquer
                  </Button>
                  <Button type="button" className={styles.resetBtn} variant="outline" onClick={handleResetFilters}>
                    Reinitialiser
                  </Button>
                </div>
              </div>
            )}
          </section>

          {selectedIds.size > 0 && (
            <section className={styles.bulkBar}>
              <div>
                <strong>{selectedIds.size}</strong> notification(s) selectionnee(s)
              </div>
              <div className={styles.bulkActions}>
                <Button
                  className="btn-success"
                  onClick={() => handleBulkAction('mark_read')}
                  disabled={processingBulk}
                >
                  Marquer lues
                </Button>
                <Button
                  className="btn-primary"
                  variant="outline"
                  onClick={() => handleBulkAction('mark_unread')}
                  disabled={processingBulk}
                >
                  Marquer non lues
                </Button>
                <Button
                  className={`${styles.deleteBtn} btn-danger`}
                  onClick={() => handleBulkAction('delete')}
                  disabled={processingBulk}
                >
                  Supprimer
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedIds(new Set())}
                  disabled={processingBulk}
                >
                  <FiX /> Annuler selection
                </Button>
              </div>
            </section>
          )}

          <section className={styles.tableCard}>
            <div className={styles.tableMeta}>
              <span>
                {total > 0
                  ? `Affichage ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} sur ${total}`
                  : 'Aucune notification'}
              </span>
              <label className={styles.pageSizeField}>
                <span>Par page</span>
                <select
                  value={String(pageSize)}
                  onChange={(e) => {
                    setPage(1);
                    setPageSize(Number(e.target.value));
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className={styles.tableWrap}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={styles.checkboxCol}>
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectAllPage}
                      />
                    </TableHead>
                    <TableHead>
                      <button className={styles.sortBtn} onClick={() => handleSort('id')}>
                        ID
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className={styles.sortBtn} onClick={() => handleSort('user')}>
                        Utilisateur
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className={styles.sortBtn} onClick={() => handleSort('type')}>
                        Type
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className={styles.sortBtn} onClick={() => handleSort('category')}>
                        Categorie
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className={styles.sortBtn} onClick={() => handleSort('priority')}>
                        Priorite
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className={styles.sortBtn} onClick={() => handleSort('title')}>
                        Titre
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className={styles.sortBtn} onClick={() => handleSort('message')}>
                        Message
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className={styles.sortBtn} onClick={() => handleSort('isRead')}>
                        Lu ?
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className={styles.sortBtn} onClick={() => handleSort('createdAt')}>
                        Date creation
                      </button>
                    </TableHead>
                    <TableHead className={styles.actionsCol}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={11} className={styles.emptyCell}>
                        Chargement...
                      </TableCell>
                    </TableRow>
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className={styles.emptyCell}>
                        Aucune notification pour les filtres actuels.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow
                        key={item.id}
                        className={`${styles.dataRow} ${
                          rowNavigatingId === item.id ? styles.dataRowNavigating : ''
                        }`}
                        onClick={() => {
                          void handleRowNavigation(item);
                        }}
                      >
                        <TableCell className={styles.checkboxCol}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleSelect(item.id)}
                          />
                        </TableCell>
                        <TableCell>#{item.id}</TableCell>
                        <TableCell>
                          <div className={styles.userCell}>
                            <span className={styles.userName}>{getUserDisplay(item.utilisateur)}</span>
                            <span className={styles.userEmail}>{getUserSecondary(item.utilisateur)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${styles.badge} ${styles[`type${item.type}`] || ''}`}>
                            {item.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${styles.badge} ${styles.categoryBadge}`}>
                            {item.category || '--'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${styles.badge} ${styles[`priority${item.priority}`] || ''}`}>
                            {item.priority}
                          </Badge>
                        </TableCell>
                        <TableCell title={item.title}>{truncateText(item.title, 40)}</TableCell>
                        <TableCell title={item.message}>{truncateText(item.message, 64)}</TableCell>
                        <TableCell>
                          {item.isRead ? (
                            <div className={styles.readStateOk}>
                              <FiCheck /> Lue {item.readAt ? `(${formatRelativeDate(item.readAt)})` : ''}
                            </div>
                          ) : (
                            <div className={styles.readStateNo}>
                              <FiX /> Non lue
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{formatRelativeDate(item.createdAt)}</TableCell>
                        <TableCell className={styles.actionsCol}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className={styles.rowActionBtn}
                                onClick={(e) => e.stopPropagation()}
                              >
                                Actions <FiChevronDown />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className={styles.rowActionMenu}>
                              <DropdownMenuItem
                                className={styles.rowActionMenuItem}
                                onSelect={(e) => {
                                  e.stopPropagation();
                                  openDetailsFromMenu(item.id);
                                }}
                              >
                                <FiEye /> Voir details
                              </DropdownMenuItem>
                              {item.isRead ? (
                                <DropdownMenuItem
                                  className={styles.rowActionMenuItem}
                                  onSelect={() => handleToggleRead(item, false)}
                                >
                                  <FiX /> Marquer non lue
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  className={styles.rowActionMenuItem}
                                  onSelect={() => handleToggleRead(item, true)}
                                >
                                  <FiCheck /> Marquer lue
                                </DropdownMenuItem>
                              )}
                              {canReply(item) && (
                                <DropdownMenuItem
                                  className={styles.rowActionMenuItem}
                                  onSelect={() => {
                                    void handleReplyNavigation(item);
                                  }}
                                >
                                  <FiMessageSquare /> Repondre
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className={`${styles.rowActionMenuItem} ${styles.rowActionMenuItemDanger}`}
                                onSelect={() => handleDeleteOne(item)}
                              >
                                <FiTrash2 /> Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className={styles.paginationBar}>
              <div>
                Affichage {items.length} / {total} notifications
              </div>
              <div className={styles.paginationControls}>
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(1)}
                >
                  <FiChevronLeft /> <FiChevronLeft />
                </button>
                <button
                  type="button"
                  disabled={page <= 1 || loading}
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
                      disabled={loading}
                    >
                      {value}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={page >= pages || loading}
                  onClick={() => setPage((prev) => Math.min(pages, prev + 1))}
                >
                  <FiChevronRight />
                </button>
                <button
                  type="button"
                  disabled={page >= pages || loading}
                  onClick={() => setPage(pages)}
                >
                  <FiChevronRight /> <FiChevronRight />
                </button>
              </div>
            </div>
          </section>

          <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
            <DialogContent className={styles.modalLarge}>
              <DialogHeader>
                <DialogTitle>Detail notification</DialogTitle>
                <DialogDescription>
                  Vue complete de la notification, de l utilisateur et de l entite liee.
                </DialogDescription>
              </DialogHeader>
              {detailLoading ? (
                <div className={styles.modalLoading}>Chargement...</div>
              ) : !detailItem ? (
                <div className={styles.modalLoading}>Aucun detail disponible.</div>
              ) : (
                <div className={styles.detailGrid}>
                  <div className={styles.detailBlock}>
                    <h4>Notification</h4>
                    <p><strong>ID:</strong> #{detailItem.id}</p>
                    <p><strong>Titre:</strong> {detailItem.title}</p>
                    <p><strong>Message:</strong> {detailItem.message}</p>
                    <p><strong>Type:</strong> {detailItem.type}</p>
                    <p><strong>Categorie:</strong> {detailItem.category || '--'}</p>
                    <p><strong>Priorite:</strong> {detailItem.priority}</p>
                    <p><strong>Statut:</strong> {detailItem.isRead ? 'Lue' : 'Non lue'}</p>
                    <p><strong>Date creation:</strong> {formatDate(detailItem.createdAt)}</p>
                    <p><strong>Date lecture:</strong> {formatDate(detailItem.readAt || null)}</p>
                  </div>
                  <div className={styles.detailBlock}>
                    <h4>Utilisateur</h4>
                    <p><strong>Nom:</strong> {getUserDisplay(detailItem.utilisateur)}</p>
                    <p><strong>Email:</strong> {getUserSecondary(detailItem.utilisateur)}</p>
                    <p><strong>Utilisateur ID:</strong> {detailItem.userId}</p>
                  </div>
                  <div className={styles.detailBlock}>
                    <h4>Entite liee</h4>
                    <p><strong>Type:</strong> {safeText(detailItem.relatedEntityType) || '--'}</p>
                    <p><strong>ID:</strong> {detailItem.relatedEntityId ?? '--'}</p>
                    {detailItem.demande && (
                      <>
                        <p><strong>Demande:</strong> #{detailItem.demande.id_demande}</p>
                        <p><strong>Code demande:</strong> {safeText(detailItem.demande.code_demande) || '--'}</p>
                        <p><strong>Statut demande:</strong> {safeText(detailItem.demande.statut_demande) || '--'}</p>
                      </>
                    )}
                    {detailItem.permis && (
                      <>
                        <p><strong>Permis:</strong> #{detailItem.permis.id}</p>
                        <p><strong>Code permis:</strong> {safeText(detailItem.permis.code_permis) || '--'}</p>
                        <p><strong>Date expiration:</strong> {formatDate(detailItem.permis.date_expiration || null)}</p>
                      </>
                    )}
                    {detailItem.messageRelated && (
                      <>
                        <p><strong>Message ID:</strong> #{detailItem.messageRelated.id}</p>
                        <p><strong>Contenu message:</strong> {safeText(detailItem.messageRelated.content) || '--'}</p>
                        <p><strong>Sender:</strong> {detailItem.messageRelated.senderId ?? '--'}</p>
                        <p><strong>Receiver:</strong> {detailItem.messageRelated.receiverId ?? '--'}</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={replyModalOpen} onOpenChange={setReplyModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Repondre a l utilisateur</DialogTitle>
                <DialogDescription>
                  Envoi via messagerie interne (Conversation/MessagePortail).
                </DialogDescription>
              </DialogHeader>
              <div className={styles.replyBox}>
                <p>
                  <strong>Destinataire:</strong>{' '}
                  {replyTarget
                    ? safeText(replyTarget.relatedEntityType).toLowerCase() ===
                      'message_portail'
                      ? 'Utilisateur de la conversation'
                      : getUserDisplay(replyTarget.utilisateur)
                    : '--'}
                </p>
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Ecrire votre reponse..."
                  rows={6}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setReplyModalOpen(false)}
                  disabled={replySubmitting}
                >
                  Fermer
                </Button>
                <Button onClick={submitReply} disabled={replySubmitting}>
                  {replySubmitting ? 'Envoi...' : 'Envoyer'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
