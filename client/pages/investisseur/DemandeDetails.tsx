'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { useAuthStore } from '@/src/store/useAuthStore';
import styles from './DemandeDetails.module.css';

interface Demande {
  code: string;
  typePermis: string;
  entreprise: string;
  statut: string;
  dateDepot: string;
  wilaya: string;
  commune: string;
  lieuDit: string;
  superficie: string;
  progression: number;
}

interface HistoriqueItem {
  date: string;
  etape: string;
  statut: string;
  description: string;
}

interface Document {
  nom: string;
  statut: string;
  date: string;
  url?: string;
}

interface Paiement {
  libelle: string;
  montant: string;
  statut: string;
  date: string;
}

const DemandeDetails = () => {
  const router = useRouter();
  const { code } = router.query;
  const { auth, isLoaded } = useAuthStore();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const [activeTab, setActiveTab] = useState('general');
  const [demande, setDemande] = useState<Demande | null>(null);
  const [historique, setHistorique] = useState<HistoriqueItem[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Vérifier l'authentification
  useEffect(() => {
    if (isLoaded && !auth?.email) {
      router.push('/');
    }
  }, [isLoaded, auth, router]);

  // Charger les détails de la demande
  useEffect(() => {
    const fetchDemandeDetails = async () => {
      if (!code || !auth?.email) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await axios.get(`${apiURL}/investisseur/demandes/${code}`, {
          withCredentials: true,
        });

        setDemande(response.data.demande);
        setHistorique(response.data.historique || []);
        setDocuments(response.data.documents || []);
        setPaiements(response.data.paiements || []);
      } catch (err: any) {
        console.error('Erreur chargement demande:', err);
        setError('Impossible de charger les détails de la demande');

        // Données de test
        setDemande({
          code: code as string,
          typePermis: "Permis d'exploration",
          entreprise: 'SARL Mines du Sud',
          statut: 'EN_COURS',
          dateDepot: '2025-11-12',
          wilaya: 'Tlemcen',
          commune: 'Chetouane',
          lieuDit: 'Oued Zitoun',
          superficie: '150 ha',
          progression: 45,
        });

        setHistorique([
          { date: '2025-11-12', etape: 'Dépôt de la demande', statut: 'Complété', description: 'Demande enregistrée avec succès' },
          { date: '2025-11-13', etape: 'Vérification administrative', statut: 'Complété', description: 'Documents vérifiés' },
          { date: '2025-11-15', etape: 'Instruction technique', statut: 'En cours', description: 'Analyse géologique en cours' },
          { date: '-', etape: 'Avis de la wilaya', statut: 'En attente', description: 'Demande envoyée au wali' },
          { date: '-', etape: 'Décision du comité', statut: 'En attente', description: 'Passage en comité de direction' },
        ]);

        setDocuments([
          { nom: 'Registre de commerce', statut: 'Validé', date: '2025-11-12' },
          { nom: 'Statuts de la société', statut: 'Validé', date: '2025-11-12' },
          { nom: 'Étude géologique', statut: 'En révision', date: '2025-11-12' },
        ]);

        setPaiements([
          { libelle: 'Frais de dépôt', montant: '15 000 DZD', statut: 'Payé', date: '2025-11-12' },
          { libelle: 'Taxe superficiaire', montant: '45 000 DZD', statut: 'En attente', date: '-' },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDemandeDetails();
  }, [code, auth, apiURL]);

  const getStatutBadge = (statut: string) => {
    const config: Record<string, { className: string; label: string; icon: string }> = {
      EN_COURS: { className: styles.badgeWarning, label: 'En cours', icon: '⏱️' },
      ACCEPTEE: { className: styles.badgeSuccess, label: 'Acceptée', icon: '✓' },
      REJETEE: { className: styles.badgeError, label: 'Rejetée', icon: '✗' },
      EN_ATTENTE: { className: styles.badgeInfo, label: 'En attente', icon: '⏸️' },
      VALIDEE: { className: styles.badgeSuccess, label: 'Validée', icon: '✓' },
      Complété: { className: styles.badgeSuccess, label: 'Complété', icon: '✓' },
      'En cours': { className: styles.badgeWarning, label: 'En cours', icon: '⏱️' },
      'En attente': { className: styles.badgeInfo, label: 'En attente', icon: '⏸️' },
      Validé: { className: styles.badgeSuccess, label: 'Validé', icon: '✓' },
      'En révision': { className: styles.badgeWarning, label: 'En révision', icon: '📝' },
      Payé: { className: styles.badgeSuccess, label: 'Payé', icon: '✓' },
    };
    const { className, label, icon } = config[statut] || config.EN_ATTENTE;
    return (
      <span className={`${styles.badge} ${className}`}>
        <span className={styles.badgeIcon}>{icon}</span>
        {label}
      </span>
    );
  };

  const handleDownloadDocument = async (docName: string) => {
    try {
      const response = await axios.get(
        `${apiURL}/investisseur/demandes/${code}/documents/${docName}`,
        {
          withCredentials: true,
          responseType: 'blob',
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', docName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Erreur téléchargement:', err);
      alert('Impossible de télécharger le document');
    }
  };

  const formatDate = (dateString: string) => {
    if (dateString === '-') return '-';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
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

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>Chargement des détails...</p>
      </div>
    );
  }

  if (error || !demande) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>⚠️</div>
        <p className={styles.errorText}>{error || 'Demande introuvable'}</p>
        <button
          className={styles.backButton}
          onClick={() => router.push('/investisseur/demandes')}
        >
          Retour à la liste
        </button>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        {/* HEADER */}
        <div className={styles.header}>
          <button
            className={styles.backBtn}
            onClick={() => router.push('/investisseur/demandes')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className={styles.headerContent}>
            <h1 className={styles.pageTitle}>{demande.code}</h1>
            <p className={styles.pageSubtitle}>{demande.typePermis}</p>
          </div>
          {getStatutBadge(demande.statut)}
        </div>

        {/* PROGRESS CARD */}
        <div className={styles.progressCard}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>Progression du dossier</span>
            <span className={styles.progressValue}>{demande.progression}%</span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${demande.progression}%` }}
            />
          </div>
          <p className={styles.progressText}>
            {historique.find(h => h.statut === 'En cours')?.etape || 'Instruction en cours'}
          </p>
        </div>

        {/* TABS */}
        <div className={styles.tabsContainer}>
          <div className={styles.tabsList}>
            <button
              className={`${styles.tab} ${activeTab === 'general' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Général
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'documents' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('documents')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <polyline points="13 2 13 9 20 9" />
              </svg>
              Documents
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'paiements' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('paiements')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              Paiements
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'historique' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('historique')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Historique
            </button>
          </div>

          {/* TAB CONTENT */}
          <div className={styles.tabContent}>
            {/* GENERAL */}
            {activeTab === 'general' && (
              <div className={styles.tabPane}>
                <div className={styles.infoCard}>
                  <h3 className={styles.cardTitle}>Informations générales</h3>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Entreprise</span>
                      <span className={styles.infoValue}>{demande.entreprise}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Date de dépôt</span>
                      <span className={styles.infoValue}>{formatDate(demande.dateDepot)}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Wilaya</span>
                      <span className={styles.infoValue}>{demande.wilaya}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Commune</span>
                      <span className={styles.infoValue}>{demande.commune}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Lieu-dit</span>
                      <span className={styles.infoValue}>{demande.lieuDit}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Superficie</span>
                      <span className={styles.infoValue}>{demande.superficie}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.mapCard}>
                  <h3 className={styles.cardTitle}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    Localisation
                  </h3>
                  <div className={styles.mapPlaceholder}>
                    <div className={styles.mapIcon}>🗺️</div>
                    <p>Carte interactive (à intégrer)</p>
                  </div>
                </div>
              </div>
            )}

            {/* DOCUMENTS */}
            {activeTab === 'documents' && (
              <div className={styles.tabPane}>
                <div className={styles.documentsCard}>
                  <h3 className={styles.cardTitle}>Documents du dossier</h3>
                  <p className={styles.cardDescription}>Liste des documents soumis</p>
                  <div className={styles.documentsList}>
                    {documents.map((doc, index) => (
                      <div key={index} className={styles.documentItem} style={{ animationDelay: `${index * 0.1}s` }}>
                        <div className={styles.documentInfo}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <div>
                            <p className={styles.documentName}>{doc.nom}</p>
                            <p className={styles.documentDate}>
                              Téléversé le {formatDate(doc.date)}
                            </p>
                          </div>
                        </div>
                        <div className={styles.documentActions}>
                          {getStatutBadge(doc.statut)}
                          <button
                            className={styles.downloadBtn}
                            onClick={() => handleDownloadDocument(doc.nom)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PAIEMENTS */}
            {activeTab === 'paiements' && (
              <div className={styles.tabPane}>
                <div className={styles.paiementsCard}>
                  <h3 className={styles.cardTitle}>Paiements</h3>
                  <p className={styles.cardDescription}>
                    Historique des paiements liés à cette demande
                  </p>
                  <div className={styles.paiementsList}>
                    {paiements.map((paiement, index) => (
                      <div key={index} className={styles.paiementItem} style={{ animationDelay: `${index * 0.1}s` }}>
                        <div className={styles.paiementInfo}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                            <line x1="1" y1="10" x2="23" y2="10" />
                          </svg>
                          <div>
                            <p className={styles.paiementLabel}>{paiement.libelle}</p>
                            {paiement.date !== '-' && (
                              <p className={styles.paiementDate}>
                                Payé le {formatDate(paiement.date)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className={styles.paiementActions}>
                          <p className={styles.paiementMontant}>{paiement.montant}</p>
                          {getStatutBadge(paiement.statut)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* HISTORIQUE */}
            {activeTab === 'historique' && (
              <div className={styles.tabPane}>
                <div className={styles.historiqueCard}>
                  <h3 className={styles.cardTitle}>Historique des étapes</h3>
                  <p className={styles.cardDescription}>Suivi chronologique du traitement</p>
                  <div className={styles.timeline}>
                    <div className={styles.timelineLine} />
                    {historique.map((item, index) => (
                      <div
                        key={index}
                        className={styles.timelineItem}
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className={`${styles.timelineDot} ${
                          item.statut === 'Complété' ? styles.timelineDotCompleted :
                          item.statut === 'En cours' ? styles.timelineDotActive :
                          styles.timelineDotPending
                        }`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        </div>
                        <div className={styles.timelineContent}>
                          <div className={styles.timelineHeader}>
                            <h4 className={styles.timelineTitle}>{item.etape}</h4>
                            {getStatutBadge(item.statut)}
                          </div>
                          <p className={styles.timelineDescription}>{item.description}</p>
                          {item.date !== '-' && (
                            <p className={styles.timelineDate}>{formatDate(item.date)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemandeDetails;