import { useEffect, useMemo, useRef, useState } from "react";
import router from "next/router";
import axios from "axios";
import { ArrowLeft, ArrowRight, Gem, Loader2, PlusCircle } from "lucide-react";
import Navbar from "../../../navbar/Navbar";
import Sidebar from "../../../sidebar/Sidebar";
import ProgressStepper from "../../../../components/ProgressStepper";
import { useViewNavigator } from "../../../../src/hooks/useViewNavigator";
import { useSearchParams } from "@/src/hooks/useSearchParams";
import { useActivateEtape } from "@/src/hooks/useActivateEtape";
import { Phase, Procedure, ProcedureEtape, ProcedurePhase } from "@/src/types/procedure";
import { toast } from "react-toastify";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import styles from "./step1.module.css";

type SubstanceItem = {
  id_sub?: number;
  id_substance?: number;
  nom_subFR?: string | null;
  nom_subAR?: string | null;
  categorie_sub?: string | null;
  priorite?: "principale" | "secondaire" | null;
};

type Step1Payload = {
  id_proc: number;
  id_permis?: number;
  id_demande?: number;
  code_demande?: string | null;
  currentSubstances: SubstanceItem[];
  selectedAdded: SubstanceItem[];
  availableSubstances: SubstanceItem[];
};

const apiURL = process.env.NEXT_PUBLIC_API_URL;

const displayName = (s: SubstanceItem) =>
  s.nom_subFR || s.nom_subAR || `Substance #${s.id_sub ?? s.id_substance ?? "--"}`;

