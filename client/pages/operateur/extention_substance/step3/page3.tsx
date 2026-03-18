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
import axios from "axios";
import styles from "./Paiement.module.css";
import Navbar from "../../../navbar/Navbar";
import Sidebar from "../../../sidebar/Sidebar";
import { useViewNavigator } from "../../../../src/hooks/useViewNavigator";
import { useSearchParams } from "@/src/hooks/useSearchParams";
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
  localisation: string;
  superficie: number | null;
  substances: string[];
};

const Paiement = () => {
  const { currentView, navigateTo } = useViewNavigator("nouvelle-demande");
  const searchParams = useSearchParams();
  const permisIdParam = searchParams?.get("permisId");
  const parsedPermisId = permisIdParam ? Number(permisIdParam) : Number.NaN;
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [demandeInfo, setDemandeInfo] = useState<DemandePaiement>({
    codeDemande: "--",
    typeProcedure: "--",
    montant: 0,
    statutPaiement: "EN_ATTENTE",
    localisation: "--",
    superficie: null,
    substances: [],
  });
  const [idProc, setIdProc] = useState<string | null>(null);
  const [idDemande, setIdDemande] = useState<string | null>(null);
  const [detectedPermisId, setDetectedPermisId] = useState<number | null>(null);
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
  const resolvedPermisId =
    Number.isFinite(parsedPermisId) ? parsedPermisId : detectedPermisId;

  useEffect(() => {
    const raw =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("id") : null;
    setIdProc(raw);
  }, []);

  const coerceNumber = (value: any): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/[\s\u00A0\u202F]/g, "").replace(",", ".");
      const num = Number(cleaned);
      if (Number.isFinite(num)) return num;
    }
    return null;
  };

  const resolveTypeProcedure = (payload: any): string | null => {
    return (
      payload?.typeProcedure?.libelle ||
      payload?.typeProcedure?.label ||
      payload?.typeProcedure?.lib_type ||
      payload?.type_procedure ||
      payload?.demande?.typeProcedure?.libelle ||
      payload?.demande?.typeProcedure?.label ||
      payload?.demande?.typeProcedure?.lib_type ||
      payload?.demande?.type_procedure ||
      payload?.typePermis?.lib_type ||
      payload?.typePermis?.libelle ||
      payload?.typePermis?.code_type ||
      null
    );
  };

  const normalizeStatus = (value: any): PaymentStatus => {
    const raw = String(value ?? "").toUpperCase();
    if (raw.includes("PAY")) return "PAYE";
    if (raw.includes("ANNUL") || raw.includes("ERREUR")) return "EN_ERREUR";
    return "EN_ATTENTE";
  };

  const pickName = (obj: any, keys: string[]): string | null => {
    if (!obj) return null;
    if (typeof obj === "string" && obj.trim() !== "") return obj.trim();
    for (const key of keys) {
      const value = obj?.[key];
      if (typeof value === "string" && value.trim() !== "") return value.trim();
    }
    return null;
  };

  const extractNames = (list: any[] | undefined | null, keys: string[]): string[] => {
    if (!Array.isArray(list)) return [];
    const values = list
      .map((item) => pickName(item, keys) || (typeof item === "string" ? item.trim() : null))
      .filter((value): value is string => !!value && value.trim() !== "");
    return Array.from(new Set(values));
  };

  const formatListShort = (items: string[]): string | null => {
    const list = items.filter((value) => typeof value === "string" && value.trim() !== "");
    if (!list.length) return null;
    if (list.length === 1) return list[0];
    return `${list[0]} et ${list.length - 1} autres`;
  };

  const buildLocationText = (payload: any): string | null => {
    const commune =
      formatListShort(
        extractNames(payload?.communes, ["nom_communeFR", "nom_commune", "lib_commune", "nom"]),
      ) ?? pickName(payload?.commune, ["nom_communeFR", "nom_commune", "lib_commune", "nom"]);
    const daira =
      formatListShort(extractNames(payload?.dairas, ["nom_dairaFR", "nom_daira", "lib_daira", "nom"])) ??
      pickName(payload?.daira, ["nom_dairaFR", "nom_daira", "lib_daira", "nom"]);
    const wilaya =
      formatListShort(
        extractNames(payload?.wilayas, ["nom_wilayaFR", "nom_wilaya", "lib_wilaya", "nom"]),
      ) ?? pickName(payload?.wilaya, ["nom_wilayaFR", "nom_wilaya", "lib_wilaya", "nom"]);
    const parts = [commune, daira, wilaya].filter((value): value is string => !!value);
    return parts.length ? parts.join(", ") : null;
  };

  const normalizeSubstances = (items: any[] = []): string[] => {
    const sorted = [...items].sort((a, b) => {
      const pa = String(a?.priorite || "").toLowerCase() === "principale" ? 0 : 1;
      const pb = String(b?.priorite || "").toLowerCase() === "principale" ? 0 : 1;
      return pa - pb;
    });
    const names = sorted
      .map(
        (item) =>
          item?.nom_subFR ||
          item?.nom_subAR ||
          item?.nom_sub ||
          item?.libelle ||
          item?.nom ||
          (typeof item === "string" ? item : null),
      )
      .filter((value: any) => typeof value === "string" && value.trim() !== "");
    return Array.from(new Set(names));
  };

  const mergeUniqueStrings = (base?: string[] | null, next?: string[] | null): string[] => {
    const values = [...(base ?? []), ...(next ?? [])]
      .filter((value): value is string => typeof value === "string" && value.trim() !== "")
      .map((value) => value.trim());
    return Array.from(new Set(values));
  };

  const extractSuperficie = (payload: any): number | null =>
    coerceNumber(payload?.superficie_cadastrale) ??
    coerceNumber(payload?.superficie_cadastrale_ha) ??
    coerceNumber(payload?.superficie_declaree) ??
    coerceNumber(payload?.superficieDeclaree) ??
    coerceNumber(payload?.superficie_calculee) ??
    coerceNumber(payload?.superficie_sig) ??
    coerceNumber(payload?.superficie_ha) ??
    coerceNumber(payload?.superficieHa) ??
    coerceNumber(payload?.superficie_officielle) ??
    coerceNumber(payload?.superficie);

  const mergeDemandeInfo = (next: Partial<DemandePaiement>) => {
    setDemandeInfo((prev) => {
      const base = prev ?? {
        codeDemande: "--",
        typeProcedure: "--",
        montant: 0,
        statutPaiement: "EN_ATTENTE" as PaymentStatus,
        localisation: "--",
        superficie: null,
        substances: [],
      };
      return {
        ...base,
        ...next,
        substances: mergeUniqueStrings(base.substances, next.substances),
      };
    });
  };

  useEffect(() => {
    if (!idProc || !apiURL) return;
    let active = true;
    const controller = new AbortController();

    const loadFacture = async (demandeId: number) => {
      try {
        const res = await axios.get(`${apiURL}/api/facture/demande/${demandeId}`, {
          signal: controller.signal,
        });
        return res.data?.facture ?? res.data ?? null;
      } catch (error) {
        if (axios.isCancel(error)) throw error;
        try {
          const generated = await axios.post(
            `${apiURL}/api/facture/investisseur/generer`,
            { id_demande: demandeId },
            { withCredentials: true, signal: controller.signal },
          );
          return generated.data?.facture ?? generated.data ?? null;
        } catch (err) {
          if (axios.isCancel(err)) throw err;
        }
      }
      return null;
    };

    const load = async () => {
      try {
        const res = await axios.get(`${apiURL}/api/procedures/${idProc}/demande`, {
          signal: controller.signal,
        });
        if (!active) return;
        const payload = res.data ?? {};
        const demandeId =
          payload?.id_demande ?? payload?.idDemande ?? payload?.demande?.id_demande;
        if (demandeId != null) {
          setIdDemande(String(demandeId));
        }
        const payloadPermisId = Number(
          payload?.id_permis ?? payload?.demande?.id_permis ?? payload?.idPermis,
        );
        if (Number.isFinite(payloadPermisId)) {
          setDetectedPermisId(payloadPermisId);
        }
        const codeDemande =
          payload?.code_demande ??
          payload?.codeDemande ??
          payload?.demande?.code_demande ??
          payload?.demande?.codeDemande ??
          (idProc ? `DEM-${idProc}` : "--");
        const typeProcedure = resolveTypeProcedure(payload);
        const localisation = buildLocationText(payload);
        const superficie = extractSuperficie(payload);
        const substances = normalizeSubstances(payload?.substances ?? []);

        mergeDemandeInfo({
          codeDemande: codeDemande ?? "--",
          typeProcedure: typeProcedure ?? "--",
          localisation: localisation ?? "--",
          superficie,
          substances,
        });

        if (demandeId != null) {
          const facture = await loadFacture(Number(demandeId));
          if (!active || !facture) return;
          const montant =
            coerceNumber(facture?.montant_total) ??
            coerceNumber(facture?.montantTotal) ??
            coerceNumber(facture?.montant);
          const statut = normalizeStatus(
            facture?.statut ?? facture?.statut_facture ?? facture?.statutFacture,
          );
          mergeDemandeInfo({
            codeDemande: codeDemande ?? "--",
            typeProcedure: typeProcedure ?? "--",
            montant: montant ?? 0,
            statutPaiement: statut,
          });
        }
      } catch (error) {
        if (axios.isCancel(error)) return;
      } finally {
        if (!active) return;
      }
    };

    load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [idProc, apiURL]);

  useEffect(() => {
    if (!resolvedPermisId || !apiURL) return;
    const controller = new AbortController();
    const loadPermisBase = async () => {
      try {
        const res = await axios.get(`${apiURL}/operateur/permis/${resolvedPermisId}`, {
          withCredentials: true,
          signal: controller.signal,
        });
        const payload = res.data ?? {};
        const localisation =
          buildLocationText(payload?.localisation_officielle ?? payload) ??
          buildLocationText(payload) ??
          "--";
        const superficie = extractSuperficie(payload);
        const substances = Array.isArray(payload?.substances_officielles)
          ? mergeUniqueStrings(payload.substances_officielles, [])
          : normalizeSubstances(
              (payload?.procedure_officielle?.SubstanceAssocieeDemande ?? []).map(
                (assoc: any) => assoc?.substance ?? assoc,
              ),
            );
        mergeDemandeInfo({
          localisation,
          superficie,
          substances,
        });
      } catch (error) {
        if (!axios.isCancel(error)) {
          console.warn("[Paiement] permit fallback fetch failed", error);
        }
      }
    };
    loadPermisBase();
    return () => controller.abort();
  }, [resolvedPermisId, apiURL]);

  useEffect(() => {
    if (!idDemande || !apiURL) return;
    const controller = new AbortController();
    const loadSubstances = async () => {
      try {
        const res = await axios.get(`${apiURL}/api/substances/demande/${idDemande}`, {
          signal: controller.signal,
        });
        const list = normalizeSubstances(Array.isArray(res.data) ? res.data : []);
        if (list.length) {
          mergeDemandeInfo({ substances: list });
        }
      } catch (error) {
        if (!axios.isCancel(error)) {
          console.warn("[Paiement] demande substances fetch failed", error);
        }
      }
    };
    loadSubstances();
    return () => controller.abort();
  }, [idDemande, apiURL]);

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

  // Demande data is loaded separately for paiement details.

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
    const pathname = "operateur/extention_substance/step3/page3";
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
      return route === target || route.endsWith(target) || route.includes("step3/page3");
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
      const permisParam = searchParams?.get('permisId');
      router.push(
        `/operateur/extention_substance/step2/page2?id=${idProc}${permisParam ? `&permisId=${permisParam}` : ''}`,
      );
    } else {
      router.push('/operateur/extention_substance/step2/page2');
    }
  };

  const handleSaveEtape = async () => {
    if (!idProc) {
      setEtapeMessage("ID de proc?dure manquant");
      return false;
    }
    const etapeId = etapeIdForThisPage ?? currentStep;
    if (!etapeId) {
      setEtapeMessage(
        "Étape introuvable. Vérifiez le page_route en base (step3/page3).",
      );
      return false;
    }
    setSavingEtape(true);
    setEtapeMessage(null);
    try {
      await axios.post(`${apiURL}/api/procedure-etape/finish/${idProc}/${etapeId}`, undefined, {
        withCredentials: true,
      });
      setEtapeMessage("?tape enregistr?e avec succ?s");
      setRefetchTrigger((prev) => prev + 1);
      return true;
    } catch (err) {
      console.error("Erreur sauvegarde ?tape", err);
      setEtapeMessage("Erreur lors de l'enregistrement de l'?tape");
      return false;
    } finally {
      setSavingEtape(false);
    }
  };

  const handlePayment = async () => {
    if (!isPayable || !selectedMethod) return;
    const saved = await handleSaveEtape();
    if (!saved) return;
    setDemandeInfo((prev) =>
      prev ? { ...prev, statutPaiement: "PAYE" } : prev,
    );
    if (idProc) {
      const permisParam = searchParams?.get('permisId');
      router.push(
        `/operateur/extention_substance/step3/confirmationpay?id=${idProc}${permisParam ? `&permisId=${permisParam}` : ''}`,
      );
    }
  };

  const handleCardRedirect = async () => {
    if (!isPayable) return;
    const saved = await handleSaveEtape();
    if (!saved) return;
    if (idProc) {
      const permisParam = searchParams?.get('permisId');
      router.push(
        `/operateur/extention_substance/step3/paiementadahabia?id=${idProc}${permisParam ? `&permisId=${permisParam}` : ''}`,
      );
      return;
    }
    router.push('/operateur/extention_substance/step3/paiementadahabia');
  };

  const isPaymentDisabled = !isPaymentFormComplete;

  const formatMontant = (val?: number) =>
    typeof val === "number" && Number.isFinite(val) && val > 0
      ? val.toLocaleString("fr-DZ", { minimumFractionDigits: 0 })
      : "--";

  const superficieText =
    demandeInfo?.superficie != null && Number.isFinite(demandeInfo.superficie)
      ? `${demandeInfo.superficie.toFixed(2)} ha`
      : "--";
  const substancesText =
    demandeInfo?.substances && demandeInfo.substances.length > 0
      ? demandeInfo.substances.join(", ")
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
                        `/operateur/extention_substance/step2/page2?id=${idProc}`,
                      )
                    : router.push('/operateur/extention_substance/step2/page2')
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
                    <span className={styles.summaryLabel}>Localisation</span>
                    <span className={styles.summaryValue}>{demandeInfo?.localisation ?? "--"}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Superficie</span>
                    <span className={styles.summaryValue}>{superficieText}</span>
                  </div>
                  <div className={styles.summaryItem}>
                    <span className={styles.summaryLabel}>Substances</span>
                    <span className={styles.summaryValue}>{substancesText}</span>
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
                  className={`${styles.btn} ${styles['btn-primary']}`}
                  disabled={isPaymentDisabled || savingEtape}
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

