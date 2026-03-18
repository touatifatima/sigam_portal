import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import router from "next/router";
import { useSearchParams } from "@/src/hooks/useSearchParams";
import { useViewNavigator } from "@/src/hooks/useViewNavigator";
import Navbar from "../../../navbar/Navbar";
import Sidebar from "../../../sidebar/Sidebar";
import ProgressStepper from "../../../../components/ProgressStepper";
import {
  ArrowLeft,
  ArrowRight,
  HandCoins,
  Loader2,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "react-toastify";
import styles from "./page1.module.css";

type Actionnaire = {
  id_actionnaire: number;
  nom: string;
  prenom: string;
  taux: number;
  type_fonction?: string | null;
  nationalite?: string | null;
  qualification?: string | null;
  numero_carte?: string | null;
  id_nationalite?: number | null;
  id_pays?: number | null;
};

type CessionContext = {
  code_permis?: string;
  id_detenteur: number;
  detenteur?: {
    nom_societeFR?: string | null;
    nom_societeAR?: string | null;
  } | null;
  actionnaires: Actionnaire[];
  total_taux: number;
};

type OptionItem = {
  id: number;
  label: string;
};

type BeneficiarySplit = {
  id_actionnaire: number;
  taux: number;
};

const apiURL = process.env.NEXT_PUBLIC_API_URL;

export default function CessionStep1Page() {
  const searchParams = useSearchParams();
  const { currentView, navigateTo } = useViewNavigator("nouvelle-demande");

  const permisId = Number(searchParams?.get("permisId") ?? Number.NaN);
  const existingProcId = Number(searchParams?.get("id") ?? Number.NaN);

  const [context, setContext] = useState<CessionContext | null>(null);
  const [actionnaires, setActionnaires] = useState<Actionnaire[]>([]);
  const [loading, setLoading] = useState(false);

  const [openModal, setOpenModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addingBenef, setAddingBenef] = useState(false);

  const [cedantId, setCedantId] = useState<number | null>(null);
  const [tauxCede, setTauxCede] = useState<number>(0);
  const [motif, setMotif] = useState("Cession de parts");
  const [beneficiaries, setBeneficiaries] = useState<BeneficiarySplit[]>([]);

  const [createdProcId, setCreatedProcId] = useState<number | null>(
    Number.isFinite(existingProcId) && existingProcId > 0 ? existingProcId : null,
  );
  const [cessionValidated, setCessionValidated] = useState(
    Number.isFinite(existingProcId) && existingProcId > 0,
  );

  const [paysOptions, setPaysOptions] = useState<OptionItem[]>([]);
  const [nationaliteOptions, setNationaliteOptions] = useState<OptionItem[]>([]);
  const [showNewBenef, setShowNewBenef] = useState(false);
  const [newBenef, setNewBenef] = useState({
    nom: "",
    prenom: "",
    lieu_naissance: "",
    qualification: "",
    numero_carte: "",
    id_nationalite: "",
    id_pays: "",
    date_naissance: "",
    telephone: "",
    email: "",
    adresse: "",
  });

  const cedant = useMemo(
    () => actionnaires.find((a) => a.id_actionnaire === cedantId) ?? null,
    [actionnaires, cedantId],
  );

  const beneficiariesTotal = useMemo(
    () => beneficiaries.reduce((sum, b) => sum + (Number(b.taux) || 0), 0),
    [beneficiaries],
  );

  const parseInputNumber = (value: string): number => {
    const normalized = value.replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const isCessionComplete = useMemo(() => {
    if (!cedant) return false;
    return Math.abs((cedant.taux || 0) - (tauxCede || 0)) < 0.0001;
  }, [cedant, tauxCede]);

  const canValidate = useMemo(() => {
    if (!cedant) return false;
    if (tauxCede <= 0 || tauxCede > cedant.taux) return false;
    if (beneficiaries.length === 0) return false;
    return Math.abs(beneficiariesTotal - tauxCede) < 0.0001;
  }, [cedant, tauxCede, beneficiaries.length, beneficiariesTotal]);

  const validationHints = useMemo(() => {
    const hints: string[] = [];
    if (!cedant) hints.push("Selectionnez d'abord le cedant.");
    if (tauxCede <= 0) hints.push("Le taux cede doit etre strictement superieur a 0.");
    if (cedant && tauxCede > cedant.taux) {
      hints.push(`Le taux cede depasse le taux du cedant (${cedant.taux.toFixed(2)}%).`);
    }
    if (beneficiaries.length === 0) {
      hints.push("Ajoutez au moins un beneficiaire.");
    }
    if (beneficiaries.length > 0 && Math.abs(beneficiariesTotal - tauxCede) >= 0.0001) {
      hints.push("La somme des taux des beneficiaires doit etre egale au taux cede.");
    }
    return hints;
  }, [cedant, tauxCede, beneficiaries.length, beneficiariesTotal]);

  const beneficiaryChoices = useMemo(
    () =>
      actionnaires.filter(
        (a) =>
          a.id_actionnaire !== cedantId &&
          !beneficiaries.some((b) => b.id_actionnaire === a.id_actionnaire),
      ),
    [actionnaires, beneficiaries, cedantId],
  );

  const cedantChoices = useMemo(
    () => actionnaires.filter((a) => Number(a.taux || 0) > 0),
    [actionnaires],
  );

  const loadActionnaires = async () => {
    if (!apiURL || !Number.isFinite(permisId)) return;
    setLoading(true);
    try {
      const res = await axios.get(
        `${apiURL}/api/procedures/cession/permis/${permisId}/actionnaires`,
        {
          withCredentials: true,
        },
      );
      const payload = res.data as CessionContext;
      setContext(payload);
      setActionnaires(Array.isArray(payload?.actionnaires) ? payload.actionnaires : []);
    } catch (err) {
      console.error(err);
      toast.error("Chargement des actionnaires impossible.");
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    if (!apiURL) return;
    try {
      const [paysRes, natRes] = await Promise.all([
        axios.get(`${apiURL}/statuts-juridiques/pays`, { withCredentials: true }),
        axios.get(`${apiURL}/statuts-juridiques/nationalites`, {
          withCredentials: true,
        }),
      ]);
      setPaysOptions(
        (Array.isArray(paysRes.data) ? paysRes.data : []).map((p: any) => ({
          id: Number(p.id_pays),
          label: String(p.nom_pays),
        })),
      );
      setNationaliteOptions(
        (Array.isArray(natRes.data) ? natRes.data : []).map((n: any) => ({
          id: Number(n.id_nationalite),
          label: String(n.libelle),
        })),
      );
    } catch {
      // options remain empty, no blocker
    }
  };

  useEffect(() => {
    if (!Number.isFinite(permisId)) return;
    void loadActionnaires();
    void loadOptions();
  }, [permisId]);

  useEffect(() => {
    setBeneficiaries((prev) => {
      if (prev.length !== 1) return prev;
      const target = tauxCede > 0 ? Number(tauxCede.toFixed(4)) : 0;
      if (Math.abs((prev[0].taux ?? 0) - target) < 0.0001) return prev;
      return [{ ...prev[0], taux: target }];
    });
  }, [tauxCede]);

  const deleteActionnaire = async (row: Actionnaire) => {
    if (!context?.id_detenteur || !apiURL) return;
    if (Number(row.taux || 0) > 0) {
      toast.error(
        `Impossible de supprimer : cet actionnaire detient encore des parts (${row.taux}%).`,
      );
      return;
    }

    if (!window.confirm("Supprimer cet actionnaire ?")) return;

    try {
      await axios.delete(
        `${apiURL}/api/actionnaires/${context.id_detenteur}/${row.id_actionnaire}`,
        {
          withCredentials: true,
        },
      );
      setActionnaires((prev) =>
        prev.filter((a) => a.id_actionnaire !== row.id_actionnaire),
      );
      toast.success("Actionnaire supprime.");
    } catch (err) {
      toast.error("Suppression impossible.");
    }
  };

  const addNewBeneficiary = async () => {
    if (!apiURL || !context?.id_detenteur) return;

    if (
      !newBenef.nom ||
      !newBenef.prenom ||
      !newBenef.lieu_naissance ||
      !newBenef.qualification ||
      !newBenef.numero_carte ||
      !newBenef.id_nationalite ||
      !newBenef.id_pays
    ) {
      toast.warning("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    setAddingBenef(true);
    try {
      const payload = {
        nom: newBenef.nom,
        prenom: newBenef.prenom,
        id_nationalite: Number(newBenef.id_nationalite),
        qualification: newBenef.qualification,
        numero_carte: newBenef.numero_carte,
        taux_participation: "0",
        lieu_naissance: newBenef.lieu_naissance,
        id_pays: Number(newBenef.id_pays),
      };

      const res = await axios.post(
        `${apiURL}/api/actionnaires/${context.id_detenteur}/single`,
        payload,
        {
          withCredentials: true,
        },
      );

      const idActionnaire = Number(res.data?.lien?.id_fonctionDetent);
      if (!Number.isFinite(idActionnaire)) {
        throw new Error("Actionnaire invalide");
      }

      const newRow: Actionnaire = {
        id_actionnaire: idActionnaire,
        nom: res.data?.personne?.nomFR ?? newBenef.nom,
        prenom: res.data?.personne?.prenomFR ?? newBenef.prenom,
        taux: Number(res.data?.lien?.taux_participation ?? 0),
        qualification: res.data?.personne?.qualification ?? newBenef.qualification,
        numero_carte: res.data?.personne?.num_carte_identite ?? newBenef.numero_carte,
        id_nationalite: Number(newBenef.id_nationalite),
        id_pays: Number(newBenef.id_pays),
      };

      setActionnaires((prev) => [...prev, newRow]);
      setBeneficiaries((prev) => [
        ...prev,
        {
          id_actionnaire: idActionnaire,
          taux: prev.length === 0 && tauxCede > 0 ? Number(tauxCede.toFixed(4)) : 0,
        },
      ]);

      setShowNewBenef(false);
      setNewBenef({
        nom: "",
        prenom: "",
        lieu_naissance: "",
        qualification: "",
        numero_carte: "",
        id_nationalite: "",
        id_pays: "",
        date_naissance: "",
        telephone: "",
        email: "",
        adresse: "",
      });

      toast.success("Nouveau beneficiaire ajoute.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Ajout impossible.");
    } finally {
      setAddingBenef(false);
    }
  };

  const validateCession = async () => {
    if (!apiURL || !Number.isFinite(permisId) || !cedant || !canValidate) return;

    setSubmitting(true);
    try {
      const res = await axios.post(
        `${apiURL}/api/procedures/cession/start`,
        {
          permisId,
          cedantActionnaireId: cedant.id_actionnaire,
          tauxCede,
          beneficiaries,
          motif_cession: motif,
          date_demande: new Date().toISOString(),
        },
        { withCredentials: true },
      );

      const procId = Number(res.data?.new_proc_id);
      if (!Number.isFinite(procId)) {
        throw new Error("Procedure manquante");
      }

      setCreatedProcId(procId);
      setCessionValidated(true);
      setOpenModal(false);

      if (isCessionComplete) {
        toast.success("Cession complete validee.");
      } else {
        toast.success("Cession partielle validee.");
      }

      await loadActionnaires();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Validation impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = () => {
    if (!createdProcId) return;
    router.push(
      `/operateur/cession/step2/page2?id=${createdProcId}&permisId=${permisId}`,
    );
  };

  if (!Number.isFinite(permisId)) {
    return <div className={styles.invalidState}>`permisId` est obligatoire.</div>;
  }

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />

        <main className={styles.mainContent}>
          <div className={styles.container}>
            <div className={styles.stepperWrap}>
              <ProgressStepper
                steps={["Cession", "Documents", "Facture", "Paiement"]}
                currentStep={1}
              />
            </div>

            <div className={styles.contentWrapper}>
              <h1 className={styles.title}>Cession de parts</h1>
              <p className={styles.subtitle}>
                Cedez des parts d&apos;un actionnaire existant vers un ou plusieurs
                beneficiaires.
              </p>

              <section className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>Actionnaires et representant</h2>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => setOpenModal(true)}
                  >
                    <HandCoins size={16} /> Ceder des parts
                  </button>
                </div>

                {loading ? (
                  <div className={styles.inlineLoading}>
                    <Loader2 className={styles.spin} size={16} /> Chargement...
                  </div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Nom</th>
                          <th>Prenom</th>
                          <th>Fonction</th>
                          <th>Taux</th>
                          <th>Nationalite</th>
                          <th>Qualification</th>
                          <th>N° Identite</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {actionnaires.map((row) => (
                          <tr key={row.id_actionnaire}>
                            <td>{row.nom}</td>
                            <td>{row.prenom}</td>
                            <td>{row.type_fonction || "--"}</td>
                            <td>{row.taux.toFixed(2)}%</td>
                            <td>{row.nationalite || "--"}</td>
                            <td>{row.qualification || "--"}</td>
                            <td>{row.numero_carte || "--"}</td>
                            <td>
                              <button
                                type="button"
                                className={`${styles.deleteBtn} ${
                                  row.taux > 0 ? styles.deleteBtnDisabled : ""
                                }`}
                                onClick={() => void deleteActionnaire(row)}
                                title={
                                  row.taux > 0
                                    ? "Impossible : cet actionnaire detient encore des parts."
                                    : "Supprimer"
                                }
                                disabled={row.taux > 0}
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className={styles.totalBadge}>
                  Total: <strong>{Number(context?.total_taux ?? 0).toFixed(2)}%</strong>
                </div>
              </section>

              <div className={styles.bottomNav}>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => router.push(`/operateur/permisdashboard/${permisId}`)}
                >
                  <ArrowLeft size={16} /> Retour
                </button>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={goNext}
                  disabled={!cessionValidated || !createdProcId}
                >
                  Suivant <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {openModal && (
        <div className={styles.modalOverlay} onClick={() => setOpenModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Nouvelle cession</h3>

            <div className={styles.formGrid}>
              <label>
                Cedant
                <select
                  className={styles.input}
                  value={cedantId ?? ""}
                  onChange={(e) => {
                    setCedantId(Number(e.target.value) || null);
                    setBeneficiaries([]);
                  }}
                >
                  <option value="">Selectionner (taux &gt; 0)</option>
                  {actionnaires.map((a) => (
                    <option key={a.id_actionnaire} value={a.id_actionnaire}>
                      {a.nom} {a.prenom} ({a.taux.toFixed(2)}%)
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Taux cede (%)
                <input
                  className={styles.input}
                  type="number"
                  min={0}
                  step="0.01"
                  max={cedant?.taux ?? 100}
                  value={tauxCede}
                  onChange={(e) => setTauxCede(parseInputNumber(e.target.value))}
                />
              </label>

              <label className={styles.fullWidth}>
                Motif
                <input
                  className={styles.input}
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                />
              </label>
            </div>

            <div className={styles.modeLine}>
              <select
                className={styles.input}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  if (id) {
                    setBeneficiaries((prev) =>
                      prev.some((b) => b.id_actionnaire === id)
                        ? prev
                        : [
                            ...prev,
                            {
                              id_actionnaire: id,
                              taux:
                                prev.length === 0 && tauxCede > 0
                                  ? Number(tauxCede.toFixed(4))
                                  : 0,
                            },
                          ],
                    );
                  }
                  e.target.value = "";
                }}
                value=""
              >
                <option value="">Ajouter un beneficiaire existant</option>
                {beneficiaryChoices.map((a) => (
                  <option key={a.id_actionnaire} value={a.id_actionnaire}>
                    {a.nom} {a.prenom}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setShowNewBenef((v) => !v)}
              >
                <UserPlus size={15} />
                {showNewBenef
                  ? "Fermer"
                  : "Ajouter nouveau beneficiaire"}
              </button>
            </div>

            {showNewBenef && (
              <div className={styles.formGrid}>
                <label>
                  Nom *
                  <input
                    className={styles.input}
                    value={newBenef.nom}
                    onChange={(e) =>
                      setNewBenef((p) => ({ ...p, nom: e.target.value }))
                    }
                  />
                </label>

                <label>
                  Prenom *
                  <input
                    className={styles.input}
                    value={newBenef.prenom}
                    onChange={(e) =>
                      setNewBenef((p) => ({ ...p, prenom: e.target.value }))
                    }
                  />
                </label>

                <label>
                  Lieu naissance *
                  <input
                    className={styles.input}
                    value={newBenef.lieu_naissance}
                    onChange={(e) =>
                      setNewBenef((p) => ({
                        ...p,
                        lieu_naissance: e.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Qualification *
                  <input
                    className={styles.input}
                    value={newBenef.qualification}
                    onChange={(e) =>
                      setNewBenef((p) => ({
                        ...p,
                        qualification: e.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  N° identite *
                  <input
                    className={styles.input}
                    value={newBenef.numero_carte}
                    onChange={(e) =>
                      setNewBenef((p) => ({
                        ...p,
                        numero_carte: e.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Date de naissance
                  <input
                    className={styles.input}
                    type="date"
                    value={newBenef.date_naissance}
                    onChange={(e) =>
                      setNewBenef((p) => ({
                        ...p,
                        date_naissance: e.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Nationalite *
                  <select
                    className={styles.input}
                    value={newBenef.id_nationalite}
                    onChange={(e) =>
                      setNewBenef((p) => ({
                        ...p,
                        id_nationalite: e.target.value,
                      }))
                    }
                  >
                    <option value="">Selectionner</option>
                    {nationaliteOptions.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Pays *
                  <select
                    className={styles.input}
                    value={newBenef.id_pays}
                    onChange={(e) =>
                      setNewBenef((p) => ({
                        ...p,
                        id_pays: e.target.value,
                      }))
                    }
                  >
                    <option value="">Selectionner</option>
                    {paysOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Telephone
                  <input
                    className={styles.input}
                    value={newBenef.telephone}
                    onChange={(e) =>
                      setNewBenef((p) => ({
                        ...p,
                        telephone: e.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  Email
                  <input
                    className={styles.input}
                    value={newBenef.email}
                    onChange={(e) =>
                      setNewBenef((p) => ({ ...p, email: e.target.value }))
                    }
                  />
                </label>

                <label className={styles.fullWidth}>
                  Adresse
                  <input
                    className={styles.input}
                    value={newBenef.adresse}
                    onChange={(e) =>
                      setNewBenef((p) => ({ ...p, adresse: e.target.value }))
                    }
                  />
                </label>

                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => void addNewBeneficiary()}
                  disabled={addingBenef}
                >
                  {addingBenef
                    ? "Ajout..."
                    : "Valider nouveau beneficiaire"}
                </button>
              </div>
            )}

            <div className={styles.beneficiaryList}>
              {beneficiaries.map((b) => {
                const a = actionnaires.find(
                  (x) => x.id_actionnaire === b.id_actionnaire,
                );
                return (
                  <div key={b.id_actionnaire} className={styles.beneficiaryRow}>
                    <span>{a ? `${a.nom} ${a.prenom}` : `#${b.id_actionnaire}`}</span>
                    <input
                      className={styles.beneficiaryInput}
                      type="number"
                      min={0}
                      step="0.01"
                      value={b.taux}
                      onChange={(e) =>
                        setBeneficiaries((prev) =>
                          prev.map((x) =>
                            x.id_actionnaire === b.id_actionnaire
                              ? { ...x, taux: parseInputNumber(e.target.value) }
                              : x,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className={styles.smallDeleteBtn}
                      onClick={() =>
                        setBeneficiaries((prev) =>
                          prev.filter((x) => x.id_actionnaire !== b.id_actionnaire),
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className={styles.validationBox}>
              <span>
                Somme beneficiaires: <strong>{beneficiariesTotal.toFixed(2)}%</strong>
              </span>
              <span>
                Taux cede: <strong>{Number(tauxCede || 0).toFixed(2)}%</strong>
              </span>
              {cedant && (
                <span>
                  Type: <strong>{isCessionComplete ? "Cession complete" : "Cession partielle"}</strong>
                </span>
              )}
            </div>
            {!canValidate && validationHints.length > 0 && (
              <div className={styles.validationHints}>
                {validationHints.map((hint) => (
                  <p key={hint} className={styles.validationHintItem}>
                    {hint}
                  </p>
                ))}
                {cedantChoices.length === 0 && (
                  <p className={styles.validationHintItem}>
                    Aucun cedant eligible trouve (aucune personne avec taux superieur a 0).
                  </p>
                )}
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => setOpenModal(false)}
                disabled={submitting}
              >
                Annuler
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => void validateCession()}
                disabled={!canValidate || submitting}
              >
                {submitting ? "Validation..." : "Valider la cession"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
