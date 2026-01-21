"use client";

import { useEffect, useState, Suspense } from "react";
import axios from "axios";
import Navbar from "../../pages/navbar/Navbar";
import Sidebar from "../../pages/sidebar/Sidebar";
import { useSearchParams } from "react-router-dom";
import { useViewNavigator } from "../../src/hooks/useViewNavigator";
import ClientLayout from "../../utils/ClientLayout";
import styles from "./cession.module.css";
import { ViewType } from "@/src/types/viewtype";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

type Actionnaire = {
  id: number;
  nom: string;
  nomAR?: string;
  prenom: string;
  prenomAR?: string;
  lieu_naissance: string;
  nationalite: string;
  qualification: string;
  numIdentite: string;
  taux: number;
  pays: number | string;
  dateEntree: string;
  adresse_domicile?: string;
  telephone?: string;
  fax?: string;
  email?: string;
  siteWeb?: string;
  lieu_juridique_soc?: string;
  ref_professionnelles?: string;
  createdInCession?: boolean;
};

type Pays = {
  id_pays: number;
  nom_pays: string;
};

function CessionContent() {
  const [searchParams] = useSearchParams();
  const [idPermis, setIdPermis] = useState<string | null>(searchParams.get("idPermis"));
  const [actionnaires, setActionnaires] = useState<Actionnaire[]>([]);
  const [paysList, setPaysList] = useState<Pays[]>([]);
  const [isActionnaireModalOpen, setIsActionnaireModalOpen] = useState(false);
  const [isCessionModalOpen, setIsCessionModalOpen] = useState(false);
  const [actionnaireFormData, setActionnaireFormData] = useState<Actionnaire>({
    id: 0,
    nom: "",
    nomAR: "",
    prenom: "",
    prenomAR: "",
    lieu_naissance: "",
    nationalite: "",
    qualification: "",
    numIdentite: "",
    taux: 0,
    pays: "",
    dateEntree: new Date().toISOString().split("T")[0],
    adresse_domicile: "",
    telephone: "",
    fax: "",
    email: "",
    siteWeb: "",
    lieu_juridique_soc: "",
    ref_professionnelles: "",
  });
  const [cessionFormData, setCessionFormData] = useState<{
    ancienCessionnaireId: number | null;
    tauxCede: number;
    beneficiaries: { id: number; taux: number; nom: string }[];
  }>({
    ancienCessionnaireId: null,
    tauxCede: 0,
    beneficiaries: [],
  });
  const [showNewCessionnaireForm, setShowNewCessionnaireForm] = useState(false);
  const [newCessionnaireData, setNewCessionnaireData] = useState({
    nomFR: "",
    nomAR: "",
    prenomFR: "",
    prenomAR: "",
    adresseDomicile: "",
    telephone: "",
    fax: "",
    email: "",
    siteWeb: "",
    lieuJuridiqueSoc: "",
    refProfessionnelles: "",
    lieu_naissance: "",
    nationalite: "",
    qualification: "",
    numCarteIdentite: "",
    idPays: 0,
    dateNaissance: new Date().toISOString().split("T")[0],
    tauxParticipation: 0,
  });
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [transactionsEnCours, setTransactionsEnCours] = useState(0);

  const { currentView, navigateTo } = useViewNavigator("cession-permis");
  const nationalityOptions = Array.from(new Set(paysList.map((p) => p.nom_pays)));
  const qualificationOptions = ["Ingenieur", "Technicien", "Gestionnaire", "Administrateur", "Autre"];
  const phaseSteps = [
    { label: "Actionnaires" },
    { label: "Cession" },
    { label: "Validation" },
  ];

  useEffect(() => {
    if (!idPermis) {
      const params = new URLSearchParams(window.location.search);
      const newIdPermis = params.get("idPermis");
      if (newIdPermis) {
        setIdPermis(newIdPermis);
      } else {
        setErrorMessage("ID du permis manquant dans l'URL.");
        return;
      }
    }
    fetchData();
  }, [idPermis]);

  const fetchData = () => {
    if (!idPermis) return;
    axios
      .get(`${API_BASE}/actionnaires?permisId=${idPermis}`)
      .then((res) => {
        console.log("Actionnaires API response:", res.data);
        setActionnaires(res.data);
      })
      .catch((error) => {
        console.error("Error fetching actionnaires:", error);
        setErrorMessage(`Erreur lors du chargement des actionnaires: ${error.message}`);
      });

    axios
      .get(`${API_BASE}/actionnaires/pays`)
      .then((res) => {
        console.log("Pays API response:", res.data);
        setPaysList(res.data);
      })
      .catch((error) => {
        console.error("Error fetching pays:", error);
        setErrorMessage(`Erreur lors du chargement des pays: ${error.message}`);
      });
  };

  const totalParticipations = actionnaires.reduce((sum, a) => sum + a.taux, 0);

  const handleOpenActionnaireModal = (actionnaire?: Actionnaire) => {
    if (actionnaire) {
      console.log("Opening modal for actionnaire:", actionnaire); // Debugging
      setActionnaireFormData({
        id: actionnaire.id,
        nom: actionnaire.nom || "",
        nomAR: (actionnaire as any).nomAR || "",
        prenom: actionnaire.prenom || "",
        prenomAR: (actionnaire as any).prenomAR || "",
        lieu_naissance: (actionnaire as any).lieu_naissance || (actionnaire as any).lieuNaissance || "",
        nationalite: actionnaire.nationalite || "",
        qualification: actionnaire.qualification || "",
        numIdentite: actionnaire.numIdentite || "",
        taux: actionnaire.taux || 0,
        pays: actionnaire.pays || "", // Ensure pays is set correctly
        dateEntree: actionnaire.dateEntree || new Date().toISOString().split("T")[0],
        adresse_domicile: (actionnaire as any).adresse_domicile || "",
        telephone: (actionnaire as any).telephone || "",
        fax: (actionnaire as any).fax || "",
        email: (actionnaire as any).email || "",
        siteWeb: (actionnaire as any).siteWeb || "",
        lieu_juridique_soc: (actionnaire as any).lieu_juridique_soc || "",
        ref_professionnelles: (actionnaire as any).ref_professionnelles || "",
      });
    } else {
      setActionnaireFormData({
        id: 0,
        nom: "",
        nomAR: "",
        prenom: "",
        prenomAR: "",
        lieu_naissance: "",
        nationalite: "",
        qualification: "",
        numIdentite: "",
        taux: 0,
        pays: "",
        dateEntree: new Date().toISOString().split("T")[0],
        adresse_domicile: "",
        telephone: "",
        fax: "",
        email: "",
        siteWeb: "",
        lieu_juridique_soc: "",
        ref_professionnelles: "",
      });
    }
    setIsActionnaireModalOpen(true);
    setErrorMessage("");
  };

  const handleSubmitNewActionnaire = async () => {
    if (!idPermis) {
      setErrorMessage("ID du permis manquant.");
      return;
    }

    const isEditing = actionnaireFormData.id !== 0;

    // Calculate new total participation for validation
    const currentTaux = isEditing ? actionnaires.find(a => a.id === actionnaireFormData.id)?.taux || 0 : 0;
    const newTotal = totalParticipations - currentTaux + actionnaireFormData.taux;

    if (newTotal > 100) {
      setErrorMessage("L'ajout ou la modification de cet actionnaire depasse le total de 100%.");
      return;
    }

    try {
      if (isEditing) {
        // Update existing actionnaire
        await axios.put(`${API_BASE}/actionnaires/${actionnaireFormData.id}`, {
          nomFR: actionnaireFormData.nom,
          nomAR: actionnaireFormData.nomAR,
          prenomFR: actionnaireFormData.prenom,
          prenomAR: actionnaireFormData.prenomAR,
          lieuNaissance: actionnaireFormData.lieu_naissance,
          nationalite: actionnaireFormData.nationalite,
          qualification: actionnaireFormData.qualification,
          numCarteIdentite: actionnaireFormData.numIdentite,
          tauxParticipation: actionnaireFormData.taux,
          idPays: parseInt(actionnaireFormData.pays as string) || 0,
          adresseDomicile: actionnaireFormData.adresse_domicile,
          telephone: actionnaireFormData.telephone,
          fax: actionnaireFormData.fax,
          email: actionnaireFormData.email,
          siteWeb: actionnaireFormData.siteWeb,
          lieuJuridiqueSoc: actionnaireFormData.lieu_juridique_soc,
          refProfessionnelles: actionnaireFormData.ref_professionnelles,
        });
      } else {
        // Create new actionnaire
        const detenteurRes = await axios.get(`${API_BASE}/actionnaires/detenteur?permisId=${idPermis}`);
        const payload = {
          detenteurId: detenteurRes.data.id_detenteur,
          nomFR: actionnaireFormData.nom,
          nomAR: actionnaireFormData.nomAR || actionnaireFormData.nom,
          prenomFR: actionnaireFormData.prenom,
          prenomAR: actionnaireFormData.prenomAR || actionnaireFormData.prenom,
          lieu_naissance: actionnaireFormData.lieu_naissance,
          nationalite: actionnaireFormData.nationalite,
          qualification: actionnaireFormData.qualification,
          numCarteIdentite: actionnaireFormData.numIdentite,
          tauxParticipation: actionnaireFormData.taux,
          idPays: parseInt(actionnaireFormData.pays as string) || 0,
          dateNaissance: actionnaireFormData.dateEntree,
          typeFonction: "Actionnaire",
          statutPersonne: "Actif",
          adresseDomicile: actionnaireFormData.adresse_domicile,
          telephone: actionnaireFormData.telephone,
          fax: actionnaireFormData.fax,
          email: actionnaireFormData.email,
          siteWeb: actionnaireFormData.siteWeb,
          lieuJuridiqueSoc: actionnaireFormData.lieu_juridique_soc,
          refProfessionnelles: actionnaireFormData.ref_professionnelles,
        };
        await axios.post(`${API_BASE}/actionnaires`, payload);
      }

      setIsActionnaireModalOpen(false);
      fetchData();
      setErrorMessage("");
    } catch (error) {
      console.error("Error submitting actionnaire:", error);
      setErrorMessage("Erreur lors de la soumission de l'actionnaire.");
    }
  };

    const handleDeleteActionnaire = async (actionnaire: Actionnaire) => {
    if (!actionnaire.createdInCession && actionnaire.taux > 0) {
      setErrorMessage("Cet actionnaire provient du permis initial : cedez ses parts plutot que de le supprimer.");
      return;
    }

    if (!window.confirm("Etes-vous sur de vouloir supprimer cet actionnaire ?")) {
      return;
    }

    try {
      await axios.delete(`${API_BASE}/actionnaires/${actionnaire.id}`);
      setActionnaires(actionnaires.filter((a) => a.id !== actionnaire.id));
      setErrorMessage("");
    } catch (error) {
      console.error("Error deleting actionnaire:", error);
      setErrorMessage("Erreur lors de la suppression de l'actionnaire.");
    }
  };
  const handleOpenCessionModal = () => {
    setCessionFormData({
      ancienCessionnaireId: null,
      tauxCede: 0,
      beneficiaries: [],
    });
    setShowNewCessionnaireForm(false);
    setNewCessionnaireData({
      nomFR: "",
      nomAR: "",
      prenomFR: "",
      prenomAR: "",
      adresseDomicile: "",
      telephone: "",
      fax: "",
      email: "",
      siteWeb: "",
      lieuJuridiqueSoc: "",
      refProfessionnelles: "",
      lieu_naissance: "",
      nationalite: "",
      qualification: "",
      numCarteIdentite: "",
      idPays: 0,
      dateNaissance: new Date().toISOString().split("T")[0],
      tauxParticipation: 0,
    });
    setIsCessionModalOpen(true);
    setErrorMessage("");
  };

  const handleAddBeneficiary = (id: number, nom: string, prenom: string) => {
    setCessionFormData((prev) => {
      const isExisting = prev.beneficiaries.some((b) => b.id === id);
      if (!isExisting) {
        return {
          ...prev,
          beneficiaries: [...prev.beneficiaries, { id, taux: 0, nom: `${nom} ${prenom}` }],
        };
      }
      return prev;
    });
  };

    const handleCessionShares = async () => {
    if (!idPermis || cessionFormData.ancienCessionnaireId === null) {
      setErrorMessage("ID du permis ou de l'ancien cessionnaire manquant.");
      return;
    }

    const ancienActionnaire = actionnaires.find((a) => a.id === cessionFormData.ancienCessionnaireId);
    if (!ancienActionnaire) {
      setErrorMessage("Ancien actionnaire introuvable.");
      return;
    }

    if (cessionFormData.tauxCede > ancienActionnaire.taux) {
      setErrorMessage(`Le taux c�d� (${cessionFormData.tauxCede}%) ne peut pas �tre sup�rieur au taux de l'ancien actionnaire (${ancienActionnaire.taux}%).`);
      return;
    }

    const sumBeneficiaryTaux = cessionFormData.beneficiaries.reduce((sum, b) => sum + b.taux, 0);
    if (sumBeneficiaryTaux !== cessionFormData.tauxCede) {
      setErrorMessage("La somme des taux des nouveaux actionnaires doit �tre �gale au taux c�d�.");
      return;
    }

    const premierBenef = cessionFormData.beneficiaries[0];
    if (!premierBenef) {
      setErrorMessage("Veuillez s�lectionner au moins un b�n�ficiaire.");
      return;
    }

    try {
      const newAncienTaux = ancienActionnaire.taux - cessionFormData.tauxCede;
      await axios.put(`${API_BASE}/actionnaires/${ancienActionnaire.id}`, {
        ...ancienActionnaire,
        tauxParticipation: newAncienTaux,
        lieu_naissance: ancienActionnaire.lieu_naissance,
      });

      for (const beneficiary of cessionFormData.beneficiaries) {
        const existingBeneficiary = actionnaires.find((a) => a.id === beneficiary.id);
        if (existingBeneficiary) {
          const newTaux = existingBeneficiary.taux + beneficiary.taux;
          await axios.put(`${API_BASE}/actionnaires/${existingBeneficiary.id}`, {
            ...existingBeneficiary,
            tauxParticipation: newTaux,
            lieu_naissance: existingBeneficiary.lieu_naissance,
          });
        }
      }

      await axios.post(`${API_BASE}/actionnaires/cession`, {
        permisId: Number(idPermis),
        ancienCessionnaireId: cessionFormData.ancienCessionnaireId,
        nouveauCessionnaireId: premierBenef.id,
        motifCession: "Cession de parts",
        natureCession: cessionFormData.tauxCede === ancienActionnaire.taux ? "complet" : "partiel",
        tauxCession: cessionFormData.tauxCede,
      });

      setIsCessionModalOpen(false);
      fetchData();
      setErrorMessage("");
    } catch (error) {
      console.error("Error submitting cession:", error);
      setErrorMessage("Erreur lors de la soumission de la cession.");
    }
  };


  
  const handleAddPotentialNewCessionnaire = async () => {
    if (!idPermis) {
      setErrorMessage("ID du permis manquant.");
      return;
    }

    if (
      !newCessionnaireData.nomFR ||
      !newCessionnaireData.prenomFR ||
      !newCessionnaireData.lieu_naissance ||
      !newCessionnaireData.nationalite ||
      !newCessionnaireData.qualification ||
      !newCessionnaireData.numCarteIdentite ||
      !newCessionnaireData.idPays ||
      !newCessionnaireData.dateNaissance
    ) {
      setErrorMessage("Veuillez remplir tous les champs obligatoires du nouveau bénéficiaire.");
      return;
    }

    const newTotal = totalParticipations + newCessionnaireData.tauxParticipation;
    if (newTotal > 100) {
      setErrorMessage("L'ajout de ce nouvel actionnaire dépasse le total de 100%.");
      return;
    }

    try {
      const detenteurRes = await axios.get(`${API_BASE}/actionnaires/detenteur?permisId=${idPermis}`);
      const payload = {
        detenteurId: detenteurRes.data.id_detenteur,
        nomFR: newCessionnaireData.nomFR,
        nomAR: newCessionnaireData.nomAR || newCessionnaireData.nomFR,
        prenomFR: newCessionnaireData.prenomFR,
        prenomAR: newCessionnaireData.prenomAR || newCessionnaireData.prenomFR,
        dateNaissance: newCessionnaireData.dateNaissance,
        lieuNaissance: newCessionnaireData.lieu_naissance,
        nationalite: newCessionnaireData.nationalite,
        adresseDomicile: newCessionnaireData.adresseDomicile,
        telephone: newCessionnaireData.telephone,
        fax: newCessionnaireData.fax,
        email: newCessionnaireData.email,
        siteWeb: newCessionnaireData.siteWeb,
        qualification: newCessionnaireData.qualification,
        numCarteIdentite: newCessionnaireData.numCarteIdentite,
        lieuJuridiqueSoc: newCessionnaireData.lieuJuridiqueSoc,
        refProfessionnelles: newCessionnaireData.refProfessionnelles,
        idPays: newCessionnaireData.idPays,
        typeFonction: "Actionnaire",
        statutPersonne: "Actif",
        tauxParticipation: newCessionnaireData.tauxParticipation || 0,
      };
      const response = await axios.post(`${API_BASE}/actionnaires`, payload);
      const newPersonId = response.data.id_personne;

      handleAddBeneficiary(newPersonId, response.data.nomFR, response.data.prenomFR);
      setActionnaires((prev) => [
        ...prev,
        {
          id: newPersonId,
          nom: response.data.nomFR,
          prenom: response.data.prenomFR,
          lieu_naissance: response.data.lieu_naissance,
          nationalite: response.data.nationalite,
          qualification: response.data.qualification,
          numIdentite: response.data.num_carte_identite,
          taux: newCessionnaireData.tauxParticipation,
          pays: paysList.find((p) => p.id_pays == newCessionnaireData.idPays)?.nom_pays || "",
          dateEntree: response.data.date_naissance || "",
        },
      ]);
      setShowNewCessionnaireForm(false);
      setNewCessionnaireData({
        nomFR: "",
        nomAR: "",
        prenomFR: "",
        prenomAR: "",
        adresseDomicile: "",
        telephone: "",
        fax: "",
        email: "",
        siteWeb: "",
        lieuJuridiqueSoc: "",
        refProfessionnelles: "",
        lieu_naissance: "",
        nationalite: "",
        qualification: "",
        numCarteIdentite: "",
        idPays: 0,
        dateNaissance: new Date().toISOString().split("T")[0],
        tauxParticipation: 0,
      });
      setErrorMessage("");
    } catch (error) {
      console.error("Error adding new cessionnaire:", error);
      if (axios.isAxiosError(error)) {
        const raw = (error.response?.data as any)?.message;
        const serverMessage = Array.isArray(raw)
          ? raw.join(" | ")
          : raw || error.response?.statusText || error.message;
        setErrorMessage(`Erreur lors de l'ajout du nouveau cessionnaire: ${serverMessage}`);
      } else {
        setErrorMessage("Erreur lors de l'ajout du nouveau cessionnaire.");
      }
    }
  };

const cedingShareholder = actionnaires.find(a => a.id === cessionFormData.ancienCessionnaireId);
  
  if (!idPermis && errorMessage) {
    return (
      <ClientLayout>
        <div className={styles.appContainer}>
          <Navbar />
          <div className={styles.appContent}>
            <Sidebar currentView={"dashboard"} navigateTo={function (view: ViewType): void {
                        throw new Error("Function not implemented.");
                    } } />
            <main className={styles.mainContent}>
              <div className={styles.errorMessage}>{errorMessage}</div>
            </main>
          </div>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className={styles.appContainer}>
        <Navbar />
        <div className={styles.appContent}>
          <Sidebar currentView={currentView} navigateTo={navigateTo} />
          <main className={styles.mainContent}>
            <div className={styles.breadcrumb}>
              <span>Permis</span> &gt; <span>Cession</span>
            </div>
            <section className={styles.headerStats}>
              <div className={styles.statBadge}>
                <span className={styles.icon}>{String.fromCodePoint(0x1F465)}</span>
                <span className={styles.statText}>{actionnaires.length}</span>
                <span className={styles.statLabel}>Actionnaires</span>
              </div>
              <div className={styles.statBadge}>
                <span className={styles.icon}>{String.fromCodePoint(0x1F4CA)}</span>
                <span className={styles.statText}>{totalParticipations}%</span>
                <span className={styles.statLabel}>Total participations</span>
              </div>
              <div className={styles.statBadge}>
                <span className={styles.icon}>{String.fromCodePoint(0x1F504)}</span>
                <span className={styles.statText}>{transactionsEnCours}</span>
                <span className={styles.statLabel}>Transactions en cours</span>
              </div>
            </section>
            {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}
            <section className={styles.sectionTitle}>
              <div>
                <h2>Liste des Actionnaires</h2>
                <p>Gérez les actionnaires associés a ce permis</p>
              </div>
              <div className={styles.buttonContainer}>
                <button
                  className={styles.addButton}
                  onClick={handleOpenCessionModal}
                >
                  Céder des parts
                </button>
              </div>
            </section>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Lieu de Naissance</th>
                    <th>Nationalité</th>
                    <th>Qualification</th>
                    <th>Numéro d'Identité</th>
                    <th>Taux (%)</th>
                    <th>Pays</th>
                    <th>Date d'Entrée</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {actionnaires.map((actionnaire) => (
                    <tr key={actionnaire.id}>
                      <td>{actionnaire.nom}</td>
                      <td>{actionnaire.prenom}</td>
                      <td>{(actionnaire as any).lieu_naissance || (actionnaire as any).lieuNaissance || "Non specefie"}</td>
                      <td>{actionnaire.nationalite}</td>
                      <td>{actionnaire.qualification}</td>
                      <td>{actionnaire.numIdentite}</td>
                      <td>{actionnaire.taux}%</td>
                      <td>{paysList.find((p) => p.id_pays === Number(actionnaire.pays))?.nom_pays || actionnaire.pays || "Non specefie"}</td>
                      <td>{actionnaire.dateEntree}</td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button
                            className={styles.editIcon}
                            onClick={() => handleOpenActionnaireModal(actionnaire)}
                            title="Modifier l'actionnaire"
                          >
                            ✏️
                          </button>
                          <button
                            className={styles.deleteIcon}
                            onClick={() => handleDeleteActionnaire(actionnaire)}
                            title="Supprimer l'actionnaire"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isActionnaireModalOpen && (
              <div className={styles.modalOverlay}>
                <div className={styles.modalContent}>
                  <h3>
                    <span className={styles.modalIcon}>👤</span>
                    {actionnaireFormData.id === 0 ? "Ajouter Actionnaire" : "Modifier Actionnaire"}
                  </h3>
                  <div className={styles.formSection}>
                    <h4>Informations Personnelles</h4>
                    <div className={styles.formGrid}>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Nom *</label>
                        <input
                          className={styles.input}
                          value={actionnaireFormData.nom}
                          onChange={(e) =>
                            setActionnaireFormData({ ...actionnaireFormData, nom: e.target.value })
                          }
                          placeholder="Nom"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Prénom *</label>
                        <input
                          className={styles.input}
                          value={actionnaireFormData.prenom}
                          onChange={(e) =>
                            setActionnaireFormData({ ...actionnaireFormData, prenom: e.target.value })
                          }
                          placeholder="Prénom"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Nom (arabe)</label>
                        <input
                          className={styles.input}
                          value={actionnaireFormData.nomAR || ""}
                          onChange={(e) =>
                            setActionnaireFormData({ ...actionnaireFormData, nomAR: e.target.value })
                          }
                          placeholder="Nom (arabe)"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Prénom (arabe)</label>
                        <input
                          className={styles.input}
                          value={actionnaireFormData.prenomAR || ""}
                          onChange={(e) =>
                            setActionnaireFormData({ ...actionnaireFormData, prenomAR: e.target.value })
                          }
                          placeholder="Prénom (arabe)"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Lieu de Naissance *</label>
                        <input
                          className={styles.input}
                          value={actionnaireFormData.lieu_naissance || ""}
                          onChange={(e) =>
                            setActionnaireFormData({ ...actionnaireFormData, lieu_naissance: e.target.value })
                          }
                          placeholder="Lieu de naissance"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Nationalité *</label>
                        <input
                          className={styles.input}
                          value={actionnaireFormData.nationalite}
                          onChange={(e) =>
                            setActionnaireFormData({ ...actionnaireFormData, nationalite: e.target.value })
                          }
                          placeholder="Nationalité"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Qualification *</label>
                        <input
                          className={styles.input}
                          value={actionnaireFormData.qualification}
                          onChange={(e) =>
                            setActionnaireFormData({ ...actionnaireFormData, qualification: e.target.value })
                          }
                          placeholder="Qualification"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Numéro d'Identité *</label>
                        <input
                          className={styles.input}
                          value={actionnaireFormData.numIdentite}
                          onChange={(e) =>
                            setActionnaireFormData({ ...actionnaireFormData, numIdentite: e.target.value })
                          }
                          placeholder="Numéro d'identité"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Adresse</label>
                        <input
                          className={styles.input}
                          value={actionnaireFormData.adresse_domicile || ""}
                          onChange={(e) =>
                            setActionnaireFormData({ ...actionnaireFormData, adresse_domicile: e.target.value })
                          }
                          placeholder="Adresse"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Téléphone</label>
                        <input
                          className={styles.input}
                          value={actionnaireFormData.telephone || ""}
                          onChange={(e) =>
                            setActionnaireFormData({ ...actionnaireFormData, telephone: e.target.value })
                          }
                          placeholder="Téléphone"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Email</label>
                        <input
                          className={styles.input}
                          type="email"
                          value={actionnaireFormData.email || ""}
                          onChange={(e) =>
                            setActionnaireFormData({ ...actionnaireFormData, email: e.target.value })
                          }
                          placeholder="Email"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Fax</label>
                        <input
                          className={styles.input}
                          value={actionnaireFormData.fax || ""}
                          onChange={(e) =>
                            setActionnaireFormData({ ...actionnaireFormData, fax: e.target.value })
                          }
                          placeholder="Fax"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Taux de Participation (%) *</label>
                        <input
                          className={styles.input}
                          type="number"
                          value={actionnaireFormData.taux}
                          onChange={(e) =>
                            setActionnaireFormData({ ...actionnaireFormData, taux: parseFloat(e.target.value) || 0 })
                          }
                          placeholder="Taux de participation"
                          readOnly={actionnaireFormData.id !== 0}
                          disabled={actionnaireFormData.id !== 0}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Pays *</label>
                        <select
                          className={styles.select}
                          value={actionnaireFormData.pays || ""}
                          onChange={(e) =>
                            setActionnaireFormData({ ...actionnaireFormData, pays: e.target.value })
                          }
                        >
                          <option value="">Sélectionner un pays</option>
                          {paysList.map((pays) => (
                            <option key={pays.id_pays} value={pays.id_pays}>
                              {pays.nom_pays}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Date d'Entrée *</label>
                        <input
                          className={styles.input}
                          type="date"
                          value={actionnaireFormData.dateEntree}
                          onChange={(e) =>
                            setActionnaireFormData({ ...actionnaireFormData, dateEntree: e.target.value })
                          }
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Site Web</label>
                        <input
                          className={styles.input}
                          value={actionnaireFormData.siteWeb || ""}
                          onChange={(e) =>
                            setActionnaireFormData({ ...actionnaireFormData, siteWeb: e.target.value })
                          }
                          placeholder="Site Web"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Lieu juridique</label>
                        <input
                          className={styles.input}
                          value={actionnaireFormData.lieu_juridique_soc || ""}
                          onChange={(e) =>
                            setActionnaireFormData({ ...actionnaireFormData, lieu_juridique_soc: e.target.value })
                          }
                          placeholder="Lieu juridique"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>Références professionnelles</label>
                        <input
                          className={styles.input}
                          value={actionnaireFormData.ref_professionnelles || ""}
                          onChange={(e) =>
                            setActionnaireFormData({ ...actionnaireFormData, ref_professionnelles: e.target.value })
                          }
                          placeholder="Références professionnelles"
                        />
                      </div>
                    </div>
                  </div>
                  <div className={styles.modalButtons}>
                    <button
                      className={styles.cancelButton}
                      onClick={() => setIsActionnaireModalOpen(false)}
                    >
                      Annuler
                    </button>
                    <button
                      className={styles.submitButton}
                      onClick={handleSubmitNewActionnaire}
                    >
                      {actionnaireFormData.id === 0 ? "Ajouter" : "Mettre à jour"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {isCessionModalOpen && (
              <div className={styles.modalOverlay}>
                <div className={styles.modalContent}>
                  <h3>
                    <span className={styles.modalIcon}>🔄</span>
                    Nouvelle Cession
                  </h3>
                  <div className={styles.formSection}>
                    <h4>Ancien Actionnaire (Cédant)</h4>
                    <div className={styles.formGrid}>
                      <div className={styles.formGroup}>
                        <label className={styles.label}></label>
                        <select
                          className={styles.select}
                          value={cessionFormData.ancienCessionnaireId || ""}
                          onChange={(e) =>
                            setCessionFormData({
                              ...cessionFormData,
                              ancienCessionnaireId: parseInt(e.target.value) || null,
                              tauxCede: 0,
                              beneficiaries: [],
                            })
                          }
                        >
                          <option value="">Sélectionner un actionnaire</option>
                          {actionnaires.map((actionnaire) => (
                            <option key={actionnaire.id} value={actionnaire.id}>
                              {actionnaire.nom} {actionnaire.prenom} ({actionnaire.taux}%)
                            </option>
                          ))}
                        </select>
                      </div>
                      {cedingShareholder && (
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Taux de parts à céder (%)</label>
                          <input
                            className={styles.input}
                            type="number"
                            value={cessionFormData.tauxCede}
                            onChange={(e) =>
                              setCessionFormData({
                                ...cessionFormData,
                                tauxCede: parseFloat(e.target.value) || 0,
                              })
                            }
                            max={cedingShareholder.taux}
                          />
                          <div className={styles.inputRow}>
                            <button
                              type="button"
                              className={styles.maxButton}
                              onClick={() =>
                                setCessionFormData({
                                  ...cessionFormData,
                                  tauxCede: cedingShareholder.taux,
                                })
                              }
                            >
                              Max
                            </button>
                            {cessionFormData.tauxCede > cedingShareholder.taux && (
                              <span className={styles.warningText}>
                                Taux disponible : {cedingShareholder.taux}%
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {cessionFormData.ancienCessionnaireId && (
                    <div className={styles.formSection}>
                      <h4>Nouveaux Actionnaires (Bénéficiaires)</h4>
                      <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Ajouter un Bénéficiaire existant</label>
                          <select
                            className={styles.select}
                            onChange={(e) => {
                              const selectedId = parseInt(e.target.value);
                              const selectedActionnaire = actionnaires.find(a => a.id === selectedId);
                              if (selectedActionnaire) {
                                handleAddBeneficiary(selectedId, selectedActionnaire.nom, selectedActionnaire.prenom);
                                e.target.value = "";
                              }
                            }}
                            value=""
                          >
                            <option value="">Sélectionner un actionnaire</option>
                            {actionnaires
                              .filter(a => a.id !== cessionFormData.ancienCessionnaireId && !cessionFormData.beneficiaries.some(b => b.id === a.id))
                              .map((actionnaire) => (
                                <option key={actionnaire.id} value={actionnaire.id}>
                                  {actionnaire.nom} {actionnaire.prenom}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Ajouter un nouveau bénéficiaire</label>
                          <button
                            className={styles.addPersonButton}
                            onClick={() => setShowNewCessionnaireForm(!showNewCessionnaireForm)}
                          >
                            {showNewCessionnaireForm ? "Annuler" : "Ajouter un nouveau"}
                          </button>
                        </div>
                      </div>
                      {showNewCessionnaireForm && (
                        <div className={styles.formSection}>
                          <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Nom *</label>
                              <input className={styles.input} value={newCessionnaireData.nomFR} onChange={(e) => setNewCessionnaireData({...newCessionnaireData, nomFR: e.target.value})} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Nom (arabe)</label>
                              <input className={styles.input} value={newCessionnaireData.nomAR} onChange={(e) => setNewCessionnaireData({...newCessionnaireData, nomAR: e.target.value})} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Prénom *</label>
                              <input className={styles.input} value={newCessionnaireData.prenomFR} onChange={(e) => setNewCessionnaireData({...newCessionnaireData, prenomFR: e.target.value})} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Prénom (arabe)</label>
                              <input className={styles.input} value={newCessionnaireData.prenomAR} onChange={(e) => setNewCessionnaireData({...newCessionnaireData, prenomAR: e.target.value})} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Lieu de Naissance *</label>
                              <input className={styles.input} value={newCessionnaireData.lieu_naissance} onChange={(e) => setNewCessionnaireData({...newCessionnaireData, lieu_naissance: e.target.value})} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Nationalité *</label>
                              <select
                                className={styles.select}
                                value={newCessionnaireData.nationalite}
                                onChange={(e) => setNewCessionnaireData({ ...newCessionnaireData, nationalite: e.target.value })}
                              >
                                <option value="">Sélectionner</option>
                                {nationalityOptions.map((nat) => (
                                  <option key={nat} value={nat}>{nat}</option>
                                ))}
                              </select>
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Qualification *</label>
                              <select
                                className={styles.select}
                                value={newCessionnaireData.qualification}
                                onChange={(e) => setNewCessionnaireData({ ...newCessionnaireData, qualification: e.target.value })}
                              >
                                <option value="">Sélectionner</option>
                                {qualificationOptions.map((qual) => (
                                  <option key={qual} value={qual}>{qual}</option>
                                ))}
                              </select>
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Numéro d'Identité *</label>
                              <input className={styles.input} value={newCessionnaireData.numCarteIdentite} onChange={(e) => setNewCessionnaireData({...newCessionnaireData, numCarteIdentite: e.target.value})} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Adresse</label>
                              <input className={styles.input} value={newCessionnaireData.adresseDomicile} onChange={(e) => setNewCessionnaireData({...newCessionnaireData, adresseDomicile: e.target.value})} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Téléphone</label>
                              <input className={styles.input} value={newCessionnaireData.telephone} onChange={(e) => setNewCessionnaireData({...newCessionnaireData, telephone: e.target.value})} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Email</label>
                              <input className={styles.input} type="email" value={newCessionnaireData.email} onChange={(e) => setNewCessionnaireData({...newCessionnaireData, email: e.target.value})} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Fax</label>
                              <input className={styles.input} value={newCessionnaireData.fax} onChange={(e) => setNewCessionnaireData({...newCessionnaireData, fax: e.target.value})} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Site Web</label>
                              <input className={styles.input} value={newCessionnaireData.siteWeb} onChange={(e) => setNewCessionnaireData({...newCessionnaireData, siteWeb: e.target.value})} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Lieu Juridique</label>
                              <input className={styles.input} value={newCessionnaireData.lieuJuridiqueSoc} onChange={(e) => setNewCessionnaireData({...newCessionnaireData, lieuJuridiqueSoc: e.target.value})} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Références professionnelles</label>
                              <input className={styles.input} value={newCessionnaireData.refProfessionnelles} onChange={(e) => setNewCessionnaireData({...newCessionnaireData, refProfessionnelles: e.target.value})} />
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Pays *</label>
                              <select className={styles.select} value={newCessionnaireData.idPays || ""} onChange={(e) => setNewCessionnaireData({...newCessionnaireData, idPays: parseInt(e.target.value) || 0})}>
                                <option value="">Sélectionner un pays</option>
                                {paysList.map((pays) => (
                                  <option key={pays.id_pays} value={pays.id_pays}>{pays.nom_pays}</option>
                                ))}
                              </select>
                            </div>
                            <div className={styles.formGroup}>
                              <label className={styles.label}>Date de Naissance *</label>
                              <input className={styles.input} type="date" value={newCessionnaireData.dateNaissance} onChange={(e) => setNewCessionnaireData({...newCessionnaireData, dateNaissance: e.target.value})} />
                            </div>
                          </div>
                          <div className={styles.modalButtons}>
                            <button className={styles.submitButton} onClick={handleAddPotentialNewCessionnaire}>
                              Valider le nouvel actionnaire
                            </button>
                          </div>
                        </div>
                      )}
                      {cessionFormData.beneficiaries.length > 0 && (
                        <div className={styles.formSection}>
                                                    <h4>Parts a distribuer ({cessionFormData.tauxCede}%)</h4>
                          {cessionFormData.beneficiaries.map((beneficiary, index) => (
                            <div key={beneficiary.id} className={styles.formGrid}>
                              <div className={styles.formGroup}>
                                <label className={styles.label}>{beneficiary.nom}</label>
                                <div className={styles.inputRow}>
                                  <input
                                    className={styles.input}
                                    type="number"
                                    value={beneficiary.taux}
                                    onChange={(e) => {
                                      const newTaux = parseFloat(e.target.value) || 0;
                                      setCessionFormData(prev => ({
                                        ...prev,
                                        beneficiaries: prev.beneficiaries.map((b, i) =>
                                          i === index ? { ...b, taux: newTaux } : b
                                        ),
                                      }));
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className={styles.maxButton}
                                    onClick={() => {
                                      setCessionFormData(prev => {
                                        const remaining = prev.tauxCede - prev.beneficiaries.reduce((sum, b, i2) => i2 === index ? sum : sum + b.taux, 0);
                                        return {
                                          ...prev,
                                          beneficiaries: prev.beneficiaries.map((b, i2) =>
                                            i2 === index ? { ...b, taux: Math.max(0, remaining) } : b
                                          ),
                                        };
                                      });
                                    }}
                                  >
                                    Max
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className={styles.modalButtons}>
                    <button
                      className={styles.cancelButton}
                      onClick={() => setIsCessionModalOpen(false)}
                    >
                      Annuler
                    </button>
                    <button
                      className={styles.submitButton}
                      onClick={handleCessionShares}
                    >
                      Soumettre Cession
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </ClientLayout>
  );
}

export default function CessionPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CessionContent />
    </Suspense>
  );
}







