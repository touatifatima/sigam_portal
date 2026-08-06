'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useDemandeInfo } from '../../../../utils/useDemandeInfo';
import { FiChevronLeft, FiChevronRight, FiDollarSign, FiTool, FiBriefcase } from 'react-icons/fi';
import styles from './capacities3.module.css';
import { useSearchParams } from '@/src/hooks/useSearchParams';
import Navbar from '../../../navbar/Navbar';
import Sidebar from '../../../sidebar/Sidebar';
import { useViewNavigator } from '../../../../src/hooks/useViewNavigator';
import ProgressStepper from '../../../../components/ProgressStepper';
import { useActivateEtape } from '@/src/hooks/useActivateEtape';
import { toast } from 'react-toastify';
import { Phase, Procedure, ProcedureEtape, ProcedurePhase } from '@/src/types/procedure';
import router from 'next/router';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FieldHelpLabel } from '@/components/ui/field-help';
import { BrandLoader } from '@/components/loading/BrandLoader';

// Data status interface
interface DataStatus {
  idProc: boolean;
  procedureData: boolean;
  idDemande: boolean;
  allDataReady: boolean;
}

export default function Capacites() {
  const [form, setForm] = useState({
    id_expert: 0,
    expert_mode: '',
    expert_autre: '',
    duree_travaux: '',
    description: '',
    financement: '',
    nom_expert: '',
    specialisation: '',
    num_agrement: '',
    etat_agrement: '',
    date_agrement: '',
    adresse: '',
    email: '',
    tel_expert: '',
    fax_expert: '',
    date_demarrage_prevue: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { isReady } = useDemandeInfo();
  const searchParams = useSearchParams();
  const [idDemande, setIdDemande] = useState<string | null>(null);
  const [codeDemande, setCodeDemande] = useState<string | null>(null);
  const [savingEtape, setSavingEtape] = useState(false);
  const [etapeMessage, setEtapeMessage] = useState<string | null>(null);
  const { currentView, navigateTo } = useViewNavigator("nouvelle-demande");
  const [statutProc, setStatutProc] = useState<string | undefined>(undefined);
  const [currentStep, setCurrentStep] = useState(3);
  const [activatedSteps, setActivatedSteps] = useState<Set<number>>(new Set());
  const apiURL = process.env.NEXT_PUBLIC_API_URL;
  const [procedureData, setProcedureData] = useState<Procedure | null>(null);
  const [currentEtape, setCurrentEtape] = useState<{ id_etape: number } | null>(null);
  const [procedureTypeId, setProcedureTypeId] = useState<number | undefined>();
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [hasActivatedStep3, setHasActivatedStep3] = useState(false);
  const [idProc, setIdProc] = useState<number | undefined>(undefined);
  const [isPageReady, setIsPageReady] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Chargement des données...');
  const [dataStatus, setDataStatus] = useState<DataStatus>({
    idProc: false,
    procedureData: false,
    idDemande: false,
    allDataReady: false
  });
  const [checkInterval, setCheckInterval] = useState<NodeJS.Timeout | null>(null);
  // Check if all required data is available
  const checkRequiredData = useCallback(() => {
    const newStatus = {
      idProc: !!idProc,
      procedureData: !!procedureData,
      idDemande: !!idDemande,
      allDataReady: !!(idProc && procedureData && idDemande)
    };
    
    setDataStatus(newStatus);
    return newStatus.allDataReady;
  }, [idProc, procedureData, idDemande]);

  // Set up interval to check for required data
  useEffect(() => {
    // Clear any existing interval
    if (checkInterval) {
      clearInterval(checkInterval);
      setCheckInterval(null);
    }

    // If all data is ready, set page as ready
    if (checkRequiredData()) {
      setIsPageReady(true);
      setIsLoading(false);
      return;
    }

    // Set up a new interval to check for data
    const interval = setInterval(() => {
      const allReady = checkRequiredData();
      if (allReady) {
        setIsPageReady(true);
        setIsLoading(false);
        clearInterval(interval);
        setCheckInterval(null);
      }
    }, 100); // Check every 100ms

    setCheckInterval(interval);
    
    // Cleanup interval on component unmount
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [checkRequiredData]);

  // Get idProc from URL parameters
  useEffect(() => {
    const idProcStr = searchParams?.get('id');
    if (!idProcStr) {
      setLoadingMessage("ID de procédure non trouvé dans les paramétres");
      return;
    }

    const parsedId = parseInt(idProcStr, 10);
    if (isNaN(parsedId)) {
      setLoadingMessage("ID de procédure invalide");
      return;
    }

    setIdProc(parsedId);
    setLoadingMessage("Chargement des données de la procédure...");
  }, [searchParams]);

  // Fetch procedure data when idProc is available
  useEffect(() => {
    if (!idProc) return;

    const fetchProcedureData = async () => {
      try {
        const response = await axios.get<Procedure>(`${apiURL}/api/procedure-etape/procedure/${idProc}`);
        setProcedureData(response.data);
        
        if (response.data.demandes && response.data.demandes.length > 0) {
          setProcedureTypeId(response.data.demandes[0].typeProcedure?.id);
        }

        const activeEtape = response.data.ProcedureEtape.find((pe: ProcedureEtape) => pe.statut === 'EN_COURS');
        if (activeEtape) {
          setCurrentEtape({ id_etape: activeEtape.id_etape });
        }
        
        setLoadingMessage("Données de procédure chargées, récupération de la demande...");
      } catch (error) {
        console.error('Error fetching procedure data:', error);
        setLoadingMessage("Erreur lors du chargement des données de procédure");
      }
    };

    fetchProcedureData();
  }, [idProc, apiURL, refetchTrigger]);

  // Fetch demande data when procedure data is available
  useEffect(() => {
    if (!idProc || !procedureData) return;
    
    const fetchDemandeFromProc = async () => {
      try {
        const response = await axios.get(`${apiURL}/api/procedures/${idProc}/demande`);
        const demande = response.data;
        setIdDemande(demande.id_demande.toString());
        setCodeDemande(demande.code_demande);
        setStatutProc(demande.procedure.statut_proc);
        
        const expert = demande.expertMinier;
        setForm({
          id_expert: expert?.id_expert || 0,
          expert_mode: expert ? 'expert_agree' : '',
          expert_autre: '',
          duree_travaux: demande.duree_travaux_estimee || '',
          description: demande.description_travaux || '',
          financement: demande.sources_financement || '',
          nom_expert: expert?.nom_expert || '',
          specialisation: expert?.specialisation || '',
          num_agrement: expert?.num_agrement || '',
          etat_agrement: expert?.etat_agrement || '',
          date_agrement: expert?.date_agrement ? expert.date_agrement.split('T')[0] : '',
          adresse: expert?.adresse || '',
          email: expert?.email || '',
          tel_expert: expert?.tel_expert || '',
          fax_expert: expert?.fax_expert || '',
          date_demarrage_prevue: demande.date_demarrage_prevue?.split('T')[0] || ''
        });
        
        setLoadingMessage("Données de demande chargées, préparation de l'interface...");
      } catch (err) {
        console.error("Erreur récupération de la demande :", err);
        setError("Erreur récupération de la demande");
        setLoadingMessage("Erreur lors de la récupération de la demande");
      }
    };

    fetchDemandeFromProc();
  }, [idProc, procedureData, apiURL]);

  const phases: Phase[] = procedureData?.ProcedurePhase 
    ? procedureData.ProcedurePhase
        .slice()
        .sort((a: ProcedurePhase, b: ProcedurePhase) => a.ordre - b.ordre)
        .map((pp: ProcedurePhase) => ({
          ...pp.phase,
          ordre: pp.ordre,
        }))
    : [];

  const etapeIdForThisPage = useMemo(() => {
    if (!procedureData) return null;
    const pathname = 'investisseur/nouvelle_demande/step3/page3';
    const normalize = (value?: string | null) =>
      (value ?? '')
        .replace(/^\/+/, '')
        .replace(/\.(tsx|ts|jsx|js|html)$/i, '')
        .trim()
        .toLowerCase();
    const target = normalize(pathname);
    const phasesList = (procedureData.ProcedurePhase || []) as ProcedurePhase[];
    const phaseEtapes = phasesList.flatMap((pp) => pp.phase?.etapes || []);
    const byRoute = phaseEtapes.find((e: any) => {
      const route = normalize(e.page_route);
      return route === target || route.endsWith(target) || route.includes('step3/page3');
    });
    if (byRoute) return byRoute.id_etape;
    const allEtapes = [
      ...phaseEtapes,
      ...((procedureData.ProcedureEtape || []).map((pe: any) => pe.etape).filter(Boolean) as any[]),
    ];
    const byLabel = allEtapes.find((e: any) =>
      String(e?.lib_etape ?? '').toLowerCase().includes('capacite'),
    );
    return byLabel?.id_etape ?? 3;
  }, [procedureData]);

  useEffect(() => {
    if (etapeIdForThisPage && currentStep !== etapeIdForThisPage) {
      setCurrentStep(etapeIdForThisPage);
    }
  }, [etapeIdForThisPage, currentStep]);

  useActivateEtape({
    idProc,
    etapeNum: etapeIdForThisPage ?? 0,
    shouldActivate:
      isPageReady &&
      !!etapeIdForThisPage &&
      !activatedSteps.has(etapeIdForThisPage ?? -1),
    onActivationSuccess: (stepStatus: string) => {
      if (!etapeIdForThisPage) return;
      setActivatedSteps(prev => new Set(prev).add(etapeIdForThisPage));
      if (stepStatus === 'TERMINEE') {
        setHasActivatedStep3(true);
        return;
      }

      setHasActivatedStep3(true);
      setTimeout(() => setRefetchTrigger(prev => prev + 1), 500);
    }
  });

  const isStepSaved = useMemo(() => {
    if (!procedureData || !etapeIdForThisPage) return false;
    return (procedureData.ProcedureEtape || []).some(
      (pe) => pe.id_etape === etapeIdForThisPage && pe.statut === 'TERMINEE',
    );
  }, [procedureData, etapeIdForThisPage]);

  const isFormComplete = useMemo(() => {
    const usesExpertDetails =
      form.expert_mode === 'bureau_etudes' || form.expert_mode === 'expert_agree';
    const expertOk = usesExpertDetails
      ? form.nom_expert.trim() !== '' &&
        form.adresse.trim() !== '' &&
        form.tel_expert.trim() !== ''
      : form.expert_mode === 'autre'
      ? form.expert_autre.trim() !== ''
      : false;

    return (
      form.duree_travaux.trim() !== '' &&
      form.description.trim() !== '' &&
      form.financement.trim() !== '' &&
      form.date_demarrage_prevue.trim() !== '' &&
      expertOk
    );
  }, [form]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleExpertModeChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      expert_mode: value,
      id_expert: 0,
    }));
  };



  const handleNext = async () => {
    if (!idDemande) {
      toast.error("ID de demande non disponible");
      return;
    }

    if (!idProc) {
      toast.error("ID de procédure manquant");
      return;
    }

    if (!isFormComplete && !isStepSaved) {
      toast.warning("Veuillez remplir tous les champs obligatoires avant de continuer.");
      return;
    }

    setSavingEtape(true);
    setEtapeMessage(null);

    try {
      const usesExpertDetails =
        form.expert_mode === 'bureau_etudes' || form.expert_mode === 'expert_agree';
      const expertNom = usesExpertDetails ? form.nom_expert.trim() : form.expert_autre.trim();
      await axios.put(`${apiURL}/api/capacites`, {
        id_demande: idDemande,
        duree_travaux: form.duree_travaux,
        description: form.description,
        financement: form.financement,
        date_demarrage_prevue: form.date_demarrage_prevue,
        id_expert: form.id_expert || null,
        expert_mode: form.expert_mode,
        expert_autre: form.expert_autre.trim(),
        nom_expert: expertNom,
        num_agrement: usesExpertDetails ? form.num_agrement.trim() : '',
        date_agrement: usesExpertDetails ? form.date_agrement : '',
        etat_agrement: usesExpertDetails ? form.etat_agrement.trim() : '',
        adresse: usesExpertDetails ? form.adresse.trim() : '',
        email: usesExpertDetails ? form.email.trim() : '',
        tel_expert: usesExpertDetails ? form.tel_expert.trim() : '',
        fax_expert: usesExpertDetails ? form.fax_expert.trim() : '',
        specialisation: usesExpertDetails ? form.specialisation.trim() : '',
      });

      let etapeId = 3;

      try {
        if (procedureData?.ProcedurePhase) {
          const pathname = window.location.pathname.replace(/^\/+/, '');
          const phasesList = (procedureData.ProcedurePhase || []) as ProcedurePhase[];
          const allEtapes = phasesList.flatMap(pp => pp.phase?.etapes ?? []);
          const match = allEtapes.find((e: any) => e.page_route === pathname);
          if (match?.id_etape != null) {
            etapeId = match.id_etape;
          }
        }
      } catch {
        // fallback to default etapeId
      }

      etapeId = etapeIdForThisPage ?? etapeId;
      await axios.post(`${apiURL}/api/procedure-etape/finish/${idProc}/${etapeId}`);
      setRefetchTrigger((prev) => prev + 1);
      toast.success("Capacités enregistrées avec succès");
      router.push(`/investisseur/nouvelle_demande/step11/page11?id=${idProc}`);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'enregistrement");
      setEtapeMessage("Erreur lors de l'enregistrement de l'étape.");
    } finally {
      setSavingEtape(false);
    }
  };

  const handleBack = () => {
    if (!idProc) {
      setError("ID procédure manquant");
      return;
    }
    router.push(`/investisseur/nouvelle_demande/step1/page1?id=${idProc}`);
  };

  if (!isReady) {
    return <BrandLoader fullScreen label="Chargement des informations de la demande..." />;
  }

  if (!isPageReady) {
    return <BrandLoader fullScreen label={loadingMessage || "Chargement des donnees..."} />;
  }

  return (    
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.mainContent}>
          <div className={styles.capacitesContainer}>
            <div className={styles.breadcrumb}>
              <span>GUNAM</span>
              <FiChevronRight className={styles.breadcrumbArrow} />
              <span>Nouvelle demande</span>
              <FiChevronRight className={styles.breadcrumbArrow} />
              <span>Capacités</span>
            </div>
            <div className={styles.contentWrapper}>
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
              <div className={styles.stepHero}>
                <span className={styles.stepKicker}>ÉTAPE 3</span>
                <h2 className={styles.pageTitle}>Capacités techniques et financières</h2>
                <p className={styles['page-subtitle']}>
                  Présentez les moyens techniques, le financement et le référent chargé du dossier.
                </p>
              </div>
                


              <div className={styles.formSections}>
                {/* Capacités techniques */}
                <section className={styles.formSection}>
                  <div className={styles.sectionHeader}>
                    <FiTool className={styles.sectionIcon} />
                    <div>
                      <h3 className={styles.sectionTitle}>Capacités techniques</h3>
                      <p className={styles.sectionSubtitle}>Durée, calendrier et description des travaux prévus.</p>
                    </div>
                  </div>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <FieldHelpLabel
                        label="Durée estimée des travaux (mois)"
                        helpText="Indiquez la durée prévisionnelle du programme de travaux en mois."
                      />
                      <input
                        disabled={statutProc === 'TERMINEE'}
                        type="text"
                        name="duree_travaux"
                        className={styles.formInput}
                        onChange={handleChange}
                        value={form.duree_travaux}
                        placeholder="Ex: 24"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <FieldHelpLabel
                        label="Date de début prévue"
                        helpText="Choisissez la date estimée de démarrage des travaux."
                      />
                      <input
                        disabled={statutProc === 'TERMINEE'}
                        type="date"
                        name="date_demarrage_prevue"
                        className={styles.formInput}
                        value={form.date_demarrage_prevue}
                        onChange={handleChange}
                      />
                    </div>

                    <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                      <FieldHelpLabel
                        label="Description des travaux techniques"
                        helpText="Décrivez brièvement les travaux techniques envisagés."
                      />
                      <textarea
                        disabled={statutProc === 'TERMINEE'}
                        name="description"
                        className={styles.formTextarea}
                        onChange={handleChange}
                        value={form.description}
                        placeholder="Décrivez les travaux techniques prévus..."
                        rows={4}
                      />
                    </div>
                  </div>
                </section>

                {/* Capacités financières */}
                <section className={styles.formSection}>
                  <div className={styles.sectionHeader}>
                    <FiDollarSign className={styles.sectionIcon} />
                    <div>
                      <h3 className={styles.sectionTitle}>Capacités financières</h3>
                      <p className={styles.sectionSubtitle}>Sources de financement et moyens mobilisés.</p>
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <FieldHelpLabel
                      label="Sources de financement"
                      helpText="Précisez les fonds, partenaires ou mécanismes financiers mobilisés."
                    />
                    <textarea
                      disabled={statutProc === 'TERMINEE'}
                      name="financement"
                      className={styles.formTextarea}
                      onChange={handleChange}
                      value={form.financement}
                      placeholder="Détaillez vos sources de financement..."
                      rows={4}
                    />
                  </div>
                </section>

                {/* Expert Minier Section */}
                <section className={styles.formSection}>
                  <div className={styles.sectionHeader}>
                    <FiBriefcase className={styles.sectionIcon} />
                    <div>
                      <h3 className={styles.sectionTitle}>Expert minier / Référent technique</h3>
                      <p className={styles.sectionSubtitle}>Identifiez le bureau, l'expert ou le responsable technique.</p>
                    </div>
                  </div>

                  <div className={styles.expertOptions}>
                    <RadioGroup
                      value={form.expert_mode}
                      onValueChange={handleExpertModeChange}
                      className={styles.expertRadioGroup}
                    >
                      <div className={styles.expertOption}>
                        <RadioGroupItem
                          value="bureau_etudes"
                          id="expert-bureau"
                          className={styles.expertRadioItem}
                          disabled={statutProc === 'TERMINEE'}
                        />
                        <Label htmlFor="expert-bureau" className={styles.expertOptionLabel}>
                          Un bureau d&apos;études / un bureau d&apos;expertises agréé
                        </Label>
                      </div>
                      <div className={styles.expertOption}>
                        <RadioGroupItem
                          value="expert_agree"
                          id="expert-agree"
                          className={styles.expertRadioItem}
                          disabled={statutProc === 'TERMINEE'}
                        />
                        <Label htmlFor="expert-agree" className={styles.expertOptionLabel}>
                          Un expert en études géologiques et minières agréé
                        </Label>
                      </div>
                      <div className={styles.expertOption}>
                        <RadioGroupItem
                          value="autre"
                          id="expert-autre"
                          className={styles.expertRadioItem}
                          disabled={statutProc === 'TERMINEE'}
                        />
                        <Label htmlFor="expert-autre" className={styles.expertOptionLabel}>
                          Autre (préciser)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {form.expert_mode === 'autre' && (
                    <div className={`${styles.formGroup} ${styles.required}`}>
                      <Label htmlFor="expert_autre" className={styles.formLabel}>
                        Autre (préciser)
                      </Label>
                      <Input
                        id="expert_autre"
                        name="expert_autre"
                        className={styles.formInput}
                        value={form.expert_autre}
                        onChange={handleChange}
                        placeholder="Précisez le type d'expert ou bureau"
                        disabled={statutProc === 'TERMINEE'}
                        required
                      />
                    </div>
                  )}

                  {(form.expert_mode === 'bureau_etudes' || form.expert_mode === 'expert_agree') && (
                    <div className={styles.expertFields}>
                      <div className={styles.formGrid}>
                        <div className={`${styles.formGroup} ${styles.required}`}>
                          <FieldHelpLabel
                            htmlFor="nom_expert"
                            label="Nom / Raison sociale"
                            required
                            helpText="Saisissez le nom officiel du bureau ou de l'expert."
                          />
                          <Input
                            id="nom_expert"
                            type="text"
                            name="nom_expert"
                            className={styles.formInput}
                            onChange={handleChange}
                            value={form.nom_expert}
                            placeholder="Nom de l'expert ou raison sociale"
                            required
                            disabled={statutProc === 'TERMINEE'}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <FieldHelpLabel
                            htmlFor="num_agrement"
                            label="Numéro d'agrément"
                            helpText="Renseignez le numéro d'agrément officiel si disponible."
                          />
                          <Input
                            id="num_agrement"
                            type="text"
                            name="num_agrement"
                            className={styles.formInput}
                            onChange={handleChange}
                            value={form.num_agrement}
                            placeholder="Numéro d'agrément"
                            disabled={statutProc === 'TERMINEE'}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <FieldHelpLabel
                            htmlFor="specialisation"
                            label="Domaine d'agrément / Spécialisation"
                            helpText="Précisez le domaine technique couvert par l'expert."
                          />
                          <Input
                            id="specialisation"
                            type="text"
                            name="specialisation"
                            className={styles.formInput}
                            onChange={handleChange}
                            value={form.specialisation}
                            placeholder="Domaine ou spécialisation"
                            disabled={statutProc === 'TERMINEE'}
                          />
                        </div>
                        <div className={`${styles.formGroup} ${styles.required}`}>
                          <FieldHelpLabel
                            htmlFor="adresse"
                            label="Adresse"
                            required
                            helpText="Indiquez l'adresse complète du bureau ou de l'expert."
                          />
                          <Input
                            id="adresse"
                            type="text"
                            name="adresse"
                            className={styles.formInput}
                            onChange={handleChange}
                            value={form.adresse}
                            placeholder="Adresse complète"
                            required
                            disabled={statutProc === 'TERMINEE'}
                          />
                        </div>
                        <div className={`${styles.formGroup} ${styles.required}`}>
                          <FieldHelpLabel
                            htmlFor="tel_expert"
                            label="Téléphone"
                            required
                            helpText="Numéro de téléphone principal pour les échanges."
                          />
                          <Input
                            id="tel_expert"
                            type="tel"
                            name="tel_expert"
                            className={styles.formInput}
                            onChange={handleChange}
                            value={form.tel_expert}
                            placeholder="+213..."
                            required
                            disabled={statutProc === 'TERMINEE'}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <FieldHelpLabel
                            htmlFor="email"
                            label="E-mail"
                            helpText="Adresse email de contact du bureau ou de l'expert."
                          />
                          <Input
                            id="email"
                            type="email"
                            name="email"
                            className={styles.formInput}
                            onChange={handleChange}
                            value={form.email}
                            placeholder="contact@expert.com"
                            disabled={statutProc === 'TERMINEE'}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <FieldHelpLabel
                            htmlFor="fax_expert"
                            label="Fax"
                            helpText="Numéro de fax, si le bureau en utilise un."
                          />
                          <Input
                            id="fax_expert"
                            type="text"
                            name="fax_expert"
                            className={styles.formInput}
                            onChange={handleChange}
                            value={form.fax_expert}
                            placeholder="Fax"
                            disabled={statutProc === 'TERMINEE'}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <FieldHelpLabel
                            htmlFor="etat_agrement"
                            label="État d'agrément"
                            helpText="Indiquez l'état ou l'organisme ayant délivré l'agrément."
                          />
                          <Input
                            id="etat_agrement"
                            type="text"
                            name="etat_agrement"
                            className={styles.formInput}
                            onChange={handleChange}
                            value={form.etat_agrement}
                            placeholder="État ou organisme"
                            disabled={statutProc === 'TERMINEE'}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <FieldHelpLabel
                            htmlFor="date_agrement"
                            label="Date d'agrément"
                            helpText="Indiquez la date de délivrance de l'agrément."
                          />
                          <Input
                            id="date_agrement"
                            type="date"
                            name="date_agrement"
                            className={styles.formInput}
                            onChange={handleChange}
                            value={form.date_agrement}
                            disabled={statutProc === 'TERMINEE'}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              <div className={styles.actionButtons}>
                <button
                  onClick={handleBack}
                  className={styles.btnPrevious}
                  disabled={isLoading || savingEtape}
                >
                  <FiChevronLeft className={styles.btnIcon} />
                  Précédent
                </button>
                <button
                  onClick={handleNext}
                  className={styles.btnNext}
                  disabled={isLoading || savingEtape || (!isFormComplete && !isStepSaved)}
                >
                  Suivant
                  <FiChevronRight className={styles.btnIcon} />
                </button>
              </div>
              <div className={styles.etapeSaveSection}>
                {etapeMessage && (
                  <div className={styles.etapeMessage}>
                    {etapeMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
