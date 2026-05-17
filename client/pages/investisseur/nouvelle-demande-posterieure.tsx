import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  ChevronRight,
  Edit3,
  FileCheck,
  GitMerge,
  HandCoins,
  Lock,
  Loader2,
  LogOut,
  Map as MapIcon,
  QrCode,
  Repeat,
  Scissors,
  Search,
  Trash2,
} from 'lucide-react';
import Navbar from '../navbar/Navbar';
import Sidebar from '../sidebar/Sidebar';
import { useViewNavigator } from '../../src/hooks/useViewNavigator';
import { useAuthStore } from '../../src/store/useAuthStore';
import styles from './nouvelle-demande-posterieure.module.css';

type PermitSummary = {
  id: number;
  short_code?: string | null;
  code_permis?: string | null;
  qr_code?: string | null;
  type_permis?: {
    id: number;
    lib_type?: string | null;
    code_type?: string | null;
  } | null;
  statut?: {
    lib_statut?: string | null;
  } | null;
};

type VerifyStatus = 'idle' | 'checking' | 'valid' | 'not_found' | 'error';

interface ActionRapide {
  id: string;
  label: string;
  icon: ElementType;
  description: string;
  available: boolean;
}

interface FusionCandidate {
  id: number;
  code_permis: string;
  type_label: string;
  titulaire: string;
}

interface TypeProcedureSummary {
  id: number;
  libelle: string;
  code?: string | null;
  description?: string | null;
}

const normalizeCodeQr = (value: string): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    const fromQuery =
      parsed.searchParams.get('codeqr') ||
      parsed.searchParams.get('code_permis') ||
      parsed.searchParams.get('code');
    if (fromQuery) return String(fromQuery).trim();
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop() || '';
    return String(lastSegment || raw).trim();
  } catch {
    return raw;
  }
};

const deriveStatut = (permis: any) => {
  const exp = permis?.date_expiration ? new Date(permis.date_expiration) : null;
  if (exp && !isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
    return 'EXPIRE';
  }
  const lib = String(permis?.statut?.lib_statut ?? '').toLowerCase();
  if (lib.includes('suspend')) return 'SUSPENDU';
  if (lib.includes('renouvel')) return 'EN_RENOUVELLEMENT';
  return 'ACTIF';
};

const normalizeSearchValue = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const resolveActionIdFromTypeProcedure = (
  libelle?: string | null,
  code?: string | null,
): string | null => {
  const lower = `${normalizeSearchValue(libelle || '')} ${normalizeSearchValue(code || '')}`;
  if (!lower) return null;
  if (lower.includes('option')) return 'option';
  if (lower.includes('renouv')) return 'renouvellement';
  if (lower.includes('extension') || lower.includes('modif')) return 'extension';
  if (lower.includes('fusion')) return 'fusion';
  if (lower.includes('division')) return 'division';
  if (lower.includes('transfert') || lower.includes('transfer') || lower.includes('transf')) {
    return 'transfert';
  }
  if (lower.includes('cession') || lower.includes('ces')) return 'cession';
  if (lower.includes('renonc')) return 'renonciation';
  if (lower.includes('retrait') || lower.includes('annulation') || lower.includes('annul')) {
    return 'retrait';
  }
  if (lower.includes('regular')) return 'regularisation';
  return null;
};

