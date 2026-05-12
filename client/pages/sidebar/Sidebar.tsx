'use client';

import { useState } from 'react';
import { useAuthStore } from '../../src/store/useAuthStore';
import {
  FiFile,
  FiMap,
  FiSettings,
  FiUsers,
  FiChevronRight,
  FiLogOut,
  FiChevronLeft,
  FiActivity,
  FiBriefcase,
  FiClipboard,
  FiFileText,
  FiLayers,
  FiLock,
  FiShield,
  FiChevronDown,
  FiBell,
  FiTool,
  FiCamera,
  FiMenu,
} from 'react-icons/fi';
import styles from './sidebar.module.css';
import type { ViewType } from '../../src/types/viewtype';

interface MenuItemBase {
  id: ViewType;
  icon: React.ReactNode;
  label: string;
  permission: string;
}

interface MenuItemWithSubItems extends MenuItemBase {
  subItems: MenuItemBase[];
}

type MenuItem = MenuItemBase | MenuItemWithSubItems;

function hasSubItems(item: MenuItem): item is MenuItemWithSubItems {
  return 'subItems' in item;
}

interface SidebarProps {
  currentView: ViewType;
  navigateTo: (view: ViewType) => void;
}

export default function Sidebar({ currentView, navigateTo }: SidebarProps) {
  const { auth, logout, hasPermission, isLoaded } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [hoveredMenu, setHoveredMenu] = useState<ViewType | null>(null);
  const isCadastreStyledView = currentView === 'demande-interactive';

  const rawRoles = Array.isArray(auth?.role) ? auth.role : [auth?.role ?? ''];
  const roleTokens = rawRoles
    .flatMap((role) => String(role ?? '').split(','))
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);

  const isAdminRole = roleTokens.some(
    (role) => role === 'admin' || role === 'administrateur',
  );

  if (!isLoaded) {
    return (
      <aside className={styles.sidebarLoading}>
        <div className={styles.loadingSpinner}></div>
      </aside>
    );
  }

  if (!isAdminRole) {
    return null;
  }

  const menuItems: MenuItem[] = [
    { id: 'dashboard', icon: <FiActivity />, label: 'Tableau de bord', permission: 'dashboard' },
    { id: 'nouvelle-demande', icon: <FiFileText />, label: 'Nouvelle demande', permission: 'create_demande' },
    { id: 'gestion-permis', icon: <FiLayers />, label: 'Gestion des permis', permission: 'manage_permits' },
    { id: 'instruction-cadastrale', icon: <FiMap />, label: 'Instruction cadastrale', permission: 'view_cadastre' },
    { id: 'demande-interactive', icon: <FiFileText />, label: 'Verification prealable', permission: 'create_demande' },
    { id: 'generateur-permis', icon: <FiBriefcase />, label: 'Generateur permis', permission: 'generate_permits' },
    { id: 'parametres', icon: <FiSettings />, label: 'Parametres', permission: 'manage_settings' },
    {
      id: 'Admin-Panel',
      icon: <FiLock />,
      label: 'Admin Panel',
      permission: 'Admin-Panel',
      subItems: [
        { id: 'manage_demandes', icon: <FiClipboard />, label: 'Gestion Demandes', permission: 'Admin-Panel' },
        { id: 'manage_notifications', icon: <FiBell />, label: 'Gestion Notifications', permission: 'Admin-Panel' },
        { id: 'manage_actualites', icon: <FiFileText />, label: 'Gestion Actualites', permission: 'Admin-Panel' },
        { id: 'manage_static_pages', icon: <FiFileText />, label: 'Pages Statiques', permission: 'Admin-Panel' },
        { id: 'manage_navbar', icon: <FiMenu />, label: 'Configuration Navbar', permission: 'Admin-Panel' },
        { id: 'manage_identifications', icon: <FiShield />, label: 'Identifications Entreprises', permission: 'Admin-Panel' },
        { id: 'manage_declarations', icon: <FiFileText />, label: 'Declarations', permission: 'Admin-Panel' },
        { id: 'Configurations', icon: <FiSettings />, label: 'Configurations', permission: 'Admin-Panel' },
        { id: 'manage_users', icon: <FiUsers />, label: 'Manage Users', permission: 'manage_users' },
        { id: 'manage_documents', icon: <FiFile />, label: 'Manage Documents', permission: 'manage_documents' },
      ],
    },
    { id: 'operateur_nvl_demande', icon: <FiFileText />, label: 'Nouvelle Demande', permission: 'operateur' },
    {
      id: 'outils',
      icon: <FiTool />,
      label: 'Outils',
      permission: 'dashboard',
      subItems: [
        { id: 'convertisseur', icon: <FiMap />, label: 'Convertisseur', permission: 'dashboard' },
        { id: 'operateur_scan_qr', icon: <FiCamera />, label: 'Acces QR Operateur', permission: 'scan-qr' },
        { id: 'procedures', icon: <FiClipboard />, label: 'Procedures', permission: 'view_procedures' },
        { id: 'Permis', icon: <FiFileText />, label: 'Permis lists', permission: 'dashboard' },
      ],
    },
  ];

  const toggleSidebar = () => {
    setIsCollapsed((prev) => !prev);
  };

  const handleNavigate = (view: ViewType) => {
    navigateTo(view);
    setIsMobileOpen(false);
    setHoveredMenu(null);
  };

  const toggleSubMenu = (view: ViewType) => {
    setHoveredMenu((prev) => (prev === view ? null : view));
  };

  return (
    <>
      <button
        className={`${styles.sidebarMobileToggle} ${
          isCadastreStyledView ? styles.sidebarMobileToggleCadastre : ''
        }`}
        onClick={() => setIsMobileOpen((prev) => !prev)}
        aria-label={isMobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
      >
        {isMobileOpen ? <FiChevronLeft /> : <FiChevronRight />}
      </button>

      {isMobileOpen && (
        <button
          className={styles.sidebarBackdrop}
          onClick={() => setIsMobileOpen(false)}
          aria-label="Fermer le menu"
        />
      )}

      <aside
        className={`${styles.sidebar} ${
          isCadastreStyledView ? styles.sidebarCadastre : ''
        } ${isCollapsed ? styles.collapsed : ''} ${
          isMobileOpen ? styles.open : ''
        }`}
      >
        <button className={styles.sidebarToggle} onClick={toggleSidebar}>
          {isCollapsed ? <FiChevronRight /> : <FiChevronLeft />}
        </button>

        <nav className={styles.sidebarNav}>
          <ul className={styles.navMenu}>
            {menuItems.map((item) =>
              hasPermission(item.permission) ? (
                <li
                  key={item.id}
                  className={styles.navItem}
                  onMouseEnter={() => hasSubItems(item) && setHoveredMenu(item.id)}
                  onMouseLeave={() => setHoveredMenu(null)}
                >
                  <button
                    className={`${styles.navLink} ${currentView === item.id ? styles.active : ''}`}
                    onClick={() => {
                      if (hasSubItems(item)) {
                        toggleSubMenu(item.id);
                        return;
                      }
                      handleNavigate(item.id);
                    }}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <span className={styles.navIcon}>{item.icon}</span>
                    {!isCollapsed && (
                      <>
                        <span className={styles.navLabel}>{item.label}</span>
                        {hasSubItems(item) && (
                          <span className={styles.navArrow}>
                            <FiChevronDown />
                          </span>
                        )}
                      </>
                    )}
                  </button>

                  {!isCollapsed && hasSubItems(item) && (
                    <ul className={`${styles.subMenu} ${hoveredMenu === item.id ? styles.visible : ''}`}>
                      {item.subItems.map((subItem) =>
                        hasPermission(subItem.permission) ? (
                          <li
                            key={subItem.id}
                            className={styles.subItem}
                            onMouseEnter={() => setHoveredMenu(item.id)}
                          >
                            <button
                              className={`${styles.subLink} ${currentView === subItem.id ? styles.active : ''}`}
                              onClick={() => handleNavigate(subItem.id)}
                            >
                              <span className={styles.subIcon}>{subItem.icon}</span>
                              <span className={styles.subLabel}>{subItem.label}</span>
                            </button>
                          </li>
                        ) : null,
                      )}
                    </ul>
                  )}
                </li>
              ) : null,
            )}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          {!isCollapsed && (
            <div className={styles.userProfile}>
              <div className={styles.avatar}>
                {String(auth.role || '')
                  .split(' ')
                  .map((w) => w[0] ?? '')
                  .join('')
                  .toUpperCase()}
              </div>
              <div className={styles.userInfo}>
                <span className={styles.userRole}>{auth.role || 'Utilisateur'}</span>
                <span className={styles.userStatus}>En ligne</span>
              </div>
            </div>
          )}
          <button
            className={styles.logoutBtn}
            onClick={async () => {
              setIsMobileOpen(false);
              await logout();
            }}
            title={isCollapsed ? 'Deconnexion' : undefined}
          >
            <FiLogOut />
            {!isCollapsed && <span>Deconnexion</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

