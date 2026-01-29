'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { useAuthStore } from '@/src/store/useAuthStore';
import { Step2TypePermis } from '@/components/wizard/steps/Step2TypePermis';
import { Step5Documents } from '@/components/wizard/steps/Step5Documents';
import { StepCapacites } from '@/components/wizard/steps/StepCapacites';
import { Step4LocalisationSubstances } from '@/components/wizard/steps/Step4LocalisationSubstances';
import { Step3Localisation } from '@/components/wizard/steps/Step3Localisation';
import { Step6Paiement } from '@/components/wizard/steps/Step6Paiement';
import styles from './nv_demande.module.css';

const phases = [
  { 
    id: 1, 
    title: 'Type de Permis', 
    description: 'Sélection',
    steps: [{ id: 1, title: 'Type de Permis' }]
  },
  { 
    id: 2, 
    title: 'Recevabilité', 
    description: 'Informations',
    steps: [
      { id: 1, title: 'Documents' },
      { id: 2, title: 'Capacités' },
      { id: 3, title: 'Localisation & Substances' }
    ]
  },
  { 
    id: 3, 
    title: 'Coordonnées', 
    description: 'Cadastrales',
    steps: [{ id: 1, title: 'Localisation' }]
  },
  { 
    id: 4, 
    title: 'Paiement', 
    description: 'Frais',
    steps: [{ id: 1, title: 'Paiement' }]
  },
];

export interface DemandeFormData {
  typePermis?: any;
  documents?: any[];
  capacites?: any;
  localisationSubstances?: any;
  localisation?: any;
  paiement?: any;
}

