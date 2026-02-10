// pages/permis_dashboard/view/page.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styles from './PermisView.module.css';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Map as MapIcon,
  FileText, 
  Building2, 
  RefreshCw, 
  Edit2, 
  FileSearch, 
  XCircle, 
  ChevronRight, 
  Download,
  Upload,
  Eye,
  Plus,
  AlertTriangle,
  CheckCircle,
  Info,
  BarChart3,
  ChevronDown,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Copy,
  Filter,
  X,
  CreditCard,
  ChevronLeft,
  User,
  Lock
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { GetServerSideProps } from 'next';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useSearchParams } from '@/src/hooks/useSearchParams';
import axios from 'axios';
import * as XLSX from 'xlsx';
import NotificationBanner from '../../../components/NotificationBanner';
import router from 'next/router';
import {
  computePermisSuperficie,
  getPermisTitulaireName,
  getPermisSubstances,
  getPermisWilayaName,
  getPermisCommuneName,
  getPermisDairaName,
} from '@/utils/permisHelpers';
import { toast } from 'react-toastify';
import Navbar from '@/pages/navbar/Navbar';
import Sidebar from '@/pages/sidebar/Sidebar';
import { useViewNavigator } from '@/src/hooks/useViewNavigator';
import { useAuthReady } from '@/src/hooks/useAuthReady';
import { useAuthStore } from '@/src/store/useAuthStore';
import type { ArcGISMapRef, SigamLayerKey } from '@/components/arcgismap/ArcgisMap';

const OPTION_TYPE_MAP: Record<string, string> = {
  PPM: 'APM',
  PEM: 'TEM',
  PEC: 'TEC',
  PXM: 'TXM',
  PXC: 'TXC',
  ARM: 'AAM',
  ARC: 'AAC',
};

const ArcGISMap = dynamic(() => import('@/components/arcgismap/ArcgisMap'), { ssr: false });
const PREVIEW_LAYER_KEYS: SigamLayerKey[] = [
  'perimetresSig',
  'titres',
  'promotion',
  'exclusions',
  'wilayas',
  'communes',
  'villes',
  'pays',
];
const DEFAULT_UTM_ZONE = 31;

const normalizeSearchValue = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getLatestDemandeFromPermis = (permis: any) => {
  const procedures = Array.isArray(permis?.procedures) ? permis.procedures : [];
  const demandes = procedures.flatMap((proc: any) =>
    Array.isArray(proc?.demandes) ? proc.demandes : [],
  );
  if (!demandes.length) return null;
  const sorted = demandes.slice().sort((a: any, b: any) => {
    const dateA = a?.date_demande ? new Date(a.date_demande).getTime() : 0;
    const dateB = b?.date_demande ? new Date(b.date_demande).getTime() : 0;
    if (dateA !== dateB) return dateB - dateA;
    const idA = typeof a?.id_demande === 'number' ? a.id_demande : 0;
    const idB = typeof b?.id_demande === 'number' ? b.id_demande : 0;
    return idB - idA;
  });
  return sorted[0] ?? null;
};

interface DocumentCardProps {
  document: any;
  onView: (document: any) => void;
  onDownload: (document: any) => void;
}

interface ObligationFilters {
  status: string;
  type: string;
  year: string;
  minAmount: string;
  maxAmount: string;
}

interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}

interface RenewalInfo {
  id: number;
  num_decision: string;
  date_decision: Date | null;
  date_debut_validite: Date | null;
  date_fin_validite: Date | null;
  duree_renouvellement: number;
  commentaire: string;
  nombre_renouvellements?: number;
}

