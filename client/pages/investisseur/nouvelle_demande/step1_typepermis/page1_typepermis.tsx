'use client';
//c la page princaipale de l'étape 1 (type de permis)
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FieldHelp } from '@/components/ui/field-help';
import { BadgeCheck, CalendarDays, Clock3, FileText, Repeat, Ruler } from 'lucide-react';

import styles from './page1_typepermis.module.css';
import Navbar from '../../../navbar/Navbar';
import Sidebar from '../../../sidebar/Sidebar';
import { cleanLocalStorageForNewDemande } from '../../../../utils/cleanLocalStorage';
import {
  setSessionBackedItem,
  writeSessionBackedJson,
} from '@/src/utils/sessionBackedStorage';
import { useViewNavigator } from '../../../../src/hooks/useViewNavigator';
import { useAuthReady } from '../../../../src/hooks/useAuthReady';
import { useLoading } from '@/components/globalspinner/LoadingContext';
import ProgressStepper from '../../../../components/ProgressStepper';
import { OnboardingTour, type OnboardingStep } from '@/components/onboarding/OnboardingTour';
import {
  getHasSeenOnboarding,
  getOnboardingActive,
  getOnboardingPageSeen,
  markOnboardingPageCompleted,
  stopOnboardingForever,
} from '@/src/onboarding/storage';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getDefaultDashboardPath } from '@/src/utils/roleNavigation';

import 'react-datepicker/dist/react-datepicker.css';
import { useAuthStore } from '@/src/store/useAuthStore';

interface TypePermis {
  id: number;
  lib_type: string;
  code_type: string;
  regime: string;
  duree_initiale: number;
  nbr_renouv_max: number;
  duree_renouv: number;
  delai_renouv: number;
  superficie_max?: number | null;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';
const SIMPLE_STEPS = [
  'Type de permis',
  "Identification ",
  'Cadastre',
  'Documents',
  'Capacités',
  'Facture',
  'Paiement',
];

const START_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'start-progress',
    target: '[data-onboarding-id="start-progress"]',
    title: 'Parcours de creation',
    description:
      'Ce bandeau vous montre toutes les etapes de votre demande pour suivre votre avancement en temps reel.',
    placement: 'bottom',
  },
  {
    id: 'start-type-select',
    target: '[data-onboarding-id="start-type-select"]',
    title: 'Verification prealable',
    description:
      'Commencez par choisir le type de permis adapte. Les regles de duree et superficie seront appliquees automatiquement.',
    placement: 'bottom',
  },
  {
    id: 'start-details',
    target: '[data-onboarding-id="start-details"]',
    title: 'Details du permis',
    description:
      'Verifiez ici les informations critiques avant de continuer: duree, renouvellements et superficie maximale.',
    placement: 'top',
  },
  {
    id: 'start-next',
    target: '[data-onboarding-id="start-next"]',
    title: 'Passer a l etape suivante',
    description:
      "Cliquez sur Suivant pour creer la procedure et ouvrir l'etape Identification d'entreprise.",
    placement: 'top',
  },
];

const isTypePermis = (value: unknown): value is TypePermis => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'number' &&
    typeof record.lib_type === 'string' &&
    typeof record.code_type === 'string' &&
    typeof record.regime === 'string' &&
    typeof record.duree_initiale === 'number' &&
    typeof record.nbr_renouv_max === 'number' &&
    typeof record.duree_renouv === 'number' &&
    typeof record.delai_renouv === 'number'
  );
};

const extractPermisArray = (value: unknown): TypePermis[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isTypePermis);
};

const toPermisList = (payload: unknown): TypePermis[] => {
  if (Array.isArray(payload)) return extractPermisArray(payload);
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) return extractPermisArray(record.data);
    if (Array.isArray(record.items)) return extractPermisArray(record.items);
    if (Array.isArray(record.results)) return extractPermisArray(record.results);
  }
  return [];
};

const toPermisItem = (payload: unknown): TypePermis | null => {
  if (!payload) return null;
  if (Array.isArray(payload)) {
    const first = payload[0];
    return isTypePermis(first) ? first : null;
  }
  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (isTypePermis(record.data)) return record.data;
    if (isTypePermis(record)) return record;
    return null;
  }
  return null;
};

