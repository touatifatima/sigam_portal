import React, { useEffect, useMemo } from 'react';  ///public carte page, accessible sans login, avec un lien vers experience builder et un iframe pour afficher la carte
import Link from 'next/link';
import { useAuthStore } from '@/src/store/useAuthStore';
import {
  getDefaultDashboardPath,
  isAdminRole,
  isCadastreRole,
  isOperateurRole,
} from '@/src/utils/roleNavigation';
import styles from './carte_public.module.css';

const EXPERIENCE_BUILDER_URL =
  'https://sig.anam.dz/portal/apps/experiencebuilder/experience?id=fc56f54b45264df2a5f4e07fd2462664';

const EXPERIENCE_BUILDER_EDIT_URL =
  'https://sig.anam.dz/portal/apps/experiencebuilder/builder/?id=fc56f54b45264df2a5f4e07fd2462664&views=page';

function normalizeRole(role?: string | null): string {
  return String(role ?? '').toLowerCase();
}

function getDisplayName(auth: {
  Prenom?: string | null;
  nom?: string | null;
  username?: string | null;
  email?: string | null;
}): string {
  const fullName = [auth.Prenom, auth.nom].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (auth.username) return auth.username;
  if (auth.email) return auth.email;
  return 'Utilisateur';
}

export default function CartePublicPage() {
  const { auth, isLoaded, initialize, hasPermission } = useAuthStore();

  useEffect(() => {
    if (!isLoaded) {
      void initialize();
    }
  }, [isLoaded, initialize]);

  const role = normalizeRole(auth.role);
  const isConnected = Boolean(auth.id || auth.email || auth.username || auth.role);
  const isAdmin = isAdminRole(role) || hasPermission('Admin-Panel');
  const isOperateur = isOperateurRole(role);
  const isCadastre = isCadastreRole(role);

  const userLabel = useMemo(() => getDisplayName(auth), [auth]);

  const listHref = isCadastre
    ? '/investisseur/interactive'
    : isOperateur || isAdmin
      ? '/operateur/permisdashboard/mes-permis'
      : '/investisseur/demandes';
  const listLabel = isCadastre
    ? 'Verification prealable'
    : isOperateur || isAdmin
      ? 'Mes permis'
      : 'Mes demandes';

  const spaceHref = isOperateur
    ? '/operateur/permisdashboard/mes-permis'
    : getDefaultDashboardPath(role);

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Carte publique des permis</h1>
          <p className={styles.subtitle}>
            Consultation publique via Experience Builder
          </p>
        </div>

        <div className={styles.actions}>
          {isConnected ? (
            <span className={styles.connectedBadge}>Connecte en tant que {userLabel}</span>
          ) : (
            <span className={styles.publicBadge}>Acces public sans login</span>
          )}

          {isConnected && (
            <>
              <Link href={listHref} className={styles.linkBtn}>
                {listLabel}
              </Link>
              <Link href={spaceHref} className={styles.linkBtnSecondary}>
                Mon espace
              </Link>
            </>
          )}

          {isAdmin && (
            <a
              href={EXPERIENCE_BUILDER_EDIT_URL}
              target="_blank"
              rel="noreferrer"
              className={styles.editBtn}
            >
              Modifier la carte
            </a>
          )}

          <a
            href={EXPERIENCE_BUILDER_URL}
            target="_blank"
            rel="noreferrer"
            className={styles.openBtn}
          >
            Ouvrir en direct
          </a>
        </div>
      </header>

      <main className={styles.main}>
        <iframe
          src={EXPERIENCE_BUILDER_URL}
          title="Experience Builder - Carte publique des permis"
          className={styles.iframe}
          allowFullScreen
        />
      </main>
    </div>
  );
}