export default function Step1ExtensionSubstancesPage() {
  const { currentView, navigateTo } = useViewNavigator("nouvelle-demande");
  const searchParams = useSearchParams();
  const idProcStr = searchParams?.get("id");
  const permisIdStr = searchParams?.get("permisId");
  const idProc = Number(idProcStr ?? Number.NaN);
  const permisId = Number(permisIdStr ?? Number.NaN);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPageReady, setIsPageReady] = useState(false);
  const [payload, setPayload] = useState<Step1Payload | null>(null);
  const [secondaryRows, setSecondaryRows] = useState<
    Array<{ id: string; substanceId: number | null; priorite: "secondaire" }>
  >([]);
  const [procedureData, setProcedureData] = useState<Procedure | null>(null);
  const [procedureTypeId, setProcedureTypeId] = useState<number | undefined>(undefined);
  const [currentStep, setCurrentStep] = useState<number | undefined>(undefined);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const phases: Phase[] = useMemo(() => {
    if (!procedureData?.ProcedurePhase) return [];
    return procedureData.ProcedurePhase
      .slice()
      .sort((a: ProcedurePhase, b: ProcedurePhase) => a.ordre - b.ordre)
      .map((pp: ProcedurePhase) => ({ ...pp.phase, ordre: pp.ordre }));
  }, [procedureData]);

  const etapeIdForThisPage = useMemo(() => {
    if (!procedureData) return null;
    const pathname = "operateur/extention_substance/step1/page1";
    const normalize = (value?: string | null) =>
      (value ?? "")
        .replace(/^\/+/, "")
        .replace(/\.(tsx|ts|jsx|js|html)$/i, "")
        .trim()
        .toLowerCase();
    const target = normalize(pathname);
    const phaseEtapes = (procedureData.ProcedurePhase || []).flatMap((pp) => pp.phase?.etapes || []);
    const byRoute = phaseEtapes.find((e: any) => {
      const route = normalize(e.page_route);
      return route === target || route.endsWith(target) || route.includes("step1/page1");
    });
    if (byRoute) return byRoute.id_etape;
    return 1;
  }, [procedureData]);

  useActivateEtape({
    idProc: Number.isFinite(idProc) ? idProc : undefined,
    etapeNum: etapeIdForThisPage ?? 1,
    shouldActivate: isPageReady && !!etapeIdForThisPage,
    onActivationSuccess: () => setRefetchTrigger((prev) => prev + 1),
  });

  const loadProcedureData = async () => {
    if (!Number.isFinite(idProc) || !apiURL) return;
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    try {
      const res = await axios.get<Procedure>(
        `${apiURL}/api/procedure-etape/procedure/${idProc}`,
        { signal: abortControllerRef.current.signal },
      );
      setProcedureData(res.data);
      const typeId = res.data?.demandes?.[0]?.id_typeProc;
      if (typeId) setProcedureTypeId(typeId);
      const active = res.data?.ProcedureEtape?.find(
        (pe: ProcedureEtape) => pe.statut === "EN_COURS",
      );
      if (active?.id_etape) setCurrentStep(active.id_etape);
    } catch (error) {
      if (axios.isCancel(error)) return;
      console.warn("[ExtensionSubstance] procedure data unavailable", error);
    }
  };

  const loadData = async () => {
    if (!Number.isFinite(idProc) || !apiURL) return;
    setLoading(true);
    try {
      const res = await axios.get<Step1Payload>(
        `${apiURL}/api/procedures/extension-substance/${idProc}/substances`,
        { withCredentials: true },
      );
      const data = res.data;
      setPayload(data);

      const initialRows: Array<{ id: string; substanceId: number | null; priorite: "secondaire" }> = [];
      (data.selectedAdded || []).forEach((s) => {
        const id = Number(s.id_substance ?? s.id_sub);
        if (Number.isFinite(id)) {
          initialRows.push({
            id: Math.random().toString(36).slice(2, 9),
            substanceId: id,
            priorite: "secondaire",
          });
        }
      });
      setSecondaryRows(initialRows.length > 0 ? initialRows : [
        { id: Math.random().toString(36).slice(2, 9), substanceId: null, priorite: "secondaire" },
      ]);
    } catch (error) {
      console.error("[ExtensionSubstance] load step1 failed", error);
      toast.error("Impossible de charger les substances.");
    } finally {
      setLoading(false);
      setIsPageReady(true);
    }
  };

  useEffect(() => {
    loadProcedureData();
    loadData();
    return () => abortControllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idProc, refetchTrigger]);

  useEffect(() => {
    if (etapeIdForThisPage && currentStep !== etapeIdForThisPage) {
      setCurrentStep(etapeIdForThisPage);
    }
  }, [etapeIdForThisPage, currentStep]);

  const selectedCount = useMemo(
    () =>
      secondaryRows.filter(
        (row) => typeof row.substanceId === "number" && Number.isFinite(row.substanceId),
      ).length,
    [secondaryRows],
  );

  const secondarySelectedIds = useMemo(
    () =>
      secondaryRows
        .map((row) => row.substanceId)
        .filter((id): id is number => typeof id === "number" && Number.isFinite(id)),
    [secondaryRows],
  );

  const addSecondaryRow = () => {
    setSecondaryRows((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2, 9),
        substanceId: null,
        priorite: "secondaire",
      },
    ]);
  };

  const removeSecondaryRow = (rowId: string) => {
    setSecondaryRows((prev) => {
      const next = prev.filter((row) => row.id !== rowId);
      return next.length > 0
        ? next
        : [{ id: Math.random().toString(36).slice(2, 9), substanceId: null, priorite: "secondaire" }];
    });
  };

  const handleSecondarySubstanceChange = (rowId: string, value: string) => {
    const nextId = value ? Number(value) : null;
    setSecondaryRows((prev) => {
      return prev.map((r) =>
        r.id === rowId ? { ...r, substanceId: nextId } : r,
      );
    });
  };

  const handleSave = async () => {
    if (!Number.isFinite(idProc) || !apiURL) return false;
    setSaving(true);
    try {
      const substances = secondaryRows
        .filter((row) => row.substanceId != null)
        .map((row) => ({
          id_substance: Number(row.substanceId),
          priorite: "secondaire" as const,
        }))
        .filter((row) => Number.isFinite(row.id_substance));
      await axios.post(
        `${apiURL}/api/procedures/extension-substance/${idProc}/substances`,
        { substances },
        { withCredentials: true },
      );
      toast.success("Substances enregistrées.");
      return true;
    } catch (error) {
      console.error("[ExtensionSubstance] save step1 failed", error);
      toast.error("Erreur lors de la sauvegarde.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (Number.isFinite(permisId)) {
      router.push(`/operateur/permisdashboard/${permisId}`);
      return;
    }
    router.push("/operateur/permisdashboard/mes-permis");
  };

  const handleNext = async () => {
    const ok = await handleSave();
    if (!ok) return;
    const pid = Number.isFinite(permisId) ? `&permisId=${permisId}` : "";
    router.push(`/operateur/extention_substance/step2/page2?id=${idProc}${pid}`);
  };

  if (!Number.isFinite(idProc)) {
    return <div className={styles.loadingState}>ID de procédure invalide.</div>;
  }

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.mainContent}>
          <div className={styles.page}>
            <div className={styles.container}>
              {procedureData && (
                <ProgressStepper
                  phases={phases}
                  currentProcedureId={idProc}
                  currentEtapeId={etapeIdForThisPage ?? currentStep}
                  procedurePhases={procedureData.ProcedurePhase || []}
                  procedureTypeId={procedureTypeId}
                />
              )}

              <div className={styles.header}>
                <h1 className={styles.title}>Extension des substances</h1>
                <p className={styles.subtitle}>
                  Ajoutez des substances secondaires au permis sélectionné. Les substances existantes restent en lecture seule.
                </p>
              </div>

              {loading ? (
                <div className={styles.loadingState}>
                  <Loader2 className={styles.spin} size={18} /> Chargement des substances...
                </div>
              ) : (
                <>
                  <section className={styles.card}>
                    <div className={styles.cardHeader}>
                      <Gem size={18} />
                      <h2>Substances actuelles du permis</h2>
                    </div>
                    <div className={styles.badges}>
                      {payload?.currentSubstances?.length ? (
                        payload.currentSubstances.map((s) => {
                          const id = Number(s.id_substance ?? s.id_sub);
                          return (
                            <span key={`cur-${id}`} className={styles.readonlyBadge}>
                              {displayName(s)}
                              <small>{s.priorite || "secondaire"}</small>
                            </span>
                          );
                        })
                      ) : (
                        <p className={styles.empty}>Aucune substance existante.</p>
                      )}
                    </div>
                  </section>

                  <section className={styles.card}>
                    <div className={styles.cardHeader}>
                      <PlusCircle size={18} />
                      <h2>Ajouter des substances secondaires</h2>
                    </div>
                    <div className={styles.list}>
                      {payload?.availableSubstances?.length ? (
                        <>
                          {secondaryRows.map((row) => {
                            const availableForRow = payload.availableSubstances.filter((sub) => {
                              const sid = Number(sub.id_sub ?? sub.id_substance);
                              return sid === row.substanceId || !secondarySelectedIds.includes(sid);
                            });
                            return (
                              <div key={row.id} className={styles.secondaryRow}>
                                <div className={styles.secondarySelectWrap}>
                                  <Select
                                    value={row.substanceId != null ? String(row.substanceId) : undefined}
                                    onValueChange={(value) =>
                                      handleSecondarySubstanceChange(row.id, value)
                                    }
                                  >
                                    <SelectTrigger className={styles.formSelect}>
                                      <SelectValue
                                        className={styles.selectValue}
                                        placeholder="Sélectionner une substance"
                                      />
                                    </SelectTrigger>
                                    <SelectContent className={styles.selectContent}>
                                      {availableForRow.map((sub) => {
                                        const sid = Number(sub.id_sub ?? sub.id_substance);
                                        return (
                                          <SelectItem
                                            key={sid}
                                            value={String(sid)}
                                            className={styles.selectItem}
                                          >
                                            {displayName(sub)}
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                  <span className={styles.secondaryHint}>
                                    Ajoutée comme substance secondaire
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  className={styles.removeBtn}
                                  onClick={() => removeSecondaryRow(row.id)}
                                  aria-label="Supprimer cette substance secondaire"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}

                          <button
                            type="button"
                            className={styles.addSecondaryBtn}
                            onClick={addSecondaryRow}
                          >
                            + Ajouter une substance secondaire
                          </button>
                        </>
                      ) : (
                        <p className={styles.empty}>Aucune substance disponible à ajouter.</p>
                      )}
                    </div>
                  </section>

                  <div className={styles.footerInfo}>
                    {selectedCount} substance(s) à ajouter
                    {payload?.code_demande ? ` • Demande: ${payload.code_demande}` : ""}
                  </div>

                  <div className={styles.actions}>
                    <button className={styles.btnOutline} onClick={handleBack} disabled={saving}>
                      <ArrowLeft size={16} /> Précédent
                    </button>
                    <div className={styles.actionsRight}>
                      <button className={styles.btnPrimary} onClick={handleNext} disabled={saving}>
                        Suivant <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