const actionsRapides: ActionRapide[] = [
  {
    id: 'option',
    label: 'Option-2025',
    icon: ChevronRight,
    description: 'Demander une option sur le perimetre',
    available: true,
  },
  {
    id: 'renouvellement',
    label: 'Renouvellement',
    icon: Repeat,
    description: 'Renouveler le permis avant expiration',
    available: true,
  },
  {
    id: 'extension',
    label: 'Extension',
    icon: MapIcon,
    description: 'Demander une extension du permis',
    available: true,
  },
  {
    id: 'modification',
    label: 'Modification',
    icon: Edit3,
    description: 'Modifier les caracteristiques du permis',
    available: true,
  },
  {
    id: 'fusion',
    label: 'Fusion',
    icon: GitMerge,
    description: 'Fusionner avec un autre permis',
    available: true,
  },
  {
    id: 'division',
    label: 'Division',
    icon: Scissors,
    description: 'Diviser le perimetre en plusieurs permis',
    available: true,
  },
  {
    id: 'transfert',
    label: 'Transfert',
    icon: ArrowRightLeft,
    description: 'Transferer le permis a un tiers',
    available: true,
  },
  {
    id: 'cession',
    label: 'Cession',
    icon: HandCoins,
    description: 'Ceder les droits du permis',
    available: true,
  },
  {
    id: 'renonciation',
    label: 'Renonciation',
    icon: LogOut,
    description: 'Renoncer au permis',
    available: true,
  },
  {
    id: 'retrait',
    label: 'Retrait',
    icon: Trash2,
    description: 'Demander le retrait du permis',
    available: false,
  },
  {
    id: 'regularisation',
    label: 'Regularisation',
    icon: FileCheck,
    description: 'Regulariser une situation',
    available: true,
  },
];

