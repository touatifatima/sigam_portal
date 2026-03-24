"use client";
//documents page
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import axios from "axios";
import { useSearchParams } from "@/src/hooks/useSearchParams";
import {
  FiUpload,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiAlertCircle,
} from "react-icons/fi";
import styles from "@/pages/investisseur/nouvelle_demande/step1/documents1.module.css";
import Navbar from "../../../navbar/Navbar";
import Sidebar from "../../../sidebar/Sidebar";
import ProgressStepper from "../../../../components/ProgressStepper";
import { useStepperPhases } from "@/src/hooks/useStepperPhases";
import { useViewNavigator } from "../../../../src/hooks/useViewNavigator";
import router from 'next/router';
import { toast } from "react-toastify";
import { useLoading } from '@/components/globalspinner/LoadingContext';
import { Phase, Procedure, ProcedureEtape, ProcedurePhase, StatutProcedure } from "@/src/types/procedure";
import { useActivateEtape } from "@/src/hooks/useActivateEtape";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { OnboardingTour, type OnboardingStep } from "@/components/onboarding/OnboardingTour";
import {
  getHasSeenOnboarding,
  getOnboardingActive,
  getOnboardingPageSeen,
  markOnboardingPageCompleted,
  stopOnboardingForever,
} from "@/src/onboarding/storage";

type Document = {
  id_doc: number;
  nom_doc: string;
  description: string;
  format: string;
  taille_doc: string;
  statut?: string;
  file_url?: string;
  is_required?: boolean;
  missing_action?: string;
  reject_message?: string;
};

type DossierFournis = {
  id_dossierFournis: number;
  statut_dossier: string;
  remarques?: string;
  date_depot: string;
};

type MissingSummary = {
  requiredMissing: Array<{
    id_doc: number;
    nom_doc: string;
    missing_action?: string;
    reject_message?: string;
  }>;
  blocking: Array<{
    id_doc: number;
    nom_doc: string;
    reject_message?: string;
  }>;
  blockingNext: Array<{
    id_doc: number;
    nom_doc: string;
  }>;
  warnings: Array<{
    id_doc: number;
    nom_doc: string;
  }>;
};

type ProcedureDeclarationItem = {
  id: number;
  ordre: number;
  texte: string;
  actif: boolean;
};

type DocStatus = "present" | "manquant" | "attente" | "uploading";
type DocumentWithStatus = Document & { statut: DocStatus };

const DOCUMENTS_ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "documents-progress",
    target: '[data-onboarding-id="documents-progress"]',
    title: "Suivi des pieces",
    description:
      "Cette barre vous montre l avancement global des documents obligatoires et deja televerses.",
    placement: "bottom",
  },
  {
    id: "documents-grid",
    target: '[data-onboarding-id="documents-grid"]',
    title: "Deposer vos documents",
    description:
      "Chaque carte represente un document attendu. Glissez un fichier ou cliquez sur Televerser pour l ajouter.",
    placement: "top",
  },
  {
    id: "documents-navigation",
    target: '[data-onboarding-id="documents-navigation"]',
    title: "Continuer le workflow",
    description:
      "Une fois les documents requis valides, utilisez Suivant pour passer a l etape facture/paiement.",
    placement: "top",
  },
];

