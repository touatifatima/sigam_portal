'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
  XCircle,
} from 'lucide-react';
import InvestorLayout from '../../components/investor/InvestorLayout';
import { useAuthStore } from '../../src/store/useAuthStore';
import {
  resolveNotificationTargetPathAsync,
} from '../../src/utils/notificationNavigation';
import { getDefaultDashboardPath } from '../../src/utils/roleNavigation';
import styles from './notification.module.css';

type NotificationItem = {
  id: number;
  userId?: number | null;
  type: string;
  category?: string | null;
  priority: string;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
  demandeId?: number | null;
  permisId?: number | null;
  messageId?: number | null;
};

type NotificationResponse = {
  notifications?: NotificationItem[];
  items?: NotificationItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  pages?: number;
  unreadCount?: number;
};

const TYPE_OPTIONS = [
  { label: 'Tous types', value: '' },
  { label: 'Infos', value: 'INFO' },
  { label: 'Avis', value: 'AVIS' },
  { label: 'Alertes', value: 'ALERTE' },
  { label: 'Messages', value: 'REPONSE' },
  { label: 'Taxe', value: 'TAXE' },
];

const CATEGORY_OPTIONS = [
  { label: 'Toutes categories', value: '' },
  { label: 'Demandes', value: 'DEMANDE' },
  { label: 'Messages', value: 'MESSAGE_ADMIN' },
  { label: 'Permis', value: 'PERMIS' },
  { label: 'Paiements', value: 'PAIEMENT' },
  { label: 'Systeme', value: 'SYSTEM' },
  { label: 'Relance', value: 'RELANCE' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export default function NotificationsPage() {
  const router = useRouter();
  const auth = useAuthStore((state) => state.auth);
  const apiURL =
    process.env.NEXT_PUBLIC_API_URL ||
    (import.meta as any)?.env?.VITE_API_URL ||
    '';
  const notificationHeaders = useMemo(() => {
    const userId = Number(auth?.id || 0);
    return {
      'x-user-id': userId > 0 ? String(userId) : '',
      'x-user-name': auth?.username || auth?.email || '',
    };
  }, [auth?.email, auth?.id, auth?.username]);
  const dashboardHref = useMemo(
    () => getDefaultDashboardPath(auth?.role),
    [auth?.role],
  );

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [navigatingId, setNavigatingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const toRelativeDate = useCallback((dateString: string) => {
    const ts = new Date(dateString).getTime();
    if (!Number.isFinite(ts)) return '';
    const diffMs = Date.now() - ts;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs < minute) return 'A l instant';
    if (diffMs < hour) return `Il y a ${Math.floor(diffMs / minute)} min`;
    if (diffMs < day) return `Il y a ${Math.floor(diffMs / hour)} h`;
    if (diffMs < 7 * day) return `Il y a ${Math.floor(diffMs / day)} j`;

    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const iconForNotification = useCallback((notification: NotificationItem) => {
    const t = String(notification.type || '').toUpperCase();
    if (t === 'ALERTE') return <XCircle size={16} />;
    if (t === 'REPONSE') return <MessageCircle size={16} />;
    if (t === 'AVIS') return <CheckCircle2 size={16} />;
    return <AlertTriangle size={16} />;
  }, []);

  const toneClass = useCallback((notification: NotificationItem) => {
    const t = String(notification.type || '').toUpperCase();
    if (t === 'ALERTE') return styles.toneDanger;
    if (t === 'REPONSE') return styles.toneInfo;
    if (t === 'AVIS') return styles.toneSuccess;
    return styles.toneWarning;
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!apiURL) {
      setError('API URL manquante.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (typeFilter) params.set('type', typeFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (unreadOnly) params.set('unreadOnly', 'true');

      const response = await fetch(`${apiURL}/notifications?${params.toString()}`, {
        credentials: 'include',
        headers: notificationHeaders,
      });
      if (!response.ok) {
        throw new Error(`Erreur API (${response.status})`);
      }

      const payload = (await response.json()) as NotificationResponse;
      const list = Array.isArray(payload.notifications)
        ? payload.notifications
        : Array.isArray(payload.items)
        ? payload.items
        : [];

      setItems(list);
      setTotal(Number(payload.total || 0));
      setPages(Math.max(1, Number(payload.pages || 1)));
      setUnreadCount(Number(payload.unreadCount || 0));
    } catch (e: any) {
      setError(e?.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [apiURL, categoryFilter, notificationHeaders, page, pageSize, typeFilter, unreadOnly]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markAsRead = useCallback(
    async (id: number) => {
      try {
        const resp = await fetch(`${apiURL}/notifications/${id}/read`, {
          method: 'POST',
          credentials: 'include',
          headers: notificationHeaders,
        });
        const data = await resp.json().catch(() => ({}));
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item,
          ),
        );
        if (typeof data?.count === 'number') {
          setUnreadCount(data.count);
        } else {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch {
        // noop
      }
    },
    [apiURL, notificationHeaders],
  );

  const markAllAsRead = useCallback(async () => {
    try {
      await fetch(`${apiURL}/notifications/read-all`, {
        method: 'POST',
        credentials: 'include',
        headers: notificationHeaders,
      });
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch {
      // noop
    }
  }, [apiURL, notificationHeaders]);

  const handleNotificationClick = useCallback(
    async (notification: NotificationItem) => {
      setNavigatingId(notification.id);
      if (!notification.isRead) {
        await markAsRead(notification.id);
      }

      const target = await resolveNotificationTargetPathAsync(
        notification,
        auth?.role,
        {
          apiURL,
          userId: Number(auth?.id || 0),
          headers: notificationHeaders,
        },
      );
      if (!target) {
        setNavigatingId(null);
        return;
      }

      window.setTimeout(() => {
        void router.push(target);
        setNavigatingId(null);
      }, 140);
    },
    [auth?.role, markAsRead, router],
  );

  const from = useMemo(() => {
    if (!total) return 0;
    return (page - 1) * pageSize + 1;
  }, [page, pageSize, total]);

  const to = useMemo(() => {
    if (!total) return 0;
    return Math.min(page * pageSize, total);
  }, [page, pageSize, total]);

  return (
    <InvestorLayout>
      <div className={styles.pageWrap}>
        <div className={styles.headerCard}>
          <div>
            <h1 className={styles.title}>Mes notifications</h1>
            <p className={styles.subtitle}>
              Historique complet des notifications importantes de votre compte.
            </p>
          </div>
          <div className={styles.headerActions}>
            <span className={styles.unreadChip}>{unreadCount} non lues</span>
            <button className={styles.secondaryBtn} onClick={markAllAsRead}>
              Tout marquer comme lu
            </button>
            <Link href={dashboardHref} className={styles.linkBtn}>
              Retour tableau de bord
            </Link>
          </div>
        </div>

        <div className={styles.filtersCard}>
          <label className={styles.field}>
            <span>Type</span>
            <select
              value={typeFilter}
              onChange={(e) => {
                setPage(1);
                setTypeFilter(e.target.value);
              }}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Categorie</span>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setPage(1);
                setCategoryFilter(e.target.value);
              }}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
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

          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => {
                setPage(1);
                setUnreadOnly(e.target.checked);
              }}
            />
            <span>Uniquement non lues</span>
          </label>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.listCard}>
          <div className={styles.listMeta}>
            <span>
              {total
                ? `Affichage ${from}-${to} sur ${total}`
                : 'Aucune notification'}
            </span>
            <button className={styles.secondaryBtn} onClick={loadNotifications}>
              Actualiser
            </button>
          </div>

          {loading ? (
            <div className={styles.loadingBox}>Chargement...</div>
          ) : items.length === 0 ? (
            <div className={styles.emptyBox}>Aucune notification disponible.</div>
          ) : (
            <div className={styles.cards}>
              {items.map((notification) => (
                <article
                  key={notification.id}
                  className={`${styles.notificationCard} ${
                    notification.isRead ? styles.read : styles.unread
                  } ${navigatingId === notification.id ? styles.navigating : ''}`}
                  onClick={() => void handleNotificationClick(notification)}
                >
                  <div className={`${styles.iconWrap} ${toneClass(notification)}`}>
                    {iconForNotification(notification)}
                  </div>

                  <div className={styles.contentWrap}>
                    <div className={styles.rowTop}>
                      <h3 className={styles.cardTitle}>{notification.title}</h3>
                      <span className={styles.dateText}>
                        {toRelativeDate(notification.createdAt)}
                      </span>
                    </div>

                    <p className={styles.cardMessage}>{notification.message}</p>

                    <div className={styles.rowBottom}>
                      <span className={styles.metaPill}>
                        {notification.category || 'SYSTEM'} / {notification.type}
                      </span>
                      {!notification.isRead ? (
                        <button
                          className={styles.primaryBtn}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleNotificationClick(notification);
                          }}
                        >
                          Ouvrir
                        </button>
                      ) : (
                        <button
                          className={styles.secondaryBtn}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleNotificationClick(notification);
                          }}
                        >
                          Ouvrir
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className={styles.paginationRow}>
            <button
              className={styles.secondaryBtn}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Precedent
            </button>
            <span>
              Page {page} / {pages}
            </span>
            <button
              className={styles.secondaryBtn}
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Suivant
            </button>
          </div>
        </div>
      </div>
    </InvestorLayout>
  );
}