export default function NouvelleDemandePosterieurPage() {
  const navigate = useNavigate();
  const { currentView, navigateTo } = useViewNavigator('nouvelle-demande');
  const { auth } = useAuthStore();
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

  const [qrInput, setQrInput] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle');
  const [message, setMessage] = useState('');
  const [permit, setPermit] = useState<PermitSummary | null>(null);
  const [permitDetails, setPermitDetails] = useState<any | null>(null);
  const [typeProceduresForPermit, setTypeProceduresForPermit] = useState<TypeProcedureSummary[]>(
    [],
  );
  const [isLoadingTypeProcedures, setIsLoadingTypeProcedures] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);

  const [fusionModalOpen, setFusionModalOpen] = useState(false);
  const [fusionLoadingCandidates, setFusionLoadingCandidates] = useState(false);
  const [fusionCandidates, setFusionCandidates] = useState<FusionCandidate[]>([]);
  const [fusionSearch, setFusionSearch] = useState('');
  const [selectedFusionPermisId, setSelectedFusionPermisId] = useState<number | null>(null);
  const [fusionPrincipalId, setFusionPrincipalId] = useState<number | null>(null);
  const [fusionMotif, setFusionMotif] = useState('');
  const [fusionEligibility, setFusionEligibility] = useState<{
    ok: boolean;
    message: string;
    sharedBoundary: number;
    areaHa: number;
  } | null>(null);
  const [fusionChecking, setFusionChecking] = useState(false);
  const [fusionSubmitting, setFusionSubmitting] = useState(false);
  const [fusionExistingProcedureId, setFusionExistingProcedureId] = useState<number | null>(null);

  const selectedPermitId = Number(permitDetails?.id ?? permit?.id ?? NaN);
  const statutValue = permitDetails ? deriveStatut(permitDetails) : 'ACTIF';
  const rawStatut = String(permitDetails?.statut?.lib_statut ?? '').toLowerCase();

  const extensionEligible =
    Number.isFinite(selectedPermitId) &&
    statutValue !== 'EXPIRE' &&
    statutValue !== 'EN_RENOUVELLEMENT' &&
    !rawStatut.includes('annul') &&
    !rawStatut.includes('revoq') &&
    !rawStatut.includes('retir');
  const fusionEligible = extensionEligible;

  const fetchTypeProceduresForPermit = useCallback(
    async (typePermisId: number) => {
      if (!apiBase || !Number.isFinite(typePermisId)) {
        setTypeProceduresForPermit([]);
        return;
      }

      setIsLoadingTypeProcedures(true);
      try {
        const res = await fetch(`${apiBase}/phases-etapes/combinaisons`, {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error('Failed to load type procedures');
        }
        const data = await res.json();
        const combos = Array.isArray(data) ? data : (data?.data ?? []);
        const matched = combos.filter((combo: any) => Number(combo?.id_typePermis) === typePermisId);

        const uniqueMap = new Map<number, TypeProcedureSummary>();
        matched.forEach((combo: any) => {
          const tp = combo?.typeProc || combo?.typeProcedure;
          const tpId = Number(tp?.id);
          if (!Number.isFinite(tpId) || uniqueMap.has(tpId)) return;
          uniqueMap.set(tpId, {
            id: tpId,
            libelle: String(tp?.libelle || tp?.code || 'Type de procedure'),
            code: tp?.code ?? null,
            description: tp?.description ?? null,
          });
        });

        setTypeProceduresForPermit(Array.from(uniqueMap.values()));
      } catch (error) {
        console.error('Erreur chargement actions dynamiques', error);
        setTypeProceduresForPermit([]);
      } finally {
        setIsLoadingTypeProcedures(false);
      }
    },
    [apiBase],
  );

  useEffect(() => {
    const typePermisId = Number(permitDetails?.type_permis?.id ?? permitDetails?.typePermis?.id ?? NaN);
    if (!Number.isFinite(typePermisId)) {
      setTypeProceduresForPermit([]);
      return;
    }
    void fetchTypeProceduresForPermit(typePermisId);
  }, [fetchTypeProceduresForPermit, permitDetails?.type_permis?.id, permitDetails?.typePermis?.id]);

  const baseActionItems = useMemo(() => {
    if (typeProceduresForPermit.length === 0) return actionsRapides;

    const mappedById = new Map<string, ActionRapide>();
    typeProceduresForPermit.forEach((tp) => {
      const actionId = resolveActionIdFromTypeProcedure(tp.libelle, tp.code);
      if (!actionId || mappedById.has(actionId)) return;
      const template = actionsRapides.find((action) => action.id === actionId);
      if (!template) return;
      mappedById.set(actionId, {
        ...template,
        description: tp.description || template.description,
      });
    });

    const mapped = Array.from(mappedById.values());
    return mapped.length > 0 ? mapped : actionsRapides;
  }, [typeProceduresForPermit]);

  const actionItems = useMemo(
    () =>
      baseActionItems.map((action) => {
        if (action.id === 'extension') return { ...action, available: extensionEligible };
        if (action.id === 'fusion') return { ...action, available: fusionEligible };
        return action;
      }),
    [baseActionItems, extensionEligible, fusionEligible],
  );

  const filteredFusionCandidates = useMemo(() => {
    const q = fusionSearch.trim().toLowerCase();
    if (!q) return fusionCandidates;
    return fusionCandidates.filter((candidate) => {
      return (
        candidate.code_permis.toLowerCase().includes(q) ||
        candidate.type_label.toLowerCase().includes(q) ||
        candidate.titulaire.toLowerCase().includes(q)
      );
    });
  }, [fusionCandidates, fusionSearch]);

  const handleVerifyPermit = async () => {
    if (!apiBase) {
      toast.error('Configuration API manquante.');
      return;
    }

    const normalized = normalizeCodeQr(qrInput);
    if (!normalized) {
      setVerifyStatus('error');
      setMessage('Veuillez saisir un code QR.');
      setPermit(null);
      setPermitDetails(null);
      return;
    }

    setVerifyStatus('checking');
    setMessage('');
    setPermit(null);
    setPermitDetails(null);
    setExtensionModalOpen(false);
    setFusionModalOpen(false);

    try {
      const permitResponse = await axios.get(`${apiBase}/operator/access`, {
        params: { codeqr: normalized },
        withCredentials: true,
      });
      const permitData = (permitResponse.data as any)?.permit as PermitSummary | undefined;
      const permitId = Number(permitData?.id);

      if (!Number.isFinite(permitId) || permitId <= 0) {
        setVerifyStatus('error');
        setMessage('Permis trouve, mais identifiant invalide.');
        return;
      }

      setPermit(permitData ?? null);
      setPermitDetails(permitData ?? null);
      setVerifyStatus('valid');
      setMessage('Permis trouve. Choisissez une action rapide.');
    } catch (error: any) {
      const status = Number(error?.response?.status);
      const backendMessage = String(error?.response?.data?.message || '').toLowerCase();
      const isNotFound =
        status === 404 ||
        backendMessage.includes('aucun permis') ||
        backendMessage.includes('introuvable') ||
        backendMessage.includes("n'existe pas");

      setVerifyStatus(isNotFound ? 'not_found' : 'error');
      setMessage(isNotFound ? "Ce permis n'existe pas." : 'Erreur de verification. Reessayez.');
      setPermit(null);
      setPermitDetails(null);
    }
  };

  const startProcedureFlow = async (
    actionId: 'renouvellement' | 'extension' | 'extension_substance',
  ) => {
    if (!apiBase) {
      toast.error('API URL manquante.');
      return;
    }
    if (!Number.isFinite(selectedPermitId)) {
      toast.error('Permis invalide pour demarrer la procedure.');
      return;
    }

    setActionLoading(true);
    try {
      const startPath =
        actionId === 'extension'
          ? `${apiBase}/api/procedures/extension/start`
          : actionId === 'extension_substance'
            ? `${apiBase}/api/procedures/extension-substance/start`
            : `${apiBase}/api/procedures/renouvellement/start`;
      const nextPath =
        actionId === 'extension'
          ? `/operateur/extention/step1/page1?id=`
          : actionId === 'extension_substance'
            ? `/operateur/extention_substance/step1/page1?id=`
            : `/operateur/renouvellement/step1/page1?id=`;

      const res = await axios.post(
        startPath,
        {
          permisId: selectedPermitId,
          date_demande: new Date().toISOString(),
          utilisateurId: auth?.id,
        },
        { withCredentials: true },
      );

      const newProcId = res?.data?.new_proc_id;
      if (!newProcId) {
        toast.error('Impossible de demarrer la procedure.');
        return;
      }

      navigate(`${nextPath}${newProcId}&permisId=${selectedPermitId}`);
    } catch (err: any) {
      console.error('Erreur demarrage procedure', err);
      const msg = err?.response?.data?.message || 'Erreur lors du demarrage de la procedure.';
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const openFusionModal = async () => {
    if (!apiBase) {
      toast.error('API URL manquante.');
      return;
    }
    if (!Number.isFinite(selectedPermitId)) {
      toast.error('Permis invalide.');
      return;
    }

    setFusionModalOpen(true);
    setFusionSearch('');
    setFusionCandidates([]);
    setSelectedFusionPermisId(null);
    setFusionPrincipalId(selectedPermitId);
    setFusionMotif('');
    setFusionEligibility(null);
    setFusionExistingProcedureId(null);

    setFusionLoadingCandidates(true);
    try {
      const res = await axios.get(`${apiBase}/operateur/permis`, {
        withCredentials: true,
      });
      const raw = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      const currentDetenteurId =
        Number(permitDetails?.id_detenteur ?? permitDetails?.detenteur?.id_detenteur) || null;

      const mapped: FusionCandidate[] = raw
        .filter((p: any) => Number(p?.id) !== selectedPermitId)
        .filter((p: any) => {
          if (!currentDetenteurId) return true;
          const detenteurId = Number(p?.id_detenteur ?? p?.detenteur?.id_detenteur);
          return Number.isFinite(detenteurId) && detenteurId === currentDetenteurId;
        })
        .map((p: any) => ({
          id: Number(p.id),
          code_permis: String(p.code_permis ?? p.code ?? `PERMIS-${p.id}`),
          type_label: String(
            p?.typePermis?.lib_type ?? p?.typePermis?.code_type ?? p?.type ?? '--',
          ),
          titulaire: String(p?.detenteur?.nom_societeFR ?? p?.detenteur?.nom_societeAR ?? '--'),
        }));

      setFusionCandidates(mapped);
      if (mapped.length > 0) {
        setSelectedFusionPermisId(mapped[0].id);
      } else {
        setFusionEligibility({
          ok: false,
          message: 'Aucun permis eligible trouve pour la fusion (meme detenteur).',
          sharedBoundary: 0,
          areaHa: 0,
        });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Impossible de charger les permis du detenteur.';
      setFusionEligibility({
        ok: false,
        message: String(msg),
        sharedBoundary: 0,
        areaHa: 0,
      });
    } finally {
      setFusionLoadingCandidates(false);
    }
  };

  const checkFusionEligibility = async (candidatePermisId: number) => {
    if (!apiBase || !Number.isFinite(selectedPermitId) || !Number.isFinite(candidatePermisId)) {
      return;
    }

    setFusionChecking(true);
    setFusionEligibility(null);
    setFusionExistingProcedureId(null);
    try {
      const existing = await axios.get(`${apiBase}/api/fusion-permis/check`, {
        withCredentials: true,
        params: {
          id_principal: selectedPermitId,
          id_secondaire: candidatePermisId,
        },
      });

      if (existing?.data?.exists) {
        setFusionExistingProcedureId(Number(existing.data.id_procedure || 0) || null);
        setFusionEligibility({
          ok: false,
          message:
            "Une fusion en cours existe deja pour au moins un de ces permis. Veuillez la terminer d'abord.",
          sharedBoundary: 0,
          areaHa: 0,
        });
        return;
      }

      const res = await axios.post(
        `${apiBase}/api/fusion-permis/union`,
        {
          id_permis_A: selectedPermitId,
          id_permis_B: candidatePermisId,
        },
        { withCredentials: true },
      );
      const data = res?.data || {};
      setFusionEligibility({
        ok: !!data?.success,
        message: String(
          data?.message ||
            (data?.success
              ? 'Fusion possible : frontiere commune valide.'
              : 'Fusion impossible pour ces deux permis.'),
        ),
        sharedBoundary: Number(data?.shared_boundary_m || 0),
        areaHa: Number(data?.area_ha || 0),
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        'Erreur lors de la verification de la contiguite (100 m).';
      setFusionEligibility({
        ok: false,
        message: String(msg),
        sharedBoundary: 0,
        areaHa: 0,
      });
    } finally {
      setFusionChecking(false);
    }
  };

  const handleStartFusion = async () => {
    if (!apiBase || !Number.isFinite(selectedPermitId)) {
      toast.error('Parametres de fusion invalides.');
      return;
    }
    if (!Number.isFinite(Number(selectedFusionPermisId))) {
      toast.error('Veuillez selectionner un permis pour la fusion.');
      return;
    }
    if (!fusionEligibility?.ok) {
      toast.warning('Fusion non eligible. Verifiez la frontiere commune.');
      return;
    }

    const principal = Number(fusionPrincipalId || selectedPermitId);
    const secondary =
      principal === selectedPermitId ? Number(selectedFusionPermisId) : selectedPermitId;

    setFusionSubmitting(true);
    try {
      const res = await axios.post(
        `${apiBase}/api/fusion-permis/fusionner`,
        {
          id_principal: principal,
          id_secondaire: secondary,
          motif_fusion: fusionMotif || '',
          utilisateurId: auth?.id,
        },
        { withCredentials: true },
      );

      const newProcId = Number(res?.data?.id_procedure);
      if (!Number.isFinite(newProcId) || newProcId <= 0) {
        throw new Error('Procedure de fusion introuvable apres creation.');
      }

      setFusionModalOpen(false);
      toast.success('Procedure de fusion creee.');
      navigate(
        `/operateur/fusion_permis/step1/page1?id=${newProcId}&permisA=${selectedPermitId}&permisB=${selectedFusionPermisId}&principal=${principal}`,
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Impossible de demarrer la procedure de fusion.';
      toast.error(String(msg));
    } finally {
      setFusionSubmitting(false);
    }
  };

  const handleActionClick = async (actionId: string) => {
    if (!Number.isFinite(selectedPermitId)) {
      toast.error('Permis invalide.');
      return;
    }

    if (actionId === 'extension') {
      setExtensionModalOpen(true);
      return;
    }

    if (actionId === 'fusion') {
      await openFusionModal();
      return;
    }

    if (actionId === 'transfert') {
      navigate(`/operateur/transfert/step1/page1?permisId=${selectedPermitId}`);
      return;
    }

    if (actionId === 'cession') {
      navigate(`/operateur/cession/step1/page1?permisId=${selectedPermitId}`);
      return;
    }

    if (actionId !== 'renouvellement') {
      navigate(`/operateur/procedure/${actionId}/${selectedPermitId}`);
      return;
    }

    await startProcedureFlow('renouvellement');
  };

  useEffect(() => {
    if (!fusionModalOpen || !selectedFusionPermisId) return;
    void checkFusionEligibility(selectedFusionPermisId);
  }, [fusionModalOpen, selectedFusionPermisId]);

  const busy = verifyStatus === 'checking' || actionLoading || fusionSubmitting;
  const statusLabel =
    verifyStatus === 'checking'
      ? 'Recherche...'
      : verifyStatus === 'valid'
        ? 'Trouve'
        : verifyStatus === 'not_found' || verifyStatus === 'error'
          ? 'Erreur'
          : 'En attente';

  const getActionTitle = (action: ActionRapide, available: boolean) => {
    if (action.id === 'extension' && !available) {
      return 'Extension non disponible pour ce statut';
    }
    if (action.id === 'fusion' && !available) {
      return 'Fusion non disponible pour ce statut';
    }
    return action.description;
  };

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.mainContent}>
          <div className={styles.wrapper}>
            <div className={styles.topActions}>
              <button
                type="button"
                className={styles.backButton}
                onClick={() => navigate('/investisseur/InvestorDashboard')}
              >
                <ArrowLeft className={styles.backIcon} />
                Retour Dashboard
              </button>
            </div>
            <div className={styles.headerRow}>
              <h1 className={styles.title}>Nouvelle Demande Posterieure</h1>
            </div>
            <p className={styles.subtitle}>
              Saisissez le code QR du permis, puis lancez l&apos;action rapide correspondante.
            </p>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>Entrer ou verifier un permis</h2>
                  <p className={styles.cardText}>
                    Saisissez le code QR ou le numero du permis pour charger les actions rapides disponibles.
                  </p>
                </div>
                <span
                  className={`${styles.statusPill} ${
                    styles[`status_${verifyStatus === 'not_found' ? 'error' : verifyStatus}`]
                  }`}
                >
                  {statusLabel}
                </span>
              </div>

              <div className={styles.grid}>
                <div className={styles.inputWrap}>
                  <QrCode className={styles.inputIcon} />
                  <input
                    className={styles.input}
                    value={qrInput}
                    onChange={(event) => setQrInput(event.target.value)}
                    placeholder="Ex: 8TQNF-6ZB5F-1G3D0-L9KX2-7F"
                    disabled={busy}
                  />
                </div>
                <button
                  type="button"
                  className={styles.verifyButton}
                  onClick={handleVerifyPermit}
                  disabled={busy}
                >
                  {verifyStatus === 'checking' ? (
                    <Loader2 className={styles.spin} />
                  ) : (
                    <Search className={styles.searchIcon} />
                  )}
                  {verifyStatus === 'checking' ? 'Verification...' : 'Verifier'}
                </button>
              </div>

              {message && (
                <p
                  className={`${styles.message} ${
                    verifyStatus === 'valid'
                      ? styles.info
                      : verifyStatus === 'error' || verifyStatus === 'not_found'
                        ? styles.error
                        : ''
                  }`}
                >
                  {(verifyStatus === 'error' || verifyStatus === 'not_found') && (
                    <AlertTriangle className={styles.messageIcon} />
                  )}
                  {message}
                </p>
              )}

              {permit && (
                <div className={styles.section}>
                  <ul className={styles.metaList}>
                    <li>
                      <strong>Code permis:</strong> {permit.code_permis || '-'}
                    </li>
                    <li>
                      <strong>Type permis:</strong> {permit.type_permis?.lib_type || '-'}
                    </li>
                  </ul>

                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Actions rapides</h2>
                    <p className={styles.sectionSubtitle}>
                      Selectionnez une action. La redirection suivra le meme flux que depuis la page detail permis.
                    </p>
                  </div>

                  {isLoadingTypeProcedures && (
                    <p className={styles.sectionSubtitle}>Chargement des actions dynamiques...</p>
                  )}

                  <div className={styles.actionsGrid}>
                    {actionItems.map((action) => {
                      const ActionIcon = action.icon;
                      const available = action.available;
                      return (
                        <button
                          key={action.id}
                          type="button"
                          className={`${styles.actionBtn} ${!available ? styles.actionDisabled : ''}`}
                          disabled={!available || busy}
                          onClick={() => available && void handleActionClick(action.id)}
                          title={getActionTitle(action, available)}
                        >
                          <div className={styles.actionIconWrapper}>
                            <ActionIcon className={styles.actionIcon} />
                          </div>
                          <span className={styles.actionLabel}>{action.label}</span>
                          <span className={styles.actionDescription}>{action.description}</span>
                          {!available && (
                            <span className={styles.actionRestricted}>
                              <Lock className={styles.actionRestrictedIcon} />
                              Acces restreint
                            </span>
                          )}
                          {available && <ChevronRight className={styles.actionArrow} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      {extensionModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setExtensionModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Choisir le type d&apos;extension</h3>
              <p className={styles.modalText}>
                Selectionnez le mode d&apos;extension a lancer pour ce permis.
              </p>
            </div>
            <div className={styles.modalOptions}>
              <button
                type="button"
                className={styles.modalOptionCard}
                onClick={async () => {
                  setExtensionModalOpen(false);
                  await startProcedureFlow('extension');
                }}
              >
                <div className={styles.modalOptionIcon}>
                  <MapIcon className={styles.actionIcon} />
                </div>
                <div className={styles.modalOptionBody}>
                  <h4>Extension du perimetre</h4>
                  <p>Augmenter la surface du permis.</p>
                </div>
                <ChevronRight className={styles.modalOptionArrow} />
              </button>

              <button
                type="button"
                className={styles.modalOptionCard}
                onClick={async () => {
                  setExtensionModalOpen(false);
                  await startProcedureFlow('extension_substance');
                }}
              >
                <div className={styles.modalOptionIcon}>
                  <FileCheck className={styles.actionIcon} />
                </div>
                <div className={styles.modalOptionBody}>
                  <h4>Extension des substances</h4>
                  <p>Ajouter ou modifier les substances exploitees.</p>
                </div>
                <ChevronRight className={styles.modalOptionArrow} />
              </button>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalCancelButton}
                onClick={() => setExtensionModalOpen(false)}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {fusionModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setFusionModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Selectionner le permis a fusionner</h3>
              <p className={styles.modalText}>
                Choisissez un permis du meme detenteur, verifiez la frontiere commune (100 m), puis selectionnez le permis principal a conserver.
              </p>
            </div>

            <div className={styles.fusionSearchWrap}>
              <input
                className={styles.fusionSearchInput}
                type="text"
                value={fusionSearch}
                onChange={(e) => setFusionSearch(e.target.value)}
                placeholder="Rechercher par code, type ou titulaire..."
              />
            </div>

            <div className={styles.fusionCandidates}>
              {fusionLoadingCandidates ? (
                <div className={styles.fusionState}>Chargement des permis...</div>
              ) : filteredFusionCandidates.length === 0 ? (
                <div className={styles.fusionState}>Aucun permis disponible pour fusion.</div>
              ) : (
                filteredFusionCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className={`${styles.fusionCandidateBtn} ${
                      selectedFusionPermisId === candidate.id ? styles.fusionCandidateBtnActive : ''
                    }`}
                    onClick={() => setSelectedFusionPermisId(candidate.id)}
                  >
                    <div className={styles.fusionCandidateMain}>
                      <strong>{candidate.code_permis}</strong>
                      <span>{candidate.type_label}</span>
                    </div>
                    <small>{candidate.titulaire}</small>
                  </button>
                ))
              )}
            </div>

            <div className={styles.fusionEligibilityBox}>
              {fusionChecking ? (
                <div className={styles.fusionState}>Verification frontiere commune...</div>
              ) : fusionEligibility ? (
                <>
                  <div
                    className={`${styles.fusionEligibilityBadge} ${
                      fusionEligibility.ok ? styles.fusionEligibilityOk : styles.fusionEligibilityKo
                    }`}
                  >
                    {fusionEligibility.ok ? 'Fusion possible' : 'Fusion impossible'}
                  </div>
                  <p>{fusionEligibility.message}</p>
                  <div className={styles.fusionEligibilityMeta}>
                    <span>Frontiere commune: {fusionEligibility.sharedBoundary.toFixed(2)} m</span>
                    {fusionEligibility.areaHa > 0 && (
                      <span>Superficie union: {fusionEligibility.areaHa.toFixed(2)} ha</span>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.fusionState}>Selectionnez un permis pour lancer la verification.</div>
              )}
            </div>

            <div className={styles.fusionPrincipalSection}>
              <h4>Permis principal a conserver</h4>
              <label className={styles.fusionRadioRow}>
                <input
                  type="radio"
                  name="fusion-principal"
                  checked={fusionPrincipalId === selectedPermitId}
                  onChange={() => setFusionPrincipalId(selectedPermitId)}
                  disabled={!fusionEligibility?.ok}
                />
                <span>
                  Conserver le permis actuel ({permit?.code_permis ?? permit?.short_code ?? '--'})
                </span>
              </label>
              <label className={styles.fusionRadioRow}>
                <input
                  type="radio"
                  name="fusion-principal"
                  checked={fusionPrincipalId === selectedFusionPermisId}
                  onChange={() =>
                    setFusionPrincipalId(
                      Number.isFinite(Number(selectedFusionPermisId))
                        ? Number(selectedFusionPermisId)
                        : null,
                    )
                  }
                  disabled={!fusionEligibility?.ok || !selectedFusionPermisId}
                />
                <span>
                  Conserver le permis selectionne (
                  {fusionCandidates.find((c) => c.id === selectedFusionPermisId)?.code_permis || '--'})
                </span>
              </label>
            </div>

            <textarea
              className={styles.fusionMotifInput}
              value={fusionMotif}
              onChange={(e) => setFusionMotif(e.target.value)}
              placeholder="Motif de fusion (optionnel)"
            />

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalCancelButton}
                onClick={() => setFusionModalOpen(false)}
                disabled={fusionSubmitting}
              >
                Annuler
              </button>
              <button
                type="button"
                className={styles.modalPrimaryButton}
                onClick={handleStartFusion}
                disabled={
                  fusionSubmitting ||
                  !fusionEligibility?.ok ||
                  !selectedFusionPermisId ||
                  !fusionPrincipalId ||
                  !!fusionExistingProcedureId
                }
              >
                {fusionSubmitting ? 'Creation...' : 'Continuer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
