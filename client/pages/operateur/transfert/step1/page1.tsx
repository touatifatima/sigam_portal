import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import router from "next/router";
import { useSearchParams } from "@/src/hooks/useSearchParams";
import { useViewNavigator } from "@/src/hooks/useViewNavigator";
import Navbar from "../../../navbar/Navbar";
import Sidebar from "../../../sidebar/Sidebar";
import ProgressStepper from "../../../../components/ProgressStepper";
import { Phase, Procedure, ProcedureEtape, ProcedurePhase } from "@/src/types/procedure";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Search,
  Loader2,
  UserCheck,
  PlusCircle,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import styles from "./page1.module.css";

type DetenteurSearchItem = {
  id_detenteur: number;
  nom_societeFR?: string | null;
  nom_societeAR?: string | null;
  displayName?: string | null;
};

type DetenteurPreview = {
  id_detenteur: number;
  nom_societeFR?: string | null;
  nom_societeAR?: string | null;
  date_constitution?: string | null;
  capital_social?: number | null;
};

type PermisInfo = {
  id: number;
  code_permis?: string | null;
  id_detenteur?: number | null;
  detenteur?: {
    nom_societeFR?: string | null;
    nom_societeAR?: string | null;
  } | null;
  typePermis?: {
    lib_type?: string | null;
    code_type?: string | null;
  } | null;
};

type ExistingReceiver = {
  id_proc: number;
  id_demande?: number | null;
  code_demande?: string | null;
  cessionnaire?: {
    id_detenteur?: number | null;
    nom_societeFR?: string | null;
    nom_societeAR?: string | null;
  } | null;
};

type NewCompanyForm = {
  nom_societeFR: string;
  nom_societeAR: string;
  adresse_siege: string;
  telephone: string;
  email: string;
  site_web: string;
  numero_rc: string;
  nis: string;
  nif: string;
  capital_social: string;
  date_constitution: string;
  date_enregistrement: string;
};

const apiURL = process.env.NEXT_PUBLIC_API_URL;

const emptyCompany: NewCompanyForm = {
  nom_societeFR: "",
  nom_societeAR: "",
  adresse_siege: "",
  telephone: "",
  email: "",
  site_web: "",
  numero_rc: "",
  nis: "",
  nif: "",
  capital_social: "",
  date_constitution: "",
  date_enregistrement: "",
};

const getSocieteLabel = (value?: {
  nom_societeFR?: string | null;
  nom_societeAR?: string | null;
  displayName?: string | null;
}) =>
  value?.displayName ||
  value?.nom_societeFR ||
  value?.nom_societeAR ||
  "Société non renseignée";

