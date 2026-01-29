'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import router from 'next/router';
import { useSearchParams } from '@/src/hooks/useSearchParams';
import Navbar from '../../../navbar/Navbar';
import Sidebar from '../../../sidebar/Sidebar';
import { useViewNavigator } from '../../../../src/hooks/useViewNavigator';
import ProgressStepper from '../../../../components/ProgressStepper';
import { useActivateEtape } from '@/src/hooks/useActivateEtape';
import { Phase, Procedure, ProcedureEtape, ProcedurePhase } from '@/src/types/procedure';
import { Building2, User, FileText, Users, Plus, X, AlertCircle } from 'lucide-react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import layoutStyles from './page2.module.css';
import styles from '../../../../components/wizard/steps/StepIdentification.module.css';
import { toast } from 'react-toastify';

type StatutJuridique = {
  id_statutJuridique: number;
  code_statut: string;
  statut_fr: string;
  statut_ar: string;
};

type Pays = {
  id_pays: number;
  nom_pays: string;
  nationalite: string;
};

type Nationalite = {
  id_nationalite: number;
  libelle: string;
};

type Actionnaire = {
  id?: number;
  nom: string;
  prenom: string;
  lieu_naissance: string;
  qualification: string;
  numero_carte: string;
  taux_participation: string;
  id_pays: number | null;
  id_nationalite?: number | null;
};

type SocieteData = {
  infos: {
    nom_fr: string;
    nom_ar: string;
    statut_id: number;
    tel: string;
    email: string;
    fax: string;
    site_web: string;
    adresse: string;
    date_constitution?: string;
    id_pays: number | null;
    id_nationalite?: number | null;
  };
  repLegal: {
    nom: string;
    prenom: string;
    nom_ar: string;
    prenom_ar: string;
    tel: string;
    email: string;
    fax: string;
    qualite: string;
    pouvoirs: string;
    nin: string;
    taux_participation: string;
    id_pays: number | null;
    id_nationalite?: number | null;
  };
  rcDetails: {
    numero_rc: string;
    date_enregistrement: string;
    capital_social: string;
    nis: string;
    adresse_legale: string;
    nif: string;
  };
  actionnaires: Actionnaire[];
};

const initialData: SocieteData = {
  infos: {
    nom_fr: '',
    nom_ar: '',
    statut_id: 0,
    tel: '',
    email: '',
    fax: '',
    site_web: '',
    adresse: '',
    date_constitution: '',
    id_pays: null,
    id_nationalite: null,
  },
  repLegal: {
    nom: '',
    prenom: '',
    nom_ar: '',
    prenom_ar: '',
    tel: '',
    email: '',
    fax: '',
    qualite: '',
    pouvoirs: '',
    nin: '',
    taux_participation: '',
    id_pays: null,
    id_nationalite: null,
  },
  rcDetails: {
    numero_rc: '',
    date_enregistrement: '',
    capital_social: '',
    nis: '',
    adresse_legale: '',
    nif: '',
  },
  actionnaires: [],
};

const qualitesRepresentant = [
  'Gérant',
  'Directeur Général',
  'Président Directeur Général',
  'Directeur',
];