const NouvelleDemande = () => {
  const router = useRouter();
  const { auth, isLoaded } = useAuthStore();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const [currentPhase, setCurrentPhase] = useState(1);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<DemandeFormData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Vérifier l'authentification
  useEffect(() => {
    if (isLoaded && !auth?.email) {
      router.push('/');
    }
  }, [isLoaded, auth, router]);

  const updateFormData = (stepData: any) => {
    setFormData(prev => ({ ...prev, ...stepData }));
    console.log('Form data updated:', { ...formData, ...stepData });
  };

  const getCurrentPhaseSteps = () => {
    return phases.find(p => p.id === currentPhase)?.steps || [];
  };

  const getTotalStepsInPhase = () => {
    return getCurrentPhaseSteps().length;
  };

  const calculateProgress = () => {
    const totalPhases = phases.length;
    const phaseProgress = ((currentPhase - 1) / totalPhases) * 100;
    const stepsInPhase = getTotalStepsInPhase();
    const stepProgress = (currentStep / stepsInPhase) * (100 / totalPhases);
    return phaseProgress + stepProgress;
  };

  const handleNext = () => {
    const totalSteps = getTotalStepsInPhase();
    
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    } else if (currentPhase < phases.length) {
      setCurrentPhase(prev => prev + 1);
      setCurrentStep(1);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else if (currentPhase > 1) {
      const prevPhase = currentPhase - 1;
      setCurrentPhase(prevPhase);
      const prevPhaseSteps = phases.find(p => p.id === prevPhase)?.steps || [];
      setCurrentStep(prevPhaseSteps.length);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setNotification(null);

      // Préparer les données à envoyer
      const demandeData = {
        ...formData,
        userId: auth?.id,
        userEmail: auth?.email,
        dateDepot: new Date().toISOString(),
      };

      console.log('Submitting demande:', demandeData);

      // Envoyer à l'API
      const response = await axios.post(
        `${apiURL}/investisseur/demandes`,
        demandeData,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Demande submitted:', response.data);

      setNotification({
        type: 'success',
        message: 'Demande soumise avec succès ! Vous recevrez un reçu par email.',
      });

      // Rediriger après 2 secondes
      setTimeout(() => {
        router.push('/investisseur/demandes');
      }, 2000);

    } catch (error: any) {
      console.error('Submit error:', error);
      setNotification({
        type: 'error',
        message: error?.response?.data?.detail || 'Une erreur est survenue lors de la soumission.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    if (currentPhase === 1) {
      return <Step2TypePermis data={formData.typePermis} onUpdate={updateFormData} />;
    }
    
    if (currentPhase === 2) {
      switch (currentStep) {
        case 1:
          return <Step5Documents data={formData.documents} onUpdate={updateFormData} />;
        case 2:
          return <StepCapacites data={formData.capacites} onUpdate={updateFormData} />;
        case 3:
          return <Step4LocalisationSubstances data={formData.localisationSubstances} onUpdate={updateFormData} />;
        default:
          return null;
      }
    }
    
    if (currentPhase === 3) {
      return <Step3Localisation data={formData.localisation} onUpdate={updateFormData} />;
    }
    
    if (currentPhase === 4) {
      return <Step6Paiement data={formData.paiement} onUpdate={updateFormData} />;
    }
    
    return null;
  };

  const currentPhaseData = phases.find(p => p.id === currentPhase);
  const currentStepData = getCurrentPhaseSteps()[currentStep - 1];
  const isLastStep = currentPhase === phases.length && currentStep === getTotalStepsInPhase();

  if (!isLoaded || !auth?.email) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      {/* Loading Overlay */}
      {isSubmitting && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Soumission en cours...</p>
        </div>
      )}

      <div className={styles.contentWrapper}>
        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h1 className={styles.pageTitle}>Nouvelle demande initiale</h1>
            <p className={styles.pageSubtitle}>
              Complétez les phases pour soumettre votre demande
            </p>
          </div>
          <button 
            className={styles.cancelButton}
            onClick={() => router.push('/investisseur/Dashboard')}
            disabled={isSubmitting}
          >
            Annuler
          </button>
        </div>

        {/* NOTIFICATION */}
        {notification && (
          <div className={`${styles.notification} ${
            notification.type === 'success' ? styles.notificationSuccess : styles.notificationError
          }`}>
            <span className={styles.notificationIcon}>
              {notification.type === 'success' ? '✓' : '✗'}
            </span>
            <span>{notification.message}</span>
          </div>
        )}

        {/* PROGRESS BAR */}
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill}
            style={{ width: `${calculateProgress()}%` }}
          />
        </div>

        {/* PHASE STEPPER */}
        <div className={styles.stepperCard}>
          <div className={styles.wizardStepper}>
            <div className={styles.stepperLine}>
              <div 
                className={styles.stepperLineProgress}
                style={{ width: `${((currentPhase - 1) / (phases.length - 1)) * 100}%` }}
              />
            </div>
            
            {phases.map((phase) => (
              <div 
                key={phase.id}
                className={`${styles.stepItem} ${
                  phase.id === currentPhase ? styles.active : ''
                } ${phase.id < currentPhase ? styles.completed : ''}`}
              >
                <div className={`${styles.stepCircle} ${
                  phase.id === currentPhase ? styles.active : ''
                } ${phase.id < currentPhase ? styles.completed : ''}`}>
                  {phase.id < currentPhase ? '✓' : phase.id}
                </div>
                <div className={styles.stepLabel}>
                  <div className={styles.stepTitle}>{phase.title}</div>
                  <div className={styles.stepDescription}>{phase.description}</div>
                </div>
                
                {/* Sub-steps indicator */}
                {phase.steps.length > 1 && phase.id === currentPhase && (
                  <div className={styles.subStepsIndicator}>
                    {phase.steps.map((_, idx) => (
                      <div
                        key={idx}
                        className={`${styles.subStepDot} ${
                          idx + 1 === currentStep ? styles.active : ''
                        } ${idx + 1 < currentStep ? styles.completed : ''}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* STEP CONTENT */}
        <div className={styles.contentCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>
              Phase {currentPhase}: {currentPhaseData?.title}
              {getTotalStepsInPhase() > 1 && ` - ${currentStepData?.title}`}
            </h2>
            <p className={styles.cardDescription}>
              {getTotalStepsInPhase() > 1 
                ? `Étape ${currentStep} sur ${getTotalStepsInPhase()}`
                : `Phase ${currentPhase} sur ${phases.length}`
              }
            </p>
          </div>
          <div className={styles.cardContent}>
            {renderStep()}
          </div>
        </div>

        {/* NAVIGATION BUTTONS */}
        <div className={styles.navigationButtons}>
          <button
            className={`${styles.navButton} ${styles.prevButton}`}
            onClick={handlePrevious}
            disabled={currentPhase === 1 && currentStep === 1 || isSubmitting}
          >
            <svg className={styles.navIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Précédent
          </button>

          {!isLastStep ? (
            <button 
              className={`${styles.navButton} ${styles.nextButton}`}
              onClick={handleNext}
              disabled={isSubmitting}
            >
              Suivant
              <svg className={styles.navIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ) : (
            <button 
              className={`${styles.navButton} ${styles.submitButton}`}
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className={styles.buttonSpinner} />
                  Soumission...
                </>
              ) : (
                'Soumettre la demande'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NouvelleDemande;