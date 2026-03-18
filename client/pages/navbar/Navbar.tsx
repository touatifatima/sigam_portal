// components/Navbar.tsx
'use client';
import { FiSearch, FiChevronDown } from 'react-icons/fi';
import { User, Settings, LogOut, LayoutDashboard, Map } from 'lucide-react';
import { useAuthStore } from '../../src/store/useAuthStore';
import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from './Navbar.module.css';
import {
  resolveNotificationTargetPathAsync,
} from '@/src/utils/notificationNavigation';

interface NotificationItem {
  id: number;
  userId?: number | null;
  type: string;
  category?: string | null;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  priority: string;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
  demandeId?: number | null;
  permisId?: number | null;
  messageId?: number | null;
}

const NOTIFICATIONS_FLAG =
  (process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS ??
    (import.meta as any)?.env?.VITE_ENABLE_NOTIFICATIONS ??
    'true')
    .toString()
    .toLowerCase();
const NOTIFICATIONS_ENABLED =
  NOTIFICATIONS_FLAG !== 'false' &&
  NOTIFICATIONS_FLAG !== '0' &&
  NOTIFICATIONS_FLAG !== 'off';

export default function Navbar() {
  const router = useRouter();
  const { auth, logout } = useAuthStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [navigatingNotificationId, setNavigatingNotificationId] = useState<number | null>(null);
  const [notificationsSuppressed, setNotificationsSuppressed] = useState(
    !NOTIFICATIONS_ENABLED,
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const apiURL =
    process.env.NEXT_PUBLIC_API_URL || (import.meta as any)?.env?.VITE_API_URL || '';
  const isIdentificationsRoute =
    router.pathname?.includes('/admin/identifications-entreprises') ||
    router.asPath?.startsWith('/admin/identifications-entreprises');
  const disableLiveNotifications = Boolean(isIdentificationsRoute);
  const notificationHeaders = useMemo(() => {
    const userId = Number(auth?.id || 0);
    return {
      'x-user-id': userId > 0 ? String(userId) : '',
      'x-user-name': auth?.username || auth?.email || '',
    };
  }, [auth?.email, auth?.id, auth?.username]);

  const parseNotificationsPayload = (payload: any) => {
    if (Array.isArray(payload)) return payload as NotificationItem[];
    if (Array.isArray(payload?.notifications)) return payload.notifications as NotificationItem[];
    if (Array.isArray(payload?.items)) return payload.items as NotificationItem[];
    return [];
  };

  const fetchRecentNotifications = async () => {
    if (notificationsSuppressed) return;
    if (!apiURL) {
      setNotificationsSuppressed(true);
      return;
    }

    setIsNotificationsLoading(true);
    try {
      const recentResp = await fetch(`${apiURL}/notifications/recent?limit=8`, {
        credentials: 'include',
        headers: notificationHeaders,
      });
      if (!recentResp.ok) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      const payload = await recentResp.json();
      const list = parseNotificationsPayload(payload);
      setNotifications(list);

      const countFromPayload = Number(payload?.unreadCount);
      if (Number.isFinite(countFromPayload)) {
        setUnreadCount((prev) =>
          prev === countFromPayload ? prev : countFromPayload,
        );
      } else {
        setUnreadCount(list.filter((n) => !n.isRead).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setIsNotificationsLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    if (notificationsSuppressed || !apiURL) return;
    try {
      const response = await fetch(`${apiURL}/notifications/count`, {
        credentials: 'include',
        headers: notificationHeaders,
      });
      if (!response.ok) return;
      const data = await response.json();
      if (typeof data?.count === 'number') {
        setUnreadCount((prev) => (prev === data.count ? prev : data.count));
      }
    } catch {
      // silent fallback
    }
  };

  const setupSSE = () => {
    if (notificationsSuppressed) {
      return () => {};
    }

    if (!apiURL) {
      return () => {};
    }

    let reconnectTimer: number | undefined;
    let closed = false;
    let source: EventSource | null = null;
    const userId = auth?.id;
    const sseUrl = Number.isFinite(Number(userId))
      ? `${apiURL}/notifications/sse?userId=${userId}`
      : `${apiURL}/notifications/sse`;

    const connect = () => {
      if (closed) return;
      const es = new EventSource(sseUrl, { withCredentials: true } as any);
      source = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (typeof data?.count === 'number') {
            setUnreadCount((prev) => (prev === data.count ? prev : data.count));
          }
        } catch {
          // ignore malformed chunks
        }

        if (isNotificationsOpen) {
          void fetchRecentNotifications();
        }
      };

      es.onerror = () => {
        try {
          es.close();
        } catch {
          // ignore
        }
        source = null;
        if (closed) return;
        reconnectTimer = window.setTimeout(() => {
          connect();
        }, 5000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      try {
        source?.close();
      } catch {
        // ignore
      }
    };
  };

  useEffect(() => {
    if (notificationsSuppressed) return;
    if (disableLiveNotifications) {
      void fetchUnreadCount();
      return;
    }
    // Keep initial page load light: only fetch the counter.
    // Detailed notifications are loaded when the dropdown is opened.
    void fetchUnreadCount();
    const cleanup = setupSSE();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disableLiveNotifications, notificationsSuppressed, auth?.id]);

  const markAsRead = async (notificationId: number) => {
    try {
      const resp = await fetch(`${apiURL}/notifications/${notificationId}/read`, {
        method: 'POST',
        credentials: 'include',
        headers: notificationHeaders,
      });
      const data = await resp.json().catch(() => ({}));
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, isRead: true } : n,
        ),
      );
      if (typeof data?.count === 'number') {
        setUnreadCount(data.count);
      } else {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(`${apiURL}/notifications/read-all`, {
        method: 'POST',
        credentials: 'include',
        headers: notificationHeaders,
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleNotificationClick = async (notification: NotificationItem) => {
    setNavigatingNotificationId(notification.id);
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
      setNavigatingNotificationId(null);
      return;
    }
    setIsNotificationsOpen(false);
    window.setTimeout(() => {
      void router.push(target);
      setNavigatingNotificationId(null);
    }, 140);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getInitials = (role: string) => {
    return role
      .split(' ')
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  };

  const getNotificationSymbol = (notification: NotificationItem) => {
    const t = String(notification.type || '').toUpperCase();
    if (t === 'ALERTE') return '!';
    if (t === 'REPONSE') return 'MSG';
    if (t === 'AVIS') return 'OK';
    return 'i';
  };

  const formatRelativeDate = (dateString: string) => {
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
  };

  const initials = auth.role ? getInitials(auth.role) : '';
  const displayUsername = auth.username ?? auth.email ?? '';
  const displayEmail = auth.email ?? '';
  const isInvestisseur = (auth.role ?? '').toLowerCase() === 'investisseur';
  const canCreateDemande = isInvestisseur && auth.isEntrepriseVerified;

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    await logout();
  };

  return (
    <nav className={styles['navbar']}>
      <div className={styles['navbar-header']}>
        <div className={styles['app-logo']}>
          <span>POM</span>
          <span className={styles['app-version']}>Portail</span>
        </div>
      </div>

      <div className={styles['navbar-search']}>
        <div className={styles['search-container']}>
          <FiSearch className={styles['search-icon']} />
          <input
            type="text"
            className={styles['search-input']}
            placeholder="Rechercher..."
          />
        </div>
      </div>

      <div className={styles['navbar-actions']}>
        <Link
          href="/carte/carte_public"
          className={styles['nav-map-link']}
          title="Ouvrir la carte publique"
        >
          <Map size={16} />
          <span>Carte Publique</span>
        </Link>

        {isInvestisseur && (
          <Link
            href="/investisseur/nouvelle_demande/step1_typepermis/page1_typepermis"
            className={`${styles['nav-cta']} ${
              canCreateDemande ? '' : styles['nav-cta-disabled']
            }`}
            onClick={(event) => {
              if (!canCreateDemande) {
                event.preventDefault();
              }
            }}
            aria-disabled={!canCreateDemande}
            title={
              canCreateDemande
                ? 'Nouvelle demande'
                : "Completez l'identification pour continuer"
            }
          >
            Nouvelle Demande
          </Link>
        )}
      </div>

      <div className={styles['navbar-user']}>
        <div className={styles['notification-container']} ref={notificationsRef}>
          <div
            className={styles['notification-icon']}
            onClick={() => {
              const next = !isNotificationsOpen;
              setIsNotificationsOpen(next);
              if (next) {
                fetchRecentNotifications();
              } else {
                fetchUnreadCount();
              }
            }}
          >
            <svg
              stroke="currentColor"
              fill="none"
              strokeWidth={3}
              viewBox="0 0 24 24"
              strokeLinecap="round"
              strokeLinejoin="round"
              height="1.7em"
              width="1.7em"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            {unreadCount > 0 && (
              <span className={styles['notification-badge']}>{unreadCount}</span>
            )}
          </div>

          {isNotificationsOpen && (
            <div className={styles['notifications-dropdown']}>
              <div className={styles['notifications-header']}>
                <h3>Notifications ({unreadCount} non lues)</h3>
                {unreadCount > 0 && (
                  <button
                    className={styles['mark-all-read']}
                    onClick={markAllAsRead}
                  >
                    Tout marquer comme lu
                  </button>
                )}
              </div>

              <div className={styles['notifications-list']}>
                {isNotificationsLoading ? (
                  <div className={styles['no-notifications']}>
                    <p>Chargement...</p>
                  </div>
                ) : notifications?.length === 0 ? (
                  <div className={styles['no-notifications']}>
                    <p>Aucune notification</p>
                  </div>
                ) : (
                  notifications?.map((notification) => (
                    <div
                      key={notification.id}
                      className={`${styles['notification-item']} ${
                        !notification.isRead ? styles['unread'] : ''
                      } ${
                        navigatingNotificationId === notification.id ? styles['navigating'] : ''
                      }`}
                      onClick={() => void handleNotificationClick(notification)}
                    >
                      <div className={styles['notification-symbol']}>
                        {getNotificationSymbol(notification)}
                      </div>
                      <div className={styles['notification-content']}>
                        <h4>{notification.title}</h4>
                        <p>{notification.message}</p>
                        <span className={styles['notification-time']}>
                          {formatRelativeDate(notification.createdAt)}
                        </span>
                      </div>
                      {!notification.isRead && (
                        <div className={styles['unread-dot']}></div>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className={styles['notifications-footer']}>
                <Link
                  href="/notification"
                  className={styles['see-all-link']}
                  onClick={() => setIsNotificationsOpen(false)}
                >
                  Voir toutes les notifications
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className={styles['profile-dropdown']} ref={dropdownRef}>
          <button
            className={styles['profile-button']}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-expanded={isDropdownOpen}
            aria-haspopup="menu"
          >
            <div className={styles['user-avatar']}>
              <span className={styles['avatar-initials']}>{initials}</span>
            </div>
            <div className={styles['user-info']}>
              <span className={styles['user-name']}>{displayUsername}</span>
              <span className={styles['user-email']}>{displayEmail}</span>
            </div>
            <FiChevronDown
              className={`${styles['dropdown-arrow']} ${
                isDropdownOpen ? styles['open'] : ''
              }`}
            />
          </button>

          {isDropdownOpen && (
            <div className={styles['dropdown-menu']} role="menu">
              <Link
                href="/investisseur/InvestorDashboard"
                className={styles['dropdown-item']}
                onClick={() => setIsDropdownOpen(false)}
              >
                <LayoutDashboard className={styles['dropdown-icon']} size={18} />
                <span>Tableau de bord</span>
              </Link>

              <Link
                href="/notification"
                className={styles['dropdown-item']}
                onClick={() => setIsDropdownOpen(false)}
              >
                <span className={styles['dropdown-icon']} aria-hidden="true">N</span>
                <span>Notifications</span>
              </Link>

              <Link
                href="/investisseur/profil"
                className={styles['dropdown-item']}
                onClick={() => setIsDropdownOpen(false)}
              >
                <User className={styles['dropdown-icon']} size={18} />
                <span>Mon profil</span>
              </Link>

              <Link
                href="/investisseur/parametres"
                className={styles['dropdown-item']}
                onClick={() => setIsDropdownOpen(false)}
              >
                <Settings className={styles['dropdown-icon']} size={18} />
                <span>Parametres</span>
              </Link>

              <button
                onClick={handleLogout}
                className={`${styles['dropdown-item']} ${styles['logout']}`}
              >
                <LogOut className={styles['dropdown-icon']} size={18} />
                <span>Deconnexion</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

