import router from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  Building2,
  MapPin,
  Gem,
  Download,
  ArrowLeft,
  CreditCard,
} from "lucide-react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import axios from "axios";
import styles from "./facture.module.css";
import Navbar from "../../../navbar/Navbar";
import Sidebar from "../../../sidebar/Sidebar";
import { useViewNavigator } from "../../../../src/hooks/useViewNavigator";
import { useActivateEtape } from "@/src/hooks/useActivateEtape";
import ProgressStepper from "../../../../components/ProgressStepper";
import { Phase, Procedure, ProcedureEtape, ProcedurePhase } from "@/src/types/procedure";

type MontantRow = {
  poste: string;
  base: string;
  montant: number;
  isTotal?: boolean;
};

type DemandeDisplay = {
  codeDemande?: string | null;
  typeProcedure?: string | null;
  typePermis?: string | null;
  societe?: string | null;
  commune?: string | null;
  daira?: string | null;
  wilaya?: string | null;
  communes?: string[] | null;
  dairas?: string[] | null;
  wilayas?: string[] | null;
  superficie?: number | null;
  substances?: string[] | null;
};

const Facture = () => {
  const { currentView, navigateTo } = useViewNavigator("nouvelle-demande");
  const [idProc, setIdProc] = useState<number | undefined>(undefined);
  const [idDemande, setIdDemande] = useState<string | null>(null);
  const [demandeInfo, setDemandeInfo] = useState<DemandeDisplay | null>(null);
  const [factureData, setFactureData] = useState<any | null>(null);
  const [factureLines, setFactureLines] = useState<MontantRow[]>([]);
  const [procedureData, setProcedureData] = useState<Procedure | null>(null);
  const [procedureTypeId, setProcedureTypeId] = useState<number | undefined>(undefined);
  const [currentStep, setCurrentStep] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isFactureLoading, setIsFactureLoading] = useState(false);
  const [isPageReady, setIsPageReady] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [etapeMessage, setEtapeMessage] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const abortControllerRef = useRef<AbortController | null>(null);

  const coerceNumber = (value: any): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const cleaned = value
        .replace(/[\s\u00A0\u202F]/g, "")
        .replace(",", ".");
      const num = Number(cleaned);
      if (Number.isFinite(num)) return num;
    }
    return null;
  };

  const pickName = (obj: any, keys: string[]): string | null => {
    if (!obj) return null;
    if (typeof obj === "string") return obj;
    for (const key of keys) {
      const val = obj?.[key];
      if (typeof val === "string" && val.trim() !== "") return val;
    }
    return null;
  };

  const extractNames = (list: any[] | undefined | null, keys: string[]): string[] | null => {
    if (!Array.isArray(list)) return null;
    const names = list
      .map((item) => pickName(item, keys) || (typeof item === "string" ? item : null))
      .filter((v): v is string => !!v && v.trim() !== "");
    return names.length ? Array.from(new Set(names)) : null;
  };

  const normalizeSubstances = (items: any[] = []): string[] => {
    const sorted = [...items].sort((a, b) => {
      const pa = String(a?.priorite || "").toLowerCase() === "principale" ? 0 : 1;
      const pb = String(b?.priorite || "").toLowerCase() === "principale" ? 0 : 1;
      return pa - pb;
    });
    const names = sorted
      .map((item) => item?.nom_subFR || item?.nom_subAR || item?.nom_sub || item?.libelle || item?.nom)
      .filter((v: any) => typeof v === "string" && v.trim() !== "");
    return Array.from(new Set(names));
  };

  const normalizeLines = (rows: any[] = []): MontantRow[] => {
    return rows.map((row: any) => ({
      poste:
        row?.poste ||
        row?.libelle ||
        row?.label ||
        row?.designation ||
        "Poste",
      base:
        row?.base ||
        row?.base_calcul ||
        row?.description ||
        row?.regle ||
        row?.note ||
        "",
      montant: coerceNumber(row?.montant) ?? coerceNumber(row?.total) ?? 0,
      isTotal: Boolean(row?.isTotal || row?.is_total || row?.total),
    }));
  };

  const formatPersonName = (obj: any): string | null => {
    if (!obj) return null;
    if (typeof obj === "string") return obj;
    const company = pickName(obj, [
      "nom_societeFR",
      "nom_societeAR",
      "nom_societe",
      "raison_sociale",
      "nom_entreprise",
      "nomEntreprise",
    ]);
    if (company) return company;
    const nom = pickName(obj, ["nom", "nom_fr", "nom_ar", "nom_responsable", "nom_gerant"]);
    const prenom = pickName(obj, ["prenom", "prenom_fr", "prenom_ar"]);
    if (nom && prenom) return `${nom} ${prenom}`.trim();
    return nom || prenom || null;
  };

  const resolveTitulaire = (payload: any): string | null => {
    const candidates = [
      payload?.titulaire,
      payload?.detenteur,
      payload?.detenteurdemande?.[0]?.detenteur,
      payload?.demandeur,
      payload?.societe,
      payload?.entreprise,
      payload?.personne_morale,
      payload?.personneMorale,
      payload?.personne_physique,
      payload?.personnePhysique,
    ];
    for (const candidate of candidates) {
      const name = formatPersonName(candidate);
      if (name) return name;
    }
    return null;
  };

  const mergeDemandeInfo = (next: Partial<DemandeDisplay>) => {
    setDemandeInfo((prev) => {
      const cleaned: Partial<DemandeDisplay> = {};
      Object.entries(next).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "") {
          (cleaned as any)[key] = value;
        }
      });
      return { ...prev, ...cleaned };
    });
  };

  // Récupération de l'id_proc depuis l'URL
  useEffect(() => {
    const raw =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("id") : null;
    if (raw) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) setIdProc(parsed);
    }
  }, []);
  useEffect(() => {
    if (idProc != null) {
      console.log("[Facture] idProc =", idProc);
    }
  }, [idProc]);

  // Chargement de la procédure (phases + étape courante)
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
        const typeId = res.data?.demandes?.[0]?.id_typeProc;
        if (typeId) setProcedureTypeId(typeId);
        const demandeId = res.data?.demandes?.[0]?.id_demande;
        if (demandeId && !idDemande) {
          setIdDemande(demandeId.toString());
        }
        const active = res.data?.ProcedureEtape?.find(
          (pe: ProcedureEtape) => pe.statut === "EN_COURS",
        );
        if (active?.id_etape) {
          setCurrentStep(active.id_etape);
        }
      } catch (error) {
        if (axios.isCancel(error)) return;
        console.error("Erreur de chargement de la procédure", error);
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
  }, [idProc, apiURL, refetchTrigger, idDemande]);
  useEffect(() => {
    if (!procedureData) return;
    console.log("[Facture] procedureData loaded", {
      procedureId: procedureData.id_proc,
      phases: procedureData.ProcedurePhase?.length ?? 0,
      etapes: procedureData.ProcedureEtape?.length ?? 0,
    });
  }, [procedureData]);

  // Chargement de la demande
  useEffect(() => {
    if (!idProc || !procedureData || !apiURL) return;

    const fetchDemandeData = async () => {
      abortControllerRef.current = new AbortController();
      try {
        const res = await axios.get(`${apiURL}/api/procedures/${idProc}/demande`, {
          signal: abortControllerRef.current.signal,
        });
        const payload = res.data ?? {};
        console.log("[Facture] demande response", payload);
        if (res.data?.id_demande != null) {
          setIdDemande(res.data.id_demande.toString());
        }
        const societe = resolveTitulaire(payload);
        const commune = pickName(payload.commune, [
          "nom_communeFR",
          "nom_commune",
          "lib_commune",
          "nom",
        ]);
        const daira = pickName(payload.daira, [
          "nom_dairaFR",
          "nom_daira",
          "lib_daira",
          "nom",
        ]);
        const wilaya = pickName(payload.wilaya, [
          "nom_wilayaFR",
          "nom_wilaya",
          "lib_wilaya",
          "nom",
        ]);
        const communes = extractNames(payload.communes, [
          "nom_communeFR",
          "nom_commune",
          "lib_commune",
          "nom",
        ]);
        const dairas = extractNames(payload.dairas, [
          "nom_dairaFR",
          "nom_daira",
          "lib_daira",
          "nom",
        ]);
        const wilayas = extractNames(payload.wilayas, [
          "nom_wilayaFR",
          "nom_wilaya",
          "lib_wilaya",
          "nom",
        ]);
        const superficie =
          coerceNumber(payload.superficie_cadastrale) ??
          coerceNumber(payload.superficie_cadastrale_ha) ??
          coerceNumber(payload.superficie_declaree) ??
          coerceNumber(payload.superficieDeclaree) ??
          coerceNumber(payload.superficie_calculee) ??
          coerceNumber(payload.superficie_sig) ??
          coerceNumber(payload.superficie_ha) ??
          coerceNumber(payload.superficieHa) ??
          coerceNumber(payload.superficie);
        const substances = Array.isArray(payload.substances)
          ? payload.substances.map((item: any) =>
              item?.libelle ?? item?.nom ?? String(item),
            )
          : null;
        const typeProcedure =
          payload.typeProcedure?.libelle ||
          payload.typeProcedure?.label ||
          payload.typeProcedure?.lib_type ||
          payload.type_procedure ||
          null;
        const typePermis =
          payload.typePermis?.lib_type ||
          payload.typePermis?.libelle ||
          payload.typePermis?.label ||
          payload.typePermis?.code_type ||
          null;

        mergeDemandeInfo({
          codeDemande: payload.code_demande ?? null,
          typeProcedure,
          typePermis,
          societe,
          commune,
          daira,
          wilaya,
          communes,
          dairas,
          wilayas,
          superficie,
          substances,
        });
      } catch (error) {
        if (axios.isCancel(error)) return;
        console.error("Erreur lors de la récupération de la demande", error);
      }
    };

    fetchDemandeData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [idProc, procedureData, apiURL, refetchTrigger]);
  useEffect(() => {
    if (idDemande) {
      console.log("[Facture] idDemande =", idDemande);
    }
  }, [idDemande]);

  useEffect(() => {
    if (!idDemande || !apiURL) return;
    const controller = new AbortController();
    const loadSummary = async () => {
      try {
        const res = await axios.get(`${apiURL}/api/demande/${idDemande}/summary`, {
          signal: controller.signal,
        });
        const payload = res.data ?? {};
        const societe = resolveTitulaire(payload);
        const commune = pickName(payload.commune, [
          "nom_communeFR",
          "nom_commune",
          "lib_commune",
          "nom",
        ]);
        const daira = pickName(payload.daira, [
          "nom_dairaFR",
          "nom_daira",
          "lib_daira",
          "nom",
        ]);
        const wilaya = pickName(payload.wilaya, [
          "nom_wilayaFR",
          "nom_wilaya",
          "lib_wilaya",
          "nom",
        ]);
        const communes = extractNames(payload.communes, [
          "nom_communeFR",
          "nom_commune",
          "lib_commune",
          "nom",
        ]);
        const dairas = extractNames(payload.dairas, [
          "nom_dairaFR",
          "nom_daira",
          "lib_daira",
          "nom",
        ]);
        const wilayas = extractNames(payload.wilayas, [
          "nom_wilayaFR",
          "nom_wilaya",
          "lib_wilaya",
          "nom",
        ]);
        const superficie =
          coerceNumber(payload.superficie_cadastrale) ??
          coerceNumber(payload.superficie_cadastrale_ha) ??
          coerceNumber(payload.superficie_declaree) ??
          coerceNumber(payload.superficieDeclaree) ??
          coerceNumber(payload.superficie_calculee) ??
          coerceNumber(payload.superficie_sig) ??
          coerceNumber(payload.superficie_ha) ??
          coerceNumber(payload.superficieHa) ??
          coerceNumber(payload.superficie);
        const typeProcedure =
          payload.typeProcedure?.libelle ||
          payload.typeProcedure?.label ||
          payload.typeProcedure?.lib_type ||
          payload.type_procedure ||
          null;
        const typePermis =
          payload.typePermis?.lib_type ||
          payload.typePermis?.libelle ||
          payload.typePermis?.label ||
          payload.typePermis?.code_type ||
          null;

        mergeDemandeInfo({
          codeDemande: payload.code_demande ?? payload.codeDemande ?? null,
          typeProcedure,
          typePermis,
          societe,
          commune,
          daira,
          wilaya,
          communes,
          dairas,
          wilayas,
          superficie,
        });
      } catch (error) {
        if (!axios.isCancel(error)) {
          console.warn("[Facture] summary fetch failed", error);
        }
      }
    };
    loadSummary();
    return () => controller.abort();
  }, [idDemande, apiURL]);

  useEffect(() => {
    if (!apiURL || demandeInfo?.societe) return;
    const controller = new AbortController();
    const loadEntrepriseProfile = async () => {
      try {
        const res = await axios.get(`${apiURL}/api/profil/entreprise`, {
          signal: controller.signal,
          withCredentials: true,
        });
        const societe = resolveTitulaire(res.data ?? {});
        if (societe) {
          mergeDemandeInfo({ societe });
        }
      } catch (error) {
        if (!axios.isCancel(error)) {
          console.warn("[Facture] profil entreprise fetch failed", error);
        }
      }
    };
    loadEntrepriseProfile();
    return () => controller.abort();
  }, [apiURL, demandeInfo?.societe]);

  useEffect(() => {
    if (!idProc || !apiURL) return;
    const controller = new AbortController();
    const loadProvisional = async () => {
      try {
        const res = await axios.get(`${apiURL}/inscription-provisoire/procedure/${idProc}`, {
          signal: controller.signal,
        });
        const superficie =
          coerceNumber(res.data?.superficie_declaree) ??
          coerceNumber(res.data?.superficie);
        if (superficie != null) {
          mergeDemandeInfo({ superficie });
        }
      } catch (error) {
        if (!axios.isCancel(error)) {
          console.warn("[Facture] provisional fetch failed", error);
        }
      }
    };
    loadProvisional();
    return () => controller.abort();
  }, [idProc, apiURL]);

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
          console.warn("[Facture] substances fetch failed", error);
        }
      }
    };
    loadSubstances();
    return () => controller.abort();
  }, [idDemande, apiURL]);

  useEffect(() => {
    if (!idDemande || !apiURL) return;
    const controller = new AbortController();
    const loadVerification = async () => {
      try {
        const res = await axios.get(`${apiURL}/verification-geo/demande/${idDemande}`, {
          signal: controller.signal,
        });
        const superficie = coerceNumber(res.data?.superficie_cadastrale);
        if (superficie != null) {
          mergeDemandeInfo({ superficie });
        }
      } catch (error) {
        if (!axios.isCancel(error)) {
          console.warn("[Facture] verification fetch failed", error);
        }
      }
    };
    loadVerification();
    return () => controller.abort();
  }, [idDemande, apiURL]);

  useEffect(() => {
    if (!idDemande || !apiURL) return;

    const controller = new AbortController();
    const loadFacture = async () => {
      setIsFactureLoading(true);
      try {
        const res = await axios.get(`${apiURL}/api/facture/demande/${idDemande}`, {
          signal: controller.signal,
        });
        console.log("[Facture] facture get", res.data);
        if (res.data?.facture) {
          setFactureData(res.data.facture);
          setFactureLines(normalizeLines(res.data.lignes ?? []));
        } else {
          const generated = await axios.post(
            `${apiURL}/api/facture/investisseur/generer`,
            { id_demande: Number(idDemande) },
            { signal: controller.signal },
          );
          console.log("[Facture] facture generated", generated.data);
          setFactureData(generated.data?.facture ?? null);
          setFactureLines(normalizeLines(generated.data?.lignes ?? []));
        }
      } catch (error) {
        if (axios.isCancel(error)) return;
        console.error("[Facture] erreur facture", error);
      } finally {
        setIsFactureLoading(false);
      }
    };

    loadFacture();

    return () => {
      controller.abort();
    };
  }, [idDemande, apiURL, refetchTrigger]);

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

  // Resolve the backend etape id for this page using page_route (fallback to label)
  const etapeIdForThisPage = useMemo(() => {
    if (!procedureData) return null;
    const pathname = "investisseur/nouvelle_demande/step11/page11";
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
      return route === target || route.endsWith(target) || route.includes("step11/page11");
    });
    if (byRoute) return byRoute.id_etape;
    const allEtapes = [
      ...phaseEtapes,
      ...((procedureData.ProcedureEtape || []).map((pe: any) => pe.etape).filter(Boolean) as any[]),
    ];
    const byLabel = allEtapes.find((e: any) =>
      String(e?.lib_etape ?? "").toLowerCase().includes("facture"),
    );
    return byLabel?.id_etape ?? null;
  }, [procedureData]);
  useEffect(() => {
    console.log("[Facture] etapeIdForThisPage =", etapeIdForThisPage);
  }, [etapeIdForThisPage]);


  const checkRequiredData = useCallback(() => {
    return (
      !!idProc &&
      !!procedureData &&
      !!idDemande &&
      !isLoading &&
      !isFactureLoading
    );
  }, [idProc, procedureData, idDemande, isLoading, isFactureLoading]);

  useEffect(() => {
    if (checkRequiredData()) {
      setIsPageReady(true);
    }
  }, [checkRequiredData]);
  useEffect(() => {
    console.log("[Facture] readiness", {
      idProc: !!idProc,
      procedureData: !!procedureData,
      idDemande: !!idDemande,
      phases: phases.length,
      etapeIdForThisPage,
      isLoading,
      isFactureLoading,
      ready: checkRequiredData(),
    });
  }, [
    idProc,
    procedureData,
    idDemande,
    phases.length,
    etapeIdForThisPage,
    isLoading,
    isFactureLoading,
    checkRequiredData,
  ]);

  useEffect(() => {
    if (etapeIdForThisPage && currentStep !== etapeIdForThisPage) {
      setCurrentStep(etapeIdForThisPage);
    }
  }, [etapeIdForThisPage, currentStep]);

  useActivateEtape({
    idProc,
    etapeNum: etapeIdForThisPage ?? 0,
    shouldActivate: isPageReady && !!etapeIdForThisPage,
    onActivationSuccess: () => {
      setRefetchTrigger((prev) => prev + 1);
    },
  });

  // Calcul dynamique des montants (à remplacer par backend si dispo)
  const fallbackLines: MontantRow[] = useMemo(
    () => [
      {
        poste: "Frais d'inscription et d'etude de dossier",
        base: "Montant fixe pour nouvelle demande de permis",
        montant: 215000,
        isTotal: true,
      },
    ],
    [],
  );
  const montants = factureLines.length > 0 ? factureLines : fallbackLines;
  const totalAmount =
    factureData?.montant_total ?? montants.find((m) => m.isTotal)?.montant ?? 0;

  const formatMontant = (value: number) => {
    return new Intl.NumberFormat("fr-DZ").format(value) + " DA";
  };

  const formatDateDisplay = (value: any) => {
    if (!value) return "--";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("fr-DZ");
  };

  const factureNumber = factureData?.numero_facture ?? factureData?.numeroFacture ?? "--";
  const factureDate = formatDateDisplay(
    factureData?.date_emission ?? factureData?.dateEmission ?? factureData?.created_at ?? null,
  );

  const formatListShort = (items?: string[] | null) => {
    const list = (items ?? []).filter((v) => typeof v === "string" && v.trim() !== "");
    if (!list.length) return null;
    if (list.length === 1) return list[0];
    return `${list[0]} et ${list.length - 1} autres`;
  };

  const locationText = useMemo(() => {
    const communeText = formatListShort(demandeInfo?.communes) ?? demandeInfo?.commune ?? null;
    const dairaText = formatListShort(demandeInfo?.dairas) ?? demandeInfo?.daira ?? null;
    const wilayaText = formatListShort(demandeInfo?.wilayas) ?? demandeInfo?.wilaya ?? null;
    const parts = [communeText, dairaText, wilayaText].filter(Boolean) as string[];
    return parts.length ? parts.join(", ") : "--";
  }, [demandeInfo]);

  const substancesText = useMemo(() => {
    if (demandeInfo?.substances && demandeInfo.substances.length > 0) {
      return demandeInfo.substances.join(", ");
    }
    return "--";
  }, [demandeInfo]);

  const superficieText = useMemo(() => {
    if (demandeInfo?.superficie != null && Number.isFinite(demandeInfo.superficie)) {
      return `${demandeInfo.superficie.toFixed(2)} ha`;
    }
    return "--";
  }, [demandeInfo]);

  const handleDownloadPDF = async () => {
    if (!apiURL) {
      setDownloadMessage("API non configuree");
      return;
    }
    setDownloadMessage(null);
    try {
      let factureId = factureData?.id_facture;
      if (!factureId && idDemande) {
        const generated = await axios.post(
          `${apiURL}/api/facture/investisseur/generer`,
          { id_demande: Number(idDemande) },
          { withCredentials: true },
        );
        factureId = generated.data?.facture?.id_facture;
        if (generated.data?.facture) {
          setFactureData(generated.data.facture);
        }
        if (Array.isArray(generated.data?.lignes)) {
          setFactureLines(normalizeLines(generated.data.lignes));
        }
      }

      if (!factureId) {
        setDownloadMessage("Facture introuvable");
        return;
      }

      const url = `${apiURL}/api/facture/${factureId}/pdf`;
      window.open(url, "_blank");
    } catch (error) {
      console.error("[Facture] erreur telechargement PDF", error);
      setDownloadMessage("Erreur lors du telechargement du PDF");
    }
  };

  const handleBack = () => {
    if (idProc) {
      router.push(`/investisseur/nouvelle_demande/step1/page1?id=${idProc}`);
    } else {
      router.push(`/investisseur/nouvelle_demande/step1/page1`);
    }
  };

  const handleConfirm = async () => {
    if (!idProc) {
      setConfirmMessage("ID de procedure manquant");
      return;
    }
    if (!apiURL) {
      setConfirmMessage("API non configuree");
      return;
    }

    const etapeId = etapeIdForThisPage ?? currentStep;
    if (!etapeId) {
      setConfirmMessage(
        "?tape introuvable. V?rifiez le page_route en base (step11/page11).",
      );
      return;
    }

    setIsConfirming(true);
    setConfirmMessage(null);
    try {
      let factureId = factureData?.id_facture;
      if (!factureId && idDemande) {
        const generated = await axios.post(
          `${apiURL}/api/facture/investisseur/generer`,
          { id_demande: Number(idDemande) },
          { withCredentials: true },
        );
        factureId = generated.data?.facture?.id_facture;
        if (generated.data?.facture) {
          setFactureData(generated.data.facture);
        }
        if (Array.isArray(generated.data?.lignes)) {
          setFactureLines(normalizeLines(generated.data.lignes));
        }
      }

      if (factureId) {
        const emitted = await axios.post(
          `${apiURL}/api/facture/${factureId}/emettre`,
          undefined,
          { withCredentials: true },
        );
        if (emitted.data?.facture) {
          setFactureData(emitted.data.facture);
        }
      }

      await axios.post(
        `${apiURL}/api/procedure-etape/finish/${idProc}/${etapeId}`,
        undefined,
        { withCredentials: true },
      );
      setRefetchTrigger((prev) => prev + 1);

      router.push(`/investisseur/nouvelle_demande/step12/page12?id=${idProc}`);
    } catch (error) {
      console.error("[Facture] erreur confirmation facture", error);
      setConfirmMessage("Erreur lors de la confirmation de la facture");
    } finally {
      setIsConfirming(false);
    }
  };


  if (!isPageReady) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}></div>
        <p>Chargement de la facture...</p>
        {!idProc && <p>En attente de l'ID de procédure...</p>}
        {idProc && !procedureData && <p>Chargement des données de procédure...</p>}
        {procedureData && !idDemande && <p>Chargement des données de demande...</p>}
        {idDemande && phases.length === 0 && <p>Chargement des phases et étapes...</p>}
        {idDemande && isFactureLoading && <p>Chargement des données de facture...</p>}
        {procedureData && !etapeIdForThisPage && (
          <p>Etape page_route introuvable: investisseur/nouvelle_demande/step11/page11</p>
        )}
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
              <button className={styles.backLink} onClick={handleBack} type="button">
                <ArrowLeft size={18} />
                Retour à l'étape précédente
              </button>

              {procedureData && (
                <ProgressStepper
                  phases={phases}
                  currentProcedureId={idProc}
                  currentEtapeId={currentStep}
                  procedurePhases={procedureData.ProcedurePhase || []}
                  procedureTypeId={procedureTypeId}
                  procedureEtapes={procedureData.ProcedureEtape || []}
                />
              )}

                <header className={styles.header}>
                  <div className={styles.headerTop}>
                    <div className={styles.brandBlock}>
                      <span className={styles.brandLogo}>SIGAM</span>
                      <span className={styles.brandSubtitle}>
                        Plateforme des demandes minières
                      </span>
                    </div>
                    <div className={styles.invoiceMeta}>
                      <span className={styles.invoiceNumber}>Facture {factureNumber}</span>
                      <span className={styles.invoiceDate}>Émise le {factureDate}</span>
                    </div>
                  </div>
                  <h1 className={styles.title}>Facture à payer</h1>
                  <p className={styles.subtitle}>
                    Récapitulatif des droits et taxes avant paiement
                  </p>
                </header>

                <div className={styles.card}>
                  <h2 className={styles.cardTitle}>
                    <FileText size={20} className={styles.cardIcon} />
                    Informations de la demande
                  </h2>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Code demande</span>
                      <span className={`${styles.infoValue} ${styles.infoValueHighlight}`}>
                        {demandeInfo?.codeDemande ?? "--"}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Type de procédure</span>
                      <span className={styles.infoValue}>{demandeInfo?.typeProcedure ?? "--"}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Type de permis</span>
                      <span className={styles.infoValue}>{demandeInfo?.typePermis ?? "--"}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Titulaire</span>
                      <span className={styles.infoValue}>
                        <Building2 size={14} style={{ display: "inline", marginRight: "0.25rem" }} />
                        {demandeInfo?.societe ?? "--"}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Localisation</span>
                      <span className={styles.infoValue}>
                        <MapPin size={14} style={{ display: "inline", marginRight: "0.25rem" }} />
                        {locationText}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Superficie</span>
                      <span className={styles.infoValue}>
                        {superficieText}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Substances</span>
                      <span className={styles.infoValue}>
                        <Gem size={14} style={{ display: "inline", marginRight: "0.25rem" }} />
                        {substancesText}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.card}>
                  <h2 className={styles.cardTitle}>
                    <CreditCard size={20} className={styles.cardIcon} />
                    Détail des montants
                  </h2>
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Poste</th>
                          <th>Base de calcul</th>
                          <th style={{ textAlign: "right" }}>Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {montants.map((item, index) => (
                          <tr key={index} className={item.isTotal ? styles.totalRow : ""}>
                            <td>{item.poste}</td>
                            <td>{item.base}</td>
                            <td className={styles.amountCell}>{formatMontant(item.montant)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className={styles.downloadSection}>
                    <button className={styles.downloadButton} onClick={handleDownloadPDF}>
                      <Download size={16} />
                      Télécharger la facture (PDF)
                    </button>
                  </div>
                </div>

                <div className={styles.noteCard}>
                  <p className={styles.noteText}>
                    <strong>Note :</strong> Cette facture est un récapitulatif des droits et taxes
                    applicables à votre demande. “Les montants ci-dessus correspondent aux frais d’inscription et d’étude du dossier exigibles pour une nouvelle demande de permis.”{" "}
                    <strong>{formatMontant(totalAmount)}</strong> sera exigible après validation de
                    votre dossier. Ce document ne constitue pas un reçu de paiement.
                  </p>
                </div>

                <div className={styles['navigation-buttons']}>
                  <button
                    className={`${styles.btn} ${styles['btn-outline']}`}
                    onClick={handleBack}
                    type="button"
                    disabled={isLoading || !idProc}
                  >
                    <FiChevronLeft className={styles['btn-icon']} />
                    Précédent
                  </button>
                  <button
                    className={`${styles.btn} ${styles['btn-primary']}`}
                    onClick={handleConfirm}
                    type="button"
                    disabled={isLoading || !idProc || isConfirming || !isPageReady || !etapeIdForThisPage}
                  >
                    {isConfirming ? "Confirmation..." : "Confirmer et passer au paiement"}
                    <FiChevronRight className={styles['btn-icon']} />
                  </button>
                </div>

                {etapeMessage && (
                  <div className={styles.etapeMessage}>{etapeMessage}</div>
                )}
                {confirmMessage && (
                  <div className={styles.etapeMessage}>{confirmMessage}</div>
                )}
                {downloadMessage && (
                  <div className={styles.etapeMessage}>{downloadMessage}</div>
                )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Facture;