export default function Step2() {
  const { currentView, navigateTo } = useViewNavigator('nouvelle-demande');
  const searchParams = useSearchParams();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const [idProc, setIdProc] = useState<number | undefined>(undefined);
  const [procedureData, setProcedureData] = useState<Procedure | null>(null);
  const [procedureTypeId, setProcedureTypeId] = useState<number | undefined>(undefined);
  const [currentStep, setCurrentStep] = useState(2);
  const [activatedSteps, setActivatedSteps] = useState<Set<number>>(new Set());
  const [idDemande, setIdDemande] = useState<string | null>(null);
  const [codeDemande, setCodeDemande] = useState<string | null>(null);
  const [detenteurId, setDetenteurId] = useState<number | null>(null);
  const [statutProc, setStatutProc] = useState<string | undefined>(undefined);
  const [statutsJuridiques, setStatutsJuridiques] = useState<StatutJuridique[]>([]);
  const [paysOptions, setPaysOptions] = useState<Pays[]>([]);
  const [nationalitesOptions, setNationalitesOptions] = useState<Nationalite[]>([]);
  const [formData, setFormData] = useState<SocieteData>(initialData);
  const [isPageReady, setIsPageReady] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Chargement des données...');
  const [savingEtape, setSavingEtape] = useState(false);
  const [etapeMessage, setEtapeMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const isLocked = statutProc === 'TERMINEE';

  const formatDate = (isoDate?: string) => {
    if (!isoDate) return '';
    return new Date(isoDate).toISOString().split('T')[0];
  };

  useEffect(() => {
    const idProcStr = searchParams?.get('id');
    if (!idProcStr) {
      setLoadingMessage('ID de procédure non trouvé dans les paramètres');
      return;
    }

    const parsedId = parseInt(idProcStr, 10);
    if (isNaN(parsedId)) {
      setLoadingMessage('ID de procédure invalide');
      return;
    }

    setIdProc(parsedId);
    setLoadingMessage('Chargement des données de la procédure...');
  }, [searchParams]);

  useEffect(() => {
    if (!idProc) return;

    const fetchProcedureData = async () => {
      try {
        const response = await axios.get<Procedure>(
          `${apiURL}/api/procedure-etape/procedure/${idProc}`,
        );
        setProcedureData(response.data);

        if (response.data.demandes && response.data.demandes.length > 0) {
          setProcedureTypeId(response.data.demandes[0].typeProcedure?.id);
        }

        const activeEtape = response.data.ProcedureEtape.find(
          (pe: ProcedureEtape) => pe.statut === 'EN_COURS',
        );
        if (activeEtape?.id_etape) {
          setCurrentStep(activeEtape.id_etape);
        } else {
          setCurrentStep(2);
        }
      } catch (error) {
        console.error('Error fetching procedure data:', error);
        setLoadingMessage('Erreur lors du chargement des données de procédure');
      }
    };

    fetchProcedureData();
  }, [idProc, apiURL, refetchTrigger]);

  useEffect(() => {
    if (!idProc || !procedureData) return;

    const fetchDemandeFromProc = async () => {
      try {
        const res = await axios.get(`${apiURL}/api/procedures/${idProc}/demande`);
        const demande = res.data;

        setCodeDemande(demande.code_demande);
        setIdDemande(demande.id_demande.toString());
        setStatutProc(res.data.procedure?.statut_proc);

        if (demande.detenteur) {
          const fonctions = demande.detenteur.fonctions || [];
          const representant = fonctions.find(
            (f: { type_fonction: string }) => f.type_fonction === 'Representant',
          );
          const actionnaires = fonctions.filter(
            (f: { type_fonction: string }) => f.type_fonction === 'Actionnaire',
          );

          setDetenteurId(demande.detenteur.id_detenteur);

          const rcData =
            demande.detenteur.registreCommerce && demande.detenteur.registreCommerce.length > 0
              ? demande.detenteur.registreCommerce[0]
              : {};

          setFormData({
            infos: {
              nom_fr: demande.detenteur.nom_societeFR || '',
              nom_ar: demande.detenteur.nom_societeAR || '',
              statut_id: demande.detenteur.id_statutJuridique || 0,
              tel: demande.detenteur.telephone || '',
              email: demande.detenteur.email || '',
              fax: demande.detenteur.fax || '',
              site_web: demande.detenteur.site_web || '',
              adresse: demande.detenteur.adresse_siege || '',
              date_constitution: formatDate((demande.detenteur as any).date_constitution),
              id_pays: demande.detenteur.id_pays || null,
              id_nationalite: (demande.detenteur as any).id_nationalite ?? null,
            },
            repLegal: representant
              ? {
                  nom: representant.personne.nomFR || '',
                  prenom: representant.personne.prenomFR || '',
                  nom_ar: representant.personne.nomAR || '',
                  prenom_ar: representant.personne.prenomAR || '',
                  tel: representant.personne.telephone || '',
                  email: representant.personne.email || '',
                  fax: representant.personne.fax || '',
                  qualite: representant.personne.qualification || '',
                  pouvoirs: representant.personne.pouvoirs || '',
                  nin: representant.personne.num_carte_identite || '',
                  taux_participation: representant.taux_participation?.toString() || '',
                  id_pays: representant.personne.id_pays || null,
                  id_nationalite: representant.personne.id_nationalite ?? null,
                }
              : initialData.repLegal,
            rcDetails: {
              numero_rc: rcData.numero_rc || '',
              date_enregistrement: formatDate(rcData.date_enregistrement),
              capital_social: rcData.capital_social?.toString() || '',
              nis: rcData.nis || '',
              adresse_legale: rcData.adresse_legale || '',
              nif: rcData.nif || '',
            },
            actionnaires: actionnaires.map((a: any, index: number) => ({
              id: a.id_fonction ?? Date.now() + index,
              nom: a.personne.nomFR || '',
              prenom: a.personne.prenomFR || '',
              lieu_naissance: a.personne.lieu_naissance || '',
              qualification: a.personne.qualification || '',
              numero_carte: a.personne.num_carte_identite || '',
              taux_participation: a.taux_participation?.toString() || '',
              id_pays: a.personne.id_pays || null,
              id_nationalite: a.personne.id_nationalite ?? null,
            })),
          });
        } else {
          setFormData(initialData);
          setDetenteurId(null);
        }

        setLoadingMessage('Données de demande chargées, chargement des options...');
      } catch (err) {
        console.error('Erreur lors de la récupération de la demande:', err);
        setLoadingMessage('Erreur lors de la récupération de la demande');
      }
    };

    fetchDemandeFromProc();
  }, [idProc, procedureData, apiURL]);

  useEffect(() => {
    if (!idDemande) return;

    const fetchAdditionalData = async () => {
      try {
        const paysResponse = await axios.get<Pays[]>(`${apiURL}/statuts-juridiques/pays`);
        setPaysOptions(paysResponse.data);

        const statutsResponse = await axios.get<StatutJuridique[]>(
          `${apiURL}/api/statuts-juridiques`,
        );
        setStatutsJuridiques(statutsResponse.data);

        const natsResponse = await axios.get<Nationalite[]>(
          `${apiURL}/statuts-juridiques/nationalites`,
        );
        setNationalitesOptions(natsResponse.data);

        setLoadingMessage('Options chargées, préparation de la page...');
      } catch (error) {
        console.error('Error fetching additional data:', error);
        setLoadingMessage('Erreur lors du chargement des options');
      }
    };

    fetchAdditionalData();
  }, [idDemande, apiURL]);

  const checkRequiredData = useCallback(() => {
    return (
      !!idProc &&
      !!procedureData &&
      !!idDemande &&
      statutsJuridiques.length > 0 &&
      paysOptions.length > 0 &&
      nationalitesOptions.length > 0
    );
  }, [idProc, procedureData, idDemande, statutsJuridiques, paysOptions, nationalitesOptions]);

  useEffect(() => {
    if (checkRequiredData()) {
      setIsPageReady(true);
    }
  }, [checkRequiredData]);

  useActivateEtape({
    idProc,
    etapeNum: 2,
    shouldActivate: currentStep === 2 && !activatedSteps.has(2) && isPageReady,
    onActivationSuccess: (stepStatus: string) => {
      setActivatedSteps(prev => new Set(prev).add(2));
      if (stepStatus !== 'TERMINEE') {
        setTimeout(() => setRefetchTrigger(prev => prev + 1), 500);
      }
    },
  });

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

  const totalParticipation = useMemo(() => {
    const representantTaux = parseFloat(formData.repLegal.taux_participation) || 0;
    const actionnairesTaux = formData.actionnaires.reduce((sum, actionnaire) => {
      return sum + (parseFloat(actionnaire.taux_participation) || 0);
    }, 0);
    return representantTaux + actionnairesTaux;
  }, [formData.repLegal.taux_participation, formData.actionnaires]);

  const isParticipationValid = Math.abs(totalParticipation - 100) <= 0.001;

  const areActionnairesValid = useMemo(() => {
    return formData.actionnaires.every((a) => {
      return (
        a.nom.trim() !== '' &&
        a.prenom.trim() !== '' &&
        a.lieu_naissance.trim() !== '' &&
        a.numero_carte.trim() !== '' &&
        a.taux_participation.trim() !== '' &&
        !!a.id_pays &&
        !!a.id_nationalite
      );
    });
  }, [formData.actionnaires]);

  const isFormValid = useMemo(() => {
    const infosValid =
      formData.infos.nom_fr.trim() !== '' &&
      formData.infos.statut_id > 0 &&
      !!formData.infos.id_pays &&
      formData.infos.tel.trim() !== '' &&
      formData.infos.email.trim() !== '' &&
      !!formData.infos.id_nationalite &&
      formData.infos.adresse.trim() !== '';

    const repValid =
      formData.repLegal.nom.trim() !== '' &&
      formData.repLegal.prenom.trim() !== '' &&
      formData.repLegal.tel.trim() !== '' &&
      formData.repLegal.email.trim() !== '' &&
      formData.repLegal.qualite.trim() !== '' &&
      !!formData.repLegal.id_pays &&
      !!formData.repLegal.id_nationalite &&
      formData.repLegal.nin.trim() !== '';

    const rcValid =
      formData.rcDetails.numero_rc.trim() !== '' &&
      formData.rcDetails.date_enregistrement.trim() !== '' &&
      formData.rcDetails.capital_social.trim() !== '' &&
      formData.rcDetails.nis.trim() !== '' &&
      formData.rcDetails.nif.trim() !== '' &&
      formData.rcDetails.adresse_legale.trim() !== '';

    return infosValid && repValid && rcValid && areActionnairesValid && isParticipationValid;
  }, [formData, areActionnairesValid, isParticipationValid]);

  const handlePrevious = () => {
    router.push(`/investisseur/nouvelle_demande/step1/page1?id=${idProc}`);
  };

  const handleNext = useCallback(async () => {
    if (isNavigating || isSubmitting || savingEtape) return;

    if (!isFormValid) {
      toast.warning('Veuillez remplir tous les champs obligatoires avant de continuer.');
      return;
    }

    if (!idProc) {
      toast.error('ID proc?dure manquant.');
      return;
    }

    setIsSubmitting(true);
    setSavingEtape(true);
    setIsNavigating(true);
    setEtapeMessage(null);

    try {
      await saveIdentification();
      await axios.post(`${apiURL}/api/procedure-etape/finish/${idProc}/2`);
      setRefetchTrigger(prev => prev + 1);
      await router.push(`/investisseur/nouvelle_demande/step3/page3?id=${idProc}`);
    } catch (err) {
      console.error(err);
      setEtapeMessage("Erreur lors de l'enregistrement de l'?tape.");
      toast.error("Erreur lors de l'enregistrement de l'?tape.");
    } finally {
      setIsNavigating(false);
      setIsSubmitting(false);
      setSavingEtape(false);
    }
  }, [
    isNavigating,
    isSubmitting,
    savingEtape,
    isFormValid,
    idProc,
    saveIdentification,
    apiURL,
  ]);

  const handleAddActionnaire = () => {
    setFormData(prev => ({
      ...prev,
      actionnaires: [
        ...prev.actionnaires,
        {
          id: Date.now(),
          nom: '',
          prenom: '',
          lieu_naissance: '',
          qualification: '',
          numero_carte: '',
          taux_participation: '',
          id_pays: null,
          id_nationalite: null,
        },
      ],
    }));
  };

  const handleRemoveActionnaire = (id?: number) => {
    if (!id) return;
    setFormData(prev => ({
      ...prev,
      actionnaires: prev.actionnaires.filter(a => a.id !== id),
    }));
  };

  const handleActionnaireChange = (
    id: number | undefined,
    field: keyof Actionnaire,
    value: string,
  ) => {
    if (!id) return;
    setFormData(prev => ({
      ...prev,
      actionnaires: prev.actionnaires.map(a =>
        a.id === id
          ? {
              ...a,
              [field]:
                field === 'id_pays' || field === 'id_nationalite'
                  ? value
                    ? parseInt(value, 10)
                    : null
                  : value,
            }
          : a,
      ),
    }));
  };

  const saveIdentification = async () => {
    if (!idDemande) throw new Error('ID demande manquant.');

    const infosPayload = {
      ...formData.infos,
      date_constitution: formData.infos.date_constitution || null,
    };

    let detId = detenteurId;
    if (detId) {
      await axios.put(`${apiURL}/api/detenteur-morale/${detId}`, infosPayload);
    } else {
      const response = await axios.post(`${apiURL}/api/detenteur-morale`, infosPayload);
      detId = response.data?.id_detenteur;
      if (detId && idDemande) {
        await axios.put(`${apiURL}/api/demande/${idDemande}/link-detenteur`, {
          id_detenteur: detId,
        });
      }
    }

    if (!detId) {
      throw new Error('Impossible de créer le détenteur.');
    }

    setDetenteurId(detId);

    if (!formData.repLegal.nin) {
      throw new Error('NIN du repr?sentant l?gal est requis');
    }

    const repPayload = {
      ...formData.repLegal,
      pouvoirs: formData.repLegal.pouvoirs || null,
      id_detenteur: detId,
    };

    let existingRepId: number | null = null;
    try {
      const repRes = await axios.get(`${apiURL}/api/representant-legal/${detId}`);
      existingRepId = repRes.data?.personne?.id_personne ?? null;
    } catch {
      existingRepId = null;
    }

    if (existingRepId) {
      await axios.put(`${apiURL}/api/representant-legal/by-id/${existingRepId}`, repPayload);
    } else {
      await axios.post(`${apiURL}/api/representant-legal`, repPayload);
    }

    let existingRegistreId: number | null = null;
    try {
      const regRes = await axios.get(`${apiURL}/api/registre-commerce/${detId}`);
      if (Array.isArray(regRes.data) && regRes.data.length > 0) {
        existingRegistreId = regRes.data[0]?.id ?? null;
      }
    } catch {
      existingRegistreId = null;
    }

    const registrePayload = {
      ...formData.rcDetails,
      id_detenteur: detId,
    };

    if (existingRegistreId) {
      await axios.put(
        `${apiURL}/api/registre-commerce/by-id/${existingRegistreId}`,
        registrePayload,
      );
    } else {
      await axios.post(`${apiURL}/api/registre-commerce`, registrePayload);
    }

    if (formData.actionnaires.length > 0) {
      await axios.put(`${apiURL}/api/actionnaires/${detId}`, {
        actionnaires: formData.actionnaires.map(a => ({
          nom: a.nom,
          prenom: a.prenom,
          qualification: a.qualification,
          numero_carte: a.numero_carte,
          taux_participation: a.taux_participation,
          lieu_naissance: a.lieu_naissance,
          id_pays: a.id_pays as number,
          id_nationalite: a.id_nationalite as number,
        })),
        id_detenteur: detId,
      });
    } else {
      try {
        await axios.delete(`${apiURL}/api/actionnaires/${detId}`);
      } catch {}
    }
  };


  if (!isPageReady) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>{loadingMessage}</p>
        {!idProc && <p>En attente de l'ID de procédure...</p>}
        {idProc && !procedureData && <p>Chargement des données de procédure...</p>}
        {procedureData && !idDemande && <p>Chargement des données de demande...</p>}
        {idDemande && (!paysOptions.length || !statutsJuridiques.length) && (
          <p>Chargement des options...</p>
        )}
      </div>
    );
  }

  return (
    <div className={layoutStyles.appContainer}>
      <Navbar />
      <div className={layoutStyles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={layoutStyles.mainContent}>
          <div className={layoutStyles.breadcrumb}>
            <span>SIGAM</span>
            <FiChevronRight className={layoutStyles.breadcrumbArrow} />
            <span>Identification</span>
          </div>

          <div className={layoutStyles.demandeContainer}>
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

            <h2 className={layoutStyles.pageTitle}>Étape 2 : Identification de la société</h2>
            <p className={layoutStyles.pageSubtitle}>
              Veuillez renseigner les informations générales, le représentant légal, les détails du
              registre de commerce et les actionnaires.
            </p>

            {codeDemande && idDemande && (
              <div className={layoutStyles.infoCard}>
                <div className={layoutStyles.infoHeader}>
                  <h4 className={layoutStyles.infoTitle}>
                    <FileText className={layoutStyles.infoIcon} />
                    Informations Demande
                  </h4>
                </div>
                <div className={layoutStyles.infoContent}>
                  <div className={layoutStyles.infoRow}>
                    <span className={layoutStyles.infoLabel}>Code Demande :</span>
                    <span className={layoutStyles.infoValue}>{codeDemande}</span>
                  </div>
                  <div className={layoutStyles.infoRow}>
                    <span className={layoutStyles.infoLabel}>ID Demande :</span>
                    <span className={layoutStyles.infoValue}>{idDemande}</span>
                  </div>
                </div>
              </div>
            )}

            <div className={styles.container}>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>
                    <Building2 className={styles.cardIcon} />
                    Informations sur l'Entreprise
                  </div>
                  <p className={styles.cardDescription}>Renseignements généraux de la société</p>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.formGrid}>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Nom société (FR) *</label>
                      <input
                        className={styles.input}
                        value={formData.infos.nom_fr}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            infos: { ...prev.infos, nom_fr: e.target.value },
                          }))
                        }
                        placeholder="Nom de la société en français"
                        disabled={isLocked}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Nom société (AR)</label>
                      <input
                        className={`${styles.input} ${styles.inputRtl}`}
                        value={formData.infos.nom_ar}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            infos: { ...prev.infos, nom_ar: e.target.value },
                          }))
                        }
                        placeholder="الاسم بالعربية"
                        dir="rtl"
                        disabled={isLocked}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Date de constitution</label>
                      <input
                        className={styles.input}
                        type="date"
                        value={formData.infos.date_constitution || ''}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            infos: { ...prev.infos, date_constitution: e.target.value },
                          }))
                        }
                        disabled={isLocked}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Statut juridique *</label>
                      <select
                        className={styles.select}
                        value={formData.infos.statut_id || ''}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            infos: {
                              ...prev.infos,
                              statut_id: e.target.value ? parseInt(e.target.value, 10) : 0,
                            },
                          }))
                        }
                        disabled={isLocked}
                      >
                        <option value="">Sélectionner</option>
                        {statutsJuridiques.map(statut => (
                          <option key={statut.id_statutJuridique} value={statut.id_statutJuridique}>
                            {statut.code_statut} - {statut.statut_fr}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Pays *</label>
                      <select
                        className={styles.select}
                        value={formData.infos.id_pays || ''}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            infos: {
                              ...prev.infos,
                              id_pays: e.target.value ? parseInt(e.target.value, 10) : null,
                            },
                          }))
                        }
                        disabled={isLocked}
                      >
                        <option value="">Sélectionner</option>
                        {paysOptions.map((pays) => (
                          <option key={pays.id_pays} value={pays.id_pays}>
                            {pays.nom_pays}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Téléphone *</label>
                      <input
                        className={styles.input}
                        value={formData.infos.tel}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            infos: { ...prev.infos, tel: e.target.value },
                          }))
                        }
                        placeholder="+213 XXX XX XX XX"
                        disabled={isLocked}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Email *</label>
                      <input
                        className={styles.input}
                        type="email"
                        value={formData.infos.email}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            infos: { ...prev.infos, email: e.target.value },
                          }))
                        }
                        placeholder="contact@entreprise.com"
                        disabled={isLocked}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Site web</label>
                      <input
                        className={styles.input}
                        type="url"
                        value={formData.infos.site_web}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            infos: { ...prev.infos, site_web: e.target.value },
                          }))
                        }
                        placeholder="https://www.exemple.com"
                        disabled={isLocked}
                      />
                    </div>


                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Numéro de fax</label>
                      <input
                        className={styles.input}
                        value={formData.infos.fax}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            infos: { ...prev.infos, fax: e.target.value },
                          }))
                        }
                        placeholder="+213 XXX XX XX XX"
                        disabled={isLocked}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Nationalité *</label>
                      <select
                        className={styles.select}
                        value={formData.infos.id_nationalite ?? ''}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            infos: {
                              ...prev.infos,
                              id_nationalite: e.target.value
                                ? parseInt(e.target.value, 10)
                                : null,
                            },
                          }))
                        }
                        disabled={isLocked}
                      >
                        <option value="">Sélectionner</option>
                        {nationalitesOptions.map((nat) => (
                          <option key={nat.id_nationalite} value={nat.id_nationalite}>
                            {nat.libelle}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                      <label className={styles.label}>Adresse complète *</label>
                      <input
                        className={styles.input}
                        value={formData.infos.adresse}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            infos: { ...prev.infos, adresse: e.target.value },
                          }))
                        }
                        placeholder="Adresse complète de l'entreprise"
                        disabled={isLocked}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>
                    <User className={styles.cardIcon} />
                    Représentant Légal
                  </div>
                  <p className={styles.cardDescription}>
                    Personne habilitée à représenter l'entreprise
                  </p>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.formGrid}>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Nom (FR) *</label>
                      <input
                        className={styles.input}
                        value={formData.repLegal.nom}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            repLegal: { ...prev.repLegal, nom: e.target.value },
                          }))
                        }
                        placeholder="Nom en français"
                        disabled={isLocked}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Prénom (FR) *</label>
                      <input
                        className={styles.input}
                        value={formData.repLegal.prenom}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            repLegal: { ...prev.repLegal, prenom: e.target.value },
                          }))
                        }
                        placeholder="Prénom en français"
                        disabled={isLocked}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Nom (AR)</label>
                      <input
                        className={`${styles.input} ${styles.inputRtl}`}
                        value={formData.repLegal.nom_ar}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            repLegal: { ...prev.repLegal, nom_ar: e.target.value },
                          }))
                        }
                        placeholder="الاسم بالعربية"
                        dir="rtl"
                        disabled={isLocked}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Prénom (AR)</label>
                      <input
                        className={`${styles.input} ${styles.inputRtl}`}
                        value={formData.repLegal.prenom_ar}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            repLegal: { ...prev.repLegal, prenom_ar: e.target.value },
                          }))
                        }
                        placeholder="الاسم بالعربية"
                        dir="rtl"
                        disabled={isLocked}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Téléphone *</label>
                      <input
                        className={styles.input}
                        value={formData.repLegal.tel}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            repLegal: { ...prev.repLegal, tel: e.target.value },
                          }))
                        }
                        placeholder="+213 XXX XX XX XX"
                        disabled={isLocked}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Email *</label>
                      <input
                        className={styles.input}
                        type="email"
                        value={formData.repLegal.email}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            repLegal: { ...prev.repLegal, email: e.target.value },
                          }))
                        }
                        placeholder="representant@email.com"
                        disabled={isLocked}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Numéro de fax</label>
                      <input
                        className={styles.input}
                        value={formData.repLegal.fax}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            repLegal: { ...prev.repLegal, fax: e.target.value },
                          }))
                        }
                        placeholder="+213 XXX XX XX XX"
                        disabled={isLocked}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Qualité de représentant *</label>
                      <select
                        className={styles.select}
                        value={formData.repLegal.qualite}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            repLegal: { ...prev.repLegal, qualite: e.target.value },
                          }))
                        }
                        disabled={isLocked}
                      >
                        <option value="">Sélectionner</option>
                        {qualitesRepresentant.map(q => (
                          <option key={q} value={q}>
                            {q}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Pouvoirs (mandat ou procuration)</label>
                      <select
                        className={styles.select}
                        value={formData.repLegal.pouvoirs}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            repLegal: { ...prev.repLegal, pouvoirs: e.target.value },
                          }))
                        }
                        disabled={isLocked}
                      >
                        <option value="">Selectionner</option>
                        <option value="MANDAT">Mandat</option>
                        <option value="PROCURATION">Procuration</option>
                      </select>
                    </div>


                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Nationalité *</label>
                      <select
                        className={styles.select}
                        value={formData.repLegal.id_nationalite ?? ''}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            repLegal: {
                              ...prev.repLegal,
                              id_nationalite: e.target.value
                                ? parseInt(e.target.value, 10)
                                : null,
                            },
                          }))
                        }
                        disabled={isLocked}
                      >
                        <option value="">Sélectionner</option>
                        {nationalitesOptions.map((nat) => (
                          <option key={nat.id_nationalite} value={nat.id_nationalite}>
                            {nat.libelle}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Pays *</label>
                      <select
                        className={styles.select}
                        value={formData.repLegal.id_pays ?? ''}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            repLegal: {
                              ...prev.repLegal,
                              id_pays: e.target.value ? parseInt(e.target.value, 10) : null,
                            },
                          }))
                        }
                        disabled={isLocked}
                      >
                        <option value="">Sélectionner</option>
                        {paysOptions.map((pays) => (
                          <option key={pays.id_pays} value={pays.id_pays}>
                            {pays.nom_pays}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Numéro NIN *</label>
                      <input
                        className={styles.input}
                        value={formData.repLegal.nin}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            repLegal: { ...prev.repLegal, nin: e.target.value },
                          }))
                        }
                        placeholder="Numéro d'identification nationale"
                        disabled={isLocked}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Taux de participation (%)</label>
                      <input
                        className={styles.input}
                        type="number"
                        min="0"
                        max="100"
                        value={formData.repLegal.taux_participation}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            repLegal: {
                              ...prev.repLegal,
                              taux_participation: e.target.value,
                            },
                          }))
                        }
                        placeholder="0"
                        disabled={isLocked}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>
                    <FileText className={styles.cardIcon} />
                    Détails du Registre de Commerce
                  </div>
                  <p className={styles.cardDescription}>Informations légales et fiscales</p>
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.formGrid}>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Numéro RC *</label>
                      <input
                        className={styles.input}
                        value={formData.rcDetails.numero_rc}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            rcDetails: { ...prev.rcDetails, numero_rc: e.target.value },
                          }))
                        }
                        placeholder="Ex: 00B123456789"
                        disabled={isLocked}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Date d'enregistrement *</label>
                      <input
                        className={styles.input}
                        type="date"
                        value={formData.rcDetails.date_enregistrement}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            rcDetails: { ...prev.rcDetails, date_enregistrement: e.target.value },
                          }))
                        }
                        disabled={isLocked}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Capital social (DA) *</label>
                      <input
                        className={styles.input}
                        type="number"
                        value={formData.rcDetails.capital_social}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            rcDetails: { ...prev.rcDetails, capital_social: e.target.value },
                          }))
                        }
                        placeholder="Ex: 1000000"
                        disabled={isLocked}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Numéro NIS *</label>
                      <input
                        className={styles.input}
                        value={formData.rcDetails.nis}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            rcDetails: { ...prev.rcDetails, nis: e.target.value },
                          }))
                        }
                        placeholder="Numéro d'identification statistique"
                        disabled={isLocked}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Numéro NIF *</label>
                      <input
                        className={styles.input}
                        value={formData.rcDetails.nif}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            rcDetails: { ...prev.rcDetails, nif: e.target.value },
                          }))
                        }
                        placeholder="Numéro d'identification fiscale"
                        disabled={isLocked}
                      />
                    </div>

                    <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                      <label className={styles.label}>Adresse du siège *</label>
                      <input
                        className={styles.input}
                        value={formData.rcDetails.adresse_legale}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            rcDetails: { ...prev.rcDetails, adresse_legale: e.target.value },
                          }))
                        }
                        placeholder="Adresse complète du siège social"
                        disabled={isLocked}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.actionnairesHeader}>
                    <div>
                      <div className={styles.actionnairesTitle}>
                        <Users className={styles.actionnairesIcon} />
                        Actionnaires
                      </div>
                      <p className={styles.cardDescription}>Liste des actionnaires de la société</p>
                    </div>
                    <button
                      type="button"
                      className={styles.btnAddActionnaire}
                      onClick={handleAddActionnaire}
                      disabled={isLocked}
                    >
                      <Plus className={styles.btnAddIcon} />
                      Ajouter
                    </button>
                  </div>
                </div>
                <div className={styles.cardContent}>
                  {formData.actionnaires.length === 0 ? (
                    <div className={styles.emptyState}>
                      <Users className={styles.emptyIcon} />
                      <p className={styles.emptyText}>
                        Aucun actionnaire ajouté. Cliquez sur "Ajouter" pour en ajouter un.
                      </p>
                      <span className={styles.emptyHint}>
                        Vous pouvez ajouter autant d'actionnaires que nécessaire.
                      </span>
                    </div>
                  ) : (
                    formData.actionnaires.map((actionnaire, index) => (
                      <div key={actionnaire.id} className={styles.actionnaireCard}>
                        <div className={styles.actionnaireHeader}>
                          <span className={styles.actionnaireNumber}>
                            Actionnaire {index + 1}
                          </span>
                          <button
                            type="button"
                            className={styles.btnRemoveActionnaire}
                            onClick={() => handleRemoveActionnaire(actionnaire.id)}
                            disabled={isLocked}
                          >
                            <X className={styles.btnRemoveIcon} />
                          </button>
                        </div>

                        <div className={styles.formGrid}>
                          <div className={styles.inputGroup}>
                            <label className={styles.label}>Nom *</label>
                            <input
                              className={styles.input}
                              value={actionnaire.nom}
                              onChange={(e) =>
                                handleActionnaireChange(actionnaire.id, 'nom', e.target.value)
                              }
                              placeholder="Nom"
                              disabled={isLocked}
                            />
                          </div>

                          <div className={styles.inputGroup}>
                            <label className={styles.label}>Prénom *</label>
                            <input
                              className={styles.input}
                              value={actionnaire.prenom}
                              onChange={(e) =>
                                handleActionnaireChange(actionnaire.id, 'prenom', e.target.value)
                              }
                              placeholder="Prénom"
                              disabled={isLocked}
                            />
                          </div>

                          <div className={styles.inputGroup}>
                            <label className={styles.label}>Lieu de naissance *</label>
                            <input
                              className={styles.input}
                              value={actionnaire.lieu_naissance}
                              onChange={(e) =>
                                handleActionnaireChange(
                                  actionnaire.id,
                                  'lieu_naissance',
                                  e.target.value,
                                )
                              }
                              placeholder="Lieu de naissance"
                              disabled={isLocked}
                            />
                          </div>

                          <div className={styles.inputGroup}>
                            <label className={styles.label}>Nationalité *</label>
                            <select
                              className={styles.select}
                              value={actionnaire.id_nationalite ?? ''}
                              onChange={(e) =>
                                handleActionnaireChange(
                                  actionnaire.id,
                                  'id_nationalite',
                                  e.target.value,
                                )
                              }
                              disabled={isLocked}
                            >
                              <option value="">Sélectionner</option>
                              {nationalitesOptions.map((nat) => (
                                <option key={nat.id_nationalite} value={nat.id_nationalite}>
                                  {nat.libelle}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className={styles.inputGroup}>
                            <label className={styles.label}>Qualification</label>
                            <input
                              className={styles.input}
                              value={actionnaire.qualification}
                              onChange={(e) =>
                                handleActionnaireChange(
                                  actionnaire.id,
                                  'qualification',
                                  e.target.value,
                                )
                              }
                              placeholder="Qualification"
                              disabled={isLocked}
                            />
                          </div>

                          <div className={styles.inputGroup}>
                            <label className={styles.label}>Numéro d'identité *</label>
                            <input
                              className={styles.input}
                              value={actionnaire.numero_carte}
                              onChange={(e) =>
                                handleActionnaireChange(
                                  actionnaire.id,
                                  'numero_carte',
                                  e.target.value,
                                )
                              }
                              placeholder="Numéro d'identité"
                              disabled={isLocked}
                            />
                          </div>

                          <div className={styles.inputGroup}>
                            <label className={styles.label}>Taux de participation (%) *</label>
                            <input
                              className={styles.input}
                              type="number"
                              min="0"
                              max="100"
                              value={actionnaire.taux_participation}
                              onChange={(e) =>
                                handleActionnaireChange(
                                  actionnaire.id,
                                  'taux_participation',
                                  e.target.value,
                                )
                              }
                              placeholder="0"
                              disabled={isLocked}
                            />
                          </div>

                          <div className={styles.inputGroup}>
                            <label className={styles.label}>Pays *</label>
                            <select
                              className={styles.select}
                              value={actionnaire.id_pays ?? ''}
                              onChange={(e) =>
                                handleActionnaireChange(actionnaire.id, 'id_pays', e.target.value)
                              }
                              disabled={isLocked}
                            >
                              <option value="">Sélectionner</option>
                              {paysOptions.map((pays) => (
                                <option key={pays.id_pays} value={pays.id_pays}>
                                  {pays.nom_pays}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {(formData.repLegal.taux_participation || formData.actionnaires.length > 0) && (
                <div
                  className={`${styles.participationAlert} ${
                    isParticipationValid ? styles.success : styles.warning
                  }`}
                >
                  <AlertCircle className={styles.alertIcon} />
                  <div className={styles.alertContent}>
                    <div className={styles.alertTitle}>
                      {isParticipationValid
                        ? 'Le total des taux de participation est correct.'
                        : 'Le total des taux doit être égal à 100%.'}
                    </div>
                    <div className={styles.alertDescription}>
                      Total actuel : {totalParticipation.toFixed(2)}%
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={layoutStyles.stepButtons}>
              <button className={layoutStyles.btnPrevious} onClick={handlePrevious}>
                <FiChevronLeft className={layoutStyles.btnIcon} /> Précédente
              </button>

              <button
                className={layoutStyles.btnNext}
                onClick={handleNext}
                disabled={isSubmitting || isNavigating || savingEtape || isLocked || !isFormValid}
              >
                Suivante <FiChevronRight className={layoutStyles.btnIcon} />
              </button>
            </div>

            <div className={layoutStyles.etapeSaveSection}>
              {etapeMessage && <div className={layoutStyles.etapeMessage}>{etapeMessage}</div>}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
