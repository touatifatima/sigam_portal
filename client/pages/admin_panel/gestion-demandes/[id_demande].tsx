'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import axios from 'axios';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiClock,
  FiDownload,
  FiFileText,
  FiMapPin,
  FiMessageSquare,
  FiX,
} from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Navbar from '@/pages/navbar/Navbar';
import Sidebar from '@/pages/sidebar/Sidebar';
import EntityMessagesPanel from '@/components/chat/EntityMessagesPanel';
import PerimeterCoordinatesTable from '@/components/perimeter/PerimeterCoordinatesTable';
import type { ArcGISMapRef, Coordinate } from '@/components/arcgismap/ArcgisMap';
import { useViewNavigator } from '@/src/hooks/useViewNavigator';
import { useAuthStore } from '@/src/store/useAuthStore';
import styles from './gestion_demande_detail.module.css';

const ArcGISMap = dynamic<any>(() => import('@/components/arcgismap/ArcgisMap'), {
  ssr: false,
});

type StatusAction = 'ACCEPTEE' | 'REJETEE' | 'EN_COMPLEMENT';

type UserMini = {
  id?: number;
  username?: string | null;
  email?: string | null;
  nom?: string | null;
  prenom?: string | null;
  Prenom?: string | null;
  detenteur?: {
    nom_societeFR?: string | null;
    nom_societeAR?: string | null;
  } | null;
};

type ProcedureEtapeItem = {
  id_etape?: number;
  statut?: string | null;
  date_debut?: string | null;
  date_fin?: string | null;
  etape?: {
    nom_etape?: string | null;
    lib_etape?: string | null;
    ordre_etape?: number | null;
  } | null;
};

type PaiementItem = {
  id?: number;
  montant_paye?: number | null;
  etat_paiement?: string | null;
  date_paiement?: string | null;
};

type DemandeDetail = {
  id_demande: number;
  code_demande?: string | null;
  statut_demande?: string | null;
  date_demande?: string | null;
  date_instruction?: string | null;
  date_refus?: string | null;
  date_fin_instruction?: string | null;
  remarques?: string | null;
  Nom_Prenom_Resp_Enregist?: string | null;
  montant_produit?: number | null;
  budget_prevu?: number | null;
  montant_paye_total?: number | null;
  superficie?: number | null;
  lieu_ditFR?: string | null;
  utilisateurId?: number;
  utilisateur?: UserMini | null;
  detenteur?: {
    nom_societeFR?: string | null;
    nom_societeAR?: string | null;
    email?: string | null;
  } | null;
  detenteurdemande?: Array<{
    detenteur?: {
      nom_societeFR?: string | null;
      nom_societeAR?: string | null;
      email?: string | null;
    } | null;
  }> | null;
  typePermis?: { id?: number; code_type?: string | null; lib_type?: string | null } | null;
  typeProcedure?: { id?: number; libelle?: string | null } | null;
  wilaya?: { nom_wilayaFR?: string | null } | null;
  daira?: { nom_dairaFR?: string | null } | null;
  commune?: { nom_communeFR?: string | null } | null;
  facture?: {
    id_facture?: number;
    montant_total?: number | null;
    statut?: string | null;
    paiements?: PaiementItem[];
  } | null;
  procedure?: {
    id_proc?: number;
    statut_proc?: string | null;
    date_fin_proc?: string | null;
    ProcedureEtape?: ProcedureEtapeItem[];
  } | null;
};

type DocumentItem = {
  nom: string;
  statut: string;
  date?: string | null;
  size?: string | null;
  fileUrl?: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('fr-FR');
};

const formatMoney = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'DZD',
    maximumFractionDigits: 2,
  }).format(value);
};

const isTruthyQueryFlag = (value?: string | null) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'oui';
};

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const computeBbox = (points: Array<{ x: number; y: number }>) => {
  if (!Array.isArray(points) || points.length === 0) return null;
  const xs = points.map((p) => p.x).filter((v) => Number.isFinite(v));
  const ys = points.map((p) => p.y).filter((v) => Number.isFinite(v));
  if (!xs.length || !ys.length) return null;
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
};