interface PermisDetails {
  id: number;
  code_permis: string;
  date_octroi: Date | null;
  date_expiration: Date | null;
  date_annulation: Date | null;
  date_renonciation: Date | null;
  createdAt?: Date | string | null;
  createdBy?: string | null;
  qr_inserer_par?: string | null;
  date_heure_systeme?: Date | string | null;
  superficie: number | null;
  nombre_renouvellements: number | null;
  id_detenteur?: number | null;
  id_statut?: number | null;
  id_antenne?: number | null;
  statut: {
    id?: number;
    lib_statut: string;
    color_code?: string;
  } | null;
  antenne?: {
    id_antenne: number;
    nom: string;
    localisation?: string | null;
  } | null;
  typePermis: {
    id?: number;
    lib_type: string;
    code_type: string;
    duree_renouv: number;
    nbr_renouv_max: number;
  };
  detenteur: {
    nom_societeFR: string;
    id_detenteur: number;
  } | null;
  procedures: Procedure[];
  renewals: RenewalInfo[];
  documents: Document[];
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

interface RegistreCommerceInfo {
  id: number;
  numero_rc?: string | null;
  date_enregistrement?: string | Date | null;
  capital_social?: number | null;
  nis?: string | null;
  nif?: string | null;
  adresse_legale?: string | null;
}

interface ActionnaireInfo {
  id: number;
  id_actionnaire?: number;
  id_personne?: number;
  nom?: string | null;
  prenom?: string | null;
  nomAR?: string | null;
  prenomAR?: string | null;
  nationalite?: string | null;
  id_nationalite?: number | null;
  qualification?: string | null;
  type_fonction?: string | null;
  numIdentite?: string | null;
  numero_carte?: string | null;
  taux?: number | null;
  id_pays?: number | null;
  paysLabel?: string | null;
  lieu_naissance?: string | null;
}

interface GeneralFormState {
  code_permis: string;
  id_typePermis: number | '';
  id_statut: number | '';
  id_antenne: number | '';
  id_detenteur: number | '';
  id_wilaya: number | '';
  id_daira: number | '';
  id_commune: number | '';
  superficie: string;
}

interface DateFormState {
  date_octroi: string;
  date_expiration: string;
  date_annulation: string;
  date_renonciation: string;
}

type RenewalPerimeterPoint = {
  x: number;
  y: number;
  z?: number | null;
  system?: string | null;
  zone?: number | null;
  hemisphere?: string | null;
};

type RenewalPerimeterInfo = {
  procedure?: { id_proc: number; num_proc?: string | null; statut_proc?: string | null };
  points: RenewalPerimeterPoint[];
  areaHa?: number | null;
};

interface TypePermisOption {
  id: number;
  lib_type: string;
  code_type: string;
}

interface StatutPermisOption {
  id: number;
  lib_statut: string;
}

interface AntenneOption {
  id_antenne: number;
  nom: string;
}

interface DetenteurOption {
  id_detenteur: number;
  nom_societeFR?: string | null;
  nom_societeAR?: string | null;
}

interface WilayaOption {
  id_wilaya: number;
  nom_wilayaFR?: string | null;
  nom_wilayaAR?: string | null;
  code_wilaya?: string | null;
}

interface DairaOption {
  id_daira: number;
  nom_dairaFR?: string | null;
  nom_dairaAR?: string | null;
  code_daira?: string | null;
  wilaya?: {
    id_wilaya?: number | null;
    nom_wilayaFR?: string | null;
    nom_wilayaAR?: string | null;
  } | null;
}

interface CommuneOption {
  id_commune: number;
  nom_communeFR?: string | null;
  nom_communeAR?: string | null;
  code_commune?: string | null;
  daira?: {
    id_daira?: number | null;
    nom_dairaFR?: string | null;
    nom_dairaAR?: string | null;
    wilaya?: {
      id_wilaya?: number | null;
      nom_wilayaFR?: string | null;
      nom_wilayaAR?: string | null;
    } | null;
  } | null;
}

interface SubstanceOption {
  id_sub: number;
  nom_subFR: string;
  nom_subAR?: string | null;
  categorie_sub?: string | null;
}

interface ChefDdmUser {
  id: number;
  nom?: string | null;
  Prenom?: string | null;
  username?: string | null;
  email?: string | null;
  role?: {
    name?: string | null;
  } | null;
}

export interface Document {
  id: number;
  nom: string;
  description: string;
  type: string;
  date_upload: Date | string;
  url: string;
  taille: number;
  status?: string;
  category?: string;
}

export interface ProcedureDocuments {
  id_proc: number;
  num_proc: string;
  statut_proc: string;
  documents: Document[];
  documentCount: number;
}


export interface AllDocuments {
  procedures: ProcedureDocuments[];
  totalCount: number;
}

interface Procedure {
  id_proc: number;
  num_proc: string;
  date_debut_proc: Date;
  date_fin_proc: Date | null;
  statut_proc: string;
  typeProcedureId?: number | null;
  id_typeProc?: number | null;
  typeProcedure?: {
    libelle?: string | null;
    code?: string | null;
    description?: string | null;
  } | null;
  demandes: {
    id_typeProc?: number | null;
    typeProcedure: {
      libelle: string;
      code: string;
      description?: string | null;
    } | null;
  }[];
  SubstanceAssocieeDemande: {
    priorite: string;
    substance: {
      id_sub: number;
      nom_subFR: string;
      nom_subAR: string;
      categorie_sub: string;
    };
  }[];
  ProcedureEtape: {
    id_etape: number;
    statut: string;
    date_debut: Date;
    date_fin: Date | null;
    etape: {
      lib_etape: string;
      ordre_etape: number;
    };
  }[];
  // Add coordinates to Procedure interface
  coordonnees: {
    id_procedureCoord: number;
    statut_coord: string;
    coordonnee: {
      id_coordonnees: number;
      point: string;
      x: number;
      y: number;
      z: number;
      system?: string | null;
      zone?: number | null;
      hemisphere?: string | null;
    };
  }[];
}

interface Obligation {
  id: number;
  typePaiement: {
    id: number;
    libelle: string;
    frequence: string;
  };
  amount: number;
  fiscalYear: number;
  dueDate: string;
  status: string;
  payments: Payment[];
  tsPaiements?: TsPaiement[];
  details_calcul?: string;
}

interface TypeProcedureSummary {
  id: number;
  libelle: string;
  code?: string | null;
  description?: string | null;
}

type ActionVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';

interface TypeProcedureAction {
  id: string | number;
  label: string;
  description?: string | null;
  variant: ActionVariant;
  disabled?: boolean;
  tooltip?: string;
  icon?: React.ReactNode;
  allowDuringProcedureInProgress?: boolean;
  onClick: () => void;
}

interface Payment {
  id: number;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  receiptNumber: string;
  status: string;
  proofUrl: string | null;
  currency: string;
}

interface TsPaiement {
  id_tsPaiement: number;
  datePerDebut: string;
  datePerFin: string;
  surfaceMin: number;
  surfaceMax: number;
}

interface CoordinatesDisplayProps {
  coordinates: {
    id_coordonnees: number;
    point: string;
    x: number;
    y: number;
    z: number;
    system?: string | null;
    zone?: number | null;
    hemisphere?: string | null;
  }[];
  procedureNumber: string;
}

interface StatsData {
  totalProcedures: number;
  completedProcedures: number;
  activeProcedures: number;
  renewalCount: number;
  daysUntilExpiry: number;
  validityStatus: string;
}

interface TransferDetenteur {
  role: 'CEDANT' | 'CESSIONNAIRE' | string;
  type_detenteur: 'ANCIEN' | 'NOUVEAU' | string;
  detenteur?: {
    id_detenteur: number;
    nom_societeFR?: string;
  } | null;
}

interface TransferEntry {
  id_transfert: number;
  date_transfert?: string | Date | null;
  motif_transfert?: string | null;
  transfertDetenteur?: TransferDetenteur[];
}

interface Props {
  permis?: PermisDetails | null;
  latestTransfer?: TransferEntry | null;
  error?: string | null;
}


function formatFileSize(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + units[i];
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-"; // or whatever placeholder you want
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

const LockBadge: React.FC<{ label?: string }> = ({ label = 'Verrouillé' }) => (
  <span
    className={styles.badge}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
    title={label}
  >
    <Lock size={12} />
    {label}
  </span>
);

// Document Viewer Component
const DocumentViewer: React.FC<{ 
  document: Document; 
  onClose: () => void; 
  onDownload: () => void;
}> = ({ document, onClose, onDownload }) => {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{document.nom}</h2>
          <button onClick={onClose} className={styles.modalCloseButton}>
            <XCircle size={20} />
          </button>
        </div>
        <div className={styles.documentViewerContent}>
          <div className={styles.documentPreview}>
            <FileText size={64} className={styles.documentIconLarge} />
            <p>Prévisualisation non disponible</p>
            <p className={styles.documentInfo}>Type: {document.type} • Taille: {formatFileSize(document.taille)}</p>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button onClick={onClose} className={styles.modalSecondaryButton}>
            Fermer
          </button>
          <button onClick={onDownload} className={styles.modalPrimaryButton}>
            <Download size={16} />
            Télécharger
          </button>
        </div>
      </div>
    </div>
  );
};

const CoordinatesDisplay: React.FC<CoordinatesDisplayProps> = ({ 
  coordinates, 
  procedureNumber 
}) => {
  const handleCopyCoordinates = useCallback((coord: any) => {
    const coordinatesText = `X: ${coord.x ?? 'N/A'}, Y: ${coord.y ?? 'N/A'}, Z: ${coord.z ?? 'N/A'}`;
    
    navigator.clipboard.writeText(coordinatesText)
      .then(() => {
        toast.success('Coordonnées copiées avec succés');
      })
      .catch((err) => {
        console.error('Erreur lors de la copie:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = coordinatesText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast.success('Coordonnées copiées avec succés');
      });
  }, []);

  const handleViewOnMap = useCallback((coord: any) => {
    if (coord.x === null || coord.y === null) {
      toast.error('Coordonnées X et Y sont requises pour afficher sur la carte');
      return;
    }

    // Open coordinates in OpenStreetMap
    const mapUrl = `https://www.openstreetmap.org/?mlat=${coord.y}&mlon=${coord.x}#map=15/${coord.y}/${coord.x}`;
    window.open(mapUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const handleExport = useCallback(() => {
    if (coordinates.length === 0) {
      toast.error('Aucune coordonnée à exporter');
      return;
    }

    // Create CSV content
    const headers = ['X', 'Y', 'Z'];
    const csvContent = [
      headers.join(','),
      ...coordinates.map(coord => 
        [coord.x ?? '', coord.y ?? '', coord.z ?? ''].join(',')
      )
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    
    link.setAttribute('href', url);
    link.setAttribute('download', `coordonnees_procedure_${procedureNumber}_${date}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
    toast.success('Coordonnées exportées avec succés');
  }, [coordinates, procedureNumber]);
  
  if (!coordinates || coordinates.length === 0) {
    return (
      <div className={styles.emptyState}>
        <MapPin size={24} />
        <p>Aucune coordonnée disponible pour cette procédure</p>
      </div>
    );
  }

    return (
  <div className={styles.coordinatesContainer}>
    <div className={styles.coordinatesHeader}>
      <div className={styles.headerContent}>
        <div className={styles.headerTitle}>
          <MapPin size={20} className={styles.headerIcon} />
          <h3>Coordonnées de la procédure #{procedureNumber}</h3>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.exportButton} onClick={handleExport}>
            <Download size={16} />
            Exporter
          </button>
        </div>
      </div>
      <p className={styles.coordinatesCount}>{coordinates.length} ensembles de coordonnées</p>
    </div>
    
    {coordinates.length === 0 ? (
      <div className={styles.emptyCoordinates}>
        <MapPin size={48} className={styles.emptyIcon} />
        <h4>Aucune coordonnée disponible</h4>
        <p>Aucune donnée de coordonnées pour cette procédure.</p>
      </div>
    ) : (
      <div className={styles.coordinatesTableWrap}>
        <table className={styles.coordinatesTable}>
          <thead>
            <tr>
              <th className={styles.columnX}>Coordonnée X</th>
              <th className={styles.columnY}>Coordonnée Y</th>
              <th className={styles.columnZ}>Coordonnée Z</th>
              <th className={styles.columnActions}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {coordinates.map((coord) => (
              <tr key={coord.id_coordonnees} className={styles.coordinateRow}>
                <td className={styles.coordinateCell}>
                  <span className={styles.coordinateValue}>{coord.x ?? '—'}</span>
                </td>
                <td className={styles.coordinateCell}>
                  <span className={styles.coordinateValue}>{coord.y ?? '—'}</span>
                </td>
                <td className={styles.coordinateCell}>
                  <span className={styles.coordinateValue}>{coord.z ?? '—'}</span>
                </td>
                <td className={styles.actionsCell}>
                  <div className={styles.actionButtons1}>
                    <button 
                      className={styles.actionButton1}
                      onClick={() => handleViewOnMap(coord)}
                      title="Voir sur la carte"
                    >
                      <MapIcon size={16} />
                    </button>
                    <button 
                      className={styles.actionButton1}
                      onClick={() => handleCopyCoordinates(coord)}
                      title="Copier les coordonnées"
                    >
                      <Copy size={16} />
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
);
}
// Statistic Card Component
const StatisticCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  trend: 'positive' | 'negative' | 'neutral' | 'warning';
  subtitle: string;
}> = ({ title, value, icon, trend, subtitle }) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'positive': return '#10b981';
      case 'negative': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <div className={styles.statCard}>
      <div className={styles.statCardHeader}>
        <div className={styles.statCardIcon} style={{ backgroundColor: `${getTrendColor()}20`, color: getTrendColor() }}>
          {icon}
        </div>
        <span className={styles.statCardTitle}>{title}</span>
      </div>
      <div className={styles.statCardValue}>{value}</div>
      <div className={styles.statCardSubtitle} style={{ color: getTrendColor() }}>
        {subtitle}
      </div>
    </div>
  );
};

// Timeline Chart Component
const TimelineChart: React.FC<{ 
  procedures: Procedure[] | undefined | null; 
  renewals: RenewalInfo[] | undefined | null;
  dateOctroi: Date | null;
  dateExpiration: Date | null;
}> = ({ procedures, renewals, dateOctroi, dateExpiration }) => {
  const safeProcedures = Array.isArray(procedures) ? procedures : [];
  const safeRenewals = Array.isArray(renewals) ? renewals : [];
  // Simplified timeline visualization
  return (
    <div className={styles.timelineContainer}>
      <div className={styles.timeline}>
        {dateOctroi && (
          <div className={styles.timelineItem}>
            <div className={styles.timelineDot} style={{ backgroundColor: '#10b981' }}></div>
            <div className={styles.timelineContent}>
              <span className={styles.timelineDate}>{formatDate(dateOctroi)}</span>
              <span className={styles.timelineTitle}>Octroi du permis</span>
            </div>
          </div>
        )}
        
        {safeRenewals.filter(r => r.date_decision).map((renewal, index) => (
          <div key={renewal.id} className={styles.timelineItem}>
            <div className={styles.timelineDot} style={{ backgroundColor: '#3b82f6' }}></div>
            <div className={styles.timelineContent}>
              <span className={styles.timelineDate}>{formatDate(renewal.date_decision)}</span>
              <span className={styles.timelineTitle}>Renouvellement #{index + 1}</span>
              <span className={styles.timelineDesc}>Décision: {renewal.num_decision}</span>
            </div>
          </div>
        ))}
        
        {dateExpiration && (
          <div className={styles.timelineItem}>
            <div className={styles.timelineDot} style={{ backgroundColor: '#ef4444' }}></div>
            <div className={styles.timelineContent}>
              <span className={styles.timelineDate}>{formatDate(dateExpiration)}</span>
              <span className={styles.timelineTitle}>Date d'expiration</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Substance Table Component
const SubstanceTable: React.FC<{ substances: any[] }> = ({ substances }) => {
  return (
    <div className={styles.substanceTable}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Nom (FR)</th>
            <th>Nom (AR)</th>
            <th>Catégorie</th>
            <th>Priorité</th> 
          </tr>
        </thead>
        <tbody>
          {substances.map((substance) => (
            <tr key={substance.id_sub}>
              <td>{substance.nom_subFR}</td>
              <td>{substance.nom_subAR}</td>
              <td>
                <span className={styles.categoryBadge}>{substance.categorie_sub}</span>
              </td>
              <td>
                <span className={`${styles.priorityBadge} ${
                  substance.priorite === 'principale' 
                    ? styles.primaryPriority 
                    : styles.secondaryPriority
                }`}>
                  {substance.priorite === 'principale' ? 'principale' : 'secondaire'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Action Confirmation Modal Component
const ActionConfirmationModal: React.FC<{
  actionType: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  permisDetails: {
    code: string;
    type: string;
    titulaire: string;
    optionFrom?: string;
    optionTo?: string;
  };
  signatureDate?: string;
  onSignatureDateChange?: (value: string) => void;
  signatureDateError?: string | null;
}> = ({
  actionType,
  onConfirm,
  onCancel,
  permisDetails,
  signatureDate,
  onSignatureDateChange,
  signatureDateError,
}) => {
  const getActionTitle = () => {
    switch (actionType) {
      case 'renouvellement': return 'Demande de renouvellement';
      case 'modification': return 'Demande de modification';
      case 'transfert': return 'Demande de transfert';
      case 'renonciation': return 'Demande de renonciation';
      case 'expiration': return "Démarrer la procédure d'expiration";
      case 'annulation': return "Démarrer la procédure d'annulation";
      case 'option2025': return 'Option 2025';
      default: return 'Confirmation';
    }
  };

  const getActionDescription = () => {
    switch (actionType) {
      case 'renouvellement': 
        return 'Êtes-vous sûr de vouloir demander un renouvellement pour ce permis?';
      case 'modification': 
        return 'Êtes-vous sûr de vouloir demander une modification pour ce permis?';
      case 'transfert': 
        return 'Êtes-vous sûr de vouloir demander un transfert pour ce permis?';
      case 'renonciation': 
        return 'Êtes-vous sûr de vouloir demander une renonciation pour ce permis? Cette action est irréversible.';
      case 'expiration':
        return "Voulez-vous démarrer la procédure d'expiration de ce permis ?";
      case 'annulation':
        return "Voulez-vous démarrer la procédure d'annulation de ce permis ?";
      case 'option2025':
        return `Voulez-vous vraiment opter de '${permisDetails.optionFrom ?? 'ancien type'}' vers '${permisDetails.optionTo ?? permisDetails.type}' ?`;
      default: return 'Confirmez-vous cette action?';
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{getActionTitle()}</h2>
          <button onClick={onCancel} className={styles.modalCloseButton}>
            <XCircle size={20} />
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.confirmationInfo}>
            <p>{getActionDescription()}</p>
            <div className={styles.permisDetails}>
              <h4>Détails du permis:</h4>
               <ul>
                 <li><strong>Code:</strong> {permisDetails.code}</li>
                 <li><strong>Type:</strong> {permisDetails.type}</li>
                 <li><strong>Titulaire:</strong> {permisDetails.titulaire}</li>
               </ul>
             </div>

             {actionType === 'option2025' && (
               <div className={styles.modalFieldGroup}>
                 <label className={styles.modalFieldLabel} htmlFor="signatureDateInput">
                   Date de signature du permis
                 </label>
                 <input
                   id="signatureDateInput"
                   type="date"
                   value={signatureDate || ''}
                   onChange={(e) => onSignatureDateChange?.(e.target.value)}
                   disabled={!onSignatureDateChange}
                   className={`${styles.modalFieldInput} ${
                     signatureDateError ? styles.modalFieldInputError : ''
                   }`}
                 />
                 {signatureDateError && (
                   <div className={styles.modalFieldError}>{signatureDateError}</div>
                 )}
               </div>
             )}
           </div>
         </div>
        <div className={styles.modalFooter}>
          <button onClick={onCancel} className={styles.modalSecondaryButton}>
            Annuler
          </button>
          <button onClick={onConfirm} className={styles.modalPrimaryButton}>
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
};

const OptionDownloadPromptModal: React.FC<{
  title?: string;
  message: string;
  onDownload: () => void;
  onCancel: () => void;
}> = ({ title = 'Telechargement du permis', message, onDownload, onCancel }) => {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{title}</h2>
          <button onClick={onCancel} className={styles.modalCloseButton}>
            <XCircle size={20} />
          </button>
        </div>
        <div className={styles.modalBody}>
          <p>{message}</p>
        </div>
        <div className={styles.modalFooter}>
          <button onClick={onCancel} className={styles.modalSecondaryButton}>
            Annuler
          </button>
          <button onClick={onDownload} className={styles.modalPrimaryButton}>
            Aller au telechargement
          </button>
        </div>
      </div>
    </div>
  );
};

const OptionPermissionRequestModal: React.FC<{
  message: string;
  users: ChefDdmUser[];
  isLoading: boolean;
  isSending: boolean;
  selectedUserId: number | null;
  error?: string | null;
  onSelectUser: (id: number) => void;
  onClose: () => void;
  onSend: () => void;
}> = ({
  message,
  users,
  isLoading,
  isSending,
  selectedUserId,
  error,
  onSelectUser,
  onClose,
  onSend,
}) => {
  const getDisplayName = (user: ChefDdmUser) => {
    const fullName = [user.nom, user.Prenom].filter(Boolean).join(' ').trim();
    return fullName || user.username || user.email || `Utilisateur #${user.id}`;
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Autorisation requise</h2>
          <button onClick={onClose} className={styles.modalCloseButton}>
            <XCircle size={20} />
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.modalInfoText}>
            <p>{message}</p>
            <p className={styles.modalHint}>
              Selectionnez un utilisateur Chef_DDM pour lui envoyer une notification.
            </p>
          </div>
          <div className={styles.modalSubtitle}>Chefs DDM disponibles</div>
          {isLoading ? (
            <p>Chargement des utilisateurs...</p>
          ) : users.length === 0 ? (
            <p>Aucun utilisateur Chef_DDM disponible.</p>
          ) : (
            <div className={styles.roleUserList}>
              {users.map((user) => (
                <label key={user.id} className={styles.roleUserItem}>
                  <input
                    type="radio"
                    name="chefDdmUser"
                    value={user.id}
                    checked={selectedUserId === user.id}
                    onChange={() => onSelectUser(user.id)}
                    className={styles.roleUserRadio}
                  />
                  <User size={18} className={styles.roleUserIcon} />
                  <div className={styles.roleUserInfo}>
                    <span className={styles.roleUserName}>{getDisplayName(user)}</span>
                    {(user.email || user.username) && (
                      <span className={styles.roleUserMeta}>
                        {user.email || user.username}
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
          <p className={styles.modalHint}>
            Une fois la procedure terminee, le Chef_DDM peut vous repondre via une notification.
          </p>
          {error && <div className={styles.modalFieldError}>{error}</div>}
        </div>
        <div className={styles.modalFooter}>
          <button
            onClick={onClose}
            className={styles.modalSecondaryButton}
            disabled={isSending}
          >
            Fermer
          </button>
          <button
            onClick={onSend}
            className={styles.modalPrimaryButton}
            disabled={isSending || isLoading || !selectedUserId}
          >
            {isSending ? 'Envoi en cours...' : 'Envoyer la notification'}
          </button>
        </div>
      </div>
    </div>
  );
};

// pages/permis_dashboard/view/page.tsx (or your page)

export const getServerSideProps: GetServerSideProps = async (context: { query: { id: any; }; }) => {
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const id = context.query.id;

  try {
    // Fetch permit data
    const res = await fetch(`${apiURL}/Permisdashboard/${id}`);
    if (!res.ok) throw new Error('Failed to fetch permit');
    
    const permis = await res.json();
    
    // Fetch documents from API (Permisdashboard controller)
    const documentsRes = await fetch(`${apiURL}/Permisdashboard/${id}/documents`);
    const documentsData = documentsRes.ok ? await documentsRes.json() : [];
    // Fetch transfer history and take the latest if available
    let latestTransfer: TransferEntry | null = null;
    try {
      const transferRes = await fetch(`${apiURL}/transfert/permis/${id}/history`);
      if (transferRes.ok) {
        const history = await transferRes.json();
        if (Array.isArray(history) && history.length > 0) {
          latestTransfer = history[0];
        }
      }
    } catch (_) {
      // ignore transfer fetch errors; keep latestTransfer as null
    }
     const renewalsRes = await fetch(`${apiURL}/api/procedures/${id}/renewals`);
    const renewalsData = renewalsRes.ok ? await renewalsRes.json() : [];
    const formattedRenewals = renewalsData.map((proc: any) => {
      if (!proc.renouvellement) return null;
      
      return {
        id: proc.id_proc,
        num_decision: proc.renouvellement.num_decision || 'N/A',
        date_decision: proc.renouvellement.date_decision ? new Date(proc.renouvellement.date_decision).toISOString() : null,
        date_debut_validite: proc.renouvellement.date_debut_validite ? new Date(proc.renouvellement.date_debut_validite).toISOString() : null,
        date_fin_validite: proc.renouvellement.date_fin_validite ? new Date(proc.renouvellement.date_fin_validite).toISOString() : null,
        duree_renouvellement: proc.renouvellement.nombre_renouvellements || 0,
        commentaire: proc.renouvellement.commentaire || '',
      };
    }).filter(Boolean);
    
    // Convert all date fields in the main permis object to ISO strings
    const createdAtRaw =
      (permis as any)?.created_at ??
      (permis as any)?.createdAt ??
      (permis as any)?.date_heure_systeme ??
      null;
    const createdBy =
      (permis as any)?.createdBy ??
      (permis as any)?.created_by ??
      (permis as any)?.qr_inserer_par ??
      null;

    const serializablePermis = {
  ...permis,
  date_octroi: permis.date_octroi ? new Date(permis.date_octroi).toISOString() : null,
  date_expiration: permis.date_expiration ? new Date(permis.date_expiration).toISOString() : null,
  date_annulation: permis.date_annulation ? new Date(permis.date_annulation).toISOString() : null,
  date_heure_systeme: (permis as any)?.date_heure_systeme ? new Date((permis as any).date_heure_systeme).toISOString() : null,
  createdAt: createdAtRaw ? new Date(createdAtRaw).toISOString() : null,
  createdBy: createdBy ?? null,
  qr_inserer_par: (permis as any)?.qr_inserer_par ?? null,
  date_renonciation: permis.date_renonciation ? new Date(permis.date_renonciation).toISOString() : null,
  renewals: formattedRenewals,
  documents: documentsData.data || [], 
  procedures: permis.procedures ? permis.procedures.map((proc: any) => ({
    ...proc,
    date_debut_proc: proc.date_debut_proc ? new Date(proc.date_debut_proc).toISOString() : null,
    date_fin_proc: proc.date_fin_proc ? new Date(proc.date_fin_proc).toISOString() : null,
    ProcedureEtape: proc.ProcedureEtape ? proc.ProcedureEtape.map((step: any) => ({
      ...step,
      date_debut: step.date_debut ? new Date(step.date_debut).toISOString() : null,
      date_fin: step.date_fin ? new Date(step.date_fin).toISOString() : null,
    })) : [],
    coordonnees: proc.coordonnees || []
  })) : []
};
    
    return {
      props: {
        permis: serializablePermis,
        latestTransfer: latestTransfer || null,
      },
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return { 
      props: { 
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      } 
    };
  }
};

const PermisViewPage: React.FC<Props> = ({ permis: initialPermis, latestTransfer: initialLatestTransfer, error: initialError }) => {
  const searchParams = useSearchParams();
  const idPermis = searchParams!.get('id');
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const route = useRouter();

  // Make props resilient when coming from client routing (no SSR props)
  const [permis, setPermis] = useState<PermisDetails | null>(initialPermis ?? null);
  const [latestTransfer, setLatestTransfer] = useState<TransferEntry | null>(initialLatestTransfer ?? null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(!initialPermis && !!idPermis);
  const permisIdValue = useMemo(() => {
    if (permis?.id) return permis.id;
    if (!idPermis) return null;
    const parsed = Number(idPermis);
    return Number.isNaN(parsed) ? null : parsed;
  }, [permis?.id, idPermis]);
  const [historique, setHistorique] = useState<any[]>([]);

  const [notif, setNotif] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [pendingPermisId, setPendingPermisId] = useState<number | null>(null);
  const [renewalPerimeter, setRenewalPerimeter] = useState<RenewalPerimeterInfo | null>(null);
  const [renewalPerimeterLoading, setRenewalPerimeterLoading] = useState(false);
  const [renewalPerimeterError, setRenewalPerimeterError] = useState<string | null>(null);
  const [renewalPerimeterChoice, setRenewalPerimeterChoice] = useState<'keep' | 'manual'>('keep');
  const [manualPerimeterText, setManualPerimeterText] = useState('');
  const [manualPerimeterPoints, setManualPerimeterPoints] = useState<RenewalPerimeterPoint[]>([]);
  const [manualPerimeterError, setManualPerimeterError] = useState<string | null>(null);
  const manualFileInputRef = useRef<HTMLInputElement | null>(null);
  const manualPrefillRef = useRef(false);
  const [showMaxRenewalModal, setShowMaxRenewalModal] = useState(false);
  const [showObligationWarning, setShowObligationWarning] = useState(false);
  const [unpaidObligations, setUnpaidObligations] = useState<any[]>([]);
  const [obligationMessage, setObligationMessage] = useState<string>('');
  const [pendingActionAfterWarning, setPendingActionAfterWarning] = useState<
    null | { type: 'renewal' | 'transfer' | 'cession'; permisId: number }
  >(null);
  const [selectedProcedures, setSelectedProcedures] = useState<Procedure[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'procedures' | 'documents' | 'history' | 'obligations'>('overview');
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: string;
    callback: () => void | boolean | Promise<void | boolean>;
  } | null>(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [wantsExtension, setWantsExtension] = useState(false);
  const [wantsModification, setWantsModification] = useState(false);
  const [extensionChoice, setExtensionChoice] = useState<'perimetres' | 'substances' | null>(null);
  let daysUntilExpiry: number | null = null;
const [documentsData, setDocumentsData] = useState<AllDocuments | null>(null);
const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [expandedProcedures, setExpandedProcedures] = useState<number[]>([]);
  const { currentView, navigateTo } = useViewNavigator('dashboard');
  const isAuthReady = useAuthReady();
  const auth = useAuthStore((s) => s.auth);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canQuickActions = hasPermission('actions_rapides');
  const canViewProceduresTab = hasPermission('procedure_permisDetails');
  const canViewDocumentsTab = hasPermission('document_permisDetails');
  const canModifyPermisData = hasPermission('modifier_permisData');
const [obligations, setObligations] = useState<Obligation[]>([]);
const [filteredObligations, setFilteredObligations] = useState<Obligation[]>([]);
const [isLoadingObligations, setIsLoadingObligations] = useState(false);
const [expandedObligations, setExpandedObligations] = useState<number[]>([]);
const [filters, setFilters] = useState<ObligationFilters>({
  status: 'all',
  type: 'all',
  year: 'all',
  minAmount: '',
  maxAmount: ''
});
const [pagination, setPagination] = useState<PaginationState>({
  currentPage: 1,
  itemsPerPage: 10,
  totalItems: 0,
  totalPages: 0
});
const [showFilters, setShowFilters] = useState(false);
const [typeProceduresForPermis, setTypeProceduresForPermis] = useState<TypeProcedureSummary[]>([]);
const [allTypeProcedures, setAllTypeProcedures] = useState<TypeProcedureSummary[]>([]);
  const [isLoadingTypeProcedures, setIsLoadingTypeProcedures] = useState(false);
  const [registreCommerce, setRegistreCommerce] = useState<RegistreCommerceInfo[]>([]);
  const createdByUser = useMemo(
    () => permis?.createdBy ?? permis?.qr_inserer_par ?? null,
    [permis?.createdBy, permis?.qr_inserer_par]
  );
  const creationDate = useMemo(() => {
    const raw = permis?.createdAt ?? permis?.date_heure_systeme ?? null;
    if (!raw) return null;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    try {
      return format(parsed, 'dd MMMM yyyy', { locale: fr });
    } catch {
      return null;
    }
  }, [permis?.createdAt, permis?.date_heure_systeme]);
  const [actionnaires, setActionnaires] = useState<ActionnaireInfo[]>([]);
  const [isLoadingRegistre, setIsLoadingRegistre] = useState(false);
  const [isLoadingActionnaires, setIsLoadingActionnaires] = useState(false);
  const [isEditingGeneral, setIsEditingGeneral] = useState(false);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [generalForm, setGeneralForm] = useState<GeneralFormState>({
    code_permis: '',
    id_typePermis: '',
    id_statut: '',
    id_antenne: '',
    id_detenteur: '',
    id_wilaya: '',
    id_daira: '',
    id_commune: '',
    superficie: '',
  });
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [isSavingDates, setIsSavingDates] = useState(false);
  const [dateForm, setDateForm] = useState<DateFormState>({
    date_octroi: '',
    date_expiration: '',
    date_annulation: '',
    date_renonciation: '',
  });
  const [typePermisOptions, setTypePermisOptions] = useState<TypePermisOption[]>([]);
  const [statutPermisOptions, setStatutPermisOptions] = useState<StatutPermisOption[]>([]);
  const [antenneOptions, setAntenneOptions] = useState<AntenneOption[]>([]);
  const [detenteurSearch, setDetenteurSearch] = useState('');
  const [detenteurOptions, setDetenteurOptions] = useState<DetenteurOption[]>([]);
  const [isSearchingDetenteur, setIsSearchingDetenteur] = useState(false);
  const [wilayaSearch, setWilayaSearch] = useState('');
  const [dairaSearch, setDairaSearch] = useState('');
  const [communeSearch, setCommuneSearch] = useState('');
  const [wilayaOptions, setWilayaOptions] = useState<WilayaOption[]>([]);
  const [dairaOptions, setDairaOptions] = useState<DairaOption[]>([]);
  const [communeOptions, setCommuneOptions] = useState<CommuneOption[]>([]);
  const [isLoadingWilayas, setIsLoadingWilayas] = useState(false);
  const [isLoadingDairas, setIsLoadingDairas] = useState(false);
  const [isLoadingCommunes, setIsLoadingCommunes] = useState(false);
  const [editingRegistreId, setEditingRegistreId] = useState<number | null>(null);
  const [registreDraft, setRegistreDraft] = useState<RegistreCommerceInfo | null>(null);
  const [savingRegistreId, setSavingRegistreId] = useState<number | null>(null);
  const [editingActionnaireId, setEditingActionnaireId] = useState<number | null>(null);
  const [actionnaireDraft, setActionnaireDraft] = useState<ActionnaireInfo | null>(null);
  const [savingActionnaireId, setSavingActionnaireId] = useState<number | null>(null);
  const [paysOptions, setPaysOptions] = useState<{ id_pays: number; nom_pays: string }[]>([]);
  const [nationaliteOptions, setNationaliteOptions] = useState<{ id_nationalite: number; libelle: string }[]>([]);
  const [isEditingSubstances, setIsEditingSubstances] = useState(false);
  const ensureCanModify = useCallback(() => {
    if (canModifyPermisData) return true;
    toast.error("Permission 'modifier_permisData' requise.");
    return false;
  }, [canModifyPermisData]);
  const [isSavingSubstances, setIsSavingSubstances] = useState(false);
  const [allSubstanceOptions, setAllSubstanceOptions] = useState<SubstanceOption[]>([]);
  const [selectedSubstanceIds, setSelectedSubstanceIds] = useState<number[]>([]);
  const [substancePriorities, setSubstancePriorities] = useState<Record<number, 'principale' | 'secondaire'>>({});
  const [substancesOverride, setSubstancesOverride] = useState<any[] | null>(null);

  const [optionSignatureDate, setOptionSignatureDate] = useState<string>('');

  const toDateInputValue = (date: Date | null) => {
    if (!date) return '';
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  const parseDateInputValue = (value: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const toFormNumber = (value: unknown): number | '' => {
    if (value === '' || value == null) return '';
    const num = Number(value);
    return Number.isFinite(num) ? num : '';
  };

  const normalizeNumericToken = (value: string): number | null => {
    if (!value) return null;
    const cleaned = value.replace(/\s+/g, '').replace(',', '.');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  };

  const parseManualLine = (
    line: string,
    defaultZone?: number | null,
  ): RenewalPerimeterPoint | null => {
    if (!line) return null;
    const tokens = line.match(/[-+]?\d+(?:[.,]\d+)?/g);
    if (!tokens || tokens.length < 2) return null;
    const numbers = tokens
      .map((token) => normalizeNumericToken(token))
      .filter((val): val is number => Number.isFinite(val));
    if (numbers.length < 2) return null;

    const largeNumbers = numbers.filter((num) => Math.abs(num) >= 1000);
    const pick = largeNumbers.length >= 2 ? largeNumbers : numbers;
    const x = pick[pick.length - 2];
    const y = pick[pick.length - 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    let zone = defaultZone ?? null;
    for (let i = 0; i < numbers.length - 2; i++) {
      const candidate = numbers[i];
      if (candidate >= 29 && candidate <= 32) {
        zone = Math.round(candidate);
        break;
      }
    }

    return {
      x,
      y,
      z: null,
      system: 'UTM',
      zone,
      hemisphere: 'N',
    };
  };

  const parseManualText = (
    text: string,
    defaultZone?: number | null,
  ): RenewalPerimeterPoint[] => {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const points: RenewalPerimeterPoint[] = [];
    lines.forEach((line) => {
      const point = parseManualLine(line, defaultZone);
      if (point) points.push(point);
    });
    return points;
  };

  const parseManualRows = (
    rows: Array<unknown[]>,
    defaultZone?: number | null,
  ): RenewalPerimeterPoint[] => {
    const points: RenewalPerimeterPoint[] = [];
    rows.forEach((row) => {
      if (!row || !row.length) return;
      const line = row.map((cell) => String(cell ?? '')).join(' ');
      const point = parseManualLine(line, defaultZone);
      if (point) points.push(point);
    });
    return points;
  };

  const computeAreaHaFromPoints = (points: RenewalPerimeterPoint[]): number => {
    const coords = points
      .map((pt) => [Number(pt.x), Number(pt.y)] as [number, number])
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    if (coords.length < 3) return 0;
    const ring =
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1]
        ? coords
        : [...coords, coords[0]];

    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      sum += x1 * y2 - x2 * y1;
    }

    const areaM2 = Math.abs(sum) / 2;
    const areaHa = areaM2 / 10000;
    return Math.round(areaHa * 100) / 100;
  };
  const countValidManualPoints = (points: RenewalPerimeterPoint[]) =>
    points.filter(
      (pt) => Number.isFinite(Number(pt.x)) && Number.isFinite(Number(pt.y)),
    ).length;
  const parseCoordInput = (value: string): number => {
    const trimmed = value.trim();
    if (!trimmed) return NaN;
    const cleaned = trimmed.replace(/[\s\u00A0\u202F]/g, '').replace(',', '.');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : NaN;
  };
  const formatCoordInput = (value: number | null | undefined) =>
    Number.isFinite(value as number) ? String(value) : '';

  useEffect(() => {
    if (!showDateModal || !pendingPermisId || !apiURL) return;
    let cancelled = false;
    setRenewalPerimeterLoading(true);
    setRenewalPerimeterError(null);
    setRenewalPerimeter(null);
    setManualPerimeterText('');
    setManualPerimeterPoints([]);
    setManualPerimeterError(null);

    axios
      .get(`${apiURL}/api/procedures/renouvellement/perimetre/latest`, {
        params: { permisId: pendingPermisId },
        withCredentials: true,
      })
      .then((res) => {
        if (cancelled) return;
        const data = res.data as RenewalPerimeterInfo;
        const points = Array.isArray(data?.points) ? data.points : [];
        setRenewalPerimeter({
          procedure: data?.procedure,
          points,
          areaHa: data?.areaHa ?? null,
        });
        setRenewalPerimeterChoice(points.length ? 'keep' : 'manual');
      })
      .catch((err) => {
        if (cancelled) return;
        const msg =
          err?.response?.data?.message ||
          'Aucun périmètre existant trouvé pour ce permis.';
        setRenewalPerimeterError(msg);
        setRenewalPerimeterChoice('manual');
      })
      .finally(() => {
        if (!cancelled) setRenewalPerimeterLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showDateModal, pendingPermisId, apiURL]);

  useEffect(() => {
    if (!permis || !isEditingGeneral) return;
    const superficie = computePermisSuperficie(permis);
    const demande = getLatestDemandeFromPermis(permis);
    const idWilaya = toFormNumber(
      (demande as any)?.id_wilaya ??
        (demande as any)?.wilaya?.id_wilaya ??
        (demande as any)?.commune?.daira?.wilaya?.id_wilaya ??
        (permis as any)?.wilaya?.id_wilaya,
    );
    const idDaira = toFormNumber(
      (demande as any)?.id_daira ??
        (demande as any)?.daira?.id_daira ??
        (demande as any)?.commune?.daira?.id_daira ??
        (permis as any)?.daira?.id_daira,
    );
    const idCommune = toFormNumber(
      (demande as any)?.id_commune ??
        (demande as any)?.commune?.id_commune ??
        (permis as any)?.commune?.id_commune,
    );
    setGeneralForm({
      code_permis: permis.code_permis || '',
      id_typePermis: permis.typePermis?.id ?? '',
      id_statut: (permis.statut as any)?.id ?? permis.id_statut ?? '',
      id_antenne: permis.antenne?.id_antenne ?? permis.id_antenne ?? '',
      id_detenteur: permis.detenteur?.id_detenteur ?? '',
      id_wilaya: idWilaya,
      id_daira: idDaira,
      id_commune: idCommune,
      superficie: superficie != null ? String(superficie) : '',
    });
    setDetenteurSearch('');
    setDetenteurOptions([]);
    setWilayaSearch('');
    setDairaSearch('');
    setCommuneSearch('');
    setDairaOptions([]);
    setCommuneOptions([]);
  }, [isEditingGeneral, permis]);

  useEffect(() => {
    if (!permis || !isEditingDates) return;
    setDateForm({
      date_octroi: toDateInputValue(permis.date_octroi ? new Date(permis.date_octroi) : null),
      date_expiration: toDateInputValue(permis.date_expiration ? new Date(permis.date_expiration) : null),
      date_annulation: toDateInputValue(permis.date_annulation ? new Date(permis.date_annulation) : null),
      date_renonciation: toDateInputValue(permis.date_renonciation ? new Date(permis.date_renonciation) : null),
    });
  }, [isEditingDates, permis]);
  const [optionSignatureDateError, setOptionSignatureDateError] = useState<string | null>(null);
  const [showOptionDownloadModal, setShowOptionDownloadModal] = useState(false);
  const [optionDownloadMessage, setOptionDownloadMessage] = useState<string>('');
  const optionSignatureDateRef = useRef<string>('');
  const previewMapRef = useRef<ArcGISMapRef | null>(null);
  
  const isExpiredByDate = useMemo(() => {
    if (!permis?.date_expiration) return false;
    const expiryDate = typeof permis.date_expiration === 'string' 
      ? new Date(permis.date_expiration) 
      : permis.date_expiration;
    const today = new Date();
    return expiryDate < today;
  }, [permis?.date_expiration]);

  const isStatutExpired = useMemo(() => {
    const statusLib = (permis?.statut?.lib_statut || '').toLowerCase();
    return statusLib.includes('expiré') || statusLib.includes('expired');
  }, [permis?.statut?.lib_statut]);

  const latestCoordinatesProcedure = useMemo(() => {
    const procedures = Array.isArray(permis?.procedures) ? permis.procedures : [];
    if (!procedures.length) return null;

    const sorted = [...procedures].sort((a, b) => {
      const dateA = a.date_debut_proc ? new Date(a.date_debut_proc).getTime() : 0;
      const dateB = b.date_debut_proc ? new Date(b.date_debut_proc).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;
      return (b.id_proc ?? 0) - (a.id_proc ?? 0);
    });

    return (
      sorted.find((procedure) =>
        (procedure.coordonnees || []).some((entry) => {
          const coord = entry?.coordonnee;
          const x = Number(coord?.x);
          const y = Number(coord?.y);
          return Number.isFinite(x) && Number.isFinite(y);
        }),
      ) || null
    );
  }, [permis?.procedures]);

  const latestCoordinates = useMemo(() => {
    if (!latestCoordinatesProcedure?.coordonnees?.length) return [];
    const normalized = latestCoordinatesProcedure.coordonnees
      .map((entry, index) => {
        const coord = entry?.coordonnee;
        if (!coord) return null;
        const x = Number(coord.x);
        const y = Number(coord.y);
        const z = Number(coord.z);
        return {
          coord: {
            ...coord,
            x,
            y,
            z: Number.isFinite(z) ? z : 0,
          },
          index,
          order: Number.parseInt(String(coord.point ?? ''), 10),
        };
      })
      .filter(
        (item): item is {
          coord: {
            id_coordonnees: number;
            point: string;
            x: number;
            y: number;
            z: number;
            system?: string | null;
            zone?: number | null;
            hemisphere?: string | null;
          };
          index: number;
          order: number;
        } =>
          !!item && Number.isFinite(item.coord.x) && Number.isFinite(item.coord.y),
      );

    normalized.sort((a, b) => {
      const aHasOrder = Number.isFinite(a.order);
      const bHasOrder = Number.isFinite(b.order);
      if (aHasOrder && bHasOrder && a.order !== b.order) return a.order - b.order;
      if (aHasOrder && !bHasOrder) return -1;
      if (!aHasOrder && bHasOrder) return 1;
      return a.index - b.index;
    });

    return normalized.map((item) => item.coord);
  }, [latestCoordinatesProcedure]);

  const latestDemande = useMemo(
    () => getLatestDemandeFromPermis(permis),
    [permis?.procedures],
  );
  const latestDemandeId = (latestDemande as any)?.id_demande ?? null;
  const wilayaName = useMemo(() => getPermisWilayaName(permis), [permis]);
  const dairaName = useMemo(() => getPermisDairaName(permis), [permis]);
  const communeName = useMemo(() => getPermisCommuneName(permis), [permis]);
  const antenneName = permis?.antenne?.nom || null;

  const formatLocationLabel = (
    code?: string | null,
    fr?: string | null,
    ar?: string | null,
  ) => {
    const name = fr || ar || '';
    return [code, name].filter(Boolean).join(' - ');
  };

  const filteredWilayaOptions = useMemo(() => {
    const query = normalizeSearchValue(wilayaSearch);
    if (!query) return wilayaOptions;
    return wilayaOptions.filter((opt) => {
      const target = normalizeSearchValue(
        [opt.code_wilaya, opt.nom_wilayaFR, opt.nom_wilayaAR]
          .filter(Boolean)
          .join(' '),
      );
      return target.includes(query);
    });
  }, [wilayaOptions, wilayaSearch]);

  const filteredDairaOptions = useMemo(() => {
    const query = normalizeSearchValue(dairaSearch);
    if (!query) return dairaOptions;
    return dairaOptions.filter((opt) => {
      const target = normalizeSearchValue(
        [opt.code_daira, opt.nom_dairaFR, opt.nom_dairaAR]
          .filter(Boolean)
          .join(' '),
      );
      return target.includes(query);
    });
  }, [dairaOptions, dairaSearch]);

  const filteredCommuneOptions = useMemo(() => {
    const query = normalizeSearchValue(communeSearch);
    if (!query) return communeOptions;
    return communeOptions.filter((opt) => {
      const target = normalizeSearchValue(
        [opt.code_commune, opt.nom_communeFR, opt.nom_communeAR]
          .filter(Boolean)
          .join(' '),
      );
      return target.includes(query);
    });
  }, [communeOptions, communeSearch]);

  const detailedSubstances = useMemo(() => {
    if (!permis) return [];
    const seen = new Set<number>();
    const items: any[] = [];
    const addAssoc = (assoc: any) => {
      const sub = assoc?.substance;
      const idSub = typeof sub?.id_sub === 'number' ? sub.id_sub : null;
      if (idSub == null || seen.has(idSub)) return;
      seen.add(idSub);
      items.push({
        id_sub: idSub,
        nom_subFR: sub?.nom_subFR || '',
        nom_subAR: sub?.nom_subAR || '',
        categorie_sub: sub?.categorie_sub || '',
        priorite: assoc?.priorite || '',
      });
    };
    const procedures = Array.isArray(permis?.procedures) ? permis.procedures : [];
    procedures.forEach((proc: any) => {
      const assocList = Array.isArray(proc?.SubstanceAssocieeDemande)
        ? proc.SubstanceAssocieeDemande
        : [];
      assocList.forEach(addAssoc);
    });
    const relations = Array.isArray((permis as any)?.permisProcedure)
      ? (permis as any).permisProcedure
      : [];
    relations.forEach((rel: any) => {
      const assocList = Array.isArray(rel?.procedure?.SubstanceAssocieeDemande)
        ? rel.procedure.SubstanceAssocieeDemande
        : [];
      assocList.forEach(addAssoc);
    });
    if (items.length) return items;
    const names = getPermisSubstances(permis);
    return names.map((nom_subFR, index) => ({
      id_sub: index + 1,
      nom_subFR,
      nom_subAR: '',
      categorie_sub: '',
      priorite: '',
    }));
  }, [permis]);

  const currentSubstanceIds = useMemo(() => {
    const source = substancesOverride ?? detailedSubstances;
    return source.map((s: any) => s.id_sub).filter((id: number) => Number.isFinite(id));
  }, [detailedSubstances, substancesOverride]);

  const currentSubstancePriorityMap = useMemo(() => {
    const source = substancesOverride ?? detailedSubstances;
    const map: Record<number, 'principale' | 'secondaire'> = {};
    source.forEach((row: any) => {
      const id = row?.id_sub;
      if (typeof id !== 'number' || Number.isNaN(id)) return;
      map[id] = row?.priorite === 'principale' ? 'principale' : 'secondaire';
    });
    return map;
  }, [detailedSubstances, substancesOverride]);

  useEffect(() => {
    if (!isEditingSubstances) return;
    setSelectedSubstanceIds(currentSubstanceIds);
    setSubstancePriorities(currentSubstancePriorityMap);
  }, [currentSubstanceIds, currentSubstancePriorityMap, isEditingSubstances]);

  const latestProcedureLabel = useMemo(() => {
    if (!latestCoordinatesProcedure) return '';
    if (latestCoordinatesProcedure.num_proc) return latestCoordinatesProcedure.num_proc;
    if (latestCoordinatesProcedure.id_proc != null) {
      return `PROC-${latestCoordinatesProcedure.id_proc}`;
    }
    return '';
  }, [latestCoordinatesProcedure]);

  const previewUtmZone = useMemo(() => {
    const zone = latestCoordinates.find((coord) => coord.zone != null)?.zone;
    if (typeof zone === 'number' && Number.isFinite(zone)) return zone;
    return DEFAULT_UTM_ZONE;
  }, [latestCoordinates]);

  const previewMapPoints = useMemo(
    () =>
      latestCoordinates.map((coord, index) => ({
        id: coord.id_coordonnees ?? index + 1,
        idTitre: 0,
        h: Number.isFinite(coord.z) ? coord.z : 0,
        x: coord.x,
        y: coord.y,
        system: 'UTM' as const,
        zone: previewUtmZone,
        hemisphere: 'N' as const,
      })),
    [latestCoordinates, previewUtmZone],
  );

  useEffect(() => {
    const map = previewMapRef.current;
    if (!map) return;
    PREVIEW_LAYER_KEYS.forEach((key) => map.setLayerActive(key, false));
    map.setLayerPanelOpen(false);
  }, [latestCoordinates.length]);
  const [showOptionPermissionModal, setShowOptionPermissionModal] = useState(false);
  const [chefDdmUsers, setChefDdmUsers] = useState<ChefDdmUser[]>([]);
  const [isLoadingChefDdmUsers, setIsLoadingChefDdmUsers] = useState(false);
  const [selectedChefDdmId, setSelectedChefDdmId] = useState<number | null>(null);
  const [optionPermissionError, setOptionPermissionError] = useState<string | null>(null);
  const [isSendingOptionPermission, setIsSendingOptionPermission] = useState(false);
  const optionPermissionMessage =
    "Vous n'avez pas l'autorisation pour l'option vers titre. Contactez votre responsable.";
// Add these helper functions
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'DZD'
  }).format(amount);
};

  const fetchChefDdmUsers = useCallback(async () => {
    if (!apiURL) {
      setOptionPermissionError('Configuration API manquante.');
      return;
    }

    setIsLoadingChefDdmUsers(true);
    setOptionPermissionError(null);
    try {
      const res = await axios.get(`${apiURL}/admin/users`, { withCredentials: true });
      const rawUsers = Array.isArray(res.data) ? res.data : res.data?.users || [];
      const filtered = (rawUsers as ChefDdmUser[])
        .filter((user) => (user?.role?.name || '').toLowerCase() === 'chef_ddm')
        .filter((user) => (auth.id ? user.id !== auth.id : true));
      setChefDdmUsers(filtered);
    } catch (err) {
      console.error('Erreur lors du chargement des Chef_DDM:', err);
      setOptionPermissionError("Impossible de charger la liste des Chef_DDM.");
      setChefDdmUsers([]);
    } finally {
      setIsLoadingChefDdmUsers(false);
    }
  }, [apiURL, auth.id]);

  const openOptionPermissionModal = useCallback(() => {
    setOptionPermissionError(null);
    setSelectedChefDdmId(null);
    setShowOptionPermissionModal(true);
    void fetchChefDdmUsers();
  }, [fetchChefDdmUsers]);

  const closeOptionPermissionModal = useCallback(() => {
    setShowOptionPermissionModal(false);
    setOptionPermissionError(null);
    setSelectedChefDdmId(null);
  }, []);

  const handleSendOptionPermissionRequest = useCallback(async () => {
    if (!apiURL) {
      setOptionPermissionError('Configuration API manquante.');
      return;
    }
    if (!selectedChefDdmId) {
      setOptionPermissionError('Veuillez selectionner un Chef_DDM.');
      return;
    }
    if (!auth.id) {
      setOptionPermissionError('Utilisateur non authentifie.');
      return;
    }

    setIsSendingOptionPermission(true);
    setOptionPermissionError(null);
    const permisCode =
      permis?.code_permis || (permis?.id ? `#${permis.id}` : 'inconnu');

    try {
      await axios.post(
        `${apiURL}/notifications/option-request`,
        {
          receiverId: selectedChefDdmId,
          permisId: permis?.id ?? null,
          permisCode,
        },
        {
          withCredentials: true,
          headers: {
            'x-user-id': auth.id.toString(),
            'x-user-name': auth.username || auth.email || '',
          },
        },
      );
      toast.success('Notification envoyee au Chef_DDM.');
      setShowOptionPermissionModal(false);
    } catch (err) {
      console.error("Erreur lors de l'envoi de la notification:", err);
      setOptionPermissionError("Echec de l'envoi de la notification.");
    } finally {
      setIsSendingOptionPermission(false);
    }
  }, [
    apiURL,
    auth.id,
    auth.username,
    auth.email,
    selectedChefDdmId,
    permis?.code_permis,
    permis?.id,
  ]);

  // Client-side fallback fetch when SSR props are absent
  useEffect(() => {
    const fetchData = async () => {
      if (!apiURL || !idPermis) return;
      setIsLoading(true);
      try {
        const id = idPermis;
        const res = await fetch(`${apiURL}/Permisdashboard/${id}`);
        if (!res.ok) throw new Error('Failed to fetch permit');
        const permisJson = await res.json();

        const documentsRes = await fetch(`${apiURL}/Permisdashboard/${id}/documents`);
        const documentsData = documentsRes.ok ? await documentsRes.json() : [];

        let latestTransferLocal: TransferEntry | null = null;
        try {
          const transferRes = await fetch(`${apiURL}/transfert/permis/${id}/history`);
          if (transferRes.ok) {
            const history = await transferRes.json();
            if (Array.isArray(history) && history.length > 0) {
              latestTransferLocal = history[0];
            }
          }
        } catch (_) {
          // ignore
        }

        const renewalsRes = await fetch(`${apiURL}/api/procedures/${id}/renewals`);
        const renewalsData = renewalsRes.ok ? await renewalsRes.json() : [];
        const formattedRenewals = renewalsData
          .map((proc: any) => {
            if (!proc.renouvellement) return null;
            return {
              id: proc.id_proc,
              num_decision: proc.renouvellement.num_decision || 'N/A',
              date_decision: proc.renouvellement.date_decision ? new Date(proc.renouvellement.date_decision).toISOString() : null,
              date_debut_validite: proc.renouvellement.date_debut_validite ? new Date(proc.renouvellement.date_debut_validite).toISOString() : null,
              date_fin_validite: proc.renouvellement.date_fin_validite ? new Date(proc.renouvellement.date_fin_validite).toISOString() : null,
              duree_renouvellement: proc.renouvellement.nombre_renouvellements || 0,
              commentaire: proc.renouvellement.commentaire || '',
            } as RenewalInfo;
          })
          .filter(Boolean) as RenewalInfo[];

        const createdAtRaw =
          permisJson?.created_at ??
          permisJson?.createdAt ??
          permisJson?.date_heure_systeme ??
          null;
        const createdBy =
          permisJson?.createdBy ??
          permisJson?.created_by ??
          permisJson?.qr_inserer_par ??
          null;

        const serializablePermis: PermisDetails = {
          ...permisJson,
          date_octroi: permisJson?.date_octroi ? new Date(permisJson.date_octroi).toISOString() : null,
          date_expiration: permisJson?.date_expiration ? new Date(permisJson.date_expiration).toISOString() : null,
          date_annulation: permisJson?.date_annulation ? new Date(permisJson.date_annulation).toISOString() : null,
          date_renonciation: permisJson?.date_renonciation ? new Date(permisJson.date_renonciation).toISOString() : null,
          date_heure_systeme: permisJson?.date_heure_systeme ? new Date(permisJson.date_heure_systeme).toISOString() : null,
          createdAt: createdAtRaw ? new Date(createdAtRaw).toISOString() : null,
          createdBy: createdBy ?? null,
          qr_inserer_par: permisJson?.qr_inserer_par ?? null,
          renewals: formattedRenewals,
          documents: (documentsData && documentsData.data) ? documentsData.data : [],
          procedures: permisJson?.procedures ? (permisJson.procedures as any[]).map((proc: any) => ({
            ...proc,
            date_debut_proc: proc.date_debut_proc ? new Date(proc.date_debut_proc).toISOString() : null,
            date_fin_proc: proc.date_fin_proc ? new Date(proc.date_fin_proc).toISOString() : null,
            ProcedureEtape: proc.ProcedureEtape ? proc.ProcedureEtape.map((step: any) => ({
              ...step,
              date_debut: step.date_debut ? new Date(step.date_debut).toISOString() : null,
              date_fin: step.date_fin ? new Date(step.date_fin).toISOString() : null,
            })) : [],
            coordonnees: proc.coordonnees || []
          })) : []
        };

        setPermis(serializablePermis);
        try {
          const histRes = await fetch(`${apiURL}/Permisdashboard/${id}/historique`);
          if (histRes.ok) {
            const hist = await histRes.json();
            setHistorique(hist);
          }
        } catch {}
        setLatestTransfer(latestTransferLocal);
        setError(null);
      } catch (e: any) {
        console.error('Error fetching permit (client):', e);
        setError(e?.message ?? 'Une erreur est survenue lors du chargement du permis');
      } finally {
        setIsLoading(false);
      }
    };

    if (!permis && idPermis) {
      void fetchData();
    }
  }, [apiURL, idPermis, permis]);

  useEffect(() => {
    if (!apiURL || !permisIdValue || !isAuthReady) return;
    const controller = new AbortController();
    const mapActionnaires = (rows: any[]): ActionnaireInfo[] => {
      if (!Array.isArray(rows)) return [];
      return rows.map((row: any) => {
        const personne = row.personne || row;
        const nationalite = personne?.nationaliteRef?.libelle || row.nationalite || null;
        const idNationalite = personne?.nationaliteRef?.id_nationalite ?? row.id_nationalite ?? null;
        const idPays = personne?.pays?.id_pays ?? row.id_pays ?? row.pays ?? null;
        const typeFonction =
          row.type_fonction ??
          row.fonctions?.[0]?.type_fonction ??
          row.lien?.type_fonction ??
          row.fonction?.type_fonction ??
          null;
        return {
          id: row.id_actionnaire ?? row.id_fonctionDetent ?? row.id_personne ?? row.id ?? 0,
          id_actionnaire: row.id_actionnaire ?? row.id_fonctionDetent ?? undefined,
          id_personne: personne?.id_personne ?? row.id_personne ?? undefined,
          nom: personne?.nomFR ?? row.nom ?? null,
          prenom: personne?.prenomFR ?? row.prenom ?? null,
          nomAR: personne?.nomAR ?? row.nomAR ?? null,
          prenomAR: personne?.prenomAR ?? row.prenomAR ?? null,
          nationalite,
          id_nationalite: idNationalite,
          qualification: personne?.qualification ?? row.qualification ?? null,
          type_fonction: typeFonction,
          numIdentite: personne?.num_carte_identite ?? row.numIdentite ?? null,
          numero_carte: personne?.num_carte_identite ?? row.numero_carte ?? null,
          taux: row.taux_participation ?? row.taux ?? null,
          id_pays: idPays,
          paysLabel: personne?.pays?.nom_pays ?? row.paysLabel ?? null,
          lieu_naissance: personne?.lieu_naissance ?? row.lieu_naissance ?? null,
        };
      });
    };
    const loadCompanyDetails = async () => {
      setIsLoadingRegistre(true);
      setIsLoadingActionnaires(true);
      try {
        const detenteurRes = await axios.get(`${apiURL}/actionnaires/detenteur`, {
          params: { permisId: permisIdValue },
          withCredentials: true,
          signal: controller.signal,
        });
        const detId =
          detenteurRes?.data?.id_detenteur ||
          detenteurRes?.data?.detenteur?.id_detenteur ||
          (permis?.detenteur as any)?.id_detenteur ||
          (permis as any)?.id_detenteur ||
          null;

        let regData: RegistreCommerceInfo[] = [];
        let actData: ActionnaireInfo[] = [];

        if (detId) {
          try {
            const [rcRes, actRes] = await Promise.all([
              axios.get(`${apiURL}/api/registre-commerce/${detId}`, {
                withCredentials: true,
                signal: controller.signal,
              }),
              axios.get(`${apiURL}/api/actionnaires/${detId}`, {
                withCredentials: true,
                signal: controller.signal,
              }),
            ]);
            regData = Array.isArray(rcRes.data) ? rcRes.data : [];
            actData = mapActionnaires(actRes.data);
          } catch (err) {
            console.error('Erreur chargement registre/actionnaires', err);
          }
        }

        if (!regData.length) {
          const fallbackRegistre =
            detenteurRes?.data?.registreCommerce && Array.isArray(detenteurRes.data.registreCommerce)
              ? detenteurRes.data.registreCommerce
              : [];
          regData = fallbackRegistre;
        }

        if (!actData.length) {
          try {
            const actionnairesRes = await axios.get(`${apiURL}/actionnaires`, {
              params: { permisId: permisIdValue },
              withCredentials: true,
              signal: controller.signal,
            });
            actData = Array.isArray(actionnairesRes.data)
              ? mapActionnaires(actionnairesRes.data)
              : [];
          } catch (err) {
            console.error('Erreur fallback actionnaires', err);
          }
        }

        setRegistreCommerce(regData || []);
        setActionnaires(actData || []);
      } catch (err) {
        if ((err as any)?.name !== 'CanceledError') {
          console.error('Error loading company details:', err);
        }
        setRegistreCommerce([]);
        setActionnaires([]);
      } finally {
        setIsLoadingRegistre(false);
        setIsLoadingActionnaires(false);
      }
    };
    void loadCompanyDetails();
    return () => controller.abort();
  }, [apiURL, permisIdValue, isAuthReady, permis?.detenteur, permis?.id_detenteur]);

  useEffect(() => {
    if (!apiURL || !isAuthReady) return;
    const controller = new AbortController();
    const loadOptions = async () => {
      try {
        const [
          typeRes,
          statutRes,
          antenneRes,
          substanceRes,
          paysRes,
          nationaliteRes,
        ] = await Promise.all([
          axios.get(`${apiURL}/type-permis_conf`, { withCredentials: true, signal: controller.signal }),
          axios.get(`${apiURL}/statut-permis_conf`, { withCredentials: true, signal: controller.signal }),
          axios.get(`${apiURL}/antenne_conf`, { withCredentials: true, signal: controller.signal }),
          axios.get(`${apiURL}/api/substances`, { withCredentials: true, signal: controller.signal }),
          axios.get(`${apiURL}/statuts-juridiques/pays`, { withCredentials: true, signal: controller.signal }),
          axios.get(`${apiURL}/statuts-juridiques/nationalites`, { withCredentials: true, signal: controller.signal }),
        ]);

        const typeData = Array.isArray(typeRes.data) ? typeRes.data : typeRes.data?.data;
        const statutData = Array.isArray(statutRes.data) ? statutRes.data : statutRes.data?.data;
        const antenneData = Array.isArray(antenneRes.data) ? antenneRes.data : antenneRes.data?.data;
        const substanceData = Array.isArray(substanceRes.data) ? substanceRes.data : substanceRes.data?.data;
        const paysData = Array.isArray(paysRes.data) ? paysRes.data : paysRes.data?.data;
        const natData = Array.isArray(nationaliteRes.data) ? nationaliteRes.data : nationaliteRes.data?.data;

        setTypePermisOptions((typeData || []) as TypePermisOption[]);
        setStatutPermisOptions((statutData || []) as StatutPermisOption[]);
        setAntenneOptions((antenneData || []) as AntenneOption[]);
        setAllSubstanceOptions((substanceData || []) as SubstanceOption[]);
        setPaysOptions((paysData || []) as { id_pays: number; nom_pays: string }[]);
        setNationaliteOptions((natData || []) as { id_nationalite: number; libelle: string }[]);
      } catch (err) {
        if ((err as any)?.name !== 'CanceledError') {
          console.error('Failed to load reference data', err);
        }
      }
    };
    void loadOptions();
    return () => controller.abort();
  }, [apiURL, isAuthReady]);

  useEffect(() => {
    if (!apiURL || !isAuthReady || !isEditingGeneral) return;
    if (wilayaOptions.length > 0) return;
    const controller = new AbortController();
    const loadWilayas = async () => {
      setIsLoadingWilayas(true);
      try {
        const res = await axios.get(`${apiURL}/api/wilayas`, {
          withCredentials: true,
          signal: controller.signal,
        });
        const data = Array.isArray(res.data) ? res.data : res.data?.data;
        setWilayaOptions((data || []) as WilayaOption[]);
      } catch (err) {
        if ((err as any)?.name !== 'CanceledError') {
          console.error('Failed to load wilayas', err);
        }
        setWilayaOptions([]);
      } finally {
        setIsLoadingWilayas(false);
      }
    };
    void loadWilayas();
    return () => controller.abort();
  }, [apiURL, isAuthReady, isEditingGeneral, wilayaOptions.length]);

  useEffect(() => {
    if (!apiURL || !isAuthReady || !isEditingGeneral) return;
    const wilayaId = Number(generalForm.id_wilaya);
    if (!Number.isFinite(wilayaId)) {
      setDairaOptions([]);
      setCommuneOptions([]);
      return;
    }
    const controller = new AbortController();
    const loadDairas = async () => {
      setIsLoadingDairas(true);
      try {
        const res = await axios.get(`${apiURL}/api/wilayas/${wilayaId}/dairas`, {
          withCredentials: true,
          signal: controller.signal,
        });
        const data = Array.isArray(res.data) ? res.data : res.data?.data;
        setDairaOptions((data || []) as DairaOption[]);
      } catch (err) {
        if ((err as any)?.name !== 'CanceledError') {
          console.error('Failed to load dairas', err);
        }
        setDairaOptions([]);
      } finally {
        setIsLoadingDairas(false);
      }
    };
    void loadDairas();
    return () => controller.abort();
  }, [apiURL, isAuthReady, isEditingGeneral, generalForm.id_wilaya]);

  useEffect(() => {
    if (!apiURL || !isAuthReady || !isEditingGeneral) return;
    const dairaId = Number(generalForm.id_daira);
    if (!Number.isFinite(dairaId)) {
      setCommuneOptions([]);
      return;
    }
    const controller = new AbortController();
    const loadCommunes = async () => {
      setIsLoadingCommunes(true);
      try {
        const res = await axios.get(`${apiURL}/api/dairas/${dairaId}/communes`, {
          withCredentials: true,
          signal: controller.signal,
        });
        const data = Array.isArray(res.data) ? res.data : res.data?.data;
        setCommuneOptions((data || []) as CommuneOption[]);
      } catch (err) {
        if ((err as any)?.name !== 'CanceledError') {
          console.error('Failed to load communes', err);
        }
        setCommuneOptions([]);
      } finally {
        setIsLoadingCommunes(false);
      }
    };
    void loadCommunes();
    return () => controller.abort();
  }, [apiURL, isAuthReady, isEditingGeneral, generalForm.id_daira]);

  useEffect(() => {
    if (!isEditingGeneral) return;
    const query = detenteurSearch.trim();
    if (!apiURL || query.length < 2) {
      setDetenteurOptions([]);
      return;
    }
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      setIsSearchingDetenteur(true);
      try {
        const res = await axios.get(`${apiURL}/api/detenteur-morale/search`, {
          params: { q: query },
          withCredentials: true,
          signal: controller.signal,
        });
        const data = Array.isArray(res.data) ? res.data : res.data?.data;
        setDetenteurOptions((data || []) as DetenteurOption[]);
      } catch (err) {
        if ((err as any)?.name !== 'CanceledError') {
          console.error('Failed to search detenteurs', err);
        }
      } finally {
        setIsSearchingDetenteur(false);
      }
    }, 300);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [apiURL, detenteurSearch, isEditingGeneral]);

// Add to your useEffect section
const applyFilters = useCallback(() => {
  let filtered = obligations;

  // Apply status filter
  if (filters.status !== 'all') {
    filtered = filtered.filter(ob => ob.status === filters.status);
  }

  // Apply type filter
  if (filters.type !== 'all') {
    filtered = filtered.filter(ob => ob.typePaiement.libelle === filters.type);
  }

  // Apply year filter
  if (filters.year !== 'all') {
    filtered = filtered.filter(ob => ob.fiscalYear.toString() === filters.year);
  }

  // Apply amount filters
  if (filters.minAmount) {
    const min = parseFloat(filters.minAmount);
    filtered = filtered.filter(ob => ob.amount >= min);
  }

  if (filters.maxAmount) {
    const max = parseFloat(filters.maxAmount);
    filtered = filtered.filter(ob => ob.amount <= max);
  }

  // Update pagination
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pagination.itemsPerPage);
  
  setPagination(prev => ({
    ...prev,
    totalItems,
    totalPages
  }));

  // Apply pagination
  const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + pagination.itemsPerPage);
  
  setFilteredObligations(paginated);
}, [filters, obligations, pagination.currentPage, pagination.itemsPerPage]);

useEffect(() => {
  if (obligations.length > 0) {
    applyFilters();
  }
}, [applyFilters]);

const formatDateShort = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

  const handleSaveGeneral = useCallback(async () => {
    if (!canModifyPermisData) {
      toast.error("Permission 'modifier_permisData' requise.");
      return;
    }
    if (!apiURL || !permis) return;
    setIsSavingGeneral(true);
    const toNumber = (value: number | string | '') => {
      if (value === '' || value == null) return null;
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };
    const payload: any = {
      code_permis: generalForm.code_permis.trim(),
      id_typePermis: toNumber(generalForm.id_typePermis),
      id_statut: toNumber(generalForm.id_statut),
      id_antenne: toNumber(generalForm.id_antenne),
      id_detenteur: toNumber(generalForm.id_detenteur),
      superficie: generalForm.superficie !== '' ? Number(generalForm.superficie) : null,
    };
    const locationPayload = {
      id_wilaya: toNumber(generalForm.id_wilaya),
      id_daira: toNumber(generalForm.id_daira),
      id_commune: toNumber(generalForm.id_commune),
    };
    try {
      const res = await axios.patch(`${apiURL}/permis_conf/${permis.id}`, payload, {
        withCredentials: true,
      });
      const updated = res.data;
      setPermis((prev) =>
        prev
          ? {
              ...prev,
              ...updated,
              procedures: prev.procedures,
              documents: prev.documents,
              renewals: prev.renewals,
            }
          : prev,
      );

      const newDetenteurId = payload.id_detenteur;
      const currentDetenteurId =
        (permis.detenteur as any)?.id_detenteur ?? permis.id_detenteur ?? null;
        if (newDetenteurId && newDetenteurId !== currentDetenteurId && latestDemandeId) {
          try {
            await axios.put(
              `${apiURL}/api/demande/${latestDemandeId}/associate-detenteur`,
              { id_detenteur: newDetenteurId },
              { withCredentials: true },
            );
          } catch (err) {
            console.warn('Failed to sync detenteur on demande', err);
          }
        }

        if (latestDemandeId) {
          try {
            await axios.put(`${apiURL}/demandes/${latestDemandeId}`, locationPayload, {
              withCredentials: true,
            });
            const wilayaOpt =
              locationPayload.id_wilaya != null
                ? wilayaOptions.find((opt) => opt.id_wilaya === locationPayload.id_wilaya) ?? null
                : null;
            const dairaOpt =
              locationPayload.id_daira != null
                ? dairaOptions.find((opt) => opt.id_daira === locationPayload.id_daira) ?? null
                : null;
            const communeOpt =
              locationPayload.id_commune != null
                ? communeOptions.find((opt) => opt.id_commune === locationPayload.id_commune) ?? null
                : null;
            const wilayaStub = wilayaOpt
              ? {
                  id_wilaya: wilayaOpt.id_wilaya,
                  nom_wilayaFR: wilayaOpt.nom_wilayaFR ?? null,
                  nom_wilayaAR: wilayaOpt.nom_wilayaAR ?? null,
                }
              : null;
            const dairaStub = dairaOpt
              ? {
                  id_daira: dairaOpt.id_daira,
                  nom_dairaFR: dairaOpt.nom_dairaFR ?? null,
                  nom_dairaAR: dairaOpt.nom_dairaAR ?? null,
                  wilaya: wilayaStub ?? dairaOpt.wilaya ?? null,
                }
              : null;
            const communeStub = communeOpt
              ? {
                  id_commune: communeOpt.id_commune,
                  nom_communeFR: communeOpt.nom_communeFR ?? null,
                  nom_communeAR: communeOpt.nom_communeAR ?? null,
                  daira: dairaStub ?? communeOpt.daira ?? null,
                }
              : dairaStub
                ? {
                    id_commune: locationPayload.id_commune ?? null,
                    nom_communeFR: null,
                    nom_communeAR: null,
                    daira: dairaStub,
                  }
                : null;
            setPermis((prev) => {
              if (!prev) return prev;
              const procedures = Array.isArray(prev.procedures)
                ? prev.procedures.map((proc) => {
                    const demandes = Array.isArray(proc.demandes)
                      ? proc.demandes.map((dem: any) => {
                          if ((dem as any)?.id_demande !== latestDemandeId) return dem;
                          return {
                            ...dem,
                            id_wilaya: locationPayload.id_wilaya,
                            id_daira: locationPayload.id_daira,
                            id_commune: locationPayload.id_commune,
                            wilaya: wilayaStub ?? (dem as any)?.wilaya ?? null,
                            daira: dairaStub ?? (dem as any)?.daira ?? null,
                            commune: communeStub ?? (dem as any)?.commune ?? null,
                          };
                        })
                      : proc.demandes;
                    return { ...proc, demandes };
                  })
                : prev.procedures;
              return { ...prev, procedures };
            });
          } catch (err) {
            console.warn('Failed to sync localisation on demande', err);
          }
        }

        setIsEditingGeneral(false);
      toast.success('Informations générales mises à jour');
    } catch (err) {
      console.error('Failed to update permis', err);
      toast.error("Échec de la mise à jour du permis");
    } finally {
      setIsSavingGeneral(false);
    }
  }, [
    apiURL,
    generalForm,
    latestDemandeId,
    permis,
    wilayaOptions,
    dairaOptions,
    communeOptions,
    canModifyPermisData,
  ]);

  const handleSaveDates = useCallback(async () => {
    if (!canModifyPermisData) {
      toast.error("Permission 'modifier_permisData' requise.");
      return;
    }
    if (!apiURL || !permis) return;
    setIsSavingDates(true);
    const payload: any = {
      date_octroi: dateForm.date_octroi || null,
      date_expiration: dateForm.date_expiration || null,
      date_annulation: dateForm.date_annulation || null,
      date_renonciation: dateForm.date_renonciation || null,
    };
    try {
      const res = await axios.patch(`${apiURL}/permis_conf/${permis.id}`, payload, {
        withCredentials: true,
      });
      const updated = res.data;
      setPermis((prev) =>
        prev
          ? {
              ...prev,
              ...updated,
              procedures: prev.procedures,
              documents: prev.documents,
              renewals: prev.renewals,
            }
          : prev,
      );
      setIsEditingDates(false);
      toast.success('Dates mises à jour');
    } catch (err) {
      console.error('Failed to update dates', err);
      toast.error("Échec de la mise à jour des dates");
    } finally {
      setIsSavingDates(false);
    }
  }, [apiURL, dateForm, permis, canModifyPermisData]);

  const handleSaveRegistre = useCallback(async () => {
    if (!canModifyPermisData) {
      toast.error("Permission 'modifier_permisData' requise.");
      return;
    }
    if (!apiURL || !registreDraft?.id) return;
    setSavingRegistreId(registreDraft.id);
    try {
      const payload = {
        numero_rc: registreDraft.numero_rc || null,
        date_enregistrement: registreDraft.date_enregistrement || null,
        capital_social: registreDraft.capital_social ?? null,
        nis: registreDraft.nis || null,
        nif: registreDraft.nif || null,
        adresse_legale: registreDraft.adresse_legale || null,
      };
      await axios.put(`${apiURL}/api/registre-commerce/by-id/${registreDraft.id}`, payload, {
        withCredentials: true,
      });
      setRegistreCommerce((prev) =>
        prev.map((row) => (row.id === registreDraft.id ? { ...row, ...registreDraft } : row)),
      );
      setEditingRegistreId(null);
      setRegistreDraft(null);
      toast.success('Registre du commerce mis à jour');
    } catch (err) {
      console.error('Failed to update registre', err);
      toast.error("Échec de la mise à jour du registre");
    } finally {
      setSavingRegistreId(null);
    }
  }, [apiURL, registreDraft, canModifyPermisData]);

  const handleSaveActionnaire = useCallback(async () => {
    if (!canModifyPermisData) {
      toast.error("Permission 'modifier_permisData' requise.");
      return;
    }
    if (!apiURL || !actionnaireDraft?.id_actionnaire) return;
    const detenteurId =
      (permis?.detenteur as any)?.id_detenteur ??
      (permis as any)?.id_detenteur ??
      null;
    if (!detenteurId) {
      toast.error('Titulaire manquant pour mettre à jour les actionnaires');
      return;
    }
    setSavingActionnaireId(actionnaireDraft.id_actionnaire);
    const resolvedNationalite =
      actionnaireDraft.id_nationalite ??
      nationaliteOptions.find((n) => n.libelle === actionnaireDraft.nationalite)?.id_nationalite ??
      null;
    const resolvedPays =
      actionnaireDraft.id_pays ??
      paysOptions.find((p) => p.nom_pays === actionnaireDraft.paysLabel)?.id_pays ??
      null;
    if (!resolvedPays || !resolvedNationalite) {
      toast.error('Veuillez sélectionner le pays et la nationalité');
      setSavingActionnaireId(null);
      return;
    }
    try {
      const payload = {
        nom: actionnaireDraft.nom || '',
        prenom: actionnaireDraft.prenom || '',
        id_nationalite: resolvedNationalite,
        qualification: actionnaireDraft.qualification || '',
        numero_carte: actionnaireDraft.numero_carte || actionnaireDraft.numIdentite || '',
        taux_participation: String(actionnaireDraft.taux ?? '0'),
        id_pays: resolvedPays,
        lieu_naissance: actionnaireDraft.lieu_naissance || '',
      };
      await axios.put(
        `${apiURL}/api/actionnaires/${detenteurId}/${actionnaireDraft.id_actionnaire}`,
        payload,
        { withCredentials: true },
      );
      setActionnaires((prev) =>
        prev.map((row) =>
          row.id_actionnaire === actionnaireDraft.id_actionnaire
            ? {
                ...row,
                ...actionnaireDraft,
                id_nationalite: resolvedNationalite,
                id_pays: resolvedPays,
              }
            : row,
        ),
      );
      setEditingActionnaireId(null);
      setActionnaireDraft(null);
      toast.success('Actionnaire mis à jour');
    } catch (err) {
      console.error('Failed to update actionnaire', err);
      toast.error("Échec de la mise à jour de l'actionnaire");
    } finally {
      setSavingActionnaireId(null);
    }
  }, [apiURL, actionnaireDraft, nationaliteOptions, paysOptions, permis, canModifyPermisData]);

  const handleSaveSubstances = useCallback(async () => {
    if (!canModifyPermisData) {
      toast.error("Permission 'modifier_permisData' requise.");
      return;
    }
    if (!apiURL) return;
    if (!latestDemandeId) {
      toast.error('Aucune demande disponible pour mettre à jour les substances');
      return;
    }
    setIsSavingSubstances(true);
    try {
      const currentRes = await axios.get(
        `${apiURL}/api/substances/demande/${latestDemandeId}/substances`,
        { withCredentials: true },
      );
      const existing = Array.isArray(currentRes.data) ? currentRes.data : [];
      const existingPriorityMap = new Map<number, 'principale' | 'secondaire'>();
      existing.forEach((row: any) => {
        const id =
          row?.substance?.id_sub ??
          row?.id_substance ??
          row?.id_sub ??
          null;
        if (typeof id !== 'number' || Number.isNaN(id)) return;
        const rawPriority = row?.priorite ?? row?.substance?.priorite ?? '';
        existingPriorityMap.set(
          id,
          rawPriority === 'principale' ? 'principale' : 'secondaire',
        );
      });
      const existingIds = Array.from(existingPriorityMap.keys());
      const toAdd = selectedSubstanceIds.filter((id) => !existingIds.includes(id));
      const toRemove = existingIds.filter((id) => !selectedSubstanceIds.includes(id));
      const toUpdatePriority = selectedSubstanceIds.filter((id) => {
        if (!existingPriorityMap.has(id)) return false;
        const desired = substancePriorities[id] ?? 'secondaire';
        const current = existingPriorityMap.get(id) ?? 'secondaire';
        return desired !== current;
      });

      await Promise.all([
        ...toAdd.map((id) =>
          axios.post(
            `${apiURL}/api/substances/demande/${latestDemandeId}`,
            { id_substance: id, priorite: substancePriorities[id] ?? 'secondaire' },
            { withCredentials: true },
          ),
        ),
        ...toUpdatePriority.map((id) =>
          axios.put(
            `${apiURL}/api/substances/demande/${latestDemandeId}/${id}/priority`,
            { priorite: substancePriorities[id] ?? 'secondaire' },
            { withCredentials: true },
          ),
        ),
        ...toRemove.map((id) =>
          axios.delete(`${apiURL}/api/substances/demande/${latestDemandeId}/${id}`, {
            withCredentials: true,
          }),
        ),
      ]);

      const nextList = selectedSubstanceIds
        .map((id) => {
          const base = allSubstanceOptions.find((s) => s.id_sub === id);
          if (!base) return null;
          return {
            ...base,
            priorite: substancePriorities[id] ?? existingPriorityMap.get(id) ?? 'secondaire',
          };
        })
        .filter(Boolean);
      setSubstancesOverride(nextList as any[]);
      setIsEditingSubstances(false);
      toast.success('Substances mises à jour');
    } catch (err) {
      console.error('Failed to update substances', err);
      toast.error("Échec de la mise à jour des substances");
    } finally {
      setIsSavingSubstances(false);
    }
  }, [
    apiURL,
    allSubstanceOptions,
    latestDemandeId,
    selectedSubstanceIds,
    substancePriorities,
    canModifyPermisData,
  ]);
// Add to your useEffect section
const loadObligations = useCallback(async () => {
  if (!permis?.id || !isAuthReady) {
    return;
  }

  setIsLoadingObligations(true);
  try {
    const response = await axios.get(`${apiURL}/payments/obligations/${permis.id}`, {
      withCredentials: true,
    });
    setObligations(response.data);
  } catch (error) {
    console.error('Error loading obligations:', error);
    toast.error('Erreur lors du chargement des obligations fiscales');
  } finally {
    setIsLoadingObligations(false);
  }
}, [apiURL, isAuthReady, permis?.id]);

useEffect(() => {
  if (activeTab === 'obligations') {
    void loadObligations();
  }
}, [activeTab, loadObligations]);

const DocumentCard: React.FC<DocumentCardProps> = ({ document, onView, onDownload }) => {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date | string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('fr-FR');
  };

  return (
    <div className={styles.documentCard}>
      <div className={styles.documentIcon}>
        <FileText size={24} />
      </div>
      <div className={styles.documentInfo}>
        <h4 className={styles.documentName}>{document.nom}</h4>
        <p className={styles.documentType}>{document.type}</p>
        {document.description && (
          <p className={styles.documentDescription}>{document.description}</p>
        )}
        <p className={styles.documentMeta}>
          Ajouté le {formatDate(document.date_upload)} • {formatFileSize(document.taille)}
          {document.status && (
            <span className={`${styles.documentStatus} ${styles[`status${document.status}`]}`}>
              {document.status}
            </span>
          )}
        </p>
      </div>
      <div className={styles.documentActions}>
        {document.url ? (
          <>
            <button 
              className={styles.iconButton}
              onClick={() => onView(document)}
              title="Voir le document"
            >
              <Eye size={16} />
            </button>
            <button 
              className={styles.iconButton}
              onClick={() => onDownload(document)}
              title="Télécharger"
            >
              <Download size={16} />
            </button>
          </>
        ) : (
          <span className={styles.documentUnavailable}>
            NO URL FOUND!
          </span>
        )}
      </div>
    </div>
  );
};

  const loadDocuments = useCallback(async () => {
    if (!permis?.id || !isAuthReady) {
      return;
    }

    setIsLoadingDocuments(true);
    try {
      const response = await axios.get(`${apiURL}/Permisdashboard/${permis.id}/documents`, {
        withCredentials: true,
      });
      const payload = response.data?.data || null;
      setDocumentsData(payload);
      if (payload?.procedures) {
        setExpandedProcedures(payload.procedures.map((proc: { id_proc: number }) => proc.id_proc));
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Erreur lors du chargement des documents');
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [apiURL, isAuthReady, permis?.id]);

  // Clear previous documents when switching permits to avoid stale guards
  useEffect(() => {
    setDocumentsData(null);
    setExpandedProcedures([]);
  }, [permis?.id]);

  // Always (re)load documents when a valid permit and auth are ready
  useEffect(() => {
    if (!permis?.id || !isAuthReady) {
      return;
    }
    void loadDocuments();
  }, [isAuthReady, loadDocuments, permis?.id]);

const toggleProcedure = (procedureId: number) => {
  setExpandedProcedures(prev =>
    prev.includes(procedureId)
      ? prev.filter(id => id !== procedureId)
      : [...prev, procedureId]
  );
};

  // Early UI while fetching or when error is present



if (permis?.date_expiration) {
  const expiryDate =
    typeof permis?.date_expiration === "string"
      ? new Date(permis?.date_expiration)
      : permis?.date_expiration;

  const today = new Date();

  if (expiryDate instanceof Date && !isNaN(expiryDate.getTime())) {
    daysUntilExpiry = differenceInDays(expiryDate, today);
  }
}

  // Calculate statistics on component mount
  useEffect(() => {
    if (permis!) {
      const totalProcedures = permis?.procedures.length;
      const completedProcedures = permis?.procedures.filter(p => 
        p.statut_proc === 'TERMINEE').length;
      const activeProcedures = permis?.procedures.filter(p => 
        p.statut_proc === 'EN_COURS').length;
      const renewalCount = permis?.renewals?.length || 0;
      
      let daysUntilExpiry = 0;
      let validityStatus = 'Inconnu';
      
      if (permis?.date_expiration) {
      const expiryDate = typeof permis?.date_expiration === 'string' 
        ? new Date(permis?.date_expiration) 
        : permis?.date_expiration;
      const today = new Date();
      daysUntilExpiry = differenceInDays(expiryDate, today);
        
        if (daysUntilExpiry < 0) {
          validityStatus = 'Expirée';
        } else if (daysUntilExpiry < 30) {
          validityStatus = 'Expire bientôt';
        } else {
          validityStatus = 'Valide';
        }
      }
      
      setStatsData({
        totalProcedures,
        completedProcedures,
        activeProcedures,
        renewalCount,
        daysUntilExpiry,
        validityStatus
      });
    }
  }, [permis]);

  // Handle initial error
  useEffect(() => {
    if (error) {
      setNotif({ message: `Erreur: ${error}`, type: 'error' });
    }
  }, [error]);

  const optionNewType = permis?.typePermis?.code_type;
  const optionOldType = optionNewType ? OPTION_TYPE_MAP[optionNewType] : undefined;
  const isLegacyPermis = typeof permis?.id === 'number' && permis.id <= 10899;
  const isOptionEligible = isLegacyPermis;

  const hasOptionProcedure = !!permis?.procedures?.some((p) => {
    const candidates = [
      p.typeProcedure,
      ...(Array.isArray(p.demandes) ? p.demandes.map((d) => d?.typeProcedure) : []),
    ].filter(Boolean);
    return candidates.some((tp: any) => {
      const lib = (tp?.libelle || '').toLowerCase();
      const code = (tp?.code || '').toLowerCase();
      const desc = (tp?.description || '').toLowerCase();
      return lib.includes('option') || code.includes('option') || desc.includes('option');
    });
  });

  const isProceduresLocked = isOptionEligible && !hasOptionProcedure;
  const lockMessage = "Option 2025 non encore deposee : veuillez la faire pour activer les autres procedures.";
  const warnLocked = () => toast.warning(lockMessage);

  // Helper to check unpaid obligations before actions
  const checkObligationsBeforeAction = useCallback(
    async (permisId: number) => {
      const apiURL = process.env.NEXT_PUBLIC_API_URL;
      if (!apiURL) return true;

      const parseMessage = (msg?: string) => {
        if (!msg) return [];
        // Remove leading label
        const cleaned = msg.replace(/^Renouvellement bloque\s*:\s*/i, '');
        return cleaned
          .split('-')
          .map((chunk) => chunk.trim())
          .filter((chunk) => chunk.length > 0)
          .map((chunk) => {
            const [lib, amtRaw] = chunk.split(':').map((s) => s.trim());
            return {
              year: '-',
              type: lib || '-',
              montant:
                amtRaw && amtRaw.length
                  ? amtRaw.replace(/\s+/g, ' ').replace('DZD', 'DZD')
                  : '-',
              dueDate: '-',
            };
          });
      };

      const parseMessageLines = (msg?: string) => {
        if (!msg) return [];
        return msg
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.startsWith('-'))
          .map((l) => {
            const stripped = l.replace(/^-+\s*/, '');
            const [lib, amount] = stripped.split(':').map((s) => s.trim());
            return {
              type: lib || '-',
              montant: amount || '-',
              year: '-',
              due: '-',
            };
          });
      };

      try {
        const resp = await axios.post(
          `${apiURL}/api/procedures/renouvellement/check-payments`,
          { permisId },
          { withCredentials: true },
        );
        const obligations = resp.data?.unpaid || resp.data?.obligations || [];
        if (Array.isArray(obligations) && obligations.length > 0) {
          setUnpaidObligations(obligations);
          setObligationMessage(
            resp.data?.message ||
              'Des obligations non payées ont été détectées pour ce permis.',
          );
          setShowObligationWarning(true);
          return false;
        }
        return true;
      } catch (err: any) {
        const data = err?.response?.data || {};
        const obligations = data?.unpaid || data?.obligations || [];
        const message =
          data?.message ||
          'Des obligations non payées ont été détectées pour ce permis.';
        const parsed =
          Array.isArray(obligations) && obligations.length
            ? obligations
            : (() => {
                const fromLines = parseMessageLines(message);
                const fromInline = parseMessage(message);
                return fromLines.length ? fromLines : fromInline;
              })();
        setUnpaidObligations(parsed);
        setObligationMessage(message);
        setShowObligationWarning(true);
      return false;
    }
  },
  [],
);

  const checkObligationsForTransfer = useCallback(
    async (permisId: number, actionType: 'transfer' | 'cession' = 'transfer') => {
      const apiURL = process.env.NEXT_PUBLIC_API_URL;
      if (!apiURL) {
        setNotif({ message: "Configuration API manquante.", type: 'error' });
        return false;
      }

      try {
        const resp = await axios.get(
          `${apiURL}/payments/check-obligations/${permisId}`,
          { withCredentials: true },
        );
        const missing = Array.isArray(resp.data?.missing) ? resp.data.missing : [];
        if (resp.data?.isPaid === false && missing.length > 0) {
          setUnpaidObligations(missing);
          setObligationMessage(
            'Des obligations non payées ont été détectées pour ce permis.',
          );
          setPendingActionAfterWarning({ type: actionType, permisId });
          setShowObligationWarning(true);
          return false;
        }
        return true;
      } catch (err: any) {
        const message =
          err?.response?.data?.message ||
          "Impossible de vérifier les obligations du permis.";
        setNotif({ message, type: 'error' });
        return false;
      }
    },
    [
      setNotif,
      setObligationMessage,
      setShowObligationWarning,
      setUnpaidObligations,
      setPendingActionAfterWarning,
    ],
  );

  const handleOptionStart = useCallback(async (): Promise<boolean> => {
    if (!permis?.id) {
      toast.error('Permis introuvable');
      return false;
    }
    const apiURL = process.env.NEXT_PUBLIC_API_URL;
    if (!apiURL) {
      toast.error('Configuration API manquante');
      return false;
    }

    const signature = (optionSignatureDateRef.current || optionSignatureDate || '').trim();
    if (!signature) {
      const msg = 'Veuillez renseigner la date de signature du permis.';
      setOptionSignatureDateError(msg);
      toast.warning(msg);
      return false;
    }

    setOptionSignatureDateError(null);
    const parsed = new Date(signature);
    if (isNaN(parsed.getTime())) {
      const msg = 'Date de signature invalide.';
      setOptionSignatureDateError(msg);
      toast.warning(msg);
      return false;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await axios.post(
        `${apiURL}/api/procedures/option-2025/start`,
        {
          permisId: permis.id,
          date_debut_proc: today,
          date_fin_proc: today,
          date_signature_permis: signature,
        },
        { withCredentials: true },
      );
      const updated = res.data?.permis ?? res.data;
      if (updated) {
        // Ensure renewals array exists to avoid downstream UI errors
        setPermis({
          ...(updated as any),
          renewals: Array.isArray((updated as any).renewals) ? (updated as any).renewals : [],
        });
      }
      setNotif({ message: 'Option 2025 deposee avec succes.', type: 'success' });
      setOptionDownloadMessage(
        'Option 2025 reussie. Voulez-vous aller telecharger le permis ?',
      );
      setShowOptionDownloadModal(true);
      return true;
    } catch (err) {
      console.error('Erreur lors de la demande Option 2025', err);
      toast.error("Echec de la demande d'option 2025");
      return false;
    }
  }, [permis?.id, setPermis, setNotif]);

  // Action handlers (declared early so callbacks can reference them)
  const handleRenewalClick = async (permisId: number) => {
    const apiURL = process.env.NEXT_PUBLIC_API_URL;

    if (isProceduresLocked) {
      warnLocked();
      return;
    }

    if ((permis?.renewals?.length || 0) >= permis!.typePermis.nbr_renouv_max) {
      setShowMaxRenewalModal(true);
      return;
    }

    // Check unpaid obligations before proceeding
    const ok = await checkObligationsBeforeAction(permisId);
    if (!ok) {
      setPendingActionAfterWarning({ type: 'renewal', permisId });
      return;
    }

    setPendingPermisId(permisId);
    setShowDateModal(true);
  };

  const handleStartExpiration = async (typeProcedureId?: number) => {
    if (!apiURL || !permis?.id) return;
    try {
      const res = await axios.post(
        `${apiURL}/Permisdashboard/${permis.id}/expiration/start`,
        { typeProcedureId },
        { withCredentials: true },
      );
      const procId =
        res.data?.id_proc ??
        res.data?.procId ??
        res.data?.proc_id ??
        res.data?.new_proc_id ??
        res.data?.id;
      if (!procId) {
        throw new Error('Procedure introuvable.');
      }
      await router.push(`/expiration/step1/page1?id=${procId}&permisId=${permis.id}`);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.statusText ||
        error?.message ||
        "Erreur lors du demarrage de l'expiration.";
      toast.error(message);
    }
  };

  const handleStartAnnulation = async (typeProcedureId?: number) => {
    if (!apiURL || !permis?.id) return;
    try {
      const res = await axios.post(
        `${apiURL}/Permisdashboard/${permis.id}/annulation/start`,
        { typeProcedureId },
        { withCredentials: true },
      );
      const procId =
        res.data?.id_proc ??
        res.data?.procId ??
        res.data?.proc_id ??
        res.data?.new_proc_id ??
        res.data?.id;
      if (!procId) {
        throw new Error('Procedure introuvable.');
      }
      await router.push(`/annulation/step1/page1?id=${procId}&permisId=${permis.id}`);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.statusText ||
        error?.message ||
        "Erreur lors du demarrage de l'annulation.";
      toast.error(message);
    }
  };

  const handletransfertClick = async (permisId: number, force = false) => {
    const apiURL = process.env.NEXT_PUBLIC_API_URL;

    if (isProceduresLocked) {
      warnLocked();
      return;
    }

    try {
      if (!force) {
        const ok = await checkObligationsForTransfer(permisId);
        if (!ok) {
          return;
        }
      }

      const res = await axios.post(
        `${apiURL}/transfert/start-from-permis`,
        {
          permisId,
          date_demande: new Date().toISOString(),
        },
        { withCredentials: true },
      );

      const procId =
        res.data?.procId ??
        res.data?.proc_id ??
        res.data?.new_proc_id ??
        res.data?.id_proc;

      if (!procId) {
        throw new Error('ID de procedure manquant pour le transfert');
      }

      const params = new URLSearchParams();
      params.set('id', String(procId));
      params.set('permisId', String(permisId));
      router.push(`/transfert/step1/page1?${params.toString()}`);
    } catch (error: any) {
      let errorMessage = 'Erreur inconnue';

      if (error.response) {
        errorMessage = error.response.data.message || error.response.statusText;
      } else if (error.request) {
        errorMessage = 'Pas de réponse du serveur';
      } else {
        errorMessage = error.message;
      }

      setNotif({
        message: `⛔ ${errorMessage}`,
        type: 'error',
      });
    }
  };

  const handleCessionClick = async (permisId: number, force = false) => {
    const apiURL = process.env.NEXT_PUBLIC_API_URL;

    if (isProceduresLocked) {
      warnLocked();
      return;
    }

    try {
      if (!force) {
        const ok = await checkObligationsForTransfer(permisId, 'cession');
        if (!ok) {
          return;
        }
      }

      const res = await axios.post(
        `${apiURL}/actionnaires/cession/start`,
        { permisId },
        { withCredentials: true },
      );

      const procId =
        res.data?.procedureId ??
        res.data?.procId ??
        res.data?.proc_id ??
        res.data?.new_proc_id ??
        res.data?.id_proc;

      if (!procId) {
        throw new Error('ID de procedure manquant pour la cession');
      }

      const params = new URLSearchParams();
      params.set('id', String(procId));
      params.set('idPermis', String(permisId));
      router.push(`/cession_permis/step1/page1?${params.toString()}`);
    } catch (error: any) {
      let errorMessage = 'Erreur inconnue';

      if (error.response) {
        errorMessage = error.response.data.message || error.response.statusText;
      } else if (error.request) {
        errorMessage = 'Pas de réponse du serveur';
      } else {
        errorMessage = error.message;
      }

      setNotif({
        message: `✗ ${errorMessage}`,
        type: 'error',
      });
    }
  };

  const handleActionWithConfirmation = (
    actionType: string,
    callback: () => void | boolean | Promise<void | boolean>,
  ) => {
    setPendingAction({ type: actionType, callback });
    setShowConfirmationModal(true);
  };

  const resetExtensionModal = () => {
    setShowExtensionModal(false);
    setWantsExtension(false);
    setWantsModification(false);
    setExtensionChoice(null);
  };

  const handleExtensionConfirm = async () => {
    const permisIdParam = permis?.id ?? idPermis;

    if (isProceduresLocked) {
      warnLocked();
      return;
    }

    if (wantsExtension && !extensionChoice) {
      setNotif({ message: "Choisissez le type d'extension.", type: 'info' });
      return;
    }

    if (wantsExtension && extensionChoice) {
      if (permisIdParam === null || permisIdParam === undefined) {
        setNotif({ message: "Permis introuvable pour lancer l'extension.", type: 'error' });
        return;
      }
      try {
        const res = await axios.post(
          `${apiURL}/api/extension/start`,
          { permisId: Number(permisIdParam) },
          { withCredentials: true },
        );
        const data = res.data || {};
        const procId = data.new_proc_id ?? data.original_proc_id ?? null;
        const numProc = data.num_proc || (procId ? `PROC-${procId}` : '');
        if (!procId) {
          setNotif({ message: "Impossible de créer la procédure d'extension.", type: 'error' });
          return;
        }
        const basePath =
          extensionChoice === 'perimetres'
            ? '/extension_permis/step1/page1'
            : '/extension_substance/extension_substance';
        const params = new URLSearchParams();
        params.set('permisId', String(permisIdParam));
        params.set('procId', String(procId));
        if (numProc) params.set('numProc', numProc);
        router.push(`${basePath}?${params.toString()}`);
      } catch (err) {
        console.error('Demarrage extension impossible', err);
        setNotif({ message: "Impossible de démarrer l'extension.", type: 'error' });
        return;
      }
    } else if (wantsModification) {
      if (permisIdParam === null || permisIdParam === undefined) {
        setNotif({ message: "Permis introuvable pour lancer la modification.", type: 'error' });
        return;
      }
      try {
        const res = await axios.post(
          `${apiURL}/api/extension/start`,
          { permisId: Number(permisIdParam) },
          { withCredentials: true },
        );
        const data = res.data || {};
        const procId = data.new_proc_id ?? data.original_proc_id ?? null;
        const numProc = data.num_proc || (procId ? `PROC-${procId}` : '');
        if (!procId) {
          setNotif({ message: "Impossible de créer la procédure de modification.", type: 'error' });
          return;
        }
        setNotif({ message: `Procédure ${numProc || procId} créée et liée au permis.`, type: 'success' });
      } catch (err) {
        console.error('Demarrage modification impossible', err);
        setNotif({ message: "Impossible de démarrer la modification.", type: 'error' });
        return;
      }
    }

    resetExtensionModal();
  };
const getActionButtonClass = (variant: ActionVariant) => {
    switch (variant) {
      case 'primary':
        return styles.actionButtonPrimary;
      case 'success':
        return styles.actionButtonSuccess;
      case 'warning':
        return styles.actionButtonWarning;
      case 'danger':
        return styles.actionButtonDanger;
      default:
        return styles.actionButtonPrimary;
    }
  };

  const getActionConfigForType = useCallback(
    (tp: TypeProcedureSummary): TypeProcedureAction => {
      const label = tp.libelle || 'Action';
      const lowered = label.toLowerCase();
      const code = tp.code?.toLowerCase() || '';
      const limitReached =
        (permis?.renewals?.length || 0) >= (permis?.typePermis?.nbr_renouv_max ?? 0);

      // Default navigation for unhandled types
      const isFusionAction = lowered.includes('fusion');
      const isTransfertAction =
        lowered.includes('transfert') ||
        lowered.includes('transfer') ||
        lowered.includes('transf') ||
        code === 'trf' ||
        code.includes('transf');
      const isCessionAction =
        lowered.includes('cession') || code === 'ces' || code.includes('ces');
      const isExpirationAction =
        lowered.includes('expiration') || code.includes('expir');
      const isAnnulationAction =
        lowered.includes('annulation') ||
        lowered.includes('retrait') ||
        code.includes('annul');

      if (isExpirationAction) {
        return {
          id: tp.id,
          label,
          description: tp.description,
          variant: 'danger',
          tooltip: isProceduresLocked ? lockMessage : tp.description ?? undefined,
          icon: <XCircle size={18} />,
          allowDuringProcedureInProgress: true,
          onClick: () => {
            if (isProceduresLocked) {
              warnLocked();
              return;
            }
            if (isStatutExpired) {
              toast.info('Ce permis est deja marque comme expire.');
              return;
            }
            if (!isExpiredByDate) {
              toast.warning("Ce permis n'est pas encore expiré.");
              return;
            }
            handleActionWithConfirmation('expiration', () => handleStartExpiration(tp.id));
          },
        };
      }

      if (isAnnulationAction) {
        return {
          id: tp.id,
          label,
          description: tp.description,
          variant: 'danger',
          tooltip: isProceduresLocked ? lockMessage : tp.description ?? undefined,
          icon: <XCircle size={18} />,
          allowDuringProcedureInProgress: true,
          onClick: () => {
            if (isProceduresLocked) {
              warnLocked();
              return;
            }
            handleActionWithConfirmation('annulation', () => handleStartAnnulation(tp.id));
          },
        };
      }

      if (lowered.includes('extension') || lowered.includes('modification')) {
        return {
          id: tp.id,
          label,
          description: tp.description,
          variant: 'primary',
          tooltip: isProceduresLocked ? lockMessage : undefined,
          icon: <Edit2 size={18} />,
          onClick: () => {
            if (isProceduresLocked) {
              warnLocked();
              return;
            }
            setShowExtensionModal(true);
            setWantsExtension(false);
            setWantsModification(false);
            setExtensionChoice(null);
          },
        };
      }
      const defaultAction = () => {
        if (!permis?.id) return;
        if (isProceduresLocked) {
          warnLocked();
          return;
        }
        if (isFusionAction) {
          const typeCode = permis.typePermis?.code_type;
          if (!typeCode) {
            console.warn('Permis type code unavailable for fusion action');
            return;
          }
          router.push(
            `/fusion_permis/fusion?idPermisA=${permis.id}&idType=${typeCode}`,
          );
          return;
        }
        if (isTransfertAction) {
          handletransfertClick(permis.id);
          return;
        }
        if (isCessionAction) {
          handleCessionClick(permis.id);
          return;
        }
        router.push(
          `/permis_dashboard/create-procedure?permisId=${permis.id}&typeProcedureId=${tp.id}`,
        );
      };

      if (lowered.includes('renouv')) {
        return {
          id: tp.id,
          label,
          description: tp.description,
          variant: 'primary',
          disabled: limitReached,
          allowDuringProcedureInProgress: true,
          tooltip: isProceduresLocked
            ? lockMessage
            : limitReached
              ? `Maximum de ${permis?.typePermis?.nbr_renouv_max ?? 0} renouvellements atteint`
              : tp.description ?? undefined,
          icon: <RefreshCw size={18} />,
          onClick: () => {
            if (isProceduresLocked) {
              warnLocked();
              return;
            }
            if (limitReached) {
              setShowMaxRenewalModal(true);
              return;
            }
            handleActionWithConfirmation('renouvellement', () => handleRenewalClick(permis!.id));
          },
        };
      }

      if (lowered.includes('modif')) {
        return {
          id: tp.id,
          label,
          description: tp.description,
          variant: 'success',
          tooltip: isProceduresLocked ? lockMessage : undefined,
          icon: <Edit2 size={18} />,
          onClick: () =>
            handleActionWithConfirmation('modification', () => {
              if (isProceduresLocked) {
                warnLocked();
                return;
              }
              setNotif({ message: 'Demande de modification initiée', type: 'info' });
            }),
        };
      }

      if (lowered.includes('transfert')) {
        return {
          id: tp.id,
          label,
          description: tp.description,
          variant: 'primary',
          tooltip: isProceduresLocked ? lockMessage : undefined,
          icon: <RefreshCw size={18} />,
          onClick: () => {
            if (isProceduresLocked) {
              warnLocked();
              return;
            }
            handletransfertClick(permis!.id);
          },
        };
      }

      if (lowered.includes('cession')) {
        return {
          id: tp.id,
          label,
          description: tp.description,
          variant: 'primary',
          tooltip: isProceduresLocked ? lockMessage : undefined,
          icon: <RefreshCw size={18} />,
          onClick: () => {
            if (isProceduresLocked) {
              warnLocked();
              return;
            }
            handleCessionClick(permis!.id);
          },
        };
      }

      if (lowered.includes('renon')) {
        return {
          id: tp.id,
          label,
          description: tp.description,
          variant: 'danger',
          tooltip: isProceduresLocked ? lockMessage : undefined,
          icon: <XCircle size={18} />,
          onClick: () =>
            handleActionWithConfirmation('renonciation', () => {
              if (isProceduresLocked) {
                warnLocked();
                return;
              }
              setNotif({ message: 'Demande de renonciation initiée', type: 'info' });
            }),
        };
      }

      return {
        id: tp.id,
        label,
        description: tp.description,
        variant: 'primary',
        disabled: isProceduresLocked,
        tooltip: isProceduresLocked ? lockMessage : tp.description ?? undefined,
        icon: <ChevronRight size={18} />,
        onClick: defaultAction,
      };
    },
    [
      permis?.renewals?.length,
      permis?.typePermis?.nbr_renouv_max,
      permis?.id,
      isProceduresLocked,
      lockMessage,
      isExpiredByDate,
      isStatutExpired,
      handleStartExpiration,
      handleStartAnnulation,
      handleActionWithConfirmation,
      handleRenewalClick,
      setShowMaxRenewalModal,
      handletransfertClick,
      handleCessionClick,
      setNotif,
      router,
    ],
  );

  const resolvedActions = useMemo(() => {
    const canOption2025 = hasPermission('option_vers_titre');

    const mapped =
      typeProceduresForPermis.length > 0
        ? typeProceduresForPermis.map((tp) => getActionConfigForType(tp))
        : [];

    // Pour les nouveaux permis (id > 10899), on n'affiche pas l'option
    if (!isOptionEligible) {
      return mapped;
    }

    const optionAction: TypeProcedureAction = {
      id: 'option-2025',
      label: 'Option-2025',
      variant: canOption2025 ? 'primary' : 'secondary',
      allowDuringProcedureInProgress: true,
      tooltip: !canOption2025
        ? 'Permission requise : Option vers Titre (contactez votre responsable)'
        : hasOptionProcedure
          ? 'Option deja deposee (telecharger le permis)'
          : optionOldType && optionNewType
            ? `Option ${optionOldType} -> ${optionNewType}`
            : undefined,
      icon: <ArrowRight size={18} />,
      onClick: () => {
        if (!canOption2025) {
          openOptionPermissionModal();
          return;
        }
        if (hasOptionProcedure) {
          setOptionDownloadMessage(
            'Ce permis possede deja une procedure Option 2025. Voulez-vous aller telecharger le permis ?',
          );
          setShowOptionDownloadModal(true);
          return;
        }

        const existing = permis?.date_octroi
          ? new Date(permis.date_octroi as any).toISOString().split('T')[0]
          : '';
        optionSignatureDateRef.current = existing;
        setOptionSignatureDate(existing);
        setOptionSignatureDateError(null);
        handleActionWithConfirmation('option2025', handleOptionStart);
      },
    };

    const baseActions = mapped;

    return [optionAction, ...baseActions.filter((a) => a.id !== 'option-2025')];
  }, [
    getActionConfigForType,
    typeProceduresForPermis,
    isOptionEligible,
    hasOptionProcedure,
    optionOldType,
    optionNewType,
    openOptionPermissionModal,
    handleActionWithConfirmation,
    handleOptionStart,
    permis?.date_octroi,
  ]);

  const fetchTypeProceduresForPermis = useCallback(async () => {
    if (!apiURL || !permis?.typePermis?.id) return;

    setIsLoadingTypeProcedures(true);
    try {
      const res = await fetch(`${apiURL}/phases-etapes/combinaisons`);
      if (!res.ok) {
        throw new Error('Failed to load procedure types for permit');
      }
      const data = await res.json();
      const combos = Array.isArray(data) ? data : (data?.data ?? []);

      const matched = combos.filter(
        (combo: any) => combo.id_typePermis === permis.typePermis.id
      );

      const uniqueMap = new Map<number, TypeProcedureSummary>();
      matched.forEach((combo: any) => {
        const tp = combo.typeProc || combo.typeProcedure;
        if (tp?.id && !uniqueMap.has(tp.id)) {
          uniqueMap.set(tp.id, {
            id: tp.id,
            libelle: tp.libelle || tp.code || 'Type de proc\u00e9dure',
            code: tp.code ?? null,
            description: tp.description ?? null,
          });
        }
      });

      setTypeProceduresForPermis(Array.from(uniqueMap.values()));
    } catch (err) {
      console.error('Error fetching type procedures for permis:', err);
      setTypeProceduresForPermis([]);
    } finally {
      setIsLoadingTypeProcedures(false);
    }
  }, [apiURL, permis?.typePermis?.id]);

  const fetchAllTypeProcedures = useCallback(async () => {
    if (!apiURL) return;
    try {
      const res = await fetch(`${apiURL}/conf/type-procedures`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to load type procedures');
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.data ?? [];
      const mapped: TypeProcedureSummary[] = list.map((tp: any) => ({
        id: tp.id,
        libelle: tp.libelle || tp.code || 'Type de procédure',
        code: tp.code ?? null,
        description: tp.description ?? null,
      }));
      setAllTypeProcedures(mapped);
    } catch (err) {
      console.error('Error fetching all type procedures:', err);
      setAllTypeProcedures([]);
    }
  }, [apiURL]);

  useEffect(() => {
    setTypeProceduresForPermis([]);
    void fetchTypeProceduresForPermis();
  }, [fetchTypeProceduresForPermis, route.asPath]);

  useEffect(() => {
    void fetchAllTypeProcedures();
  }, [fetchAllTypeProcedures]);

 const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return 'Non définie';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj as Date, 'PPP', { locale: fr });
};

  const getProcedureType = (procedure: Procedure): string => {
    const demandeWithType = procedure.demandes?.find(
      (d) => d?.typeProcedure?.libelle,
    );
    const directType = demandeWithType?.typeProcedure?.libelle;
    if (directType) return directType;

    const procType =
      procedure.typeProcedure?.libelle ||
      (procedure as any)?.typeProcedure?.libelle;
    if (procType) return procType;

    const typeIdRaw =
      demandeWithType?.id_typeProc ??
      (procedure as any).typeProcedureId ??
      (procedure as any).id_typeProc ??
      (procedure as any).id_typeProcedure ??
      (procedure as any).typeProcedureID ??
      (procedure as any).type_proc_id ??
      (procedure as any).typeProcId ??
      procedure.typeProcedureId ??
      procedure.id_typeProc ??
      null;

    if (typeIdRaw != null) {
      const parsed = Number(typeIdRaw);
      const lookupList = [...typeProceduresForPermis, ...allTypeProcedures];
      const match = lookupList.find((tp) => tp && tp.id === parsed);
      if (match?.libelle) return match.libelle;
      if (match?.code) return match.code as string;
      // Fallback: show the ID to avoid "Non définie" when the list is empty
      return `Type #${parsed}`;
    }

    return 'Non définie';
  };

  const procedureTypes = Array.from(
    new Set(permis?.procedures.map(p => getProcedureType(p)))
  );

  const calculateValidityStatus = (expiryDate: Date | string | null) => {
  if (!expiryDate) return 'Inconnu';

  const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  const today = new Date();
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Expirée';
  if (diffDays < 30) return 'Expire bientôt';
  return 'Valide';
};

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'en_cours':
        return styles.badgePrimary;
      case 'terminee':
        return styles.badgeSuccess;
      case 'en_attente':
        return styles.badgeWarning;
      case 'rejetee':
      case 'annulee':
        return styles.badgeDanger;
      default:
        return styles.badgeNeutral;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'en_cours':
        return <Clock size={14} />;
      case 'terminee':
        return <CheckCircle size={14} />;
      case 'en_attente':
        return <AlertTriangle size={14} />;
      case 'rejetee':
      case 'annulee':
        return <XCircle size={14} />;
      default:
        return <Info size={14} />;
    }
  };

  const getProcedureBorderColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'EN_COURS': return '#6366f1';
      case 'TERMINEE': return '#10b981';
      case 'EN_ATTENTE': return '#f59e0b';
      case 'REJETEE': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  const getDemandeBasePath = (procedure?: Procedure) => {
    const fromPermis = permis?.typePermis?.code_type;
    const fromProcedure =
      (procedure as any)?.demandes?.[0]?.typePermis?.code_type ||
      (procedure as any)?.demandes?.[0]?.type_permis?.code_type;
    const codeType = (fromPermis || fromProcedure || '').toUpperCase();

    if (codeType === 'APM') return '/demande_apm';
    if (codeType === 'TEM') return '/demande_exploration_mines';
    if (codeType.startsWith('TX')) return '/demande_exploitation';
    if (codeType === 'AXW') return '/demande_axw';
    return '/demande';
  };

  // Function to get all unique substances from all procedures
  const getAllSubstances = () => (substancesOverride ?? detailedSubstances);


  const resolveStepNumber = (proc: Procedure) => {
    const inProgress = proc.ProcedureEtape.find(
      (step) => step.statut === 'EN_COURS' && step.etape?.ordre_etape != null
    );
    if (inProgress?.etape?.ordre_etape != null) return inProgress.etape.ordre_etape;

    const firstWithOrder = proc.ProcedureEtape.find((step) => step.etape?.ordre_etape != null);
    return firstWithOrder?.etape?.ordre_etape ?? 1;
  };

  const handleViewProcedure = (procedure: Procedure) => {
    if (!permis) return;

    const normalizeLabel = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const procedureType = normalizeLabel(getProcedureType(procedure));
    const procNumber = normalizeLabel(procedure.num_proc || '');

    const isOption2025 = procedureType.includes('option');
    const isRenewal =
      procedureType.includes('renouvel') || procedureType === 'rnv' || procNumber.includes('ren');
    const isExtension =
      procedureType.includes('extension') ||
      procedureType.includes('modification') ||
      procedureType === 'ext' ||
      procNumber.includes('ext');
    const isTransfert =
      procedureType.includes('transfert') ||
      procedureType.includes('transfer') ||
      procedureType.includes('transf') ||
      procedureType === 'trf' ||
      procNumber.includes('trf');
    const isCession = procedureType.includes('cession');
    const isFusion = procedureType.includes('fusion');
    const currentStep = procedure.ProcedureEtape.find(step => step.statut === 'EN_COURS');
    const stepNumber = currentStep?.etape?.ordre_etape ?? resolveStepNumber(procedure);

    let url: string;

    if (isOption2025) {
      url = `/permis_dashboard/view/permis_option_designer?permisId=${permis.id}`;
    } else if (isExtension) {
      const params = new URLSearchParams();
      params.set('procId', String(procedure.id_proc));
      params.set('permisId', String(permis.id));
      url = `/extension_permis/step${stepNumber}/page${stepNumber}?${params.toString()}`;
    } else if (isRenewal) {
      const originalProcedure = (() => {
        const procedures = Array.isArray(permis?.procedures) ? permis.procedures : [];
        if (!procedures.length) return null;

        const sorted = [...procedures].sort((a, b) => {
          const dateA = a.date_debut_proc ? new Date(a.date_debut_proc).getTime() : 0;
          const dateB = b.date_debut_proc ? new Date(b.date_debut_proc).getTime() : 0;
          if (dateA !== dateB) return dateA - dateB;
          return (a.id_proc ?? 0) - (b.id_proc ?? 0);
        });

        const demandeLike = sorted.find((proc) => {
          const label = normalizeLabel(getProcedureType(proc));
          return label.includes('demande') || label.includes('initial');
        });

        return demandeLike || sorted[0];
      })();

      const originalDemandeId = (originalProcedure as any)?.demandes?.[0]?.id_demande ?? null;
      const originalProcId = originalProcedure?.id_proc ?? null;

      const params = new URLSearchParams();
      params.set('id', String(procedure.id_proc));
      params.set('permisId', String(permis.id));
      if (originalDemandeId != null) {
        params.set('originalDemandeId', String(originalDemandeId));
      }
      if (originalProcId != null) {
        params.set('original_proc_id', String(originalProcId));
      }

      url = `/renouvellement/step${stepNumber}/page${stepNumber}?${params.toString()}`;
    } else if (isTransfert) {
      const params = new URLSearchParams();
      params.set('id', String(procedure.id_proc));
      params.set('permisId', String(permis.id));
      url = `/transfert/step${stepNumber}/page${stepNumber}?${params.toString()}`;
    } else if (isCession) {
      // Cession procedure handling
      url = `/cession/step${stepNumber}/page${stepNumber}?id=${procedure.id_proc}`;
    } else if (isFusion) {
      // Fusion procedure handling
      url = `/fusion/step${stepNumber}/page${stepNumber}?id=${procedure.id_proc}`;
    } else {
      // Default procedure (demande)
      const basePath = getDemandeBasePath(procedure);
      url = `${basePath}/step${stepNumber}/page${stepNumber}?id=${procedure.id_proc}`;
    }

    window.open(url, '_blank');
  };

    const handleNotificationClose = () => {
    setNotif(null);
  };

  const resolveDefaultUtmZone = () => {
    const fallback = 31;
    const fromExisting = (renewalPerimeter?.points || []).find((pt) =>
      Number.isFinite(pt.zone ?? NaN),
    );
    if (fromExisting && Number.isFinite(fromExisting.zone ?? NaN)) {
      return Number(fromExisting.zone);
    }
    return fallback;
  };

  const handleManualParse = () => {
    const text = manualPerimeterText.trim();
    if (!text) {
      setManualPerimeterPoints([]);
      setManualPerimeterError('Collez des coordonnees avant de valider.');
      return;
    }
    const points = parseManualText(text, resolveDefaultUtmZone());
    setRenewalPerimeterChoice('manual');
    setManualPerimeterPoints(points);
    if (points.length < 3) {
      setManualPerimeterError('Au moins trois points valides sont requis.');
      return;
    }
    setManualPerimeterError(null);
  };

  const handleManualFileImport = async (file: File) => {
    const isCsv = /\.csv$/i.test(file.name) || file.type.includes('csv');
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);
    const defaultZone = resolveDefaultUtmZone();

    try {
      let points: RenewalPerimeterPoint[] = [];
      if (isCsv) {
        const content = await file.text();
        points = parseManualText(content, defaultZone);
      } else if (isExcel) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as Array<unknown[]>;
        points = parseManualRows(data, defaultZone);
      } else {
        const content = await file.text();
        points = parseManualText(content, defaultZone);
      }

      setRenewalPerimeterChoice('manual');
      if (points.length < 3) {
        setManualPerimeterPoints(points);
        setManualPerimeterError('Aucun perimetre valide detecte dans le fichier.');
        return;
      }
      setManualPerimeterText('');
      setManualPerimeterPoints(points);
      setManualPerimeterError(null);
    } catch (err) {
      setManualPerimeterError('Impossible de lire ce fichier de coordonnees.');
    }
  };

  const handleManualFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleManualFileImport(file);
    event.target.value = '';
  };

  useEffect(() => {
    if (renewalPerimeterChoice !== 'manual') {
      manualPrefillRef.current = false;
      return;
    }
    if (manualPrefillRef.current) return;
    if (manualPerimeterPoints.length > 0) {
      manualPrefillRef.current = true;
      return;
    }
    const existing = Array.isArray(renewalPerimeter?.points)
      ? renewalPerimeter.points
      : [];
    const defaultZone = (() => {
      const fromExisting = existing.find((pt) =>
        Number.isFinite(pt.zone ?? NaN),
      );
      if (fromExisting && Number.isFinite(fromExisting.zone ?? NaN)) {
        return Number(fromExisting.zone);
      }
      return 31;
    })();
    if (existing.length >= 3) {
      setManualPerimeterPoints(
        existing.map((pt) => ({
          x: Number(pt.x),
          y: Number(pt.y),
          z: pt.z ?? 0,
          zone: pt.zone ?? defaultZone,
          hemisphere: pt.hemisphere ?? 'N',
          system: pt.system ?? 'UTM',
        })),
      );
      manualPrefillRef.current = true;
      return;
    }
    setManualPerimeterPoints([
      {
        x: NaN,
        y: NaN,
        z: 0,
        zone: defaultZone,
        hemisphere: 'N',
        system: 'UTM',
      },
    ]);
    manualPrefillRef.current = true;
  }, [renewalPerimeterChoice, renewalPerimeter, manualPerimeterPoints.length]);

  const clearManualPerimeter = () => {
    setManualPerimeterText('');
    setManualPerimeterPoints([]);
    setManualPerimeterError(null);
  };

  const updateManualPoint = useCallback(
    (index: number, field: 'x' | 'y' | 'zone', rawValue: string) => {
      setManualPerimeterPoints((prev) =>
        prev.map((pt, idx) => {
          if (idx !== index) return pt;
          if (field === 'zone') {
            const trimmed = rawValue.trim();
            const zoneValue = trimmed ? Number.parseInt(trimmed, 10) : null;
            return {
              ...pt,
              zone: Number.isFinite(zoneValue) ? zoneValue : null,
            };
          }
          const numeric = parseCoordInput(rawValue);
          return { ...pt, [field]: numeric };
        }),
      );
      if (manualPerimeterError) setManualPerimeterError(null);
    },
    [manualPerimeterError],
  );

  const addManualPointRow = useCallback(() => {
    const defaultZone = resolveDefaultUtmZone();
    setManualPerimeterPoints((prev) => [
      ...prev,
      {
        x: NaN,
        y: NaN,
        z: 0,
        zone: defaultZone,
        hemisphere: 'N',
        system: 'UTM',
      },
    ]);
  }, [resolveDefaultUtmZone]);

  const removeManualPointRow = useCallback((index: number) => {
    setManualPerimeterPoints((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  // Early UI while fetching or when error is present (must stay after hooks)
  if (isLoading && !permis) {
    return <div style={{ padding: 16 }}>Chargement du permis.</div>;
  }

  if (error && !permis) {
    return <div style={{ padding: 16, color: '#b00020' }}>Erreur: {error}</div>;
  }

  const handleSubmitDate = async () => {
    const apiURL = process.env.NEXT_PUBLIC_API_URL;

    if (!selectedDate || !pendingPermisId) return;

    try {
      const manualValidCount = countValidManualPoints(manualPerimeterPoints);
      const manualInputProvided =
        manualPerimeterText.trim().length > 0 || manualValidCount > 0;
      const manualAreaHa = computeAreaHaFromPoints(manualPerimeterPoints);
      const baseSuperficie = computePermisSuperficie(permis);
      const maxAreaHa =
        typeof baseSuperficie === 'number' && Number.isFinite(baseSuperficie) && baseSuperficie > 0
          ? baseSuperficie
          : typeof renewalPerimeter?.areaHa === 'number' && renewalPerimeter.areaHa > 0
            ? renewalPerimeter.areaHa
            : null;
      const tolerance =
        typeof maxAreaHa === 'number' ? Math.max(0.01, maxAreaHa * 0.002) : 0;
      const manualAreaExceeded =
        typeof maxAreaHa === 'number' &&
        Number.isFinite(maxAreaHa) &&
        manualAreaHa > maxAreaHa + tolerance;
      const manualHasValidPoints =
        manualValidCount >= 3 && !manualPerimeterError && !manualAreaExceeded;

      if (renewalPerimeterChoice === 'manual' && manualInputProvided && !manualHasValidPoints) {
        if (manualAreaExceeded) {
          toast.error(
            `La superficie saisie (${manualAreaHa.toFixed(2)} ha) depasse la superficie du permis.`,
          );
        } else {
          setManualPerimeterError(
            manualPerimeterError || 'Au moins trois points valides sont requis.',
          );
        }
        return;
      }

      const res = await axios.post(
        `${apiURL}/api/procedures/renouvellement/start`,
        {
        permisId: pendingPermisId,
        date_demande: selectedDate.toISOString().split('T')[0],
      },
        { withCredentials: true }
      );

      const { original_demande_id, original_proc_id, new_proc_id } = res.data;

      const shouldKeepPerimeter =
        renewalPerimeterChoice === 'keep' &&
        (renewalPerimeter?.points?.length ?? 0) >= 3;
      const shouldUseManualPerimeter =
        renewalPerimeterChoice === 'manual' &&
        manualPerimeterPoints.length >= 3 &&
        !manualPerimeterError;
      const perimeterPoints = shouldKeepPerimeter
        ? renewalPerimeter?.points || []
        : shouldUseManualPerimeter
          ? manualPerimeterPoints
          : [];

      if (perimeterPoints.length >= 3) {
        try {
          await axios.post(
            `${apiURL}/api/procedures/renouvellement/${new_proc_id}/perimetres`,
            { points: perimeterPoints },
            { withCredentials: true },
          );
        } catch (err) {
          toast.warning(
            "Le p?rim?tre n'a pas pu ?tre copi? automatiquement. Vous pourrez le saisir ? l'?tape 4.",
          );
        }
      } else if (renewalPerimeterChoice === 'manual') {
        toast.info('Vous pourrez saisir les coordonnees a l etape 4 si besoin.');
      }

      router.push(
        `/renouvellement/step1/page1?id=${new_proc_id}&permisId=${pendingPermisId}&originalDemandeId=${original_demande_id}&original_proc_id=${original_proc_id}`
      );
    } catch (error: any) {
      setNotif({ message: 'Erreur lors du renouvellement.', type: 'error' });
    } finally {
      setShowDateModal(false);
      setPendingPermisId(null);
      setSelectedDate(null);
      setRenewalPerimeter(null);
      setRenewalPerimeterError(null);
      setRenewalPerimeterChoice('keep');
      setManualPerimeterText('');
      setManualPerimeterPoints([]);
      setManualPerimeterError(null);
    }
  };

  const handleProcedureTypeClick = (type: string) => {
    const matchingProcedures = permis!.procedures.filter(p => getProcedureType(p) === type);
    if (matchingProcedures.length > 0) {
      setSelectedProcedures(matchingProcedures);
      setSelectedProcedure(matchingProcedures[0]);
      setIsModalOpen(true);
    }
  };

  const handleDocumentView = (document: Document) => {
  if (!document.url) {
    toast.error(
     'Ce document n\'est pas disponible en téléchargement'
    );
    return;
  }
  
  setSelectedDocument(document);
  setShowDocumentViewer(true);
};

 const handleDocumentDownload = async (doc: Document) => {
  if (!doc.url) {
    toast.error('Ce document n\'est pas disponible en téléchargement');
    return;
  }
  
  try {
    // Show loading notification
    setNotif({ message: `Téléchargement de ${doc.nom} en cours...`, type: 'info' });
    
    // Create a hidden anchor element for download
    const link = document.createElement('a');
    link.href = doc.url;
    link.download = doc.nom || `document-${doc.id}`;
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Revoke the object URL after some time
    if (doc.url.startsWith('blob:')) {
      setTimeout(() => {
        URL.revokeObjectURL(doc.url);
      }, 1000);
    }
    
    // Success notification
    setNotif({ message: `${doc.nom} téléchargé avec succés`, type: 'success' });
    
  } catch (error) {
    console.error('Download error:', error);
    setNotif({ message: 'Erreur lors du téléchargement', type: 'error' });
  }
};

  const confirmAction = async () => {
    if (!pendingAction) return;

    try {
      const ok = await pendingAction.callback();
      if (ok === false) {
        return;
      }
    } catch (e) {
      console.error('Action confirmation failed', e);
      toast.error("Une erreur s'est produite.");
      return;
    }

    setShowConfirmationModal(false);
    setPendingAction(null);
  };

  const cancelAction = () => {
    setShowConfirmationModal(false);
    setPendingAction(null);
  };

  const substances = getAllSubstances();
  const proceduresInProgress = (permis?.procedures ?? []).filter((procedure) => {
    return (procedure.statut_proc || '').toUpperCase() === 'EN_COURS';
  });
  const isProcedureInProgress = proceduresInProgress.length > 0;

  const formatProcedureDate = (value: Date | string | null | undefined) => {
    if (!value) return 'date non definie';
    const parsed = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(parsed.getTime())) return 'date non definie';
    return format(parsed, 'dd/MM/yyyy');
  };

  const procedureInProgressMessage = (() => {
    if (!isProcedureInProgress) return '';
    const current = proceduresInProgress[0];
    const procNumber =
      current?.num_proc || (current?.id_proc ? `PROC-${current.id_proc}` : 'procedure en cours');
    const procType = current ? getProcedureType(current) : 'Type non defini';
    const startDate = current ? formatProcedureDate(current.date_debut_proc) : 'date non definie';

    if (proceduresInProgress.length === 1) {
      return `Ce permis a une procedure en cours : ${procNumber} (${procType}, debut ${startDate}).`;
    }
    return `Ce permis a ${proceduresInProgress.length} procedures en cours, dont ${procNumber} (${procType}, debut ${startDate}).`;
  })();

  const warnProcedureInProgress = () => {
    if (!procedureInProgressMessage) return;
    setNotif({ message: procedureInProgressMessage, type: 'info' });
  };

  if (error && !permis) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <AlertTriangle size={48} className={styles.errorIcon} />
          <h2>Erreur de chargement</h2>
          <p>{error}</p>
          <button 
            className={styles.primaryButton}
            onClick={() => router.push('/permis_dashboard')}
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  if (!permis) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Chargement des données...</p>
        </div>
      </div>
    );
  }

  const derivedSuperficie = computePermisSuperficie(permis);
  const maxRenewalAreaHa =
    typeof derivedSuperficie === 'number' && Number.isFinite(derivedSuperficie) && derivedSuperficie > 0
      ? derivedSuperficie
      : typeof renewalPerimeter?.areaHa === 'number' && renewalPerimeter.areaHa > 0
        ? renewalPerimeter.areaHa
        : null;
  const manualValidPointCount = countValidManualPoints(manualPerimeterPoints);
  const manualAreaHa = computeAreaHaFromPoints(manualPerimeterPoints);
  const manualAreaTolerance =
    typeof maxRenewalAreaHa === 'number' ? Math.max(0.01, maxRenewalAreaHa * 0.002) : 0;
  const manualAreaError =
    typeof maxRenewalAreaHa === 'number' &&
    manualPerimeterPoints.length >= 3 &&
    manualAreaHa > maxRenewalAreaHa + manualAreaTolerance
      ? `La superficie saisie (${manualAreaHa.toFixed(2)} ha) depasse la superficie du permis.`
      : null;
  const manualInputProvided =
    manualPerimeterText.trim().length > 0 || manualValidPointCount > 0;
  const manualHasValidPoints =
    manualValidPointCount >= 3 && !manualPerimeterError && !manualAreaError;
  const disableRenewalConfirm =
    !selectedDate ||
    (renewalPerimeterChoice === 'manual' && manualInputProvided && !manualHasValidPoints);

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.mainContent}>
    <div className={styles.container}>
      {notif && (
        <NotificationBanner
          message={notif.message}
          type={notif.type}
          onClose={handleNotificationClose}
        />
      )}

      {showObligationWarning && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <button
              onClick={() => setShowObligationWarning(false)}
              className={styles.modalCloseButton}
            >
              <XCircle size={20} />
            </button>

            <div className={styles.modalIconWarning}>
              <XCircle size={48} className={styles.warningIcon} />
            </div>

            <h2 className={styles.modalTitle}>Obligations non payées</h2>
            <div className={styles.modalBody}>
              <p>{obligationMessage}</p>
              <div className={styles.tableWrapper}>
                <table className={styles.modalTable}>
                  <thead>
                  <tr>
                    <th>Année</th>
                    <th>Type</th>
                    <th>Montant</th>
                    <th>Échéance</th>
                  </tr>
                </thead>
                <tbody>
                    {unpaidObligations.map((o, idx) => (
                      <tr key={idx}>
                      <td>{o.year ?? o.annee ?? '-'}</td>
                      <td>{o.type ?? o.type_obligation ?? o.libelle ?? '-'}</td>
                      <td>{o.amount ?? o.montant ?? o.montantRestant ?? '-'}</td>
                      <td>
                        {o.dueDate ??
                          o.date_echeance ??
                          o.deadline ??
                          '-'}
                      </td>
                    </tr>
                  ))}
                  {unpaidObligations.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center' }}>
                          Aucune obligation détectée.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                onClick={() => {
                  setShowObligationWarning(false);
                  setPendingActionAfterWarning(null);
                }}
                className={styles.modalSecondaryButton}
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  const pending = pendingActionAfterWarning;
                  setShowObligationWarning(false);
                  setPendingActionAfterWarning(null);
                  if (pending?.type === 'renewal') {
                    setPendingPermisId(pending.permisId);
                    setShowDateModal(true);
                    return;
                  }
                  if (pending?.type === 'transfer') {
                    void handletransfertClick(pending.permisId, true);
                  }
                  if (pending?.type === 'cession') {
                    void handleCessionClick(pending.permisId, true);
                  }
                }}
                className={styles.modalPrimaryButton}
              >
                Continuer quand même
              </button>
            </div>
          </div>
        </div>
      )}

      {showOptionPermissionModal && (
        <OptionPermissionRequestModal
          message={optionPermissionMessage}
          users={chefDdmUsers}
          isLoading={isLoadingChefDdmUsers}
          isSending={isSendingOptionPermission}
          selectedUserId={selectedChefDdmId}
          error={optionPermissionError}
          onSelectUser={setSelectedChefDdmId}
          onClose={closeOptionPermissionModal}
          onSend={handleSendOptionPermissionRequest}
        />
      )}

      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div>
            <h1 className={styles.headerTitle}>Détails du Permis</h1>
            <p className={styles.headerSubtitle}>
              Informations complétes sur le permis {permis.code_permis}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button 
              className={styles.secondaryButton}
              onClick={() => router.push('/permis_dashboard/PermisDashboard')}
            >
              Retour
            </button>
            <button
              className={styles.secondaryButton}
              onClick={() => router.push(`/permis_dashboard/view/permis_resume?id=${permis.id}`)}
            >
              Resume
            </button>
            <button 
              className={styles.primaryButton}
              onClick={() => window.print()}
            >
              Imprimer
            </button>
          </div>
        </div>
        
        <div className={styles.tabNavigation}>
          <button 
            className={`${styles.tab} ${activeTab === 'overview' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <FileText size={16} />
            Aperçu
          </button>

          <button 
            className={`${styles.tab} ${activeTab === 'procedures' ? styles.tabActive : ''}`}
            onClick={() => {
              if (!canViewProceduresTab) {
                toast.error("Permission 'procedure_permisDetails' requise.");
                return;
              }
              setActiveTab('procedures');
            }}
            disabled={!canViewProceduresTab}
            title={!canViewProceduresTab ? "Permission 'procedure_permisDetails' requise." : undefined}
          >
            <Clock size={16} />
            Procédures ({permis.procedures.length})
            {!canViewProceduresTab && (
              <Lock size={14} style={{ marginLeft: 8, verticalAlign: 'middle' }} />
            )}
          </button>
          <button 
  className={`${styles.tab} ${activeTab === 'documents' ? styles.tabActive : ''}`}
  onClick={() => {
    if (!canViewDocumentsTab) {
      toast.error("Permission 'document_permisDetails' requise.");
      return;
    }
    setActiveTab('documents');
  }}
  disabled={!canViewDocumentsTab}
  title={!canViewDocumentsTab ? "Permission 'document_permisDetails' requise." : undefined}
>
  <FileSearch size={16} />
  Documents ({documentsData?.totalCount || permis.documents?.length || 0})
  {!canViewDocumentsTab && (
    <Lock size={14} style={{ marginLeft: 8, verticalAlign: 'middle' }} />
  )}
</button>
          <button 
            className={`${styles.tab} ${activeTab === 'history' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <BarChart3 size={16} />
            Historique
          </button>
          <button 
    className={`${styles.tab} ${activeTab === 'obligations' ? styles.tabActive : ''}`}
    onClick={() => setActiveTab('obligations')}
  >
    <FileText size={16} />
    Obligations fiscales
  </button>
        </div>
      </div>
{activeTab === 'obligations' && (
  <div className={styles.tabContent}>
    <div className={`${styles.card} ${styles.animateIn}`}>
      <div className={styles.cardHeader}>
        <div className={styles.cardHeaderIcon}>
          <FileText size={20} />
        </div>
        <h2 className={styles.cardTitle}>Obligations Fiscales</h2>
        <div className={styles.headerActions}>
          <span className={styles.badge}>{pagination.totalItems} obligations</span>
          <button
            className={`${styles.filterButton} ${showFilters ? styles.filterButtonActive : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} />
            Filtres
          </button>
        </div>
      </div>

      {/* Filters Section */}
      {showFilters && (
        <div className={styles.filtersSection}>
          <div className={styles.filterGrid}>
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Statut</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className={styles.filterSelect}
              >
                <option value="all">Tous les statuts</option>
                <option value="Payé">Payé</option>
                <option value="A_payer">À payer</option>
                <option value="En retard">En retard</option>
                <option value="Partiellement payé">Partiellement payé</option>
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Type</label>
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                className={styles.filterSelect}
              >
                <option value="all">Tous les types</option>
                {Array.from(new Set(obligations.map(ob => ob.typePaiement.libelle))).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Année</label>
              <select
                value={filters.year}
                onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
                className={styles.filterSelect}
              >
                <option value="all">Toutes les années</option>
                {Array.from(new Set(obligations.map(ob => ob.fiscalYear)))
                  .sort((a, b) => b - a)
                  .map(year => (
                    <option key={year} value={year.toString()}>{year}</option>
                  ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Montant min (DZD)</label>
              <input
                type="number"
                value={filters.minAmount}
                onChange={(e) => setFilters(prev => ({ ...prev, minAmount: e.target.value }))}
                className={styles.filterInput}
                placeholder="0"
              />
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Montant max (DZD)</label>
              <input
                type="number"
                value={filters.maxAmount}
                onChange={(e) => setFilters(prev => ({ ...prev, maxAmount: e.target.value }))}
                className={styles.filterInput}
                placeholder="âˆž"
              />
            </div>

            <div className={styles.filterActions}>
              <button
                onClick={() => setFilters({
                  status: 'all',
                  type: 'all',
                  year: 'all',
                  minAmount: '',
                  maxAmount: ''
                })}
                className={styles.resetButton}
              >
                <X size={16} />
                Réinitialiser
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.cardContent}>
        {isLoadingObligations ? (
          <div className={styles.loading}>
            <RefreshCw size={32} className={styles.spinner} />
            <p>Chargement des obligations...</p>
          </div>
        ) : filteredObligations.length > 0 ? (
          <div className={styles.obligationsContainer}>
            {/* Summary Stats */}
            <div className={styles.summaryStats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Total</span>
                <span className={styles.statValue}>
                  {(obligations.reduce((sum, ob) => sum + (ob.amount || 0), 0)).toLocaleString('fr-FR')} DZD
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Payé</span>
                <span className={styles.statValue}>
                  {obligations
                    .filter(ob => ob.status === 'Payé')
                    .reduce((sum, ob) => sum + ob.amount, 0)
                    .toLocaleString('fr-FR')} DZD
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>En attente</span>
                <span className={styles.statValue}>
                  {obligations
                    .filter(ob => ob.status !== 'Payé')
                    .reduce((sum, ob) => sum + ob.amount, 0)
                    .toLocaleString('fr-FR')} DZD
                </span>
              </div>
            </div>

            {/* Obligations List */}
            <div className={styles.obligationsList}>
              {filteredObligations.map(obligation => (
                <div key={obligation.id} className={styles.obligationItem}>
                  <div 
                    className={styles.obligationHeader}
                    onClick={() => setExpandedObligations(prev =>
                      prev.includes(obligation.id)
                        ? prev.filter(id => id !== obligation.id)
                        : [...prev, obligation.id]
                    )}
                  >
                    <div className={styles.obligationInfo}>
                      <h3 className={styles.obligationTitle}>
                        {obligation.typePaiement.libelle}
                      </h3>
                      <div className={styles.obligationMeta}>
                        <span className={styles.obligationYear}>Année {obligation.fiscalYear}</span>
                        <span className={styles.obligationFrequency}>• {obligation.typePaiement.frequence}</span>
                        <span className={styles.obligationDue}>
                          • Échéance: {new Date(obligation.dueDate).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                    
                    <div className={styles.obligationStatus}>
                      <span className={`${styles.statusBadge} ${
                        obligation.status === 'Payé' ? styles.statusPaid :
                        obligation.status === 'En retard' ? styles.statusOverdue :
                        obligation.status === 'Partiellement payé' ? styles.statusPartial :
                        styles.statusPending
                      }`}>
                        {obligation.status}
                      </span>
                      <span className={styles.obligationAmount}>
                  {(obligation.amount ?? 0).toLocaleString('fr-FR')} DZD
                      </span>
                    </div>
                    
                    <ChevronDown 
                      size={20} 
                      className={`${styles.expandIcon} ${
                        expandedObligations.includes(obligation.id) ? styles.expanded : ''
                      }`}
                    />
                  </div>

                  {expandedObligations.includes(obligation.id) && (
                    <div className={styles.obligationDetails}>
                      {/* Payment Period Information */}
                      {obligation.tsPaiements && obligation.tsPaiements.length > 0 && (
                        <div className={styles.detailSection}>
                          <h4>Période de paiement</h4>
                          <div className={styles.periodGrid}>
                            {obligation.tsPaiements.map(ts => (
                              <div key={ts.id_tsPaiement} className={styles.periodItem}>
                                <Calendar size={16} />
                                <span>
                                  {new Date(ts.datePerDebut).toLocaleDateString('fr-FR')} - {new Date(ts.datePerFin).toLocaleDateString('fr-FR')}
                                </span>
                                <span className={styles.surfaceInfo}>
                                  Surface: {ts.surfaceMin} - {ts.surfaceMax} ha
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Payment History */}
                      <div className={styles.detailSection}>
                        <h4>Historique des paiements</h4>
                        {obligation.payments.length > 0 ? (
                          <div className={styles.paymentsTable}>
                            <div className={styles.tableHeader}>
                              <span>Date</span>
                              <span>Méthode</span>
                              <span>Quittance</span>
                              <span>Montant</span>
                            </div>
                            {obligation.payments.map(payment => (
                              <div key={payment.id} className={styles.tableRow}>
                                <span>{new Date(payment.paymentDate).toLocaleDateString('fr-FR')}</span>
                                <span className={styles.paymentMethod}>{payment.paymentMethod}</span>
                                <span className={styles.receiptNumber}>{payment.receiptNumber || 'N/A'}</span>
                                <span className={styles.paymentAmount}>
                {(payment.amount ?? 0).toLocaleString('fr-FR')} {payment.currency}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className={styles.noData}>Aucun paiement effectué</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className={styles.actionsSection}>
                        <button className={styles.actionBtn}>
                          <Download size={16} />
                          Télécharger le reçu
                        </button>
                        <button className={styles.actionBtn}>
                          <Eye size={16} />
                          Voir justificatif
                        </button>
                        {obligation.status !== 'Payé' && (
                          <button className={styles.payBtn}>
                            <CreditCard size={16} />
                            Payer maintenant
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                  disabled={pagination.currentPage === 1}
                  className={styles.paginationButton}
                >
                  <ChevronLeft size={16} />
                  Précédent
                </button>

                <div className={styles.paginationPages}>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const page = Math.max(1, Math.min(
                      pagination.currentPage - 2,
                      pagination.totalPages - 4
                    )) + i;
                    return (
                      <button
                        key={page}
                        onClick={() => setPagination(prev => ({ ...prev, currentPage: page }))}
                        className={`${styles.pageButton} ${pagination.currentPage === page ? styles.pageButtonActive : ''}`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                  disabled={pagination.currentPage === pagination.totalPages}
                  className={styles.paginationButton}
                >
                  Suivant
                  <ChevronRight size={16} />
                </button>

                <select
                  value={pagination.itemsPerPage}
                  onChange={(e) => setPagination(prev => ({
                    ...prev,
                    itemsPerPage: parseInt(e.target.value),
                    currentPage: 1
                  }))}
                  className={styles.pageSizeSelect}
                >
                  <option value="5">5 par page</option>
                  <option value="10">10 par page</option>
                  <option value="20">20 par page</option>
                  <option value="50">50 par page</option>
                </select>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <FileText size={48} className={styles.emptyStateIcon} />
            <p>Aucune obligation ne correspond aux filtres</p>
            <button 
              className={styles.primaryButton}
              onClick={() => setFilters({
                status: 'all',
                type: 'all',
                year: 'all',
                minAmount: '',
                maxAmount: ''
              })}
            >
              <Filter size={16} />
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
)}
      {activeTab === 'overview' && (
        <div className={styles.tabContent}>
          <div className={styles.statsGrid}>
            <StatisticCard
  title="Statut du permis"
  value={permis.statut?.lib_statut || "Inconnu"}
  icon={<FileText size={20} />}
  trend={
    statsData?.validityStatus === "Valide"
      ? "positive"
      : statsData?.validityStatus === "Expire bientôt"
      ? "warning"
      : "negative"
  }
  subtitle={
    statsData?.validityStatus ||
    (daysUntilExpiry !== null ? `${daysUntilExpiry} jours restants` : "Non défini")
  }
/>

            <StatisticCard
  title="Jours avant expiration"
  value={statsData?.daysUntilExpiry?.toString() ?? 'N/A'}
  icon={<Calendar size={20} />}
  trend={
    statsData?.daysUntilExpiry && statsData.daysUntilExpiry > 30
      ? 'positive'
      : statsData?.daysUntilExpiry && statsData.daysUntilExpiry > 0
      ? 'warning'
      : 'negative'
  }
  subtitle={statsData?.validityStatus ?? 'N/A'}   // ? safer
/>

            <StatisticCard
              title="Procédures actives"
              value={statsData?.activeProcedures.toString() || '0'}
              icon={<Clock size={20} />}
              trend="neutral"
              subtitle={`Sur ${statsData?.totalProcedures} au total`}
            />
            <StatisticCard
              title="Renouvellements"
              value={(permis.nombre_renouvellements || 0).toString()}
              icon={<RefreshCw size={20} />}
              trend={(permis.nombre_renouvellements || 0) < permis.typePermis.nbr_renouv_max ? 'positive' : 'negative'}
              subtitle={`Max: ${permis.typePermis.nbr_renouv_max}`}
            />
          </div>

      <div className={styles.gridLayout}>
        {/* Main Content */}
        <div className="space-y-6">
              {/* General Info Card */}
              <div className={`${styles.card} ${styles.animateIn}`}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderIcon}>
                    <FileText size={20} />
                  </div>
                  <h2 className={styles.cardTitle}>Informations générales</h2>
                  <div className={styles.cardHeaderActions}>
                    {!canModifyPermisData && <LockBadge />}
                    {isEditingGeneral ? (
                      <>
                        <button
                          className={styles.secondaryButton}
                          onClick={() => setIsEditingGeneral(false)}
                          disabled={isSavingGeneral}
                        >
                          Annuler
                        </button>
                        <button
                          className={styles.primaryButton}
                          onClick={handleSaveGeneral}
                          disabled={isSavingGeneral}
                        >
                          {isSavingGeneral ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                      </>
                    ) : (
                      <button
                        className={styles.secondaryButton}
                        onClick={() => {
                          if (!ensureCanModify()) return;
                          setIsEditingGeneral(true);
                        }}
                        disabled={!canModifyPermisData}
                        title={
                          !canModifyPermisData
                            ? "Permission 'modifier_permisData' requise."
                            : undefined
                        }
                      >
                        <Edit2 size={16} />
                        Modifier
                      </button>
                    )}
                  </div>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Code Permis</span>
                      <span className={styles.infoValue}>{permis.code_permis}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Type de Permis</span>
                      <span className={styles.infoValue}>
                        {permis.typePermis.lib_type} ({permis.typePermis.code_type})
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Statut</span>
                      {isEditingGeneral ? (
                        <select
                          className={styles.editSelect}
                          value={generalForm.id_statut}
                          onChange={(e) =>
                            setGeneralForm((prev) => ({
                              ...prev,
                              id_statut: e.target.value ? Number(e.target.value) : '',
                            }))
                          }
                        >
                          <option value="">--</option>
                          {statutPermisOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.lib_statut}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`${styles.badge} ${getStatusColor(
                            permis.statut?.lib_statut || '',
                          )}`}
                        >
                          {permis.statut?.lib_statut || 'Inconnu'}
                        </span>
                      )}
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Superficie</span>
                      {isEditingGeneral ? (
                        <input
                          type="number"
                          className={styles.editInput}
                          value={generalForm.superficie}
                          onChange={(e) =>
                            setGeneralForm((prev) => ({ ...prev, superficie: e.target.value }))
                          }
                        />
                      ) : (
                        <span className={styles.infoValue}>
                          {derivedSuperficie != null ? `${derivedSuperficie} Ha` : 'Non définie'}
                        </span>
                      )}
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Titulaire</span>
                      <span className={styles.infoValue}>
                        {getPermisTitulaireName(permis) || 'Non d?fini'}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Antenne</span>
                      {isEditingGeneral ? (
                        <select
                          className={styles.editSelect}
                          value={generalForm.id_antenne}
                          onChange={(e) =>
                            setGeneralForm((prev) => ({
                              ...prev,
                              id_antenne: e.target.value ? Number(e.target.value) : '',
                            }))
                          }
                        >
                          <option value="">--</option>
                          {antenneOptions.map((opt) => (
                            <option key={opt.id_antenne} value={opt.id_antenne}>
                              {opt.nom}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={styles.infoValue}>{antenneName || 'Non définie'}</span>
                      )}
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Wilaya</span>
                      {isEditingGeneral ? (
                        <div className={styles.searchStack}>
                          <input
                            className={styles.editInput}
                            placeholder="Rechercher une wilaya..."
                            value={wilayaSearch}
                            onChange={(e) => setWilayaSearch(e.target.value)}
                          />
                          <select
                            className={styles.editSelect}
                            value={generalForm.id_wilaya}
                            onChange={(e) => {
                              const value = e.target.value ? Number(e.target.value) : '';
                              setGeneralForm((prev) => ({
                                ...prev,
                                id_wilaya: value,
                                id_daira: '',
                                id_commune: '',
                              }));
                              setDairaSearch('');
                              setCommuneSearch('');
                              setDairaOptions([]);
                              setCommuneOptions([]);
                            }}
                          >
                            <option value="">--</option>
                            {filteredWilayaOptions.map((opt) => (
                              <option key={opt.id_wilaya} value={opt.id_wilaya}>
                                {formatLocationLabel(
                                  opt.code_wilaya,
                                  opt.nom_wilayaFR,
                                  opt.nom_wilayaAR,
                                )}
                              </option>
                            ))}
                          </select>
                          <span className={styles.searchHint}>
                            {isLoadingWilayas
                              ? 'Chargement...'
                              : `Actuelle: ${wilayaName || 'Non definie'}`}
                          </span>
                        </div>
                      ) : (
                        <span className={styles.infoValue}>{wilayaName || 'Non definie'}</span>
                      )}
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Daira</span>
                      {isEditingGeneral ? (
                        <div className={styles.searchStack}>
                          <input
                            className={styles.editInput}
                            placeholder="Rechercher une daira..."
                            value={dairaSearch}
                            onChange={(e) => setDairaSearch(e.target.value)}
                            disabled={!generalForm.id_wilaya}
                          />
                          <select
                            className={styles.editSelect}
                            value={generalForm.id_daira}
                            onChange={(e) => {
                              const value = e.target.value ? Number(e.target.value) : '';
                              setGeneralForm((prev) => ({
                                ...prev,
                                id_daira: value,
                                id_commune: '',
                              }));
                              setCommuneSearch('');
                              setCommuneOptions([]);
                            }}
                            disabled={!generalForm.id_wilaya}
                          >
                            <option value="">--</option>
                            {filteredDairaOptions.map((opt) => (
                              <option key={opt.id_daira} value={opt.id_daira}>
                                {formatLocationLabel(
                                  opt.code_daira,
                                  opt.nom_dairaFR,
                                  opt.nom_dairaAR,
                                )}
                              </option>
                            ))}
                          </select>
                          <span className={styles.searchHint}>
                            {!generalForm.id_wilaya
                              ? 'Selectionnez une wilaya'
                              : isLoadingDairas
                                ? 'Chargement...'
                                : `Actuelle: ${dairaName || 'Non definie'}`}
                          </span>
                        </div>
                      ) : (
                        <span className={styles.infoValue}>{dairaName || 'Non definie'}</span>
                      )}
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Commune</span>
                      {isEditingGeneral ? (
                        <div className={styles.searchStack}>
                          <input
                            className={styles.editInput}
                            placeholder="Rechercher une commune..."
                            value={communeSearch}
                            onChange={(e) => setCommuneSearch(e.target.value)}
                            disabled={!generalForm.id_daira}
                          />
                          <select
                            className={styles.editSelect}
                            value={generalForm.id_commune}
                            onChange={(e) =>
                              setGeneralForm((prev) => ({
                                ...prev,
                                id_commune: e.target.value ? Number(e.target.value) : '',
                              }))
                            }
                            disabled={!generalForm.id_daira}
                          >
                            <option value="">--</option>
                            {filteredCommuneOptions.map((opt) => (
                              <option key={opt.id_commune} value={opt.id_commune}>
                                {formatLocationLabel(
                                  opt.code_commune,
                                  opt.nom_communeFR,
                                  opt.nom_communeAR,
                                )}
                              </option>
                            ))}
                          </select>
                          <span className={styles.searchHint}>
                            {!generalForm.id_daira
                              ? 'Selectionnez une daira'
                              : isLoadingCommunes
                                ? 'Chargement...'
                                : `Actuelle: ${communeName || 'Non definie'}`}
                          </span>
                        </div>
                      ) : (
                        <span className={styles.infoValue}>{communeName || 'Non definie'}</span>
                      )}
                    </div>
                    {/* <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Substances</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {substances.length > 0 ? (
                          substances.map((substance) => (
                            <span key={substance.id_sub} className={`${styles.badge} ${styles.badgePrimary}`}>
                              {substance.nom_subFR}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500">Non spécifiées</span>
                        )}
                      </div>
                    </div> */}
                  </div>
                </div>
              </div>

              <div className={`${styles.card} ${styles.animateIn} ${styles.delay1}`}>

                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderIcon}>
                    <Building2 size={20} />
                  </div>
                  <h2 className={styles.cardTitle}>Registre du commerce</h2>
                  {!canModifyPermisData && <LockBadge />}
                </div>
                <div className={styles.cardContent}>
                  {isLoadingRegistre ? (
                    <div className={styles.emptyState}>
                      <div className={styles.spinner} />
                      <p>Chargement des informations...</p>
                    </div>
                  ) : registreCommerce.length > 0 ? (
                                        <div className={styles.substanceTable}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Numero RC</th>
                            <th>Date</th>
                            <th>NIS</th>
                            <th>NIF</th>
                            <th>Capital social</th>
                            <th>Adresse legale</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registreCommerce.map((rc) => {
                            const isEditingRow = editingRegistreId === rc.id;
                            const isSavingRow = savingRegistreId === rc.id;
                            const draft = isEditingRow && registreDraft ? registreDraft : rc;
                            return (
                              <tr key={rc.id || rc.numero_rc || Math.random()}>
                                <td>
                                  {isEditingRow ? (
                                    <input
                                      className={styles.tableInput}
                                      value={draft.numero_rc || ''}
                                      onChange={(e) =>
                                        setRegistreDraft((prev) =>
                                          prev ? { ...prev, numero_rc: e.target.value } : prev,
                                        )
                                      }
                                    />
                                  ) : (
                                    rc.numero_rc || '-'
                                  )}
                                </td>
                                <td>
                                  {isEditingRow ? (
                                    <input
                                      type="date"
                                      className={styles.tableInput}
                                      value={
                                        typeof draft.date_enregistrement === 'string'
                                          ? draft.date_enregistrement
                                          : toDateInputValue(
                                              draft.date_enregistrement
                                                ? new Date(draft.date_enregistrement)
                                                : null,
                                            )
                                      }
                                      onChange={(e) =>
                                        setRegistreDraft((prev) =>
                                          prev ? { ...prev, date_enregistrement: e.target.value } : prev,
                                        )
                                      }
                                    />
                                  ) : (
                                    formatDate(rc.date_enregistrement)
                                  )}
                                </td>
                                <td>
                                  {isEditingRow ? (
                                    <input
                                      className={styles.tableInput}
                                      value={draft.nis || ''}
                                      onChange={(e) =>
                                        setRegistreDraft((prev) =>
                                          prev ? { ...prev, nis: e.target.value } : prev,
                                        )
                                      }
                                    />
                                  ) : (
                                    rc.nis || '-'
                                  )}
                                </td>
                                <td>
                                  {isEditingRow ? (
                                    <input
                                      className={styles.tableInput}
                                      value={draft.nif || ''}
                                      onChange={(e) =>
                                        setRegistreDraft((prev) =>
                                          prev ? { ...prev, nif: e.target.value } : prev,
                                        )
                                      }
                                    />
                                  ) : (
                                    rc.nif || '-'
                                  )}
                                </td>
                                <td>
                                  {isEditingRow ? (
                                    <input
                                      type="number"
                                      className={styles.tableInput}
                                      value={draft.capital_social ?? ''}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const parsed = raw === '' ? null : Number(raw);
                                        setRegistreDraft((prev) => {
                                          if (!prev) return prev;
                                          const nextValue =
                                            parsed != null && Number.isFinite(parsed)
                                              ? parsed
                                              : prev.capital_social ?? null;
                                          return { ...prev, capital_social: nextValue };
                                        });
                                      }}
                                    />
                                  ) : rc.capital_social != null ? (
                                    formatCurrency(rc.capital_social)
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td>
                                  {isEditingRow ? (
                                    <input
                                      className={styles.tableInput}
                                      value={draft.adresse_legale || ''}
                                      onChange={(e) =>
                                        setRegistreDraft((prev) =>
                                          prev ? { ...prev, adresse_legale: e.target.value } : prev,
                                        )
                                      }
                                    />
                                  ) : (
                                    rc.adresse_legale || '-'
                                  )}
                                </td>
                                <td>
                                  {isEditingRow ? (
                                    <div className={styles.tableActions}>
                                      <button
                                        className={`${styles.tableActionButton} ${styles.tableActionButtonPrimary}`}
                                        onClick={handleSaveRegistre}
                                        disabled={isSavingRow}
                                      >
                                        {isSavingRow ? 'Enregistrement...' : 'Enregistrer'}
                                      </button>
                                      <button
                                        className={styles.tableActionButton}
                                        onClick={() => {
                                          setEditingRegistreId(null);
                                          setRegistreDraft(null);
                                        }}
                                        disabled={isSavingRow}
                                      >
                                        Annuler
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      className={styles.tableActionButton}
                                      onClick={() => {
                                        if (!ensureCanModify()) return;
                                        if (!rc.id) return;
                                        setEditingRegistreId(rc.id);
                                        setRegistreDraft({
                                          ...rc,
                                          date_enregistrement: rc.date_enregistrement
                                            ? toDateInputValue(new Date(rc.date_enregistrement))
                                            : '',
                                        });
                                      }}
                                      disabled={!rc.id || !canModifyPermisData}
                                      title={
                                        !canModifyPermisData
                                          ? "Permission 'modifier_permisData' requise."
                                          : undefined
                                      }
                                    >
                                      <Edit2 size={14} />
                                      Modifier
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <Info size={24} />
                      <p>Aucune information de registre du commerce</p>
                    </div>
                  )}
                </div>
              </div>

              <div className={`${styles.card} ${styles.animateIn} ${styles.delay1}`}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderIcon}>
                    <BarChart3 size={20} />
                  </div>
                  <h2 className={styles.cardTitle}>Actionnaires</h2>
                  {!canModifyPermisData && <LockBadge />}
                </div>
                <div className={styles.cardContent}>
                  {isLoadingActionnaires ? (
                    <div className={styles.emptyState}>
                      <div className={styles.spinner} />
                      <p>Chargement des actionnaires...</p>
                    </div>
                  ) : actionnaires.length > 0 ? (
                                        <div className={styles.substanceTable}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Nom</th>
                            <th>Prenom</th>
                            <th>Nationalite</th>
                            <th>Type Personne</th>
                            <th>Role</th>
                            <th>Taux</th>
                            <th>No Identite</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {actionnaires.map((actionnaire) => {
                            const rowId = actionnaire.id_actionnaire ?? actionnaire.id;
                            const isEditingRow = rowId != null && editingActionnaireId === rowId;
                            const isSavingRow = rowId != null && savingActionnaireId === rowId;
                            const draft = isEditingRow && actionnaireDraft ? actionnaireDraft : actionnaire;
                            const canEdit = Boolean(actionnaire.id_actionnaire);
                            return (
                              <tr key={rowId || Math.random()}>
                                <td>
                                  {isEditingRow ? (
                                    <input
                                      className={styles.tableInput}
                                      value={draft.nom || ''}
                                      onChange={(e) =>
                                        setActionnaireDraft((prev) =>
                                          prev ? { ...prev, nom: e.target.value } : prev,
                                        )
                                      }
                                    />
                                  ) : (
                                    actionnaire.nom || actionnaire.nomAR || '-'
                                  )}
                                </td>
                                <td>
                                  {isEditingRow ? (
                                    <input
                                      className={styles.tableInput}
                                      value={draft.prenom || ''}
                                      onChange={(e) =>
                                        setActionnaireDraft((prev) =>
                                          prev ? { ...prev, prenom: e.target.value } : prev,
                                        )
                                      }
                                    />
                                  ) : (
                                    actionnaire.prenom || actionnaire.prenomAR || '-'
                                  )}
                                </td>
                                <td>
                                  {isEditingRow ? (
                                    <div className={styles.tableFieldStack}>
                                      <select
                                        className={styles.tableSelect}
                                        title="Nationalite"
                                        value={draft.id_nationalite ?? ''}
                                        onChange={(e) => {
                                          const nextId = e.target.value ? Number(e.target.value) : null;
                                          const label =
                                            nationaliteOptions.find(
                                              (opt) => opt.id_nationalite === nextId,
                                            )?.libelle || '';
                                          setActionnaireDraft((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  id_nationalite: nextId,
                                                  nationalite: label,
                                                }
                                              : prev,
                                          );
                                        }}
                                      >
                                        <option value="">--</option>
                                        {nationaliteOptions.map((opt) => (
                                          <option key={opt.id_nationalite} value={opt.id_nationalite}>
                                            {opt.libelle}
                                          </option>
                                        ))}
                                      </select>
                                      <select
                                        className={styles.tableSelect}
                                        title="Pays"
                                        value={draft.id_pays ?? ''}
                                        onChange={(e) => {
                                          const nextId = e.target.value ? Number(e.target.value) : null;
                                          const label =
                                            paysOptions.find((opt) => opt.id_pays === nextId)?.nom_pays ||
                                            '';
                                          setActionnaireDraft((prev) =>
                                            prev
                                              ? {
                                                  ...prev,
                                                  id_pays: nextId,
                                                  paysLabel: label,
                                                }
                                              : prev,
                                          );
                                        }}
                                      >
                                        <option value="">--</option>
                                        {paysOptions.map((opt) => (
                                          <option key={opt.id_pays} value={opt.id_pays}>
                                            {opt.nom_pays}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : (
                                    actionnaire.nationalite || '-'
                                  )}
                                </td>
                                <td>
                                  {actionnaire.type_fonction || '-'}
                                </td>
                                <td>
                                  {isEditingRow ? (
                                    <input
                                      className={styles.tableInput}
                                      value={draft.qualification || ''}
                                      onChange={(e) =>
                                        setActionnaireDraft((prev) =>
                                          prev ? { ...prev, qualification: e.target.value } : prev,
                                        )
                                      }
                                    />
                                  ) : (
                                    actionnaire.qualification || '-'
                                  )}
                                </td>
                                <td>
                                  {isEditingRow ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      className={styles.tableInput}
                                      value={draft.taux ?? ''}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const parsed = raw === '' ? null : Number(raw);
                                        setActionnaireDraft((prev) => {
                                          if (!prev) return prev;
                                          const nextValue =
                                            parsed != null && Number.isFinite(parsed)
                                              ? parsed
                                              : prev.taux ?? null;
                                          return { ...prev, taux: nextValue };
                                        });
                                      }}
                                    />
                                  ) : actionnaire.taux != null ? (
                                    `${actionnaire.taux}%`
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td>
                                  {isEditingRow ? (
                                    <input
                                      className={styles.tableInput}
                                      value={draft.numero_carte || draft.numIdentite || ''}
                                      onChange={(e) =>
                                        setActionnaireDraft((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                numero_carte: e.target.value,
                                                numIdentite: e.target.value,
                                              }
                                            : prev,
                                        )
                                      }
                                    />
                                  ) : (
                                    actionnaire.numIdentite || actionnaire.numero_carte || '-'
                                  )}
                                </td>
                                <td>
                                  {isEditingRow ? (
                                    <div className={styles.tableActions}>
                                      <button
                                        className={`${styles.tableActionButton} ${styles.tableActionButtonPrimary}`}
                                        onClick={handleSaveActionnaire}
                                        disabled={isSavingRow}
                                      >
                                        {isSavingRow ? 'Enregistrement...' : 'Enregistrer'}
                                      </button>
                                      <button
                                        className={styles.tableActionButton}
                                        onClick={() => {
                                          setEditingActionnaireId(null);
                                          setActionnaireDraft(null);
                                        }}
                                        disabled={isSavingRow}
                                      >
                                        Annuler
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      className={styles.tableActionButton}
                                      onClick={() => {
                                        if (!ensureCanModify()) return;
                                        if (!actionnaire.id_actionnaire) return;
                                        setEditingActionnaireId(actionnaire.id_actionnaire);
                                        setActionnaireDraft({
                                          ...actionnaire,
                                          id_actionnaire: actionnaire.id_actionnaire,
                                          nom: actionnaire.nom || actionnaire.nomAR || '',
                                          prenom: actionnaire.prenom || actionnaire.prenomAR || '',
                                          numero_carte:
                                            actionnaire.numero_carte || actionnaire.numIdentite || '',
                                        });
                                      }}
                                      disabled={!canEdit || !canModifyPermisData}
                                      title={
                                        !canModifyPermisData
                                          ? "Permission 'modifier_permisData' requise."
                                          : undefined
                                      }
                                    >
                                      <Edit2 size={14} />
                                      Modifier
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <Info size={24} />
                      <p>Aucun actionnaire trouvé pour ce permis</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Dates Card */}
              <div className={`${styles.card} ${styles.animateIn} ${styles.delay1}`}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderIcon}>
                    <Calendar size={20} />
                  </div>
                  <h2 className={styles.cardTitle}>Dates importantes</h2>
                  <div className={styles.cardHeaderActions}>
                    {!canModifyPermisData && <LockBadge />}
                    {isEditingDates ? (
                      <>
                        <button
                          className={styles.secondaryButton}
                          onClick={() => setIsEditingDates(false)}
                          disabled={isSavingDates}
                        >
                          Annuler
                        </button>
                        <button
                          className={styles.primaryButton}
                          onClick={handleSaveDates}
                          disabled={isSavingDates}
                        >
                          {isSavingDates ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                      </>
                    ) : (
                      <button
                        className={styles.secondaryButton}
                        onClick={() => {
                          if (!ensureCanModify()) return;
                          setIsEditingDates(true);
                        }}
                        disabled={!canModifyPermisData}
                        title={
                          !canModifyPermisData
                            ? "Permission 'modifier_permisData' requise."
                            : undefined
                        }
                      >
                        <Edit2 size={16} />
                        Modifier
                      </button>
                    )}
                  </div>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Date d'octroi</span>
                      {isEditingDates ? (
                        <input
                          type="date"
                          className={styles.editInput}
                          value={dateForm.date_octroi}
                          onChange={(e) =>
                            setDateForm((prev) => ({ ...prev, date_octroi: e.target.value }))
                          }
                        />
                      ) : (
                        <span className={styles.infoValue}>{formatDate(permis.date_octroi)}</span>
                      )}
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Date d'expiration</span>
                      {isEditingDates ? (
                        <input
                          type="date"
                          className={styles.editInput}
                          value={dateForm.date_expiration}
                          onChange={(e) =>
                            setDateForm((prev) => ({ ...prev, date_expiration: e.target.value }))
                          }
                        />
                      ) : (
                        <span className={styles.infoValue}>{formatDate(permis.date_expiration)}</span>
                      )}
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Date d'annulation</span>
                      {isEditingDates ? (
                        <input
                          type="date"
                          className={styles.editInput}
                          value={dateForm.date_annulation}
                          onChange={(e) =>
                            setDateForm((prev) => ({ ...prev, date_annulation: e.target.value }))
                          }
                        />
                      ) : (
                        <span className={styles.infoValue}>{formatDate(permis.date_annulation)}</span>
                      )}
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Date de renonciation</span>
                      {isEditingDates ? (
                        <input
                          type="date"
                          className={styles.editInput}
                          value={dateForm.date_renonciation}
                          onChange={(e) =>
                            setDateForm((prev) => ({ ...prev, date_renonciation: e.target.value }))
                          }
                        />
                      ) : (
                        <span className={styles.infoValue}>{formatDate(permis.date_renonciation)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Substances Card */}
              <div className={`${styles.card} ${styles.animateIn} ${styles.delay2}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardHeaderIcon}>
                      <MapPin size={20} />
                    </div>
                    <h2 className={styles.cardTitle}>Substances</h2>
                    <div className={styles.cardHeaderActions}>
                      {!canModifyPermisData && <LockBadge />}
                      {isEditingSubstances ? (
                        <>
                          <button
                            className={styles.secondaryButton}
                            onClick={() => setIsEditingSubstances(false)}
                            disabled={isSavingSubstances}
                          >
                            Annuler
                          </button>
                          <button
                            className={styles.primaryButton}
                            onClick={handleSaveSubstances}
                            disabled={isSavingSubstances}
                          >
                            {isSavingSubstances ? 'Enregistrement...' : 'Enregistrer'}
                          </button>
                        </>
                      ) : (
                        <button
                          className={styles.secondaryButton}
                          onClick={() => {
                            if (!ensureCanModify()) return;
                            setIsEditingSubstances(true);
                          }}
                          disabled={!canModifyPermisData}
                          title={
                            !canModifyPermisData
                              ? "Permission 'modifier_permisData' requise."
                              : undefined
                          }
                        >
                          <Edit2 size={16} />
                          Modifier
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={styles.cardContent}>
                    {isEditingSubstances ? (
                      <div className={styles.substanceEditor}>
                        <div className={styles.substanceChecklist}>
                          {allSubstanceOptions.map((option) => {
                            const isSelected = selectedSubstanceIds.includes(option.id_sub);
                            const priorityValue =
                              substancePriorities[option.id_sub] ?? 'secondaire';
                            return (
                              <label key={option.id_sub} className={styles.substanceOption}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setSelectedSubstanceIds((prev) =>
                                      checked
                                        ? [...prev, option.id_sub]
                                        : prev.filter((id) => id !== option.id_sub),
                                    );
                                    setSubstancePriorities((prev) => {
                                      if (checked) {
                                        if (prev[option.id_sub]) return prev;
                                        return { ...prev, [option.id_sub]: 'secondaire' };
                                      }
                                      const { [option.id_sub]: _, ...rest } = prev;
                                      return rest;
                                    });
                                  }}
                                />
                                <span style={{ flex: 1 }}>{option.nom_subFR}</span>
                                <select
                                  className={styles.tableSelect}
                                  style={{ width: 140 }}
                                  value={priorityValue}
                                  disabled={!isSelected}
                                  onChange={(e) => {
                                    const value =
                                      e.target.value === 'principale' ? 'principale' : 'secondaire';
                                    setSubstancePriorities((prev) => ({
                                      ...prev,
                                      [option.id_sub]: value,
                                    }));
                                  }}
                                >
                                  <option value="principale">principale</option>
                                  <option value="secondaire">secondaire</option>
                                </select>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : substances.length > 0 ? (
                      <SubstanceTable substances={substances} />
                    ) : (
                      <div className={styles.emptyState}>
                        <Info size={24} />
                        <p>Aucune substance définie pour ce permis</p>
                      </div>
                    )}
                  </div>
                </div>

              {substances.length > 0 && (
                <div className={`${styles.card} ${styles.animateIn} ${styles.delay2}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardHeaderIcon}>
                      <MapPin size={20} />
                    </div>
                    <h2 className={styles.cardTitle}>Coordonnées</h2>
                  </div>
                  <div className={styles.cardContent}>
                    {latestCoordinatesProcedure && latestCoordinates.length > 0 ? (
                      <>
                        <CoordinatesDisplay
                          coordinates={latestCoordinates}
                          procedureNumber={latestProcedureLabel || latestCoordinatesProcedure.num_proc || ''}
                        />
                        <div className={styles.coordinatesMapSection}>
                          <div className={styles.coordinatesMap}>
                            <ArcGISMap
                              ref={previewMapRef}
                              points={previewMapPoints}
                              superficie={derivedSuperficie ?? 0}
                              isDrawing={false}
                              coordinateSystem="UTM"
                              utmZone={previewUtmZone}
                              utmHemisphere="N"
                              showFuseaux={false}
                              enableSelectionTools={false}
                              disableEnterpriseLayers
                            />
                          </div>
                          <div className={styles.coordinatesMapActions}>
                            <button
                              className={styles.primaryButton}
                              onClick={() => router.push('/projection')}
                            >
                              Voir dans la projection
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className={styles.emptyState}>
                        <MapPin size={24} />
                        <p>Aucune coordonnée disponible</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Latest Transfer Card */}
              {latestTransfer && (
                <div className={`${styles.card} ${styles.animateIn} ${styles.delay1}`}>
                  <div className={styles.cardHeader}>
                    <div className={styles.cardHeaderIcon}>
                      <ArrowRight size={20} />
                    </div>
                    <h2 className={styles.cardTitle}>Dernier transfert</h2>
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>De</span>
                        <span className={styles.infoValue}>
                          {latestTransfer.transfertDetenteur?.find(d => d.role === 'CEDANT' || d.type_detenteur === 'ANCIEN')?.detenteur?.nom_societeFR || '-'}
                        </span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Vers</span>
                        <span className={styles.infoValue}>
                          {latestTransfer.transfertDetenteur?.find(d => d.role === 'CESSIONNAIRE' || d.type_detenteur === 'NOUVEAU')?.detenteur?.nom_societeFR || '-'}
                        </span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Date</span>
                        <span className={styles.infoValue}>{formatDate(latestTransfer.date_transfert as any)}</span>
                      </div>
                      {latestTransfer.motif_transfert && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Motif</span>
                          <span className={styles.infoValue}>{latestTransfer.motif_transfert}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {/* Quick Actions Card */}
              <div className={`${styles.card} ${styles.animateIn} ${styles.delay1}`}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderIcon}>
                    <Building2 size={20} />
                  </div>
                  <h2 className={styles.cardTitle}>Actions rapides</h2>
                  {!canQuickActions && <LockBadge label="Accès restreint" />}
                </div>
                <div className={styles.cardContent}>
                  {isLoadingTypeProcedures && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                      Chargement des actions...
                    </div>
                  )}
                  {resolvedActions.length > 0 ? (
                    resolvedActions.map((action) => {
                      const allowsDuringProcedure = action.allowDuringProcedureInProgress === true;
                      const isBlockedByProgress = isProcedureInProgress && !allowsDuringProcedure;
                      const isActionBlocked = isBlockedByProgress || action.disabled || !canQuickActions;
                      const actionTitle = isBlockedByProgress
                        ? procedureInProgressMessage ||
                          action.tooltip ||
                          action.description ||
                          undefined
                        : !canQuickActions
                          ? "Permission 'actions_rapides' requise."
                          : action.tooltip || action.description || undefined;

                      return (
                        <button
                          key={action.id}
                          className={`${styles.actionButton} ${getActionButtonClass(action.variant)}`}
                          onClick={() => {
                            if (!canQuickActions) {
                              toast.error("Permission 'actions_rapides' requise.");
                              return;
                            }
                            if (isBlockedByProgress) {
                              warnProcedureInProgress();
                              return;
                            }
                            action.onClick();
                          }}
                          disabled={isActionBlocked}
                          aria-disabled={isActionBlocked}
                          title={actionTitle}
                          style={isActionBlocked ? { cursor: 'not-allowed', opacity: 0.75 } : undefined}
                        >
                          {action.icon}
                          {action.label}
                        </button>
                      );
                    })
                  ) : (
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      Aucune action disponible pour ce type de permis.
                    </div>
                  )}
                  {!canQuickActions && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                      Permission requise.
                    </div>
                  )}
                </div>
              </div>

              {/* Status Timeline */}
              <div className={`${styles.card} ${styles.animateIn} ${styles.delay2}`}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderIcon}>
                    <BarChart3 size={20} />
                  </div>
                  <h2 className={styles.cardTitle}>Historique des statuts</h2>
                </div>
                <div className={styles.cardContent}>
                  <TimelineChart 
                    procedures={permis.procedures} 
                    renewals={permis.renewals}
                    dateOctroi={permis.date_octroi}
                    dateExpiration={permis.date_expiration}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'procedures' && (
        <div className={styles.tabContent}>
          {!canViewProceduresTab ? (
            <div className={`${styles.card} ${styles.animateIn}`}>
              <div className={styles.cardHeader}>
                <div className={styles.cardHeaderIcon}>
                  <Clock size={20} />
                </div>
                <h2 className={styles.cardTitle}>Procédures associées</h2>
                <LockBadge label="Accès restreint" />
              </div>
              <div className={styles.cardContent}>
                <div className={styles.emptyState}>
                  <Info size={24} />
                  <p>Permission requise: procedure_permisDetails.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className={`${styles.card} ${styles.animateIn}`}>
              <div className={styles.cardHeader}>
                <div className={styles.cardHeaderIcon}>
                  <Clock size={20} />
                </div>
                <h2 className={styles.cardTitle}>Procédures associées</h2>
                <span className={styles.badge}>{permis.procedures.length} procédures</span>
              </div>
              <div className={styles.cardContent}>
                {/* Procedure Types Section */}
                <div className={styles.procedureTypes}>
                  <h3 className={styles.procedureTypesTitle}>Types de procédures</h3>
                  <div className={styles.procedureTypesList}>
                    {procedureTypes.map(type => (
                      <button
                        key={type}
                        onClick={() => handleProcedureTypeClick(type)}
                        className={styles.procedureTypeBadge}
                      >
                        {type} ({permis.procedures.filter(p => getProcedureType(p) === type).length})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Procedures List */}
                <div className={styles.proceduresList}>
                  <h3 className={styles.proceduresListTitle}>Toutes les procédures</h3>
                  {permis.procedures.length > 0 ? (
                    <div className={styles.procedureItems}>
                      {permis.procedures.map(procedure => (
                        <div 
                          key={procedure.id_proc} 
                          className={styles.procedureItem}
                          style={{ borderLeftColor: getProcedureBorderColor(procedure.statut_proc) }}
                          onClick={() => {
                            setSelectedProcedure(procedure);
                            setIsModalOpen(true);
                          }}
                        >
                          <div className={styles.procedureItemHeader}>
                            <span className={styles.procedureNumber}>{procedure.num_proc}</span>
                            <span className={`${styles.badge} ${getStatusColor(procedure.statut_proc)}`}>
                              {getStatusIcon(procedure.statut_proc)}
                              {procedure.statut_proc}
                            </span>
                          </div>
                          <div className={styles.procedureItemBody}>
                            <span className={styles.procedureType}>{getProcedureType(procedure)}</span>
                            <span className={styles.procedureDates}>
                              {formatDate(procedure.date_debut_proc)} - {formatDate(procedure.date_fin_proc)}
                            </span>
                          </div>
                          <div className={styles.procedureItemFooter}>
                            <span className={styles.procedureSteps}>
                              {procedure.ProcedureEtape.length} étape(s)
                            </span>
                            <ChevronRight size={16} className={styles.chevronIcon} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <FileText size={48} className={styles.emptyStateIcon} />
                      <p>Aucune procédure associée à ce permis</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div className={styles.tabContent}>
          {!canViewDocumentsTab ? (
            <div className={`${styles.card} ${styles.animateIn}`}>
              <div className={styles.cardHeader}>
                <div className={styles.cardHeaderIcon}>
                  <FileSearch size={20} />
                </div>
                <h2 className={styles.cardTitle}>Documents associés</h2>
                <LockBadge label="Accès restreint" />
              </div>
              <div className={styles.cardContent}>
                <div className={styles.emptyState}>
                  <Info size={24} />
                  <p>Permission requise: document_permisDetails.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className={`${styles.card} ${styles.animateIn}`}>
              <div className={styles.cardHeader}>
                <div className={styles.cardHeaderIcon}>
                  <FileSearch size={20} />
                </div>
                <h2 className={styles.cardTitle}>Documents associés</h2>
                <span className={styles.badge}>{documentsData?.totalCount || 0} documents</span>
              </div>
              <div className={styles.cardContent}>
                {isLoadingDocuments ? (
                  <div className={styles.loading}>
                    <RefreshCw size={32} className={styles.spinner} />
                    <p>Chargement des documents...</p>
                  </div>
                ) : documentsData ? (
                  <div className={styles.documentsContainer}>
                    {/* Procedure Documents */}
                    {documentsData.procedures.map((procedure) => (
                      <div key={procedure.id_proc} className={styles.documentCategory}>
                        <div
                          className={styles.documentCategoryHeader}
                          onClick={() => toggleProcedure(procedure.id_proc)}
                        >
                          <h3 className={styles.documentCategoryTitle}>
                            Procédure: {procedure.num_proc} :{' '}
                            <span className={styles.procedureStatus}>{procedure.statut_proc}</span>
                          </h3>
                          <div className={styles.documentCategoryInfo}>
                            <span className={styles.documentCount}>
                              {procedure.documentCount} document(s)
                            </span>
                            <ChevronDown
                              size={16}
                              className={`${styles.expandIcon} ${
                                expandedProcedures.includes(procedure.id_proc)
                                  ? styles.expanded
                                  : ''
                              }`}
                            />
                          </div>
                        </div>

                        {expandedProcedures.includes(procedure.id_proc) && (
                          <div className={styles.documentsGrid}>
                            {procedure.documents.map((document) => (
                              <DocumentCard
                                key={document.id}
                                document={document}
                                onView={handleDocumentView}
                                onDownload={handleDocumentDownload}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {documentsData.totalCount === 0 && (
                      <div className={styles.emptyState}>
                        <FileText size={48} className={styles.emptyStateIcon} />
                        <p>Aucun document associé à ce permis</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <FileText size={48} className={styles.emptyStateIcon} />
                    <p>Aucun document associé à ce permis</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === 'history' && (
        <div className={styles.tabContent}>
          <div className={`${styles.card} ${styles.animateIn}`}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderIcon}>
                <RefreshCw size={20} />
              </div>
              <h2 className={styles.cardTitle}>Historique du permis</h2>
            </div>
            <div className={styles.cardContent}>
              {historique && historique.length > 0 ? (
                <div className={styles.renewalTimeline}>
                  {historique.map((h: any, idx: number) => (
                    <div key={`${h.type_code}-${h.id}`} className={styles.renewalItem}>
                      <div className={styles.renewalMarker}>
                        <div className={styles.renewalNumber}>{idx + 1}</div>
                        <div className={styles.renewalConnector}></div>
                      </div>
                      <div className={styles.renewalDetails}>
                        <div className={styles.renewalHeader}>
                          <span className={styles.renewalDecision}>
                            {h.type_code ? `${h.type_code} - ` : ''}
                            {h.type || 'Type inconnu'}
                          </span>
                          <span className={styles.renewalDate}>{formatDate(h.date_octroi)}</span>
                        </div>
                        <div className={styles.renewalPeriod}>
                          {h.code && (<span>Code permis: {h.code}</span>)}
                          <span>Expiration: {formatDate(h.date_expiration)}</span>
                          {h.detenteur && (<span style={{ marginLeft: 16 }}>Titulaire: {h.detenteur}</span>)}
                          {h.statut && (<span style={{ marginLeft: 16 }}>Statut: {h.statut}</span>)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <FileText size={48} className={styles.emptyStateIcon} />
                  <p>Aucun historique du permis</p>
                </div>
              )}
            </div>
          </div>
          <div className={`${styles.card} ${styles.animateIn}`}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeaderIcon}>
                <RefreshCw size={20} />
              </div>
              <h2 className={styles.cardTitle}>Historique des Renouvellements</h2>
            </div>
            <div className={styles.cardContent}>
              {permis.renewals && permis.renewals.some(r => r.num_decision && r.num_decision !== 'N/A') ? (
                <div className={styles.renewalTimeline}>
                  {permis.renewals
                    .filter(r => r.num_decision && r.num_decision !== 'N/A')
                    .map((renewal, index) => (
                      <div key={renewal.id} className={styles.renewalItem}>
                        <div className={styles.renewalMarker}>
                          <div className={styles.renewalNumber}>{index + 1}</div>
                          <div className={styles.renewalConnector}></div>
                        </div>
                        <div className={styles.renewalDetails}>
                          <div className={styles.renewalHeader}>
                            <span className={styles.renewalDecision}>Décision: {renewal.num_decision}</span>
                            <span className={styles.renewalDate}>
                              {formatDate(renewal.date_decision)}
                            </span>
                          </div>
                          <div className={styles.renewalPeriod}>
                            <span>Période: {formatDate(renewal.date_debut_validite)} - {formatDate(renewal.date_fin_validite)}</span>
                            <span className={styles.renewalDuration}>
                              ({permis.typePermis.duree_renouv} {permis.typePermis.duree_renouv > 1 ? 'ans' : 'an'})
                            </span>
                          </div>
                          {renewal.commentaire && (
                            <div className={styles.renewalComment}>
                              <strong>Commentaire:</strong> {renewal.commentaire}
                            </div>
                          )}
                          <div
                            className={styles.renewalLimitWarning}
                            onClick={() => {
                              if (permis.nombre_renouvellements! >= permis.typePermis.nbr_renouv_max) {
                                setShowMaxRenewalModal(true);
                              }
                            }}
                            style={{
                              cursor: permis.nombre_renouvellements! >= permis.typePermis.nbr_renouv_max ? 'pointer' : 'default'
                            }}
                          >
                            {permis.nombre_renouvellements && permis.typePermis.nbr_renouv_max && (
                              <>
                                <div className={styles.renewalProgress}>
                                  <div
                                    className={styles.renewalProgressBar}
                                    style={{
                                      width: `${Math.min(100, (permis.nombre_renouvellements / permis.typePermis.nbr_renouv_max) * 100)}%`
                                    }}
                                  ></div>
                                </div>
                                <div className={styles.renewalLimitText}>
                                  {permis.nombre_renouvellements} / {permis.typePermis.nbr_renouv_max} renouvellements utilisés
                                </div>
                                {permis.nombre_renouvellements >= permis.typePermis.nbr_renouv_max && (
                                  <div className={styles.renewalMaxReached}>
                                    <XCircle size={16} />
                                    <span>Maximum de renouvellements atteint</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  }
                  <div className={styles.currentStatus}>
                    <div className={styles.statusLabel}>Statut actuel:</div>
                    <div className={`${styles.statusValue} ${calculateValidityStatus(permis.date_expiration) === 'Valide' ? styles.statusValid :
                        calculateValidityStatus(permis.date_expiration) === 'Expire bientôt' ? styles.statusWarning :
                          styles.statusExpired
                      }`}>
                      {calculateValidityStatus(permis.date_expiration)}
                      {permis.date_expiration && (
                        <span className={styles.statusDate}>
                          (jusqu'au {formatDate(permis.date_expiration)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.noRenewals}>
                  <RefreshCw size={48} className={styles.emptyStateIcon} />
                  <p>Ce permis n'a pas encore été renouvelé.</p>
                  <button 
                    className={styles.primaryButton}
                    onClick={() => handleRenewalClick(permis.id)}
                    disabled={
                      isProceduresLocked ||
                      (permis.renewals?.length || 0) >= permis.typePermis.nbr_renouv_max
                    }
                  >
                    <Plus size={16} />
                    Demander un premier renouvellement
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Procedure Modal */}
      {isModalOpen && selectedProcedure && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <button
              onClick={() => setIsModalOpen(false)}
              className={styles.modalCloseButton}
            >
              <XCircle size={20} />
            </button>

            <h2 className={styles.modalTitle}>
              {getProcedureType(selectedProcedure)} - {selectedProcedure.num_proc}
            </h2>

            <div className={styles.modalBody}>
              <div className={styles.modalProcedureInfo}>
                <div className={styles.modalProcedureDates}>
                  <span>Début: {formatDate(selectedProcedure.date_debut_proc)}</span>
                  <span> - </span>
                  <span>Fin: {formatDate(selectedProcedure.date_fin_proc)}</span>
                </div>
                <div className={`${styles.badge} ${getStatusColor(selectedProcedure.statut_proc)}`}>
                  {getStatusIcon(selectedProcedure.statut_proc)}
                  {selectedProcedure.statut_proc}
                </div>
              </div>

              {selectedProcedures.length > 1 && (
                <div className={styles.procedureSelector}>
                  <label className={styles.procedureSelectorLabel}>Choisir une procédure :</label>
                  <select
                    className={styles.procedureSelectorDropdown}
                    value={selectedProcedure?.id_proc}
                    onChange={(e) => {
                      const freshProc = permis.procedures.find(p => p.id_proc === Number(e.target.value));
                      if (freshProc) setSelectedProcedure(freshProc);
                    }}
                  >
                    {selectedProcedures.map(p => (
                      <option key={p.id_proc} value={p.id_proc}>
                        {p.num_proc} - {formatDate(p.date_debut_proc)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={styles.modalStepsContainer}>
                <h3 className={styles.modalStepsTitle}>Étapes de la procédure</h3>
                {selectedProcedure.ProcedureEtape.map((step) => (
                  <div key={step.id_etape} className={styles.stepItem}>
                    <div
                      className={styles.stepIndicator}
                      style={{
                        backgroundColor: step.statut === 'TERMINEE' ? '#10b981' :
                          step.statut === 'EN_COURS' ? '#6366f1' : 
                          step.statut === 'EN_ATTENTE' ? '#f59e0b' : '#e2e8f0',
                        color: step.statut === 'EN_ATTENTE' ? '#64748b' : 'white'
                      }}
                    >
                      {step.etape.ordre_etape}
                    </div>
                    <div className={styles.stepContent}>
                      <h4 className={styles.stepTitle}>{step.etape.lib_etape}</h4>
                      <div className={styles.stepDates}>
                        {formatDate(step.date_debut)} - {formatDate(step.date_fin)}
                      </div>
                      <span className={`${styles.badge} ${getStatusColor(step.statut)}`}>
                        {getStatusIcon(step.statut)}
                        {step.statut}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {selectedProcedure.SubstanceAssocieeDemande?.some((sub) => sub?.substance) && (
                <div className={styles.modalSubstances}>
                  <h3 className={styles.modalSubstancesTitle}>Substances concernées</h3>
                  <div className={styles.substancesList}>
                    {selectedProcedure.SubstanceAssocieeDemande
                      .filter((sub) => sub?.substance)
                      .map((sub, index) => (
                        <span key={index} className={styles.substanceBadge}>
                          {sub?.substance?.nom_subFR || 'Substance non renseignée'}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                onClick={() => setIsModalOpen(false)}
                className={styles.modalSecondaryButton}
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  handleViewProcedure(selectedProcedure);
                }}
                className={styles.modalPrimaryButton}
              >
                Voir la procédure
              </button>
            </div>
          </div>
        </div>
      )}

      {showDateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.modalTitle}>Demande de renouvellement</h2>

            <div className={styles.modalInfoText}>
              <p>Renouvellements restants: {permis.typePermis.nbr_renouv_max - (permis.nombre_renouvellements || 0)}/{permis.typePermis.nbr_renouv_max}</p>
              <p>Vous pouvez effectuer {permis.typePermis.nbr_renouv_max - (permis.nombre_renouvellements || 0)} renouvellement(s) supplémentaire(s)</p>
            </div>

            <div className={styles.modalSection}>
              <h3 className={styles.modalSubtitle}>Choisir une date de demande</h3>
              <input
                type="date"
                value={toDateInputValue(selectedDate)}
                onChange={(e) => setSelectedDate(parseDateInputValue(e.target.value))}
                className={styles.modalDateInput}
                min={toDateInputValue(new Date())}
              />
            </div>

            <div className={styles.modalSection}>
              <h3 className={styles.modalSubtitle}>Coordonnées du permis</h3>
              {renewalPerimeterLoading && (
                <div className={styles.modalHint}>Chargement des coordonnées...</div>
              )}
              {!renewalPerimeterLoading && renewalPerimeterError && (
                <div className={styles.modalHint}>{renewalPerimeterError}</div>
              )}

              <div className={styles.choiceList}>
                <label
                  className={`${styles.choiceCard} ${renewalPerimeterChoice === 'keep' ? styles.choiceCardActive : ''}`}
                >
                  <input
                    type="radio"
                    name="renewal-perimeter-choice"
                    checked={renewalPerimeterChoice === 'keep'}
                    onChange={() => setRenewalPerimeterChoice('keep')}
                    disabled={!renewalPerimeter?.points?.length}
                  />
                  <div>
                    <div>Conserver le périmètre existant</div>
                    <div className={styles.choiceMeta}>
                      {renewalPerimeter?.procedure?.num_proc
                        ? `Procédure ${renewalPerimeter.procedure.num_proc}`
                        : renewalPerimeter?.procedure?.id_proc
                          ? `Procédure ${renewalPerimeter.procedure.id_proc}`
                          : 'Dernière procédure avec coordonnées'}
                      {renewalPerimeter?.points?.length
                        ? ` • ${renewalPerimeter.points.length} points`
                        : ''}
                      {typeof renewalPerimeter?.areaHa === 'number'
                        ? ` • ${renewalPerimeter.areaHa.toFixed(2)} ha`
                        : ''}
                    </div>
                  </div>
                </label>

                <label
                  className={`${styles.choiceCard} ${renewalPerimeterChoice === 'manual' ? styles.choiceCardActive : ''}`}
                >
                  <input
                    type="radio"
                    name="renewal-perimeter-choice"
                    checked={renewalPerimeterChoice === 'manual'}
                    onChange={() => setRenewalPerimeterChoice('manual')}
                  />
                  <div>
                    <div>Saisir un nouveau périmètre</div>
                    <div className={styles.choiceMeta}>
                      Importer CSV/Excel ou modifier les champs ci-dessous.
                    </div>
                  </div>
                </label>
              </div>

              {renewalPerimeterChoice === 'manual' && (
                <div className={styles.manualSection}>
                  <div className={styles.manualActions}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => manualFileInputRef.current?.click()}
                    >
                      <Upload size={16} />
                      Importer CSV/Excel
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={addManualPointRow}
                    >
                      Ajouter un point
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={clearManualPerimeter}
                      disabled={!manualPerimeterText && manualPerimeterPoints.length === 0}
                    >
                      Effacer
                    </button>
                  </div>
                  <input
                    ref={manualFileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleManualFileChange}
                    style={{ display: 'none' }}
                  />
                  {manualPerimeterError && (
                    <div className={styles.manualError}>{manualPerimeterError}</div>
                  )}
                  {manualAreaError && (
                    <div className={styles.manualError}>{manualAreaError}</div>
                  )}
                  <div className={styles.coordPreview}>
                    <table className={styles.coordPreviewTable}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>X</th>
                          <th>Y</th>
                          <th>Fuseau</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {manualPerimeterPoints.map((p, idx) => (
                          <tr key={`manual-point-${idx}`}>
                            <td>{idx + 1}</td>
                            <td>
                              <input
                                className={styles.coordInput}
                                type="text"
                                value={formatCoordInput(p.x)}
                                onChange={(e) => updateManualPoint(idx, 'x', e.target.value)}
                                placeholder="X"
                              />
                            </td>
                            <td>
                              <input
                                className={styles.coordInput}
                                type="text"
                                value={formatCoordInput(p.y)}
                                onChange={(e) => updateManualPoint(idx, 'y', e.target.value)}
                                placeholder="Y"
                              />
                            </td>
                            <td>
                              <input
                                className={styles.coordInput}
                                type="number"
                                value={p.zone ?? ''}
                                onChange={(e) => updateManualPoint(idx, 'zone', e.target.value)}
                                placeholder="31"
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className={styles.coordRemoveBtn}
                                onClick={() => removeManualPointRow(idx)}
                                disabled={manualPerimeterPoints.length <= 1}
                              >
                                Supprimer
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className={styles.manualSummary}>
                      <span>{manualValidPointCount} points valides</span>
                      {manualValidPointCount >= 3 && (
                        <span>Surface estimee: {manualAreaHa.toFixed(2)} ha</span>
                      )}
                      {typeof maxRenewalAreaHa === 'number' && (
                        <span>Max: {maxRenewalAreaHa.toFixed(2)} ha</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {renewalPerimeterChoice === 'keep' &&
                (renewalPerimeter?.points?.length ?? 0) > 0 && (
                  <div className={styles.coordPreview}>
                    <table className={styles.coordPreviewTable}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>X</th>
                          <th>Y</th>
                          <th>Zone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(renewalPerimeter?.points || []).slice(0, 12).map((p, idx) => (
                          <tr key={`renewal-point-${idx}`}>
                            <td>{idx + 1}</td>
                            <td>{p.x}</td>
                            <td>{p.y}</td>
                            <td>{p.zone ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(renewalPerimeter?.points?.length ?? 0) > 12 && (
                      <div className={styles.modalHint}>
                        + {(renewalPerimeter?.points?.length ?? 0) - 12} points supplémentaires
                      </div>
                    )}
                    <div className={styles.modalHint}>
                      Vous pouvez réduire la surface à l’étape 4, sans dépasser le périmètre actuel.
                    </div>
                  </div>
                )}
            </div>

            <div className={styles.modalFooter}>
              <button
                onClick={() => {
                  setShowDateModal(false);
                  setSelectedDate(null);
                  setRenewalPerimeter(null);
                  setRenewalPerimeterError(null);
                  setRenewalPerimeterChoice('keep');
                  setManualPerimeterText('');
                  setManualPerimeterPoints([]);
                  setManualPerimeterError(null);
                }}
                className={styles.modalSecondaryButton}
              >
                Annuler
              </button>
              <button
                onClick={handleSubmitDate}
                disabled={disableRenewalConfirm}
                className={styles.modalPrimaryButton}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {showMaxRenewalModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <button
              onClick={() => setShowMaxRenewalModal(false)}
              className={styles.modalCloseButton}
            >
              <XCircle size={20} />
            </button>

            <div className={styles.modalIconWarning}>
              <XCircle size={48} className={styles.warningIcon} />
            </div>

            <h2 className={styles.modalTitle}>Limite de renouvellements atteinte</h2>

            <div className={styles.modalBody}>
              <p>
                <strong>Type de permis:</strong> {permis.typePermis.lib_type} ({permis.typePermis.code_type})
              </p>
              <p>
                <strong>Renouvellements effectués:</strong> {permis.nombre_renouvellements || 0} / {permis.typePermis.nbr_renouv_max}
              </p>
              <div className={styles.modalWarningText}>
                Ce permis a atteint le nombre maximum de renouvellements autorisés.
                Vous ne pouvez pas effectuer de nouveaux renouvellements pour ce permis.
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                onClick={() => setShowMaxRenewalModal(false)}
                className={styles.modalPrimaryButton}
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}

      {showDocumentViewer && selectedDocument && (
        <DocumentViewer
          document={selectedDocument}
          onClose={() => setShowDocumentViewer(false)}
          onDownload={() => handleDocumentDownload(selectedDocument)}
        />
      )}

      {showExtensionModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: 'min(420px, 90vw)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>Extension / Modification</h3>
            <p style={{ margin: '0 0 16px', color: '#4b5563', fontSize: 14 }}>
              Choisissez l'option souhaitée puis validez.
            </p>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={wantsExtension}
                onChange={(e) => {
                  setWantsExtension(e.target.checked);
                  if (!e.target.checked) {
                    setExtensionChoice(null);
                  }
                }}
              />
              <span>Extension</span>
            </label>

            {wantsExtension && (
              <div style={{ paddingLeft: 22, marginBottom: 12, display: 'grid', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="radio"
                    name="extension-choice"
                    checked={extensionChoice === 'perimetres'}
                    onChange={() => setExtensionChoice('perimetres')}
                  />
                  <span>Extension périmètres</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="radio"
                    name="extension-choice"
                    checked={extensionChoice === 'substances'}
                    onChange={() => setExtensionChoice('substances')}
                  />
                  <span>Extension substances</span>
                </label>
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={wantsModification}
                onChange={(e) => setWantsModification(e.target.checked)}
              />
              <span>Modification</span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button
                onClick={resetExtensionModal}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleExtensionConfirm}
                disabled={
                  (!wantsExtension && !wantsModification) ||
                  (wantsExtension && !extensionChoice)
                }
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background:
                    (!wantsExtension && !wantsModification) || (wantsExtension && !extensionChoice)
                      ? '#9ca3af'
                      : '#2563eb',
                  color: '#fff',
                  cursor:
                    (!wantsExtension && !wantsModification) || (wantsExtension && !extensionChoice)
                      ? 'not-allowed'
                      : 'pointer',
                }}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmationModal && pendingAction && (
        <ActionConfirmationModal
          actionType={pendingAction.type}
          onConfirm={confirmAction}
          onCancel={cancelAction}
          permisDetails={{
            code: permis.code_permis,
            type: permis.typePermis.lib_type,
            titulaire: getPermisTitulaireName(permis) || 'Inconnu',
            optionFrom: optionOldType,
            optionTo: optionNewType || permis.typePermis.code_type,
          }}
          signatureDate={pendingAction.type === 'option2025' ? optionSignatureDate : undefined}
          signatureDateError={
            pendingAction.type === 'option2025' ? optionSignatureDateError : null
          }
          onSignatureDateChange={
            pendingAction.type === 'option2025'
              ? (value) => {
                  optionSignatureDateRef.current = value;
                  setOptionSignatureDate(value);
                  if (value && optionSignatureDateError) {
                    setOptionSignatureDateError(null);
                  }
                }
              : undefined
          }
        />
      )}

      {showOptionDownloadModal && (
        <OptionDownloadPromptModal
          message={
            optionDownloadMessage ||
            'Voulez-vous aller telecharger le permis ?'
          }
          onCancel={() => setShowOptionDownloadModal(false)}
          onDownload={() => {
            setShowOptionDownloadModal(false);
            router.push(`/permis_dashboard/view/permis_option_designer?permisId=${permis.id}`);
          }}
        />
      )}
 </div>
</main>
    </div>
    </div>
    
  );
}

export default PermisViewPage;
