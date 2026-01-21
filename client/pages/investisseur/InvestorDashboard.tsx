'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { useAuthStore } from '@/src/store/useAuthStore';
import styles from './InvestorDashboard.module.css';

interface DemandeStat {
  code: string;
  typePermis: string;
  dateDepot: string;
  statut: string;
}

interface Stats {
  totalDemandes: number;
  demandesEnAttente: number;
  permisActifs: number;
  paiementsEnAttente: number;
}

const InvestorDashboard = () => {
  const router = useRouter();
  const { auth, logout, isLoaded } = useAuthStore();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const [stats, setStats] = useState<Stats>({
    totalDemandes: 0,
    demandesEnAttente: 0,
    permisActifs: 0,
    paiementsEnAttente: 0,
  });

  const [recentDemandes, setRecentDemandes] = useState<DemandeStat[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingDemandes, setIsLoadingDemandes] = useState(true);

  // Vérifier si l'utilisateur est connecté
  useEffect(() => {
    if (isLoaded && !auth?.email) {
      router.push('/');
    }
  }, [isLoaded, auth, router]);

  // Charger les statistiques
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoadingStats(true);
        const response = await axios.get(`${apiURL}/investisseur/stats`, {
          withCredentials: true,
        });
        setStats(response.data);
      } catch (error) {
        console.error('Erreur chargement statistiques:', error);
        // Données de test en cas d'erreur
        setStats({
          totalDemandes: 12,
          demandesEnAttente: 3,
          permisActifs: 5,
          paiementsEnAttente: 2,
        });
      } finally {
        setIsLoadingStats(false);
      }
    };

    if (auth?.email) {
      fetchStats();
    }
  }, [auth, apiURL]);

  // Charger les demandes récentes
  useEffect(() => {
    const fetchRecentDemandes = async () => {
      try {
        setIsLoadingDemandes(true);
        const response = await axios.get(`${apiURL}/investisseur/demandes/recent`, {
          withCredentials: true,
          params: { limit: 5 },
        });
        setRecentDemandes(response.data);
      } catch (error) {
        console.error('Erreur chargement demandes:', error);
        // Données de test en cas d'erreur
        setRecentDemandes([
          { code: 'DMD-2025-0042', typePermis: 'Exploration', dateDepot: '2025-11-12', statut: 'EN_COURS' },
          { code: 'DMD-2025-0038', typePermis: 'Prospection', dateDepot: '2025-10-28', statut: 'ACCEPTEE' },
          { code: 'DMD-2025-0031', typePermis: 'Exploitation', dateDepot: '2025-10-15', statut: 'EN_COURS' },
        ]);
      } finally {
        setIsLoadingDemandes(false);
      }
    };

    if (auth?.email) {
      fetchRecentDemandes();
    }
  }, [auth, apiURL]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const getStatutBadge = (statut: string) => {
    const config: Record<string, { className: string; label: string; icon: string }> = {
      EN_COURS: { className: styles.badgeWarning, label: 'En cours', icon: '⏱️' },
      ACCEPTEE: { className: styles.badgeSuccess, label: 'Acceptée', icon: '✓' },
      REJETEE: { className: styles.badgeError, label: 'Rejetée', icon: '✗' },
      EN_ATTENTE: { className: styles.badgeInfo, label: 'En attente', icon: '⏸️' },
    };
    const { className, label, icon } = config[statut] || config.EN_ATTENTE;
    return (
      <span className={`${styles.badge} ${className}`}>
        <span className={styles.badgeIcon}>{icon}</span>
        {label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (!isLoaded || !auth?.email) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.logo}>
              <span className={styles.logoIcon}>⛏️</span>
              <span className={styles.logoText}>GUNAM Portail</span>
            </div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{auth.username || auth.email}</span>
              <span className={styles.userRole}>{auth.role || 'Investisseur'}</span>
            </div>
            <button className={styles.logoutButton} onClick={handleLogout}>
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className={styles.mainContent}>
        <div className={styles.contentWrapper}>
          {/* WELCOME SECTION */}
          <div className={styles.welcomeSection}>
            <div>
              <h1 className={styles.pageTitle}>Tableau de bord</h1>
              <p className={styles.pageSubtitle}>
                Bienvenue, {auth.username || auth.email}
              </p>
            </div>
            <button
              className={styles.newDemandeButton}
              onClick={() => router.push('/investisseur/nouvelle_demande/step1_typepermis/page1_typepermis')}
            >
              <span className={styles.buttonIcon}>+</span>
              Nouvelle demande
            </button>
          </div>

          {/* STATISTICS CARDS */}
          <div className={styles.statsGrid}>
            <div className={`${styles.statCard} ${styles.statCard1}`}>
              <div className={styles.statIcon}>📋</div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>Total Demandes</div>
                {isLoadingStats ? (
                  <div className={styles.statSkeleton} />
                ) : (
                  <div className={styles.statValue}>{stats.totalDemandes}</div>
                )}
              </div>
            </div>

            <div className={`${styles.statCard} ${styles.statCard2}`}>
              <div className={styles.statIcon}>⏱️</div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>En attente</div>
                {isLoadingStats ? (
                  <div className={styles.statSkeleton} />
                ) : (
                  <div className={styles.statValue}>{stats.demandesEnAttente}</div>
                )}
              </div>
            </div>

            <div className={`${styles.statCard} ${styles.statCard3}`}>
              <div className={styles.statIcon}>✓</div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>Permis actifs</div>
                {isLoadingStats ? (
                  <div className={styles.statSkeleton} />
                ) : (
                  <div className={styles.statValue}>{stats.permisActifs}</div>
                )}
              </div>
            </div>

            <div className={`${styles.statCard} ${styles.statCard4}`}>
              <div className={styles.statIcon}>💳</div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>Paiements en attente</div>
                {isLoadingStats ? (
                  <div className={styles.statSkeleton} />
                ) : (
                  <div className={styles.statValue}>{stats.paiementsEnAttente}</div>
                )}
              </div>
            </div>
          </div>

          {/* RECENT DEMANDES TABLE */}
          <div className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <div>
                <h2 className={styles.tableTitle}>Dernières demandes</h2>
                <p className={styles.tableDescription}>
                  Vue d'ensemble de vos demandes récentes
                </p>
              </div>
              <button
                className={styles.viewAllButton}
                onClick={() => router.push('/investisseur/demandes')}
              >
                Voir tout
              </button>
            </div>

            <div className={styles.tableContainer}>
              {isLoadingDemandes ? (
                <div className={styles.tableLoading}>
                  <div className={styles.spinner} />
                  <p>Chargement des demandes...</p>
                </div>
              ) : recentDemandes.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📭</div>
                  <p className={styles.emptyText}>Aucune demande pour le moment</p>
                  <button
                    className={styles.emptyButton}
                    onClick={() => router.push('/investisseur/nouvelle_demande')}
                  >
                    Créer une demande
                  </button>
                </div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Code demande</th>
                      <th>Type de permis</th>
                      <th>Date de dépôt</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentDemandes.map((demande, index) => (
                      <tr
                        key={demande.code}
                        className={styles.tableRow}
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <td className={styles.codeCell}>{demande.code}</td>
                        <td>{demande.typePermis}</td>
                        <td>{formatDate(demande.dateDepot)}</td>
                        <td>{getStatutBadge(demande.statut)}</td>
                        <td>
                          <button
                            className={styles.viewButton}
                            onClick={() =>
                              router.push(`/investisseur/demandes/${demande.code}`)
                            }
                          >
                            <span className={styles.viewIcon}>👁️</span>
                            Voir détails
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* QUICK ACTIONS */}
          <div className={styles.quickActions}>
            <h2 className={styles.quickActionsTitle}>Accès rapide</h2>
            <div className={styles.actionsGrid}>
              <button
                className={styles.actionCard}
                onClick={() => router.push('/investisseur/entreprises')}
              >
                <div className={styles.actionIcon}>🏢</div>
                <div className={styles.actionLabel}>Mes Entreprises</div>
              </button>

              <button
                className={styles.actionCard}
                onClick={() => router.push('/investisseur/permis')}
              >
                <div className={styles.actionIcon}>📜</div>
                <div className={styles.actionLabel}>Mes Permis</div>
              </button>

              <button
                className={styles.actionCard}
                onClick={() => router.push('/investisseur/procedures')}
              >
                <div className={styles.actionIcon}>⚙️</div>
                <div className={styles.actionLabel}>Procédures</div>
              </button>

              <button
                className={styles.actionCard}
                onClick={() => router.push('/investisseur/paiements')}
              >
                <div className={styles.actionIcon}>💰</div>
                <div className={styles.actionLabel}>Paiements</div>
              </button>

              <button
                className={styles.actionCard}
                onClick={() => router.push('/investisseur/documents')}
              >
                <div className={styles.actionIcon}>📁</div>
                <div className={styles.actionLabel}>Documents</div>
              </button>

              <button
                className={styles.actionCard}
                onClick={() => router.push('/investisseur/notifications')}
              >
                <div className={styles.actionIcon}>🔔</div>
                <div className={styles.actionLabel}>Notifications</div>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InvestorDashboard;