export default function Step5_Documents() {
  const { resetLoading } = useLoading();
  const searchParams = useSearchParams();
  const [loadingState, setLoadingState] = useState<string>("Initializing...");
  const [idDemande, setIdDemande] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentWithStatus[]>([]);
  const [statusMap, setStatusMap] = useState<Record<number, DocStatus>>({});
  const [fileUrls, setFileUrls] = useState<Record<number, string>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savingEtape, setSavingEtape] = useState(false);
  const [etapeMessage, setEtapeMessage] = useState<string | null>(null);
  const [remarques, setRemarques] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCahierForm, setShowCahierForm] = useState(false);
  const [selectedCahierDoc, setSelectedCahierDoc] = useState<DocumentWithStatus | null>(null);
  const { currentView, navigateTo } = useViewNavigator("nouvelle-demande");
  const [currentStep, setCurrentStep] = useState(1);
  const [activatedSteps, setActivatedSteps] = useState<Set<number>>(new Set());
  const [statutProc, setStatutProc] = useState<string | undefined>(undefined);
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const [procedureData, setProcedureData] = useState<Procedure | null>(null);
  const [currentEtape, setCurrentEtape] = useState<{ id_etape: number } | null>(null);
  const [procedureTypeId, setProcedureTypeId] = useState<number | undefined>();
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [hasActivatedStep1, setHasActivatedStep1] = useState(false); 
  const [idProc, setIdProc] = useState<number | undefined>(undefined);
  const [isPageReady, setIsPageReady] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [missingSummary, setMissingSummary] = useState<MissingSummary | undefined>(undefined);
  const [deadlines, setDeadlines] = useState<{ miseEnDemeure: string | null; instruction: string | null } | null>(null);
  const [letterPreview, setLetterPreview] = useState<{ type: string; content: string; deadline?: string | null; numero_recepisse?: string | null } | null>(null);
  const [showDeclarationModal, setShowDeclarationModal] = useState(false);
  const [declarations, setDeclarations] = useState<ProcedureDeclarationItem[]>([]);
  const [declarationChecks, setDeclarationChecks] = useState<Record<number, boolean>>({});
  const [isDeclarationsLoading, setIsDeclarationsLoading] = useState(false);
  const [declarationsError, setDeclarationsError] = useState<string | null>(null);
  const [declarationsValidationError, setDeclarationsValidationError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clear any stuck global spinner when landing here
  useEffect(() => {
    try { resetLoading(); } catch {}
  }, [resetLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (getHasSeenOnboarding()) return;
    const active = getOnboardingActive();
    const alreadySeen = getOnboardingPageSeen("demande-documents");

    if (active && !alreadySeen) {
      setShowOnboarding(true);
    }
  }, []);

  // Synchronize statuses and URLs from backend payload
  const applyDocPayload = useCallback((docs: DocumentWithStatus[] | undefined | null) => {
    if (!docs) return;
    const nextStatus: Record<number, DocStatus> = {};
    const nextUrls: Record<number, string> = {};
    docs.forEach((doc: any) => {
      const incomingUrl = doc.file_url || doc.fileUrl || doc.path || doc.url || "";
      const hasFile = !!incomingUrl;
      const resolved: DocStatus =
        doc.statut === 'present'
          ? 'present'
          : doc.statut === 'manquant'
          ? 'manquant'
          : hasFile
          ? 'present'
          : 'manquant';
      nextStatus[doc.id_doc] = resolved;
      nextUrls[doc.id_doc] = hasFile ? incomingUrl : '';
    });
    setStatusMap(nextStatus);
    setFileUrls((prev) => {
      const merged = { ...prev };
      Object.entries(nextUrls).forEach(([key, url]) => {
        const id = Number(key);
        merged[id] = url || merged[id] || '';
      });
      return merged;
    });
  }, []);


    // Persist the deadline into localStorage payload for cross-step alerts
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!idProc || !missingSummary) return;
    try {
      const key = 'sigam_missing_required_docs';
      const raw = window.localStorage.getItem(key);
      let store: Record<string, any> = {};
      if (raw) {
        try { store = JSON.parse(raw) || {}; } catch { store = {}; }
      }
      const existing = store[idProc] || {};
        store[idProc] = {
          ...existing,
          missing: missingSummary.requiredMissing.map(d => d.nom_doc),
          procedureId: idProc,
          demandeId: idDemande,
          phase: 'FIRST',
          // Keep allowed prefixes if already computed elsewhere
          allowedPrefixes: existing.allowedPrefixes || undefined,
          // Utilise le délai d'instruction (10 jours ouvrables) si disponible,
          // sinon garde le comportement précédent basé sur la mise en demeure.
          deadline: deadlines?.instruction || deadlines?.miseEnDemeure || null,
          updatedAt: new Date().toISOString(),
        };
      window.localStorage.setItem(key, JSON.stringify(store));
      window.dispatchEvent(new CustomEvent('sigam:missing-docs', { detail: store[idProc] }));
    } catch {}
  }, [idProc, idDemande, missingSummary, deadlines]);

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    stopOnboardingForever();
  };

  const handleCompleteOnboarding = () => {
    setShowOnboarding(false);
    markOnboardingPageCompleted("demande-documents");
  };

  // Stocker les documents manquants dans le localStorage pour le ProgressStepper et ClientLayout
  useEffect(() => {
  if (missingSummary && idProc) {
    // Construire dynamiquement les prxes autoriss pour toutes les tapes de la premire phase
    const firstPhase = (procedureData?.ProcedurePhase || [])
      .map((pp: ProcedurePhase) => pp.phase)
      .sort((a: Phase, b: Phase) => a.ordre - b.ordre)[0];

    const allowedPrefixes = firstPhase?.etapes?.map(e => `/investisseur/nouvelle_demande/step${e.id_etape}`) || ['/investisseur/nouvelle_demande/step1'];

    const missingDocsPayload = {
      missing: missingSummary.requiredMissing.map(doc => doc.nom_doc),
      procedureId: idProc,
      demandeId: idDemande,
      phase: 'FIRST',
      allowedPrefixes,
      updatedAt: new Date().toISOString()
    };

    // Stocker dans localStorage
    if (typeof window !== 'undefined') {
      const existing = window.localStorage.getItem('sigam_missing_required_docs');
      
      // Déclarer le type correctement
      let procedures: Record<number, any> = {};
      
      if (existing) {
        try {
          const parsed = JSON.parse(existing);
          // S'assurer que c'est un objet avec des clés numériques
          if (parsed && typeof parsed === 'object') {
            procedures = parsed;
          }
        } catch (e) {
          console.warn('Erreur de parsing du localStorage:', e);
          procedures = {};
        }
      }

      procedures[idProc] = missingDocsPayload;
      window.localStorage.setItem('sigam_missing_required_docs', JSON.stringify(procedures));
      
      // Déclencher un événement personnalisé pour notifier le ProgressStepper
      window.dispatchEvent(new CustomEvent('sigam:missing-docs', { 
        detail: missingDocsPayload 
      }));
    }
  }
}, [missingSummary, idProc, idDemande]);

  // Nettoyer le localStorage quand la procédure est terminée
  useEffect(() => {
    if (statutProc === 'TERMINEE' && idProc && typeof window !== 'undefined') {
      const existing = window.localStorage.getItem('sigam_missing_required_docs');
      if (existing) {
        try {
          const procedures = JSON.parse(existing);
          delete procedures[idProc];
          window.localStorage.setItem('sigam_missing_required_docs', JSON.stringify(procedures));
        } catch (e) {
          // Ignorer les erreurs de parsing
        }
      }
    }
  }, [statutProc, idProc]);

  // Check if all required data is available
  const checkRequiredData = useCallback(() => {
    if (!idProc) return false;
    if (!procedureData) return false;
    if (!idDemande) return false;
    if (documents.length === 0) return false;
    return true;
  }, [idProc, procedureData, idDemande, documents]);

  // Set up interval to check for required data
  useEffect(() => {
    if (checkRequiredData()) {
      setIsPageReady(true);
      setLoadingState(""); // Clear loading state when ready
    }
  }, [checkRequiredData]);

  // Get idProc from URL parameters
  useEffect(() => {
    const idProcStr = searchParams?.get('id');
    if (!idProcStr) {
      setLoadingState("ID de procédure non trouvé dans les paramétres");
      setError("ID de procédure non trouvé dans les paramétres");
      return;
    }

    const parsedId = parseInt(idProcStr, 10);
    if (isNaN(parsedId)) {
      setLoadingState("ID de procédure invalide");
      setError("ID de procédure invalide");
      return;
    }

    setIdProc(parsedId);
    setLoadingState("Chargement des données de la procédure...");
    setError(null); // Clear error once idProc is set
  }, [searchParams]);

  // Fetch procedure data when idProc is available
  useEffect(() => {
    if (!idProc) return;

    const fetchProcedureData = async () => {
      abortControllerRef.current = new AbortController();
      try {
        const response = await axios.get<Procedure>(`${apiURL}/api/procedure-etape/procedure/${idProc}`, {
          signal: abortControllerRef.current.signal,
        });
        setProcedureData(response.data);
        
        if (response.data.demandes && response.data.demandes.length > 0) {
          setProcedureTypeId(response.data.demandes[0].typeProcedure?.id);
        }

        const activeEtape = response.data.ProcedureEtape.find((pe: ProcedureEtape) => pe.statut === 'EN_COURS');
        if (activeEtape) {
          setCurrentEtape({ id_etape: activeEtape.id_etape });
        }
        
        setLoadingState("Données de procédure chargées, récupération de la demande...");
        setError(null);
      } catch (error) {
        if (axios.isCancel(error)) return;
        console.error('Error fetching procedure data:', error);
        setLoadingState("Erreur lors du chargement des données de procédure");
        setError("Erreur lors du chargement des données de procédure");
      }
    };

    fetchProcedureData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [idProc, apiURL, refetchTrigger]);

  // Fetch demande data when procedure data is available
  useEffect(() => {
    if (!idProc || !procedureData) return;

    const fetchDemandeData = async () => {
      abortControllerRef.current = new AbortController();
      try {
        const res = await axios.get(`${apiURL}/api/procedures/${idProc}/demande`, {
          signal: abortControllerRef.current.signal,
        });
        setIdDemande(res.data.id_demande.toString());
        setStatutProc(res.data.procedure.statut_proc);
        setLoadingState("Données de demande chargées, récupération des documents...");
        setError(null);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("Erreur lors de la récupération de la demande", err);
        setLoadingState("Erreur lors de la récupération de la demande");
        setError("Erreur lors de la récupération de la demande");
      }
    };

    fetchDemandeData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [idProc, procedureData, apiURL]);

  // Fetch documents when idDemande is available
  useEffect(() => {
    if (!idDemande) return;

    const fetchDocuments = async () => {
      setIsLoading(true);
      abortControllerRef.current = new AbortController();
      try {
          const res = await axios.get(`${apiURL}/api/procedure/${idDemande}/documents`, {
            signal: abortControllerRef.current.signal,
          });
        setDocuments(res.data.documents);
        setMissingSummary(res.data.missingSummary);
        setDeadlines(res.data.deadlines);
        applyDocPayload(res.data.documents);

        if (res.data.dossierFournis) {
          setRemarques(res.data.dossierFournis.remarques || "");
        }
        
        setLoadingState(""); // Clear loading state
        setError(null);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("Erreur lors du chargement des documents", err);
        setLoadingState("Erreur lors du chargement des documents");
        setError("Erreur lors du chargement des documents");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [idDemande, apiURL, refetchTrigger]);

  const { phases: stepperPhases, etapeIdForRoute } = useStepperPhases(
    procedureData,
    apiURL,
    'investisseur/nouvelle_demande/step1/page1',
  );
  const fallbackPhases: Phase[] = procedureData?.ProcedurePhase
    ? procedureData.ProcedurePhase
        .slice()
        .sort((a: ProcedurePhase, b: ProcedurePhase) => a.ordre - b.ordre)
        .map((pp: ProcedurePhase) => ({
          ...pp.phase,
          ordre: pp.ordre,
        }))
    : [];
  const phases: Phase[] = stepperPhases.length > 0 ? stepperPhases : fallbackPhases;

  // Resolve the backend etape id for this page using page_route
  const etapeIdForThisPage = useMemo(() => {
    if (etapeIdForRoute) return etapeIdForRoute;
    if (!procedureData) return null;
    const pathname = 'investisseur/nouvelle_demande/step1/page1'; // doc page
    const normalize = (value: string) => value.replace(/^\/+/, '').toLowerCase();
    const target = normalize(pathname);
    const phasesList = (procedureData.ProcedurePhase || []) as ProcedurePhase[];
    for (const pp of phasesList) {
      const etapes = pp.phase?.etapes || [];
      const match = etapes.find((e: any) => normalize(e.page_route || '') === target);
      if (match) return match.id_etape;
    }
    return null;
  }, [procedureData, etapeIdForRoute]);
  const resolvedEtapeId = etapeIdForThisPage ?? currentEtape?.id_etape ?? null;

  useEffect(() => {
    if (etapeIdForThisPage && currentStep !== etapeIdForThisPage) {
      setCurrentStep(etapeIdForThisPage);
    }
  }, [etapeIdForThisPage, currentStep]);

  useActivateEtape({
    idProc,
    etapeNum: resolvedEtapeId ?? 0,
    shouldActivate: !!resolvedEtapeId && !activatedSteps.has(resolvedEtapeId) && isPageReady,
    onActivationSuccess: (stepStatus: string) => {
      if (!resolvedEtapeId) return;
      if (stepStatus === 'TERMINEE') {
        setActivatedSteps(prev => new Set(prev).add(resolvedEtapeId));
        setHasActivatedStep1(true);
        return;
      }

      setActivatedSteps(prev => new Set(prev).add(resolvedEtapeId));
      setHasActivatedStep1(true);

      // Force a refetch so local procedureData matches backend
      setTimeout(() => setRefetchTrigger(prev => prev + 1), 500);
    }
  });

  const handleOpenCahierForm = (doc: DocumentWithStatus) => {
    setSelectedCahierDoc(doc);
    setShowCahierForm(true);
  };

  const CahierFormModal = () => (
    <div className={styles['modal-overlay']}>
      <div className={styles['modal-content']}>
        <div className={styles['modal-header']}>
          <h3>Remplir Cahier des Charges</h3>
          <button
            onClick={() => setShowCahierForm(false)}
            className={styles['modal-close']}
          >
            &times;
          </button>
        </div>
        <div className={styles['modal-body']}>
          <iframe
            src={`/investisseur/nouvelle_demande/step10/page10?id=${idProc}`}
            className={styles['cahier-iframe']}
          />
        </div>
      </div>
    </div>
  );

  const LetterPreviewModal = () => {
    if (!letterPreview) return null;
    return (
      <div className={styles['modal-overlay']}>
        <div className={styles['modal-content']}>
          <div className={styles['modal-header']}>
            <h3>Courrier: {letterPreview.type}</h3>
            <button onClick={() => setLetterPreview(null)} className={styles['modal-close']}>&times;</button>
          </div>
          <div className={styles['modal-body']}>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{letterPreview.content}</pre>
          </div>
          <div className={styles['modal-actions']}>
            <button className={`${styles['btn']} ${styles['btn-primary']}`} onClick={() => setLetterPreview(null)}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  };

  const fetchProcedureDeclarations = async () => {
    if (!apiURL) {
      throw new Error("API non configuree");
    }
    const typeProcedure = procedureTypeId ?? 1;

    const response = await axios.get(
      `${apiURL}/api/procedure-declarations/${typeProcedure}`,
      { withCredentials: true },
    );

    const items: ProcedureDeclarationItem[] =
      response.data?.declarations ?? response.data ?? [];

    const activeSorted = (Array.isArray(items) ? items : [])
      .filter((item) => item?.actif !== false)
      .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));

    if (!activeSorted.length) {
      throw new Error(
        "Aucune declaration active n'est configuree pour cette procedure.",
      );
    }

    return activeSorted;
  };

  const confirmDeclarationsAndContinue = async () => {
    if (!idProc) {
      setEtapeMessage("ID de procedure manquant.");
      return;
    }
    if (statutProc === 'TERMINEE') {
      setEtapeMessage("Procedure deja terminee.");
      return;
    }
    if (declarations.length > 0) {
      const allChecked = declarations.every((item) => !!declarationChecks[item.id]);
      if (!allChecked) {
        setDeclarationsValidationError(
          "Vous devez accepter toutes les declarations pour continuer.",
        );
        return;
      }
    }

    setSavingEtape(true);
    setEtapeMessage(null);
    setIsNavigating(true);

    try {
      const result = await submitDossier();
      if (!result) {
        setEtapeMessage("Erreur lors de l'enregistrement de l'etape.");
        return;
      }
      const etapeId = resolvedEtapeId ?? currentStep;
      await axios.post(`${apiURL}/api/procedure-etape/finish/${idProc}/${etapeId}`);
      setShowDeclarationModal(false);
      await router.push(`/investisseur/nouvelle_demande/step11/page11?id=${idProc}`);
    } catch (err) {
      console.error("Erreur lors de la navigation vers l'etape suivante", err);
      setEtapeMessage("Erreur lors de l'enregistrement de l'etape.");
    } finally {
      setSavingEtape(false);
      setIsNavigating(false);
    }
  };

  const FinalDeclarationsModal = () => {
    if (!showDeclarationModal) return null;

    return (
      <div className={styles.finalDeclarationOverlay}>
        <div className={styles.finalDeclarationModal}>
          <div className={styles.finalDeclarationHeader}>
            <div className={styles.finalDeclarationTitleRow}>
              <FiAlertCircle className={styles.finalDeclarationWarningIcon} />
              <div>
                <h3 className={styles.finalDeclarationTitle}>
                  Confirmation finale avant paiement
                </h3>
                <p className={styles.finalDeclarationSubtitle}>
                  Declarations sur l&apos;honneur - Derniere etape
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowDeclarationModal(false);
                setDeclarationsValidationError(null);
                setDeclarationChecks({});
              }}
              className={styles.finalDeclarationClose}
              aria-label="Fermer"
            >
              &times;
            </button>
          </div>

          <div className={styles.finalDeclarationBody}>
            <div className={styles.finalDeclarationCard}>
              <p className={styles.finalDeclarationCardTitle}>
                En cliquant sur "Accepter et continuer", je confirme et je m&apos;engage sur les points suivants :
              </p>

              {isDeclarationsLoading ? (
                <p className={styles.finalDeclarationLoading}>Chargement des declarations...</p>
              ) : declarationsError ? (
                <p className={styles.finalDeclarationFetchError}>{declarationsError}</p>
              ) : (
                <div className={styles.finalDeclarationListWrap}>
                  <ul className={styles.finalDeclarationList}>
                    {declarations.map((item) => (
                      <li key={item.id} className={styles.finalDeclarationItem}>
                        <label className={styles.finalDeclarationItemLabel}>
                          <input
                            type="checkbox"
                            checked={!!declarationChecks[item.id]}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              if (!checked) {
                                setDeclarationsValidationError(
                                  "Vous devez accepter toutes les declarations pour continuer.",
                                );
                              }
                              setDeclarationChecks((prev) => {
                                const next = {
                                  ...prev,
                                  [item.id]: checked,
                                };
                                const allChecked =
                                  declarations.length > 0 &&
                                  declarations.every((decl) => !!next[decl.id]);
                                if (allChecked) {
                                  setDeclarationsValidationError(null);
                                }
                                return next;
                              });
                            }}
                          />
                          <FiCheck className={styles.finalDeclarationItemIcon} />
                          <span>{item.texte}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {declarationsValidationError && (
              <p className={styles.finalDeclarationValidationError}>
                {declarationsValidationError}
              </p>
            )}
          </div>

          <div className={styles.finalDeclarationActions}>
            <button
              type="button"
              className={`${styles['btn']} ${styles['btn-outline']}`}
              onClick={() => {
                setShowDeclarationModal(false);
                setDeclarationsValidationError(null);
                setDeclarationChecks({});
              }}
            >
              Fermer
            </button>
            <button
              type="button"
              className={`${styles['btn']} ${styles['btn-primary']} ${!(declarations.length > 0 && declarations.every((item) => !!declarationChecks[item.id])) ? styles.finalDeclarationPrimaryDisabled : ''}`}
              disabled={
                isDeclarationsLoading ||
                !(declarations.length > 0 && declarations.every((item) => !!declarationChecks[item.id])) ||
                declarations.length === 0 ||
                savingEtape ||
                isNavigating
              }
              onClick={() => {
                if (!(declarations.length > 0 && declarations.every((item) => !!declarationChecks[item.id]))) {
                  setDeclarationsValidationError(
                    "Vous devez accepter toutes les declarations pour continuer.",
                  );
                  return;
                }
                void confirmDeclarationsAndContinue();
              }}
            >
              Accepter et continuer vers la facture
            </button>
          </div>
        </div>
      </div>
    );
  };

  const submitDossier = async () => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const payload = {
      documents: documents.map((doc) => {
        const status = statusMap[doc.id_doc] ?? 'manquant';
        const file_url = fileUrls[doc.id_doc] || null;
        return {
          id_doc: doc.id_doc,
          status,
          file_url,
          present: status === 'present',
        };
      }),
      remarques
    };

    try {
      const response = await axios.post(
        `${apiURL}/api/demande/${idDemande}/dossier-fournis`,
        payload
      );

      setMissingSummary(response.data.missingSummary);
      setDeadlines(response.data.deadlines);
      setSuccess("Dossier mis à jour avec succés");
      
      return response.data;
    } catch (err) {
      console.error("Erreur lors de la soumission du dossier", err);
      setError("Erreur lors de la soumission du dossier");
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMiseEnDemeure = async () => {
    if (!idDemande) return;
    try {
      const result = await submitDossier();
      if (!result) return;
      toast.success('Mise en demeure lancée. Le délai de 30 jours est démarré.');
      // Ouvrir directement le PDF de mise en demeure
      if (apiURL) {
        window.open(`${apiURL}/api/demande/${idDemande}/mise-en-demeure.pdf`, '_blank');
      }
    } catch (err) {
      console.error('Erreur lors de la mise en demeure', err);
      toast.error("Erreur lors du lancement de la mise en demeure.");
    }
  };

  const handleFileUpload = async (id: number, file: File) => {
    if (!apiURL || !idDemande) {
      setError('Configuration API ou identifiant de demande manquant.');
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setStatusMap(prev => ({ ...prev, [id]: "uploading" }));
      setUploadProgress(prev => ({ ...prev, [id]: 0 }));
      const res = await axios.post(
        `${apiURL}/api/demande/${idDemande}/document/${id}/upload`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          withCredentials: true,
          onUploadProgress: (evt) => {
            if (!evt.total) return;
            const pct = Math.round((evt.loaded / evt.total) * 100);
            setUploadProgress(prev => ({ ...prev, [id]: pct }));
          },
        }
      );

      const fileUrl = res.data?.fileUrl ?? res.data?.file_url ?? '';
      if (fileUrl) {
        setFileUrls(prev => ({ ...prev, [id]: fileUrl }));
      }
      if (Array.isArray(res.data?.documents)) {
        applyDocPayload(res.data.documents as any);
      }

      setStatusMap(prev => ({ ...prev, [id]: "present" }));
      setDocuments(prev =>
        prev.map(d =>
          d.id_doc === id ? { ...d, statut: "present", file_url: fileUrl || d.file_url } : d,
        ),
      );
      setUploadProgress(prev => ({ ...prev, [id]: 100 }));
      return fileUrl;
    } catch (err) {
      console.error("Erreur lors de l'upload du fichier", err);
      setError("Erreur lors de l'upload du fichier");
      setStatusMap(prev => ({ ...prev, [id]: "manquant" }));
      setUploadProgress(prev => {
        const { [id]: _drop, ...rest } = prev;
        return rest;
      });
      return null;
    }
  };

  const handleDragOver = (id: number, event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragOverId(id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (id: number, event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragOverId(null);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    void handleFileUpload(id, file);
  };

  const countByStatus = (status: DocStatus) =>
    documents.filter((d) => (statusMap[d.id_doc] ?? 'manquant') === status).length;

  const total = documents.length;
  const presents = countByStatus("present");
  const manquants = countByStatus("manquant");
  const attente = countByStatus("attente");
  const progressPercent = total > 0 ? Math.round((presents / total) * 100) : 0;
  const progressFill =
    progressPercent >= 100
      ? "linear-gradient(90deg, #16a34a, #15803d)"
      : progressPercent >= 70
      ? "linear-gradient(90deg, #22c55e, #16a34a)"
      : progressPercent >= 40
      ? "linear-gradient(90deg, #86efac, #22c55e)"
      : "linear-gradient(90deg, #dcfce7, #86efac)";
  const progressMessage =
    progressPercent >= 100
      ? "Dossier complet !"
      : progressPercent >= 70
      ? "Dossier presque complet !"
      : progressPercent >= 40
      ? "Bon avancement."
      : "Commencez par les documents obligatoires.";
  const requiredTotal = documents.filter((doc) => doc.is_required).length;
  const requiredPresent = documents.filter((doc) => {
    if (!doc.is_required) return false;
    return (statusMap[doc.id_doc] ?? 'manquant') === 'present';
  }).length;

  const hasRequiredMissingClient = documents.some((doc) => {
    if (!doc.is_required) return false;
    const status = statusMap[doc.id_doc];
    return status !== 'present';
  });

  // Vérifier si la navigation est bloquée
  const isNavigationBlocked = false;

  // Debounced navigation handlers
  const debounce = (func: () => void, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func();
      }, delay);
    };
  };

  const handleNext = useCallback(
    debounce(async () => {
      if (isNavigating || savingEtape) return;

      const hasRequiredMissing = documents.some((doc) => {
        if (!doc.is_required) return false;
        const status = statusMap[doc.id_doc];
        return status !== "present";
      });

      if (hasRequiredMissing) {
        toast.warning(
          "Des documents obligatoires sont manquants. Impossible de passer a l'etape suivante.",
        );
        return;
      }

      if (!idProc) {
        setEtapeMessage("ID de procedure manquant.");
        return;
      }

      if (statutProc === "TERMINEE") {
        setEtapeMessage("Procedure deja terminee.");
        return;
      }

      setDeclarationsValidationError(null);
      setDeclarationsError(null);
      setDeclarations([]);
      setDeclarationChecks({});
      setShowDeclarationModal(true);
      setIsDeclarationsLoading(true);
      setEtapeMessage(null);

      try {
        const fetched = await fetchProcedureDeclarations();
        setDeclarations(fetched);
        setDeclarationChecks(
          fetched.reduce<Record<number, boolean>>((acc, item) => {
            acc[item.id] = false;
            return acc;
          }, {}),
        );
      } catch (err) {
        console.error("Erreur lors du chargement des declarations finales", err);
        setDeclarationsError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les declarations de cette procedure.",
        );
      } finally {
        setIsDeclarationsLoading(false);
      }
    }, 300),
    [documents, statusMap, idProc, isNavigating, savingEtape, statutProc, procedureTypeId, apiURL]
  );

  const handleBack = async () => {
    router.push(`/investisseur/nouvelle_demande/step3/page3?id=${idProc}`);
  };


  // Afficher les documents manquants obligatoires

  // Show loading state until all required data is available
  if (!isPageReady) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>{loadingState}</p>
        {!idProc && <p>En attente de l'ID de procédure...</p>}
        {idProc && !procedureData && <p>Chargement des données de procédure...</p>}
        {procedureData && !idDemande && <p>Chargement des données de demande...</p>}
        {idDemande && documents.length === 0 && <p>Chargement des documents...</p>}
      </div>
    );
  }

  return (
    <div className={styles['app-container']}>
      <Navbar />
      <div className={styles['app-content']}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles['main-content']}>
          <div className={styles['breadcrumb']}>
            <span>SIGAM</span>
            <FiChevronRight className={styles['breadcrumb-arrow']} />
            <span>Documents</span>
          </div>

          <div className={styles['documents-container']}>
            <div className={styles['content-wrapper']}>
                {/* Progress Steps */}
                {procedureData && (
                  <ProgressStepper
                    phases={phases}
                    currentProcedureId={idProc}
                    currentEtapeId={etapeIdForThisPage ?? currentEtape?.id_etape ?? currentStep}
                    procedurePhases={procedureData.ProcedurePhase || []}
                    procedureTypeId={procedureTypeId}
                    procedureEtapes={procedureData.ProcedureEtape || []}
                  />
                )}

                <div className={styles.headerSection}>
                  <div>
                    <h1 className={styles.pageTitle}>Documents requis</h1>
                    <p className={styles.pageSubtitle}>Veuillez fournir les documents suivants</p>
                  </div>
                </div>

                <Card className={styles.progressCard} data-onboarding-id="documents-progress">
                  <CardContent className={styles.progressContent}>
                    <div className={styles.progressHeader}>
                      <span className={styles.progressLabel}>Documents téléversés</span>
                      <span className={styles.progressCount}>
                        {presents}/{total}
                      </span>
                    </div>
                    <div className={styles.progressTrack}>
                      <div
                        className={styles.progressFill}
                        style={{
                          width: `${progressPercent}%`,
                          background: progressFill,
                          boxShadow:
                            progressPercent > 0 ? "0 0 10px rgba(16, 185, 129, 0.28)" : "none",
                        }}
                        aria-hidden="true"
                      />
                    </div>
                    <div className={styles.progressMeta}>
                      <span>Documents obligatoires: {requiredPresent} / {requiredTotal}</span>
                      <span className={styles.progressMessage}>{progressMessage}</span>
                    </div>
                  </CardContent>
                </Card>

                {error && (
                  <div className={styles.errorMessage}>
                    <FiAlertCircle className={styles.errorIcon} />
                    <p>{error}</p>
                  </div>
                )}

                {success && (
                  <div className={styles.successMessage}>
                    <FiCheck className={styles.successIcon} />
                    <p>{success}</p>
                  </div>
                )}

              {isLoading && documents.length === 0 ? (
                <div className={styles['loading-state']}>
                  <div className={styles['spinner']}></div>
                  <p>Chargement des documents...</p>
                </div>
              ) : (
                  <div className={styles.documentsGrid} data-onboarding-id="documents-grid">
                    {documents.map((doc) => {
                      const status: DocStatus = statusMap[doc.id_doc] ?? 'manquant';
                      const rawFileUrl =
                        fileUrls[doc.id_doc] ||
                        doc.file_url ||
                        (doc as any).fileUrl ||
                        (doc as any).path ||
                        (doc as any).url ||
                        '';
                      const resolvedFileUrl =
                        rawFileUrl && rawFileUrl.startsWith('http')
                          ? rawFileUrl
                          : rawFileUrl && apiURL
                          ? `${apiURL}${rawFileUrl}`
                          : rawFileUrl || '';
                      const isRequired = doc.is_required;
                      const isDisabled = statutProc === 'TERMINEE' || !statutProc || isNavigating;
                      const statusLabel =
                        status === 'present'
                          ? 'Présent'
                          : status === 'uploading'
                          ? 'Téléversement...'
                          : 'Manquant';

                      return (
                        <Card
                          key={doc.id_doc}
                          className={`${styles.documentCard} ${isRequired ? styles.required : ''} ${
                            status === 'present'
                              ? styles.documentCardPresent
                              : status === 'manquant'
                              ? styles.documentCardMissing
                              : ''
                          }`}
                        >
                          <CardContent className={styles.documentBody}>
                            <div className={styles.documentHeader}>
                              <div>
                                <div className={styles.documentTitleRow}>
                                  {status === 'present' && (
                                    <FiCheck
                                      className={`${styles.docStateIcon} ${styles.docStateIconPresent}`}
                                      aria-hidden="true"
                                    />
                                  )}
                                  {status === 'manquant' && (
                                    <FiAlertCircle
                                      className={`${styles.docStateIcon} ${styles.docStateIconMissing}`}
                                      aria-hidden="true"
                                    />
                                  )}
                                  <h3 className={styles.documentTitle}>{doc.nom_doc}</h3>
                                  {isRequired && (
                                    <Badge className={styles.requiredBadge} variant="destructive">
                                      Obligatoire
                                    </Badge>
                                  )}
                                </div>
                                {doc.description && (
                                  <p className={styles.documentDescription}>{doc.description}</p>
                                )}
                                <div className={styles.documentMeta}>
                                  <span>{doc.format}</span>
                                  <span className={styles.metaDivider}>?</span>
                                  <span>{doc.taille_doc}</span>
                                </div>
                              </div>
                              <Badge
                                className={`${styles.statusBadge} ${
                                  status === 'present'
                                    ? styles.statusPresent
                                    : status === 'uploading'
                                    ? styles.statusUploading
                                    : styles.statusMissing
                                }`}
                              >
                                {statusLabel}
                              </Badge>
                            </div>

                            {resolvedFileUrl ? (
                              <a
                                href={resolvedFileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.fileLink}
                              >
                                Voir le fichier joint
                              </a>
                            ) : (
                              <span className={styles.noFile}>Aucun fichier téléversé</span>
                            )}

                            <div className={styles.uploadArea}>
                              <label
                                htmlFor={`file-upload-${doc.id_doc}`}
                                className={`${styles.uploadZone} ${
                                  dragOverId === doc.id_doc ? styles.uploadZoneActive : ''
                                } ${isDisabled ? styles.uploadZoneDisabled : ''}`}
                                onDragOver={(event) => handleDragOver(doc.id_doc, event)}
                                onDragLeave={handleDragLeave}
                                onDrop={(event) => handleDrop(doc.id_doc, event)}
                              >
                                <FiUpload className={styles.uploadIcon} />
                                <div className={styles.uploadText}>
                                  <span>Glisser-d?poser ou</span>
                                  <Button asChild variant="outline" size="sm" className={styles.uploadButton}>
                                    <span>{resolvedFileUrl ? 'Modifier' : 'Téléverser'}</span>
                                  </Button>
                                </div>
                              </label>
                              <input
                                id={`file-upload-${doc.id_doc}`}
                                type="file"
                                className={styles.fileInput}
                                disabled={isDisabled}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  void handleFileUpload(doc.id_doc, file);
                                }}
                              />
                            </div>

                            {status === 'uploading' && (
                              <div className={styles.uploadProgress}>
                                <Progress
                                  value={uploadProgress[doc.id_doc] ?? 0}
                                  className={styles.uploadProgressBar}
                                  style={
                                    {
                                      "--progress-fill": "#22c55e",
                                      "--progress-track": "#dcfce7",
                                    } as any
                                  }
                                />
                                <span className={styles.uploadProgressText}>
                                  {(uploadProgress[doc.id_doc] ?? 0)}%
                                </span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
              )}
              <div className={styles['navigation-buttons']} data-onboarding-id="documents-navigation">
                <button
                  className={`${styles['btn']} ${styles['btn-outline']}`}
                  onClick={handleBack}
                  disabled={isLoading || isSubmitting || statutProc === 'TERMINEE' || isNavigating}
                >
                  <FiChevronLeft className={styles['btn-icon']} />
                  Précédent
                </button>

                <button
                  className={`${styles['btn']} ${styles['btn-primary']}`}
                  onClick={handleNext}
                  disabled={isLoading || isSubmitting || isNavigating || savingEtape || hasRequiredMissingClient}
                >
                  {isSubmitting ? (
                    <span className={styles['btn-loading']}>
                      <span className={styles['spinner-small']}></span>
                      {isSubmitting ? "Soumission..." : "Vérification..."}
                    </span>
                  ) : (
                    <>
                      Suivant
                      <FiChevronRight className={styles['btn-icon']} />
                    </>
                  )}
                </button>
              </div>

              {etapeMessage && (
                <div className={styles['etapeMessage']}>
                  {etapeMessage}
                </div>
              )}
            </div>
            {showCahierForm && <CahierFormModal />}
            {letterPreview && <LetterPreviewModal />}
            <FinalDeclarationsModal />
            <OnboardingTour
              isOpen={showOnboarding}
              steps={DOCUMENTS_ONBOARDING_STEPS}
              onClose={handleCloseOnboarding}
              onComplete={handleCompleteOnboarding}
            />
          </div>
        </main>
      </div>
    </div>
  );
}