export default function DemandeStart() {
  const router = useRouter();
  const isAuthReady = useAuthReady();
  const { currentView, navigateTo } = useViewNavigator('nouvelle-demande');
  const { resetLoading } = useLoading();
  const { auth, isLoaded } = useAuthStore();
  const dashboardPath = getDefaultDashboardPath(auth?.role);
  
  const [permisOptions, setPermisOptions] = useState<TypePermis[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [entryChoiceModalOpen, setEntryChoiceModalOpen] = useState(false);

  const [selectedPermisId, setSelectedPermisId] = useState<number | ''>('');
  const [selectedPermis, setSelectedPermis] = useState<TypePermis | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Ensure global route spinner is cleared when landing on this page
  useEffect(() => {
    try { resetLoading(); } catch {}
  }, [resetLoading]);

  useEffect(() => {
    if (!router.isReady) return;
    const hasExistingProcedure = Boolean(router.query.id);
    setEntryChoiceModalOpen(!hasExistingProcedure);
  }, [router.isReady, router.query.id]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!entryChoiceModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [entryChoiceModalOpen]);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    if (!apiBase) {
      console.error('Missing NEXT_PUBLIC_API_URL environment variable.');
      setPageError('Configuration API manquante.');
      return;
    }

    const controller = new AbortController();
    setOptionsLoading(true);
    setPageError(null);

    axios
      .get<TypePermis[]>(`${apiBase}/type-permis`, {
        withCredentials: true,
        signal: controller.signal,
      })
      .then((response) => {
        const options = toPermisList(response.data);
        setPermisOptions(options);
        if (options.length === 0) {
          setPageError('Aucun type de permis recu depuis le serveur.');
        }
      })
      .catch((error) => {
        if (axios.isCancel(error)) {
          return;
        }
        console.error('Failed to load permit types', error);
        setPageError('Impossible de charger la liste des types de permis.');
      })
      .finally(() => {
        setOptionsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [isAuthReady]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (entryChoiceModalOpen) return;
    if (getHasSeenOnboarding()) return;

    const active = getOnboardingActive();
    const alreadySeen = getOnboardingPageSeen('demande-start');

    if (active && !alreadySeen) {
      setShowOnboarding(true);
    }
  }, [entryChoiceModalOpen]);

  const effectivePermis = useMemo(() => {
    if (selectedPermis) {
      return selectedPermis;
    }

    if (selectedPermisId === '') {
      return null;
    }

    return permisOptions.find((option) => option.id === selectedPermisId) ?? null;
  }, [permisOptions, selectedPermis, selectedPermisId]);

  const permitStats = useMemo(() => {
    if (!effectivePermis) return [];

    return [
      {
        key: 'duree',
        label: 'Durée initiale',
        value: `${effectivePermis.duree_initiale}`,
        unit: 'ans',
        note: "Durée d'octroi initiale",
        tone: 'blue',
        icon: CalendarDays,
      },
      {
        key: 'renewals',
        label: 'Renouvellements maximum',
        value: `${effectivePermis.nbr_renouv_max}`,
        unit: 'fois',
        note: 'Nombre maximum autorisé',
        tone: 'green',
        icon: Repeat,
      },
      {
        key: 'renewalDuration',
        label: 'Durée du renouvellement',
        value: `${effectivePermis.duree_renouv}`,
        unit: 'ans',
        note: 'Durée de chaque période',
        tone: 'violet',
        icon: Clock3,
      },
      {
        key: 'area',
        label: 'Superficie maximale',
        value: `${effectivePermis.superficie_max ?? 'Non spécifiée'}`,
        unit: 'ha',
        note: 'Surface maximale autorisée',
        tone: 'orange',
        icon: Ruler,
      },
      {
        key: 'delay',
        label: 'Délai de renouvellement',
        value: `${effectivePermis.delai_renouv}`,
        unit: 'jours',
        note: 'Avant expiration',
        tone: 'red',
        icon: BadgeCheck,
      },
    ];
  }, [effectivePermis]);

  const handlePermisChange = async (value: string) => {
    if (!value) {
      setSelectedPermisId('');
      setSelectedPermis(null);
      return;
    }

    const permisId = Number(value);
    if (Number.isNaN(permisId)) {
      setSelectedPermisId('');
      setSelectedPermis(null);
      toast.error('Identifiant de permis invalide.');
      return;
    }

    setSelectedPermisId(permisId);
    setSelectedPermis(null);

    if (!isAuthReady) {
      return;
    }

    if (!apiBase) {
      toast.error('Configuration API manquante.');
      return;
    }

    setDetailsLoading(true);

    try {
      const response = await axios.get<TypePermis>(`${apiBase}/type-permis/${permisId}`, {
        withCredentials: true,
      });
      setSelectedPermis(toPermisItem(response.data));
    } catch (error) {
      console.error('Failed to load permit details', error);
      setSelectedPermis(null);
      toast.error('Impossible de charger les details du type de permis.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleStartProcedure = async () => {
    const permis = effectivePermis;

    if (!permis) {
      toast.warning('Selectionnez un type de permis.');
      return;
    }

    if (!apiBase) {
      toast.error('Configuration API manquante.');
      return;
    }

    setSubmitting(true);

    try {
      cleanLocalStorageForNewDemande();
      const response = await axios.post(
        `${apiBase}/demandes`,
        {
          id_typepermis: permis.id,
          objet_demande: 'Instruction initialisee',
          // Let backend set authoritative timestamps
        },
        { withCredentials: true },
      );

      const { procedure, code_demande: demandeCode, id_demande } = response.data ?? {};
      const idProc = procedure?.id_proc ?? procedure?.id_proc;

      if (id_demande) {
        setSessionBackedItem('id_demande', String(id_demande));
      }
      if (idProc) {
        setSessionBackedItem('id_proc', String(idProc));
      }
      setSessionBackedItem('code_demande', demandeCode ?? '');
      writeSessionBackedJson('selected_permis', permis);
      writeSessionBackedJson('permis_details', {
        duree_initiale: permis.duree_initiale,
        nbr_renouv_max: permis.nbr_renouv_max,
        superficie_max: permis.superficie_max ?? null,
        duree_renouv: permis.duree_renouv,
      });
      // Start the request workflow from Identification (step 2)
      if (idProc) {
        await router.push(`/investisseur/nouvelle_demande/step2/page2?id=${idProc}`);
      } else {
        toast.info('Demande creee, mais identifiant de procedure indisponible.');
      }
    } catch (error) {
      console.error('Failed to create demande', error);
      toast.error('Erreur lors de la creation de la demande.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    stopOnboardingForever();
  };

  const handleCompleteOnboarding = () => {
    setShowOnboarding(false);
    markOnboardingPageCompleted('demande-start');
  };

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.mainContent}>
          {entryChoiceModalOpen && (
            <div className={styles.entryModalOverlay}>
              <div className={styles.entryModalCard} role="dialog" aria-modal="true" aria-labelledby="entry-choice-title">
                <div className={styles.entryModalHeader}>
                  <span className={styles.entryModalBadge}>Nouvelle demande</span>
                </div>
                <h2 id="entry-choice-title" className={styles.entryModalTitle}>
                  Que souhaitez-vous faire ?
                </h2>
                <p className={styles.entryModalText}>
                  Choisissez le parcours le plus adapte a votre besoin. Vous pouvez revenir a tout moment.
                </p>

                <div className={styles.entryModalActions}>
                  <button
                    type="button"
                    className={`${styles.entryActionButton} ${styles.entryActionPrimary}`}
                    onClick={() => router.push('/investisseur/nouvelle-demande-posterieure')}
                  >
                    <span className={styles.entryActionLabel}>Faire une demande pour un permis existant</span>
                    <span className={styles.entryActionHint}>Renouvellement, Cession, Transfert, etc.</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.entryActionButton} ${styles.entryActionSecondary}`}
                    onClick={() => setEntryChoiceModalOpen(false)}
                  >
                    <span className={styles.entryActionLabel}>Faire une nouvelle demande initiale</span>
                    <span className={styles.entryActionHint}>Continuer le parcours normal de création.</span>
                  </button>
                </div>

                <div className={styles.entryModalFooter}>
                  <button
                    type="button"
                    className={styles.entryDashboardButton}
                    onClick={() => router.push(dashboardPath)}
                  >
                    Annuler et retour au Dashboard
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className={styles.topActions}>
            <button
              type="button"
              className={styles.backDashboardButton}
              onClick={() => router.push(dashboardPath)}
            >
              Annuler et retour
            </button>
          </div>

          <div className={styles.headerRow}>
            <h1 className={styles.pageTitle}>Choisissez votre type de permis</h1>
          </div>

          <div data-onboarding-id="start-progress">
            <ProgressStepper steps={SIMPLE_STEPS} currentStep={1} />
          </div>

          <div className={`${styles.card} ${styles.stepCard}`}>
            {pageError && <div className={styles.errorBox}>{pageError}</div>}

            <div data-onboarding-id="start-type-select">
              <FieldHelp
                label="Type de permis"
                required
                helpText="Choisissez le type de permis qui correspond à votre demande."
              />
              <Select
                value={selectedPermisId === '' ? undefined : String(selectedPermisId)}
                onValueChange={handlePermisChange}
                disabled={optionsLoading}
              >
                <SelectTrigger className={styles.select}>
                  <SelectValue
                    className={styles.selectValue}
                    placeholder="-- Selectionnez --"
                  />
                </SelectTrigger>
                <SelectContent className={styles.selectContent}>
                  {permisOptions.map((permis) => (
                    <SelectItem
                      key={permis.id}
                      value={String(permis.id)}
                      className={styles.selectItem}
                    >
                      {permis.lib_type} ({permis.code_type}) - {permis.regime}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {detailsLoading && (
              <div className={styles.loadingHint}>Chargement des details du permis...</div>
            )}

            {effectivePermis && !detailsLoading && (
              <div className={styles.permisDetails} data-onboarding-id="start-details">
                <div className={styles.permisDetailsHeader}>
                  <div className={styles.permisDetailsHeaderIcon}>
                    <FileText size={18} />
                  </div>
                  <div className={styles.permisDetailsHeaderText}>
                    <h4>Details du permis selectionne</h4>
                    <p>Consultez les principales caracteristiques et conditions liees a ce type de permis.</p>
                  </div>
                  <div className={styles.permisDetailsBadge}>Donnees reglementaires ANAM</div>
                </div>

                <div className={styles.permisDetailsBody}>
                  <div className={styles.permisOverview}>
                    <div className={styles.permisHeroText}>
                      <p className={styles.permisHeroKicker}>Permis {effectivePermis.regime || 'minier'}</p>
                      <h5>{effectivePermis.lib_type}</h5>
                      <p className={styles.permisHeroDescription}>
                        {effectivePermis.code_type} - {effectivePermis.regime}
                      </p>
                      <div className={styles.permisHeroPill}>
                        <span className={styles.permisHeroPillLabel}>Nature du droit</span>
                        <span className={styles.permisHeroPillValue}>Droit minier</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.permisStats}>
                    {permitStats.map((stat) => {
                      const Icon = stat.icon;
                      return (
                        <div key={stat.key} className={`${styles.statCard} ${styles[`tone${stat.tone.charAt(0).toUpperCase()}${stat.tone.slice(1)}`]}`}>
                          <div className={styles.statIconWrap}>
                            <Icon size={18} />
                          </div>
                          <div className={styles.statCopy}>
                            <p className={styles.statLabel}>{stat.label}</p>
                            <div className={styles.statValueRow}>
                              <span className={styles.statValue}>{stat.value}</span>
                              <span className={styles.statUnit}>{stat.unit}</span>
                            </div>
                            <p className={styles.statNote}>{stat.note}</p>
                          </div>
                        </div>
                      );
                    })}

                    <div className={styles.permisAside}>
                      <div className={styles.permisAsideTitle}>Base legale</div>
                      <p className={styles.permisAsideText}>
                        {effectivePermis.regime || 'Régime'} - informations de référence associées à ce type de permis.
                      </p>
                      <button type="button" className={styles.permisAsideLink} onClick={() => toast.info('Consultez la réglementation applicable dans le guide ANAM.')}>
                        Voir les textes
                      </button>
                    </div>
                  </div>
                </div>

                <div className={styles.permisDetailsFooter}>
                  <div className={styles.permisImportant}>
                    <span className={styles.permisImportantDot}>i</span>
                    <span>
                      Important : toutes les durées sont calculées à partir de la date de signature de la décision d&apos;octroi.
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.permisImportantLink}
                    onClick={() => toast.info('Consultez la réglementation du type de permis sélectionné.')}
                  >
                    En savoir plus
                  </button>
                </div>
              </div>
            )}

            <div className={styles.buttonGroup}>
              <button
                className={styles.nextButton}
                data-onboarding-id="start-next"
                disabled={submitting || !effectivePermis}
                onClick={handleStartProcedure}
              >
                {submitting ? 'Creation...' : 'Suivant'}
              </button>
            </div>
          </div>
          <OnboardingTour
            isOpen={showOnboarding}
            steps={START_ONBOARDING_STEPS}
            onClose={handleCloseOnboarding}
            onComplete={handleCompleteOnboarding}
          />
        </main>
      </div>
    </div>
  );
}