export default function TransfertStep1Page() {
  const searchParams = useSearchParams();
  const { currentView, navigateTo } = useViewNavigator("nouvelle-demande");

  const permisId = Number(searchParams?.get("permisId") ?? Number.NaN);
  const existingProcId = Number(searchParams?.get("id") ?? Number.NaN);

  const [loadingPermis, setLoadingPermis] = useState(false);
  const [permisInfo, setPermisInfo] = useState<PermisInfo | null>(null);

  const [existingReceiver, setExistingReceiver] = useState<ExistingReceiver | null>(
    null,
  );
  const [loadingExistingReceiver, setLoadingExistingReceiver] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<DetenteurSearchItem[]>([]);

  const [selectedPreview, setSelectedPreview] = useState<DetenteurPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [showNewCompanyForm, setShowNewCompanyForm] = useState(false);
  const [newCompany, setNewCompany] = useState<NewCompanyForm>(emptyCompany);
  const [submitting, setSubmitting] = useState(false);
  const [procedureData, setProcedureData] = useState<Procedure | null>(null);
  const [procedureTypeId, setProcedureTypeId] = useState<number | undefined>();
  const [currentEtapeId, setCurrentEtapeId] = useState<number>(1);

  const idProc = Number.isFinite(existingProcId) ? existingProcId : undefined;

  const phases: Phase[] = useMemo(() => {
    if (!procedureData?.ProcedurePhase) return [];
    return procedureData.ProcedurePhase
      .slice()
      .sort((a: ProcedurePhase, b: ProcedurePhase) => a.ordre - b.ordre)
      .map((pp: ProcedurePhase) => ({ ...pp.phase, ordre: pp.ordre }));
  }, [procedureData]);

  const canSearch = Number.isFinite(permisId) && !existingReceiver?.cessionnaire;

  const permitHolderLabel = useMemo(() => {
    return (
      permisInfo?.detenteur?.nom_societeFR ||
      permisInfo?.detenteur?.nom_societeAR ||
      "--"
    );
  }, [permisInfo]);

  const goToStep2 = (procId: number) => {
    if (!Number.isFinite(procId)) return;
    const permisQuery = Number.isFinite(permisId) ? `&permisId=${permisId}` : "";
    router.push(`/operateur/transfert/step2/page2?id=${procId}${permisQuery}`);
  };

  useEffect(() => {
    if (!Number.isFinite(permisId) || !apiURL) return;
    let active = true;
    setLoadingPermis(true);
    axios
      .get(`${apiURL}/operateur/permis/${permisId}`, { withCredentials: true })
      .then((res) => {
        if (!active) return;
        setPermisInfo(res.data ?? null);
      })
      .catch((err) => {
        console.error("[Transfert step1] fetch permis failed", err);
        toast.error("Impossible de charger le permis.");
      })
      .finally(() => {
        if (active) setLoadingPermis(false);
      });
    return () => {
      active = false;
    };
  }, [permisId]);

  useEffect(() => {
    if (!Number.isFinite(existingProcId) || !apiURL) return;
    let active = true;
    setLoadingExistingReceiver(true);
    axios
      .get(`${apiURL}/api/procedures/transfert/${existingProcId}/receiver`, {
        withCredentials: true,
      })
      .then((res) => {
        if (!active) return;
        setExistingReceiver(res.data ?? null);
      })
      .catch(() => {
        if (!active) return;
        setExistingReceiver(null);
      })
      .finally(() => {
        if (active) setLoadingExistingReceiver(false);
      });
    return () => {
      active = false;
    };
  }, [existingProcId]);

  useEffect(() => {
    if (!Number.isFinite(existingProcId) || !apiURL) return;
    let active = true;
    axios
      .get<Procedure>(`${apiURL}/api/procedure-etape/procedure/${existingProcId}`, {
        withCredentials: true,
      })
      .then((res) => {
        if (!active) return;
        const proc = res.data;
        setProcedureData(proc);
        const typeId =
          proc?.demandes?.[0]?.typeProcedure?.id ??
          (proc as any)?.demandes?.[0]?.id_typeProc;
        if (typeof typeId === "number") {
          setProcedureTypeId(typeId);
        }
        const activeStep = proc?.ProcedureEtape?.find(
          (pe: ProcedureEtape) => pe.statut === "EN_COURS",
        );
        if (activeStep?.id_etape) {
          setCurrentEtapeId(activeStep.id_etape);
        } else {
          setCurrentEtapeId(1);
        }
      })
      .catch(() => {
        if (!active) return;
        setProcedureData(null);
      });
    return () => {
      active = false;
    };
  }, [existingProcId]);

  useEffect(() => {
    if (!canSearch || !apiURL) return;
    const q = searchTerm.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await axios.get(
          `${apiURL}/api/procedures/transfert/detenteurs/search`,
          {
            withCredentials: true,
            params: {
              q,
              excludeDetenteurId: permisInfo?.id_detenteur ?? undefined,
            },
          },
        );
        const rows = Array.isArray(res.data) ? res.data : [];
        setSearchResults(rows);
      } catch (err) {
        console.error("[Transfert step1] search failed", err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchTerm, canSearch, permisInfo?.id_detenteur]);

  const handleOpenConfirm = async (item: DetenteurSearchItem) => {
    if (!item?.id_detenteur || !apiURL) return;
    setPreviewLoading(true);
    try {
      const res = await axios.get(
        `${apiURL}/api/procedures/transfert/detenteurs/${item.id_detenteur}/preview`,
        { withCredentials: true },
      );
      setSelectedPreview(res.data ?? null);
      setConfirmOpen(true);
    } catch (err) {
      console.error("[Transfert step1] preview failed", err);
      toast.error("Impossible de charger l'aperçu de la société.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmExisting = async () => {
    if (!apiURL || !selectedPreview?.id_detenteur || !Number.isFinite(permisId)) return;
    setSubmitting(true);
    try {
      const res = await axios.post(
        `${apiURL}/api/procedures/transfert/start`,
        {
          permisId,
          existingDetenteurId: selectedPreview.id_detenteur,
          date_demande: new Date().toISOString(),
        },
        { withCredentials: true },
      );
      const newProcId = Number(res.data?.new_proc_id);
      if (!Number.isFinite(newProcId)) {
        throw new Error("new_proc_id manquant");
      }
      toast.success("Transfert initialisé avec succès.");
      goToStep2(newProcId);
    } catch (err: any) {
      console.error("[Transfert step1] start existing failed", err);
      toast.error(err?.response?.data?.message || "Erreur lors du démarrage du transfert.");
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const handleCreateNewAndStart = async () => {
    if (!apiURL || !Number.isFinite(permisId)) return;
    if (!newCompany.nom_societeFR.trim() && !newCompany.nom_societeAR.trim()) {
      toast.warning("Le nom de société (FR ou AR) est obligatoire.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        permisId,
        date_demande: new Date().toISOString(),
        newDetenteur: {
          nom_societeFR: newCompany.nom_societeFR || undefined,
          nom_societeAR: newCompany.nom_societeAR || undefined,
          adresse_siege: newCompany.adresse_siege || undefined,
          telephone: newCompany.telephone || undefined,
          email: newCompany.email || undefined,
          site_web: newCompany.site_web || undefined,
          date_constitution: newCompany.date_constitution || undefined,
          registreCommerce: {
            numero_rc: newCompany.numero_rc || undefined,
            nis: newCompany.nis || undefined,
            nif: newCompany.nif || undefined,
            capital_social: newCompany.capital_social
              ? Number(newCompany.capital_social)
              : undefined,
            date_enregistrement: newCompany.date_enregistrement || undefined,
          },
        },
      };

      const res = await axios.post(
        `${apiURL}/api/procedures/transfert/start`,
        payload,
        { withCredentials: true },
      );
      const newProcId = Number(res.data?.new_proc_id);
      if (!Number.isFinite(newProcId)) {
        throw new Error("new_proc_id manquant");
      }
      toast.success("Nouvelle société enregistrée et transfert initialisé.");
      goToStep2(newProcId);
    } catch (err: any) {
      console.error("[Transfert step1] start with new company failed", err);
      toast.error(err?.response?.data?.message || "Erreur lors du démarrage du transfert.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!Number.isFinite(permisId) && !Number.isFinite(existingProcId)) {
    return <div className={styles.invalidState}>Paramètres invalides (permisId manquant).</div>;
  }

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.mainContent}>
          <div className={styles.container}>
            <div className={styles.stepperWrap}>
              {idProc && procedureData ? (
                <ProgressStepper
                  phases={phases}
                  currentProcedureId={idProc}
                  currentEtapeId={currentEtapeId}
                  procedurePhases={procedureData.ProcedurePhase || []}
                  procedureTypeId={procedureTypeId}
                />
              ) : (
                <ProgressStepper
                  steps={["Identification", "Documents", "Capacités", "Facture", "Paiement"]}
                  currentStep={1}
                />
              )}
            </div>
            <div className={styles.contentWrapper}>
              <div className={styles.header}>
                <h1 className={styles.title}>Informations de la société réceptrice</h1>
                <p className={styles.subtitle}>
                  Transfert de permis: sélection du cessionnaire avec confirmation explicite.
                </p>
              </div>

            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Permis concerné</h2>
              {loadingPermis ? (
                <div className={styles.inlineLoading}>
                  <Loader2 className={styles.spin} size={16} />
                  Chargement du permis...
                </div>
              ) : (
                <div className={styles.permisGrid}>
                  <div>
                    <span className={styles.label}>Code permis</span>
                    <strong>{permisInfo?.code_permis || `PERMIS-${permisId}`}</strong>
                  </div>
                  <div>
                    <span className={styles.label}>Type</span>
                    <strong>
                      {permisInfo?.typePermis?.lib_type ||
                        permisInfo?.typePermis?.code_type ||
                        "--"}
                    </strong>
                  </div>
                  <div>
                    <span className={styles.label}>Société cédante (actuelle)</span>
                    <strong>{permitHolderLabel}</strong>
                  </div>
                </div>
              )}
            </section>

            {loadingExistingReceiver ? (
              <section className={styles.card}>
                <div className={styles.inlineLoading}>
                  <Loader2 className={styles.spin} size={16} />
                  Chargement du cessionnaire déjà enregistré...
                </div>
              </section>
            ) : existingReceiver?.cessionnaire ? (
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Cessionnaire déjà sélectionné</h2>
                <div className={styles.existingReceiver}>
                  <UserCheck size={18} />
                  <div>
                    <strong>
                      {getSocieteLabel({
                        nom_societeFR: existingReceiver.cessionnaire.nom_societeFR,
                        nom_societeAR: existingReceiver.cessionnaire.nom_societeAR,
                      })}
                    </strong>
                    <p>
                      Demande: {existingReceiver.code_demande || "--"} • Procédure:{" "}
                      {existingReceiver.id_proc}
                    </p>
                  </div>
                </div>
                <div className={styles.actions}>
                  <button
                    className={styles.btnOutline}
                    type="button"
                    onClick={() => router.push("/operateur/permisdashboard/mes-permis")}
                  >
                    <ArrowLeft size={16} />
                    Tableau de bord
                  </button>
                  <button
                    className={styles.btnPrimary}
                    type="button"
                    onClick={() => goToStep2(existingReceiver.id_proc)}
                  >
                    Continuer vers Documents
                    <ArrowRight size={16} />
                  </button>
                </div>
              </section>
            ) : (
              <>
                <section className={styles.card}>
                  <h2 className={styles.cardTitle}>Recherche simple par nom de société</h2>
                  <div className={styles.searchWrap}>
                    <Search size={16} className={styles.searchIcon} />
                    <input
                      type="text"
                      className={styles.searchInput}
                      placeholder="Nom société FR/AR..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  {searching ? (
                    <div className={styles.inlineLoading}>
                      <Loader2 className={styles.spin} size={16} />
                      Recherche en cours...
                    </div>
                  ) : searchTerm.trim().length >= 2 && searchResults.length === 0 ? (
                    <p className={styles.emptyHint}>Aucune société trouvée.</p>
                  ) : null}

                  {searchResults.length > 0 && (
                    <div className={styles.resultsList}>
                      {searchResults.map((item) => (
                        <button
                          key={item.id_detenteur}
                          type="button"
                          className={styles.resultItem}
                          onClick={() => handleOpenConfirm(item)}
                          disabled={previewLoading || submitting}
                        >
                          <Building2 size={16} />
                          <span>{getSocieteLabel(item)}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    className={styles.newCompanyToggle}
                    type="button"
                    onClick={() => setShowNewCompanyForm((prev) => !prev)}
                  >
                    <PlusCircle size={16} />
                    {showNewCompanyForm ? "Masquer le formulaire nouvelle société" : "Nouvelle société"}
                  </button>
                </section>

                {showNewCompanyForm && (
                  <section className={styles.card}>
                    <h2 className={styles.cardTitle}>Création d’une nouvelle société</h2>
                    <div className={styles.formGrid}>
                      <label>
                        <span>Nom société FR *</span>
                        <input
                          value={newCompany.nom_societeFR}
                          onChange={(e) =>
                            setNewCompany((prev) => ({ ...prev, nom_societeFR: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        <span>Nom société AR</span>
                        <input
                          value={newCompany.nom_societeAR}
                          onChange={(e) =>
                            setNewCompany((prev) => ({ ...prev, nom_societeAR: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        <span>Date constitution</span>
                        <input
                          type="date"
                          value={newCompany.date_constitution}
                          onChange={(e) =>
                            setNewCompany((prev) => ({
                              ...prev,
                              date_constitution: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        <span>Adresse siège</span>
                        <input
                          value={newCompany.adresse_siege}
                          onChange={(e) =>
                            setNewCompany((prev) => ({ ...prev, adresse_siege: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        <span>Téléphone</span>
                        <input
                          value={newCompany.telephone}
                          onChange={(e) =>
                            setNewCompany((prev) => ({ ...prev, telephone: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        <span>Email</span>
                        <input
                          type="email"
                          value={newCompany.email}
                          onChange={(e) =>
                            setNewCompany((prev) => ({ ...prev, email: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        <span>Site web</span>
                        <input
                          value={newCompany.site_web}
                          onChange={(e) =>
                            setNewCompany((prev) => ({ ...prev, site_web: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        <span>Numéro RC</span>
                        <input
                          value={newCompany.numero_rc}
                          onChange={(e) =>
                            setNewCompany((prev) => ({ ...prev, numero_rc: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        <span>NIS</span>
                        <input
                          value={newCompany.nis}
                          onChange={(e) =>
                            setNewCompany((prev) => ({ ...prev, nis: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        <span>NIF</span>
                        <input
                          value={newCompany.nif}
                          onChange={(e) =>
                            setNewCompany((prev) => ({ ...prev, nif: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        <span>Capital social (DA)</span>
                        <input
                          type="number"
                          min="0"
                          value={newCompany.capital_social}
                          onChange={(e) =>
                            setNewCompany((prev) => ({
                              ...prev,
                              capital_social: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        <span>Date enregistrement RC</span>
                        <input
                          type="date"
                          value={newCompany.date_enregistrement}
                          onChange={(e) =>
                            setNewCompany((prev) => ({
                              ...prev,
                              date_enregistrement: e.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                    <div className={styles.actions}>
                      <button
                        className={styles.btnOutline}
                        type="button"
                        onClick={() => setNewCompany(emptyCompany)}
                        disabled={submitting}
                      >
                        Réinitialiser
                      </button>
                      <button
                        className={styles.btnPrimary}
                        type="button"
                        onClick={handleCreateNewAndStart}
                        disabled={submitting}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className={styles.spin} size={16} />
                            Création...
                          </>
                        ) : (
                          <>
                            Suivant
                            <ArrowRight size={16} />
                          </>
                        )}
                      </button>
                    </div>
                  </section>
                )}
              </>
            )}

              {!existingReceiver?.cessionnaire && (
                <div className={styles.bottomNav}>
                  <button
                    className={styles.btnOutline}
                    type="button"
                    onClick={() =>
                      Number.isFinite(permisId)
                        ? router.push(`/operateur/permisdashboard/${permisId}`)
                        : router.push("/operateur/permisdashboard/mes-permis")
                    }
                  >
                    <ArrowLeft size={16} />
                    Retour au permis
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {confirmOpen && selectedPreview && (
        <div className={styles.modalOverlay} onClick={() => setConfirmOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setConfirmOpen(false)}
            >
              <X size={16} />
            </button>
            <h3>Confirmer la société réceptrice</h3>
            <p className={styles.modalLead}>
              Est-ce bien la société réceptrice que vous souhaitez ?
            </p>
            <div className={styles.previewBox}>
              <p>
                <strong>Nom FR:</strong> {selectedPreview.nom_societeFR || "--"}
              </p>
              <p>
                <strong>Nom AR:</strong> {selectedPreview.nom_societeAR || "--"}
              </p>
              <p>
                <strong>Date constitution:</strong>{" "}
                {selectedPreview.date_constitution
                  ? new Date(selectedPreview.date_constitution).toLocaleDateString("fr-FR")
                  : "--"}
              </p>
              <p>
                <strong>Capital social:</strong>{" "}
                {typeof selectedPreview.capital_social === "number"
                  ? `${selectedPreview.capital_social.toLocaleString("fr-FR")} DA`
                  : "--"}
              </p>
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
              >
                Non, ce n’est pas elle
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleConfirmExisting}
                disabled={submitting}
              >
                {submitting ? "Démarrage..." : "Oui, c’est elle"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