const normalizeProcedureEtapes = (value: unknown): ProcedureEtapeItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((step: any) => {
      const etapeRaw = step?.etape ?? null;
      return {
        id_etape: toFiniteNumber(step?.id_etape) ?? undefined,
        statut: step?.statut != null ? String(step.statut) : null,
        date_debut: step?.date_debut ?? step?.dateDebut ?? null,
        date_fin: step?.date_fin ?? step?.dateFin ?? null,
        etape: etapeRaw
          ? {
              nom_etape: etapeRaw?.nom_etape ?? etapeRaw?.nomEtape ?? etapeRaw?.lib_etape ?? null,
              lib_etape: etapeRaw?.lib_etape ?? etapeRaw?.nom_etape ?? etapeRaw?.nomEtape ?? null,
              ordre_etape: toFiniteNumber(etapeRaw?.ordre_etape ?? etapeRaw?.ordreEtape),
            }
          : null,
      } as ProcedureEtapeItem;
    })
    .filter(
      (step) =>
        step.id_etape != null ||
        !!step.statut ||
        !!step.date_debut ||
        !!step.date_fin ||
        !!step.etape?.nom_etape ||
        !!step.etape?.lib_etape,
    );
};

const getTitulaire = (item?: DemandeDetail | null) => {
  if (!item) return '--';
  const detenteurDirect = item.detenteur;
  const detenteurFromDemande = item.detenteurdemande?.find((entry) => !!entry?.detenteur)?.detenteur;
  const detenteurFromUser = item.utilisateur?.detenteur;
  const societe =
    detenteurDirect?.nom_societeFR ||
    detenteurDirect?.nom_societeAR ||
    detenteurFromDemande?.nom_societeFR ||
    detenteurFromDemande?.nom_societeAR ||
    detenteurFromUser?.nom_societeFR ||
    detenteurFromUser?.nom_societeAR;
  if (societe) return societe;
  const fullName = [item.utilisateur?.nom, item.utilisateur?.Prenom ?? item.utilisateur?.prenom]
    .filter(Boolean)
    .join(' ')
    .trim();
  return fullName || item.utilisateur?.username || item.utilisateur?.email || '--';
};

const getResponsable = (item?: DemandeDetail | null) => {
  if (!item) return '--';
  if (item.Nom_Prenom_Resp_Enregist) return item.Nom_Prenom_Resp_Enregist;
  const fullName = [item.utilisateur?.nom, item.utilisateur?.Prenom ?? item.utilisateur?.prenom]
    .filter(Boolean)
    .join(' ')
    .trim();
  return fullName || item.utilisateur?.username || item.utilisateur?.email || '--';
};

const getMontantValue = (item?: DemandeDetail | null): number | null => {
  if (!item) return null;
  const paid = toFiniteNumber(item.montant_paye_total);
  if (paid !== null) return paid;
  const legacyMontantProduit = toFiniteNumber(item.montant_produit);
  if (legacyMontantProduit !== null) return legacyMontantProduit;
  const legacyBudget = toFiniteNumber(item.budget_prevu);
  if (legacyBudget !== null) return legacyBudget;
  const factureMontant = toFiniteNumber(item.facture?.montant_total);
  return factureMontant;
};

