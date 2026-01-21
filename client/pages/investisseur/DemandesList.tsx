'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { useAuthStore } from '@/src/store/useAuthStore';
import styles from './DemandesList.module.css';

interface Demande {
  code: string;
  typePermis: string;
  wilaya: string;
  statut: string;
  dateDepot: string;
  commune?: string;
  superficie?: number;
}

const DemandesList = () => {
  const router = useRouter();
  const { auth, isLoaded } = useAuthStore();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('tous');
  const [typeFilter, setTypeFilter] = useState('tous');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Vérifier l'authentification
  useEffect(() => {
    if (isLoaded && !auth?.email) {
      router.push('/');
    }
  }, [isLoaded, auth, router]);

  // Charger les demandes
  useEffect(() => {
    const fetchDemandes = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await axios.get(`${apiURL}/investisseur/demandes`, {
          withCredentials: true,
        });
        
        setDemandes(response.data);
      } catch (err: any) {
        console.error('Erreur chargement demandes:', err);
        setError('Impossible de charger les demandes');
        
        // Données de test en cas d'erreur
        setDemandes([
          { code: 'DMD-2025-0042', typePermis: 'Exploration', wilaya: 'Tlemcen', statut: 'EN_COURS', dateDepot: '2025-11-12', superficie: 150 },
          { code: 'DMD-2025-0038', typePermis: 'Prospection', wilaya: 'Oran', statut: 'ACCEPTEE', dateDepot: '2025-10-28', superficie: 200 },
          { code: 'DMD-2025-0031', typePermis: 'Exploitation', wilaya: 'Béchar', statut: 'EN_COURS', dateDepot: '2025-10-15', superficie: 300 },
          { code: 'DMD-2025-0027', typePermis: 'Exploration', wilaya: 'Tindouf', statut: 'REJETEE', dateDepot: '2025-09-30', superficie: 180 },
          { code: 'DMD-2025-0019', typePermis: 'Carrière', wilaya: 'Tlemcen', statut: 'ACCEPTEE', dateDepot: '2025-08-22', superficie: 50 },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    if (auth?.email) {
      fetchDemandes();
    }
  }, [auth, apiURL]);

  const getStatutBadge = (statut: string) => {
    const config: Record<string, { className: string; label: string; icon: string }> = {
      EN_COURS: { className: styles.badgeWarning, label: 'En cours', icon: '⏱️' },
      ACCEPTEE: { className: styles.badgeSuccess, label: 'Acceptée', icon: '✓' },
      REJETEE: { className: styles.badgeError, label: 'Rejetée', icon: '✗' },
      EN_ATTENTE: { className: styles.badgeInfo, label: 'En attente', icon: '⏸️' },
      VALIDEE: { className: styles.badgeSuccess, label: 'Validée', icon: '✓' },
    };
    const { className, label, icon } = config[statut] || config.EN_ATTENTE;
    return (
      <span className={`${styles.badge} ${className}`}>
        <span className={styles.badgeIcon}>{icon}</span>
        {label}
      </span>
    );
  };

  const filteredDemandes = demandes.filter(d => {
    const matchesSearch = d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         d.typePermis.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         d.wilaya.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'tous' || d.statut === statusFilter;
    const matchesType = typeFilter === 'tous' || d.typePermis === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleDownloadPDF = async (code: string) => {
    try {
      const response = await axios.get(`${apiURL}/investisseur/demandes/${code}/pdf`, {
        withCredentials: true,
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${code}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Erreur téléchargement PDF:', err);
      alert('Impossible de télécharger le PDF');
    }
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
    <div className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h1 className={styles.pageTitle}>Suivi des demandes</h1>
            <p className={styles.pageSubtitle}>
              Consultez l'historique et le statut de vos demandes
            </p>
          </div>
          <button
            className={styles.newDemandeButton}
            onClick={() => router.push('/investisseur/nouvelle_demande')}
          >
            <span className={styles.buttonIcon}>+</span>
            Nouvelle demande
          </button>
        </div>

        {/* STATISTICS SUMMARY */}
        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{demandes.length}</span>
            <span className={styles.statLabel}>Total</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={`${styles.statValue} ${styles.statWarning}`}>
              {demandes.filter(d => d.statut === 'EN_COURS').length}
            </span>
            <span className={styles.statLabel}>En cours</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={`${styles.statValue} ${styles.statSuccess}`}>
              {demandes.filter(d => d.statut === 'ACCEPTEE' || d.statut === 'VALIDEE').length}
            </span>
            <span className={styles.statLabel}>Acceptées</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={`${styles.statValue} ${styles.statError}`}>
              {demandes.filter(d => d.statut === 'REJETEE').length}
            </span>
            <span className={styles.statLabel}>Rejetées</span>
          </div>
        </div>

        {/* FILTERS CARD */}
        <div className={styles.filtersCard}>
          <div className={styles.filtersHeader}>
            <span className={styles.filtersIcon}>🔍</span>
            <h3 className={styles.filtersTitle}>Filtres</h3>
          </div>
          
          <div className={styles.filtersGrid}>
            {/* Search */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Rechercher</label>
              <div className={styles.searchWrapper}>
                <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Code, type ou wilaya..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Statut</label>
              <select
                className={styles.filterSelect}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="tous">Tous les statuts</option>
                <option value="EN_COURS">En cours</option>
                <option value="EN_ATTENTE">En attente</option>
                <option value="ACCEPTEE">Acceptée</option>
                <option value="VALIDEE">Validée</option>
                <option value="REJETEE">Rejetée</option>
              </select>
            </div>

            {/* Type Filter */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Type de permis</label>
              <select
                className={styles.filterSelect}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="tous">Tous les types</option>
                <option value="Prospection">Prospection</option>
                <option value="Exploration">Exploration</option>
                <option value="Exploitation">Exploitation</option>
                <option value="Carrière">Carrière</option>
              </select>
            </div>
          </div>
        </div>

        {/* TABLE CARD */}
        <div className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <div>
              <h2 className={styles.tableTitle}>Liste des demandes</h2>
              <p className={styles.tableDescription}>
                {filteredDemandes.length} demande(s) trouvée(s)
              </p>
            </div>
          </div>

          <div className={styles.tableContainer}>
            {isLoading ? (
              <div className={styles.tableLoading}>
                <div className={styles.spinner} />
                <p>Chargement des demandes...</p>
              </div>
            ) : error ? (
              <div className={styles.errorState}>
                <div className={styles.errorIcon}>⚠️</div>
                <p className={styles.errorText}>{error}</p>
                <button className={styles.retryButton} onClick={() => window.location.reload()}>
                  Réessayer
                </button>
              </div>
            ) : filteredDemandes.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📭</div>
                <p className={styles.emptyText}>
                  {searchTerm || statusFilter !== 'tous' || typeFilter !== 'tous'
                    ? 'Aucune demande ne correspond aux filtres'
                    : 'Aucune demande pour le moment'}
                </p>
                <button
                  className={styles.emptyButton}
                  onClick={() => router.push('/investisseur/nouvelle_demande')}
                >
                  Créer une demande
                </button>
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Type</th>
                      <th>Wilaya</th>
                      <th>Superficie</th>
                      <th>Date dépôt</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDemandes.map((demande, index) => (
                      <tr
                        key={demande.code}
                        className={styles.tableRow}
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <td className={styles.codeCell}>{demande.code}</td>
                        <td>{demande.typePermis}</td>
                        <td>{demande.wilaya}</td>
                        <td>{demande.superficie ? `${demande.superficie} ha` : '-'}</td>
                        <td>{formatDate(demande.dateDepot)}</td>
                        <td>{getStatutBadge(demande.statut)}</td>
                        <td>
                          <div className={styles.actionButtons}>
                            <button
                              className={styles.viewButton}
                              onClick={() => router.push(`/investisseur/demandes/${demande.code}`)}
                              title="Voir détails"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                            <button
                              className={styles.downloadButton}
                              onClick={() => handleDownloadPDF(demande.code)}
                              title="Télécharger PDF"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemandesList;