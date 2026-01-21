import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import router from "next/router";
import { 
  CreditCard, 
  Smartphone, 
  FileText, 
  Shield, 
  ArrowLeft,
  Info,
  Phone,
  Lock,
  CheckCircle
} from "lucide-react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { BsSave } from "react-icons/bs";
import axios from "axios";
import styles from "./Paiement.module.css";
import Navbar from "../../../navbar/Navbar";
import Sidebar from "../../../sidebar/Sidebar";
import { useViewNavigator } from "../../../../src/hooks/useViewNavigator";
import { useActivateEtape } from "@/src/hooks/useActivateEtape";
import ProgressStepper from "../../../../components/ProgressStepper";
import { Phase, Procedure, ProcedureEtape, ProcedurePhase } from "@/src/types/procedure";

type PaymentMethod = "card" | "baridimob" | null;
type PaymentStatus = "EN_ATTENTE" | "PAYE" | "EN_ERREUR";

type DemandePaiement = {
  codeDemande: string;
  typeProcedure: string;
  montant: number;
  statutPaiement: PaymentStatus;
};

const Paiement = () => {
  const { currentView, navigateTo } = useViewNavigator("nouvelle-demande");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [demandeInfo, setDemandeInfo] = useState<DemandePaiement | null>(null);
  const [isLoadingDemande, setIsLoadingDemande] = useState(false);
  const [idProc, setIdProc] = useState<string | null>(null);
  const [idDemande, setIdDemande] = useState<string | null>(null);
  const [procedureData, setProcedureData] = useState<Procedure | null>(null);
  const [currentStep, setCurrentStep] = useState<number | undefined>(undefined);
  const [procedureTypeId, setProcedureTypeId] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageReady, setIsPageReady] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [savingEtape, setSavingEtape] = useState(false);
  const [etapeMessage, setEtapeMessage] = useState<string | null>(null);
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const abortControllerRef = useRef<AbortController | null>(null);
  const numericProcId = idProc ? Number(idProc) : undefined;
  const resolvedProcId = Number.isNaN(numericProcId) ? undefined : numericProcId;

  useEffect(() => {
    const raw =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("id") : null;
    setIdProc(raw);
  }, []);

  // Simulated fetch
  useEffect(() => {
    if (!idProc) return;
    setIsLoadingDemande(true);
    const mock: DemandePaiement = {
      codeDemande: `DEM-${idProc}`,
      typeProcedure: "Permis d'exploration minière",
      montant: 125000,
      statutPaiement: "EN_ATTENTE",
    };
    setDemandeInfo(mock);
    setIsLoadingDemande(false);
  }, [idProc]);

  useEffect(() => {
    if (!idProc || !apiURL) return;

    const fetchProcedureData = async () => {
      setIsLoading(true);
      abortControllerRef.current = new AbortController();
      try {
        const res = await axios.get<Procedure>(
          `${apiURL}/api/procedure-etape/procedure/${idProc}`,
          { signal: abortControllerRef.current.signal },
        );
        setProcedureData(res.data);
        // derive procedure type
        const typeId = res.data?.demandes?.[0]?.id_typeProc;
        if (typeId) setProcedureTypeId(typeId);
        // derive current step (id_etape en cours)
        const active = res.data?.ProcedureEtape?.find(
          (pe: ProcedureEtape) => pe.statut === "EN_COURS",
        );
        if (active?.id_etape) {
          setCurrentStep(active.id_etape);
        }
      } catch (error) {
        if (axios.isCancel(error)) return;
        setProcedureData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProcedureData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [idProc, apiURL, refetchTrigger]);

  useEffect(() => {
    if (!idProc || !procedureData || !apiURL) return;

    const fetchDemandeData = async () => {
      abortControllerRef.current = new AbortController();
      try {
        const res = await axios.get(`${apiURL}/api/procedures/${idProc}/demande`, {
          signal: abortControllerRef.current.signal,
        });
        if (res.data?.id_demande != null) {
          setIdDemande(res.data.id_demande.toString());
        }
      } catch (error) {
        if (axios.isCancel(error)) return;
      }
    };

    fetchDemandeData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [idProc, procedureData, apiURL, refetchTrigger]);

  // Align with page4: show phases as returned by backend, sorted by ordre
  const phases: Phase[] = useMemo(() => {
    if (!procedureData?.ProcedurePhase) return [];
    return procedureData.ProcedurePhase
      .slice()
      .sort((a: ProcedurePhase, b: ProcedurePhase) => a.ordre - b.ordre)
      .map((pp: ProcedurePhase) => ({
        ...pp.phase,
        ordre: pp.ordre,
      }));
  }, [procedureData]);

  const etapeIdForThisPage = useMemo(() => {
    if (!procedureData) return null;
    const pathname = "investisseur/nouvelle_demande/step12/page12";
    const normalize = (value?: string | null) =>
      (value ?? "")
        .replace(/^\/+/, "")
        .replace(/\.(tsx|ts|jsx|js|html)$/i, "")
        .trim()
        .toLowerCase();
    const target = normalize(pathname);
    const phasesList = (procedureData.ProcedurePhase || []) as ProcedurePhase[];
    const phaseEtapes = phasesList.flatMap((pp) => pp.phase?.etapes || []);
    const byRoute = phaseEtapes.find((e: any) => {
      const route = normalize(e.page_route);
      return route === target || route.endsWith(target) || route.includes("step12/page12");
    });
    if (byRoute) return byRoute.id_etape;
    const allEtapes = [
      ...phaseEtapes,
      ...((procedureData.ProcedureEtape || []).map((pe: any) => pe.etape).filter(Boolean) as any[]),
    ];
    const byLabel = allEtapes.find((e: any) =>
      String(e?.lib_etape ?? "").toLowerCase().includes("paiement"),
    );
    return byLabel?.id_etape ?? null;
  }, [procedureData]);

  const isStepSaved = useMemo(() => {
    if (!procedureData || !etapeIdForThisPage) return false;
    return (procedureData.ProcedureEtape || []).some(
      (pe) => pe.id_etape === etapeIdForThisPage && pe.statut === "TERMINEE",
    );
  }, [procedureData, etapeIdForThisPage]);

  const checkRequiredData = useCallback(() => {
    return (
      !!idProc &&
      !!procedureData &&
      !!idDemande &&
      phases.length > 0 &&
      !!etapeIdForThisPage &&
      !isLoading
    );
  }, [idProc, procedureData, idDemande, phases, etapeIdForThisPage, isLoading]);

  useEffect(() => {
    if (checkRequiredData()) {
      setIsPageReady(true);
    }
  }, [checkRequiredData]);

  useEffect(() => {
    if (etapeIdForThisPage && currentStep !== etapeIdForThisPage) {
      setCurrentStep(etapeIdForThisPage);
    }
  }, [etapeIdForThisPage, currentStep]);

  useActivateEtape({
    idProc: resolvedProcId,
    etapeNum: etapeIdForThisPage ?? 0,
    shouldActivate: isPageReady && !!etapeIdForThisPage,
    onActivationSuccess: () => {
      setRefetchTrigger((prev) => prev + 1);
    },
  });

  const isPayable = demandeInfo?.statutPaiement === "EN_ATTENTE";
  const isPaymentFormComplete =
    isPayable &&
    !!selectedMethod &&
    (selectedMethod !== "baridimob" || phoneNumber.trim() !== "");

  const handlePrevious = () => {
    if (idProc) {
      router.push(`/investisseur/nouvelle_demande/step11/page11?id=${idProc}`);
    } else {
      router.push('/investisseur/nouvelle_demande/step11/page11');
    }
  };

  const handleSaveEtape = async () => {
    if (!idProc) {
      setEtapeMessage("ID de procédure manquant");
      return;
    }
    const etapeId = etapeIdForThisPage ?? currentStep;
    if (!etapeId) {
      setEtapeMessage(
        "Étape introuvable. Vérifiez le page_route en base (step12/page12).",
      );
      return;
    }
    setSavingEtape(true);
    setEtapeMessage(null);
    try {
      await axios.post(`${apiURL}/api/procedure-etape/finish/${idProc}/${etapeId}`, undefined, {
        withCredentials: true,
      });
      setEtapeMessage("Étape enregistrée avec succès");
      setRefetchTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Erreur sauvegarde étape", err);
      setEtapeMessage("Erreur lors de l'enregistrement de l'étape");
    } finally {
      setSavingEtape(false);
    }
  };

  const handlePayment = () => {
    if (!isPayable || !selectedMethod) return;
    setDemandeInfo((prev) =>
      prev ? { ...prev, statutPaiement: "PAYE" } : prev,
    );
    if (idProc) {
      router.push(`/investisseur/nouvelle_demande/recapitulatif?id=${idProc}`);
    }
  };

  const handleCardRedirect = () => {
    if (idProc) {
      router.push(`/investisseur/nouvelle_demande/step12/paiementadahabia?id=${idProc}`);
      return;
    }
    router.push('/investisseur/nouvelle_demande/step12/paiementadahabia');
  };

  const isPaymentDisabled = !isPaymentFormComplete;

  const formatMontant = (val?: number) =>
    typeof val === "number"
      ? val.toLocaleString("fr-DZ", { minimumFractionDigits: 0 })
      : "--";

  if (!isPageReady) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}></div>
        <p>Chargement du paiement...</p>
        {!idProc && <p>En attente de l'ID de procédure...</p>}
        {idProc && !procedureData && <p>Chargement des données de procédure...</p>}
        {procedureData && !idDemande && <p>Chargement des données de demande...</p>}
        {idDemande && phases.length === 0 && <p>Chargement des phases et étapes...</p>}
      </div>
    );
  }

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.mainContent}>
          <div className={styles.page}>
            <div className={styles.container}>
              {/* Back Link */}
              {/*<button
                className={styles.backLink}
                onClick={() =>
                  idProc
                    ? router.push(
                        `/investisseur/nouvelle_demande/step4/page4?id=${idProc}`,
                      )
                    : router.push('/investisseur/nouvelle_demande/step4/page4')
                }
                type="button"
              >
                <ArrowLeft size={18} />
                Retour à la demande
              </button>*/}

              {procedureData && (
                <ProgressStepper
                  phases={phases}
                  currentProcedureId={idProc ? Number(idProc) : undefined}
                  currentEtapeId={currentStep}
                  procedurePhases={procedureData.ProcedurePhase || []}
                  procedureTypeId={procedureTypeId}
                  procedureEtapes={procedureData.ProcedureEtape || []}
                />
              )}

              {/* Header */}
              <header className={styles.header}>
                <h1 className={styles.title}>Paiement de la demande</h1>
                <p className={styles.subtitle}>
                  Finalisez votre demande en effectuant le paiement sécurisé
                </p>
              </header>

              {/* Summary Card */}
              <div className={styles.summaryCard}>
                <div className={styles.summaryHeader}>
                  <div className={styles.summaryIcon}>
                    <FileText size={20} />
                  </div>
                  <h2 className={styles.summaryTitle}>Récapitulatif de la demande</h2>
                </div>
                
                <div className={styles.summaryGrid}>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Code de la demande</span>
                    <span className={styles.summaryValue}>{demandeInfo?.codeDemande ?? "--"}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Type de procédure</span>
                    <span className={styles.summaryValue}>{demandeInfo?.typeProcedure ?? "--"}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Montant à payer</span>
                    <span className={styles.summaryAmount}>{formatMontant(demandeInfo?.montant)} DA</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Statut</span>
                    <span
                      className={`${styles.statusBadge} ${
                        demandeInfo?.statutPaiement === "PAYE"
                          ? styles.statusSuccess
                          : styles.statusPending
                      }`}
                    >
                      <span className={styles.statusDot}></span>
                      {demandeInfo?.statutPaiement === "PAYE"
                        ? "Payé"
                        : demandeInfo?.statutPaiement === "EN_ATTENTE"
                        ? "En attente de paiement"
                        : "En erreur"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Methods Section */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <span className={styles.sectionNumber}>1</span>
                  Choisissez votre moyen de paiement
                </h3>

                <div className={styles.paymentMethods}>
                  {/* Card Payment Option */}
                  <div 
                    className={`${styles.paymentCard} ${selectedMethod === "card" ? styles.paymentCardSelected : ""} ${!isPayable ? styles.paymentCardDisabled : ""}`}
                    onClick={() => isPayable && setSelectedMethod("card")}
                  >
                    <div className={styles.paymentCardHeader}>
                      <div className={styles.paymentIconWrapper}>
                        <CreditCard size={24} />
                      </div>
                      <div className={`${styles.radioCircle} ${selectedMethod === "card" ? styles.radioCircleSelected : ""}`}>
                        <div className={styles.radioCircleInner}></div>
                      </div>
                    </div>
                    <h4 className={styles.paymentCardTitle}>Carte CIB / EDAHABIA</h4>
                    <p className={styles.paymentCardDesc}>
                      Paiement sécurisé via carte bancaire CIB ou EDAHABIA
                    </p>
                  </div>

                  {/* BaridiMob Option */}
                  <div 
                    className={`${styles.paymentCard} ${selectedMethod === "baridimob" ? styles.paymentCardSelected : ""} ${!isPayable ? styles.paymentCardDisabled : ""}`}
                    onClick={() => isPayable && setSelectedMethod("baridimob")}
                  >
                    <div className={styles.paymentCardHeader}>
                      <div className={styles.paymentIconWrapper}>
                        <Smartphone size={24} />
                      </div>
                      <div className={`${styles.radioCircle} ${selectedMethod === "baridimob" ? styles.radioCircleSelected : ""}`}>
                        <div className={styles.radioCircleInner}></div>
                      </div>
                    </div>
                    <h4 className={styles.paymentCardTitle}>BaridiMob</h4>
                    <p className={styles.paymentCardDesc}>
                      Paiement via l'application mobile BaridiMob
                    </p>
                  </div>
                </div>
              </section>

              {/* Conditional Content */}
              {selectedMethod && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    <span className={styles.sectionNumber}>2</span>
                    {selectedMethod === "card" ? "Paiement par carte" : "Paiement BaridiMob"}
                  </h3>

                  <div className={styles.conditionalContent}>
                    {selectedMethod === "card" ? (
                      <>
                        <div className={styles.infoMessage}>
                          <Info size={20} className={styles.infoIcon} />
                          <p className={styles.infoText}>
                            Vous serez redirigé vers une plateforme de paiement sécurisée pour finaliser votre transaction. 
                            Vos informations bancaires sont protégées par un cryptage SSL.
                          </p>
                        </div>
                        <button className={styles.btnPrimary} onClick={handleCardRedirect} disabled={!isPayable}>
                          <Lock size={18} />
                          Payer par carte
                        </button>
                      </>
                    ) : (
                      <>
                        <div className={styles.infoMessage}>
                          <Info size={20} className={styles.infoIcon} />
                          <p className={styles.infoText}>
                            Entrez votre numéro de téléphone associé à votre compte BaridiMob. 
                            Vous recevrez une notification pour confirmer le paiement dans l'application.
                          </p>
                        </div>
                        
                        <div className={styles.inputGroup}>
                          <label className={styles.inputLabel} htmlFor="phone">
                            Numéro de téléphone
                          </label>
                          <div className={styles.inputWrapper}>
                            <Phone size={18} className={styles.inputIcon} />
                            <input
                              type="tel"
                              id="phone"
                              className={styles.input}
                              placeholder="0X XX XX XX XX"
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              disabled={!isPayable}
                            />
                          </div>
                        </div>
                        
                        <button 
                          className={styles.btnPrimary} 
                          onClick={handlePayment}
                          disabled={!isPayable || !phoneNumber}
                        >
                          <Smartphone size={18} />
                          Continuer avec BaridiMob
                        </button>
                      </>
                    )}
                  </div>
                </section>
              )}

              {/* Action Buttons */}
              <div className={styles['navigation-buttons']}>
                <button
                  className={`${styles.btn} ${styles['btn-outline']}`}
                  onClick={handlePrevious}
                  type="button"
                  disabled={isLoading || !idProc}
                >
                  <FiChevronLeft className={styles['btn-icon']} />
                  Précédent
                </button>

                <button
                  className={styles.btnSave}
                  onClick={handleSaveEtape}
                  type="button"
                  disabled={
                    savingEtape ||
                    isLoading ||
                    !idProc ||
                    !isPaymentFormComplete ||
                    isStepSaved
                  }
                >
                  <BsSave className={styles.btnIcon} />
                  {savingEtape ? "Sauvegarde en cours..." : "Sauvegarder l'étape"}
                </button>

                <button
                  className={`${styles.btn} ${styles['btn-primary']}`}
                  disabled={isPaymentDisabled || !isStepSaved}
                  onClick={handlePayment}
                  type="button"
                >
                  Suivant
                  <FiChevronRight className={styles['btn-icon']} />
                </button>
              </div>

              {etapeMessage && (
                <div className={styles.etapeMessage}>{etapeMessage}</div>
              )}

              {demandeInfo?.statutPaiement === "PAYE" && (
                <div className={styles.successBox}>
                  <Shield size={16} className={styles.securityIcon} />
                  Paiement enregistré. Un reçu sera disponible ici.
                </div>
              )}

              {/* Security Footer */}
              <div className={styles.securityFooter}>
                <Shield size={16} className={styles.securityIcon} />
                <span>Paiement sécurisé et crypté SSL</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Paiement;