export default function GestionDemandeDetailAdminPage() {
  const apiURL = process.env.NEXT_PUBLIC_API_URL || '';
  const router = useRouter();
  const { auth, isLoaded, hasPermission } = useAuthStore();
  const { currentView, navigateTo } = useViewNavigator('manage_demandes');

  const demandeId = useMemo(() => {
    if (!router.isReady) return null;

    const fromQuery = Array.isArray(router.query.id_demande)
      ? router.query.id_demande[0]
      : router.query.id_demande;
    const queryValue = String(fromQuery || '').trim();
    const parsedQuery = Number(queryValue);
    if (Number.isFinite(parsedQuery) && parsedQuery > 0) {
      return parsedQuery;
    }

    const fromPath = String(router.asPath || '').match(/\/admin_panel\/gestion-demandes\/(\d+)/i)?.[1];
    const parsedPath = Number(fromPath);
    if (Number.isFinite(parsedPath) && parsedPath > 0) {
      return parsedPath;
    }

    return null;
  }, [router.asPath, router.isReady, router.query.id_demande]);

  const hasValidId = Number.isFinite(Number(demandeId)) && Number(demandeId) > 0;

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [demande, setDemande] = useState<DemandeDetail | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [mapPoints, setMapPoints] = useState<Coordinate[]>([]);
  const [mapZone, setMapZone] = useState<number | undefined>(undefined);
  const [procedureEtapes, setProcedureEtapes] = useState<ProcedureEtapeItem[]>([]);
  const mapRef = useRef<ArcGISMapRef | null>(null);
  const loadedIdRef = useRef<number | null>(null);

  const [motifModalOpen, setMotifModalOpen] = useState<boolean>(false);
  const [motifAction, setMotifAction] = useState<StatusAction>('REJETEE');
  const [motifText, setMotifText] = useState<string>('');
  const messagesSectionRef = useRef<HTMLElement | null>(null);

  const isAdmin =
    hasPermission('Admin-Panel') ||
    String(auth?.role ?? '')
      .toLowerCase()
      .includes('admin');

  const codeDemande = useMemo(() => {
    if (!demande) return hasValidId ? `DEM-${Number(demandeId)}` : '--';
    return demande.code_demande || `DEM-${demande.id_demande}`;
  }, [demande, demandeId, hasValidId]);
  const demandeurUserId = useMemo(() => {
    const candidate = Number(demande?.utilisateurId || demande?.utilisateur?.id || 0);
    if (!Number.isFinite(candidate) || candidate <= 0) return null;
    return Math.trunc(candidate);
  }, [demande?.utilisateur?.id, demande?.utilisateurId]);

  const shouldJumpToMessages = useMemo(() => {
    const tabRaw = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab;
    const focusComposerRaw = Array.isArray(router.query.focusComposer)
      ? router.query.focusComposer[0]
      : router.query.focusComposer;
    const focusMessageRaw = Array.isArray(router.query.focusMessageId)
      ? router.query.focusMessageId[0]
      : router.query.focusMessageId;
    const tab = String(tabRaw || '').trim().toLowerCase();
    return (
      tab === 'messages' ||
      isTruthyQueryFlag(focusComposerRaw ? String(focusComposerRaw) : '') ||
      Number(focusMessageRaw || 0) > 0
    );
  }, [router.query.focusComposer, router.query.focusMessageId, router.query.tab]);

  const timelineRows = useMemo(() => {
    const rows: Array<{ title: string; date: string; state: 'done' | 'active' | 'pending' }> = [];
    if (!demande) return rows;

    if (demande.date_demande) rows.push({ title: 'Depot de la demande', date: demande.date_demande, state: 'done' });
    const inlineEtapes = normalizeProcedureEtapes(
      (demande as any)?.procedure?.ProcedureEtape ??
        (demande as any)?.procedure?.procedureEtapes ??
        (demande as any)?.ProcedureEtape ??
        [],
    );
    const etapesSource = procedureEtapes.length > 0 ? procedureEtapes : inlineEtapes;
    const etapes = Array.isArray(etapesSource)
      ? [...etapesSource].sort(
          (a, b) => Number(a.etape?.ordre_etape || 0) - Number(b.etape?.ordre_etape || 0),
        )
      : [];
    etapes.forEach((step) => {
      const raw = String(step.statut || '').toUpperCase();
      const state = raw.includes('TERM') ? 'done' : raw.includes('COURS') ? 'active' : 'pending';
      rows.push({
        title: step.etape?.nom_etape || step.etape?.lib_etape || 'Etape',
        date: step.date_fin || step.date_debut || '',
        state,
      });
    });
    if (demande.date_instruction) rows.push({ title: 'Instruction', date: demande.date_instruction, state: 'done' });
    if (demande.date_refus) rows.push({ title: 'Rejet', date: demande.date_refus, state: 'done' });
    if (demande.date_fin_instruction) {
      rows.push({ title: 'Fin instruction', date: demande.date_fin_instruction, state: 'done' });
    }
    if (rows.length === 0 && demande.statut_demande) {
      rows.push({ title: `Statut actuel: ${demande.statut_demande}`, date: '', state: 'active' });
    }
    return rows;
  }, [demande, procedureEtapes]);

  const fetchDetails = useCallback(async () => {
    if (!apiURL || !hasValidId) return;
    setLoading(true);
    setError(null);
    try {
      const detailRes = await axios.get<DemandeDetail>(`${apiURL}/demandes_dashboard/${Number(demandeId)}`, {
        withCredentials: true,
      });
      const payload = detailRes.data ?? null;
      setDemande(payload);
      const procedureId = toFiniteNumber((payload as any)?.procedure?.id_proc ?? (payload as any)?.id_proc);

      const [docsRes, provRes, coordsRes] = await Promise.all([
        axios.get(`${apiURL}/api/procedure/${Number(demandeId)}/documents`, { withCredentials: true }).catch(() => null),
        procedureId
          ? axios.get(`${apiURL}/inscription-provisoire/procedure/${procedureId}`, {
              withCredentials: true,
            }).catch(() => null)
          : Promise.resolve(null),
        procedureId
          ? axios.get(`${apiURL}/coordinates/procedure/${procedureId}`, {
              withCredentials: true,
            }).catch(() => null)
          : Promise.resolve(null),
      ]);

      const docsPayload = Array.isArray((docsRes as any)?.data?.documents) ? (docsRes as any).data.documents : [];
      const dossierDate = (docsRes as any)?.data?.dossierFournis?.date_depot ?? null;
      const mappedDocs = docsPayload.map((doc: any) => ({
        nom: String(doc?.nom_doc || 'Document'),
        statut: String(doc?.statut || 'EN_ATTENTE'),
        date: dossierDate,
        size: doc?.taille_doc ? String(doc.taille_doc) : null,
        fileUrl: doc?.file_url || null,
      }));
      setDocuments(mappedDocs);

      const detailEtapes = normalizeProcedureEtapes(
        (payload as any)?.procedure?.ProcedureEtape ??
          (payload as any)?.procedure?.procedureEtapes ??
          (payload as any)?.ProcedureEtape,
      );
      if (detailEtapes.length > 0) {
        setProcedureEtapes(detailEtapes);
      } else if (procedureId) {
        const etapesRes = await axios
          .get(`${apiURL}/api/procedure-etape/procedure/${procedureId}`, {
            withCredentials: true,
          })
          .catch(() => null);
        const etapesPayload = (etapesRes as any)?.data;
        const fallbackEtapes = normalizeProcedureEtapes(
          etapesPayload?.ProcedureEtape ?? etapesPayload?.procedureEtapes ?? etapesPayload?.etapes ?? [],
        );
        setProcedureEtapes(fallbackEtapes);
      } else {
        setProcedureEtapes([]);
      }

      const provisionalPoints = Array.isArray((provRes as any)?.data?.points)
        ? (provRes as any).data.points
        : [];
      const coordsPayload = Array.isArray((coordsRes as any)?.data) ? (coordsRes as any).data : [];
      const pointsSource = coordsPayload.length > 0 ? coordsPayload : provisionalPoints;
      const pointsSourceName =
        coordsPayload.length > 0 ? 'coordinates/procedure' : 'inscription_provisoire.points';
      const mappedPoints = pointsSource
        .map((item: any, index: number) => {
          const coord = item?.coordonnee ?? item;
          const x = Number(coord?.x);
          const y = Number(coord?.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
          const zoneRaw = coord?.zone;
          const zone = zoneRaw != null ? Number(zoneRaw) : undefined;
          const hemisphere: 'N' = 'N';
          const system = (coord?.system as Coordinate['system']) || 'UTM';
          return {
            id: coord?.id_coordonnees ?? coord?.id ?? index + 1,
            idTitre: coord?.idTitre ?? 1007,
            h: coord?.h ?? 0,
            x,
            y,
            system,
            zone,
            hemisphere,
          } as Coordinate;
        })
        .filter(Boolean) as Coordinate[];

      const zoneValues = Array.from(
        new Set(
          mappedPoints
            .map((point: any) => point?.zone)
            .filter((zone: any) => Number.isFinite(zone))
            .map((zone: number) => Number(zone)),
        ),
      );
      const hemisphereValues = Array.from(
        new Set(
          mappedPoints
            .map((point: any) => point?.hemisphere)
            .filter((hemisphere: any) => typeof hemisphere === 'string' && hemisphere.length > 0),
        ),
      );
      const systemValues = Array.from(
        new Set(
          mappedPoints
            .map((point: any) => point?.system)
            .filter((system: any) => typeof system === 'string' && system.length > 0),
        ),
      );
      const uniqueCoordinatesCount = new Set(
        mappedPoints.map((point: any) => `${Number(point?.x).toFixed(6)}|${Number(point?.y).toFixed(6)}`),
      ).size;
      const bbox = computeBbox(mappedPoints as Array<{ x: number; y: number }>);
      const diagnosticId = (payload as any)?.code_demande || `id_demande=${Number(demandeId)}`;
      console.groupCollapsed(`[AdminDemandeMap] Diagnostics ${diagnosticId}`);
      console.log('source', {
        sourceType: pointsSourceName,
        rawSourcePoints: pointsSource.length,
        provisionalPoints: provisionalPoints.length,
        coordinatesPoints: coordsPayload.length,
      });
      console.log('mapped', {
        mappedPoints: mappedPoints.length,
        filteredOut: Math.max(0, pointsSource.length - mappedPoints.length),
        uniqueCoordinatesCount,
        systems: systemValues,
        zones: zoneValues,
        hemispheres: hemisphereValues,
        bbox,
      });
      if (mappedPoints.length < 3) {
        console.warn(
          `[AdminDemandeMap] Polygon will not render: only ${mappedPoints.length} usable points (needs >= 3).`,
        );
      } else if (uniqueCoordinatesCount < 3) {
        console.warn(
          `[AdminDemandeMap] Polygon may fail: only ${uniqueCoordinatesCount} unique coordinate pairs.`,
        );
      }
      console.groupEnd();

      setMapPoints(mappedPoints);
      setMapZone(mappedPoints.find((point: any) => Number.isFinite(point?.zone))?.zone);
    } catch (err) {
      console.error('Erreur chargement detail demande admin', err);
      loadedIdRef.current = null;
      setError('Impossible de charger la fiche detaillee de la demande.');
      setDemande(null);
      setDocuments([]);
      setProcedureEtapes([]);
      setMapPoints([]);
      setMapZone(undefined);
    } finally {
      setLoading(false);
    }
  }, [apiURL, demandeId, hasValidId]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isAdmin) {
      router.replace('/unauthorized/page?reason=missing_permissions');
      return;
    }
    if (!router.isReady) return;
    if (!hasValidId) {
      loadedIdRef.current = null;
      setLoading(false);
      setError('Identifiant de demande invalide.');
      return;
    }
    if (loadedIdRef.current === Number(demandeId)) return;
    loadedIdRef.current = Number(demandeId);
    fetchDetails();
  }, [demandeId, fetchDetails, hasValidId, isAdmin, isLoaded, router, router.isReady]);

  useEffect(() => {
    if (!success) return;
    const timeoutId = window.setTimeout(() => setSuccess(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [success]);

  useEffect(() => {
    if (mapPoints.length < 3) return;
    const timeoutId = window.setTimeout(() => {
      mapRef.current?.zoomToCurrentPolygon?.();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [mapPoints]);

  useEffect(() => {
    if (!router.isReady || loading || !shouldJumpToMessages) return;
    if (!messagesSectionRef.current) return;
    const timeoutId = window.setTimeout(() => {
      messagesSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 140);
    return () => window.clearTimeout(timeoutId);
  }, [loading, router.isReady, shouldJumpToMessages]);

  const runStatusAction = async (action: StatusAction, motif?: string) => {
    if (!apiURL || !hasValidId) return;
    try {
      setSubmitting(true);
      setError(null);
      await axios.put(
        `${apiURL}/api/demande/${Number(demandeId)}/status`,
        {
          statut_demande: action,
          rejectionReason: motif,
        },
        { withCredentials: true },
      );
      setSuccess(
        action === 'ACCEPTEE'
          ? 'Demande validee avec succes.'
          : action === 'REJETEE'
          ? 'Demande rejetee avec succes.'
          : 'Demande marquee en complement.',
      );
      await fetchDetails();
    } catch (err) {
      console.error('Erreur action statut (detail admin)', err);
      setError("Echec de l'operation de changement de statut.");
    } finally {
      setSubmitting(false);
    }
  };

  const openMotifModal = (action: StatusAction) => {
    setMotifAction(action);
    setMotifText('');
    setMotifModalOpen(true);
  };

  const confirmMotifAction = async () => {
    if (!motifText.trim()) {
      setError('Le motif est obligatoire pour cette action.');
      return;
    }
    await runStatusAction(motifAction, motifText.trim());
    setMotifModalOpen(false);
  };

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
          <section className={styles.hero}>
            <div className={styles.heroTop}>
              <Button variant="outline" className={styles.backBtn} onClick={() => router.push('/admin_panel/gestion-demandes')}>
                <FiArrowLeft /> Retour a la liste
              </Button>
              <div className={styles.heroActions}>
                <Button className={styles.validateBtn} disabled={submitting || loading} onClick={() => runStatusAction('ACCEPTEE')}>
                  <FiCheck /> Valider
                </Button>
                <Button className={styles.rejectBtn} disabled={submitting || loading} onClick={() => openMotifModal('REJETEE')}>
                  <FiX /> Rejeter
                </Button>
                <Button className={styles.complementBtn} disabled={submitting || loading} onClick={() => openMotifModal('EN_COMPLEMENT')}>
                  <FiAlertCircle /> Demander pieces
                </Button>
              </div>
            </div>
            <h1>{codeDemande}</h1>
            <p>
              {demande?.typePermis?.lib_type || demande?.typePermis?.code_type || '--'} •{' '}
              {demande?.typeProcedure?.libelle || '--'}
            </p>
            <div className={styles.heroMeta}>
              <Badge className={styles.metaBadge}>Statut: {demande?.statut_demande || '--'}</Badge>
              <Badge className={styles.metaBadge}>Depot: {formatDate(demande?.date_demande)}</Badge>
              <Badge className={styles.metaBadge}>Titulaire: {getTitulaire(demande)}</Badge>
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

          <section className={styles.cardsGrid}>
            <article className={styles.card}>
              <h3>Informations generales</h3>
              <div className={styles.infoGrid}>
                <div><strong>Code</strong><span>{codeDemande}</span></div>
                <div><strong>Type procedure</strong><span>{demande?.typeProcedure?.libelle || '--'}</span></div>
                <div><strong>Type permis</strong><span>{demande?.typePermis?.lib_type || '--'}</span></div>
                <div><strong>Montant</strong><span>{formatMoney(getMontantValue(demande))}</span></div>
                <div><strong>Date depot</strong><span>{formatDate(demande?.date_demande)}</span></div>
                <div><strong>Responsable</strong><span>{getResponsable(demande)}</span></div>
              </div>
            </article>

            <article className={styles.card}>
              <h3>Titulaire et localisation</h3>
              <div className={styles.infoGrid}>
                <div><strong>Titulaire</strong><span>{getTitulaire(demande)}</span></div>
                <div><strong>Email</strong><span>{demande?.utilisateur?.email || '--'}</span></div>
                <div><strong>Wilaya</strong><span>{demande?.wilaya?.nom_wilayaFR || '--'}</span></div>
                <div><strong>Daira</strong><span>{demande?.daira?.nom_dairaFR || '--'}</span></div>
                <div><strong>Commune</strong><span>{demande?.commune?.nom_communeFR || '--'}</span></div>
                <div><strong>Lieu-dit</strong><span>{demande?.lieu_ditFR || '--'}</span></div>
              </div>
            </article>
          </section>

          <section className={styles.card}>
            <div className={styles.sectionHeader}>
              <h3><FiMapPin /> Carte ArcGIS du perimetre</h3>
              <span>{mapPoints.length} points</span>
            </div>
            <div className={styles.mapWrap}>
              {mapPoints.length >= 3 ? (
                <div className={styles.mapCanvas}>
                  <ArcGISMap
                    ref={mapRef as any}
                    points={mapPoints}
                    superficie={Number(demande?.superficie || 0)}
                    isDrawing={false}
                    coordinateSystem="UTM"
                    utmZone={mapZone}
                    utmHemisphere="N"
                    editable={false}
                    disableEnterpriseLayers
                  />
                  <div className={styles.simpleLegend}>
                    <span className={styles.legendSwatch} />
                    <span>Perimetre de la demande</span>
                  </div>
                </div>
              ) : (
                <div className={styles.mapPlaceholder}>
                  <FiMapPin />
                  <p>Aucune geometrie disponible pour cette demande.</p>
                </div>
              )}
            </div>
            <PerimeterCoordinatesTable
              points={mapPoints}
              emptyMessage="Aucun perimetre defini pour cette demande."
              className={styles.coordinatesBlock}
            />
          </section>

          <section className={styles.splitGrid}>
            <article className={styles.card}>
              <h3><FiClock /> Timeline / Historique</h3>
              {loading ? (
                <p className={styles.muted}>Chargement...</p>
              ) : timelineRows.length === 0 ? (
                <p className={styles.muted}>Aucun historique disponible.</p>
              ) : (
                <div className={styles.timeline}>
                  {timelineRows.map((row, idx) => (
                    <div key={`${row.title}-${idx}`} className={styles.timelineRow}>
                      <span className={`${styles.dot} ${styles[row.state]}`} />
                      <div>
                        <p>{row.title}</p>
                        <small>{formatDate(row.date)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className={styles.card}>
              <h3><FiFileText /> Documents</h3>
              {documents.length === 0 ? (
                <p className={styles.muted}>Aucun document recupere.</p>
              ) : (
                <div className={styles.docsList}>
                  {documents.map((doc, idx) => {
                    const fileUrl = doc.fileUrl
                      ? doc.fileUrl.startsWith('http')
                        ? doc.fileUrl
                        : `${apiURL}${doc.fileUrl}`
                      : null;
                    return (
                      <div key={`${doc.nom}-${idx}`} className={styles.docRow}>
                        <div>
                          <p>{doc.nom}</p>
                          <small>{doc.size || '--'} • {formatDate(doc.date)}</small>
                        </div>
                        <div className={styles.docActions}>
                          <Badge className={styles.docStatus}>{doc.statut}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fileUrl && window.open(fileUrl, '_blank')}
                            disabled={!fileUrl}
                          >
                            <FiDownload /> Ouvrir
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          </section>

          <section className={styles.card}>
            <h3>Paiements</h3>
            {demande?.facture?.paiements?.length ? (
              <div className={styles.paymentList}>
                {demande.facture.paiements.map((pay, idx) => (
                  <div key={`${pay.id || idx}`} className={styles.paymentRow}>
                    <span>Paiement #{idx + 1}</span>
                    <span>{formatMoney(pay.montant_paye)}</span>
                    <span>{pay.etat_paiement || '--'}</span>
                    <span>{formatDate(pay.date_paiement)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.muted}>Aucun paiement enregistre.</p>
            )}
          </section>

          <section className={styles.card} id="messages-section" ref={messagesSectionRef}>
            <div className={styles.sectionHeader}>
              <h3><FiMessageSquare /> Commentaires / Messages</h3>
              <span>Thread demande</span>
            </div>
            <EntityMessagesPanel
              entityType="demande"
              entityCode={codeDemande}
              autoFocusComposer={shouldJumpToMessages}
              defaultRecipientId={demandeurUserId}
              lockRecipient
            />
          </section>

          {motifModalOpen && (
            <div className={styles.modalOverlay}>
              <div className={styles.modalCard}>
                <h3>
                  {motifAction === 'REJETEE'
                    ? 'Motif de rejet'
                    : 'Motif de demande de pieces complementaires'}
                </h3>
                <p>Ce motif sera enregistre dans la decision admin.</p>
                <textarea
                  rows={6}
                  value={motifText}
                  onChange={(e) => setMotifText(e.target.value)}
                  placeholder="Saisissez le motif..."
                />
                <div className={styles.modalActions}>
                  <Button variant="outline" onClick={() => setMotifModalOpen(false)} disabled={submitting}>
                    Annuler
                  </Button>
                  <Button onClick={confirmMotifAction} disabled={submitting}>
                    {submitting ? 'Envoi...' : 'Confirmer'}
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
