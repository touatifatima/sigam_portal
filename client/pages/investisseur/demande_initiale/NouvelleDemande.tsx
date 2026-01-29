import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WizardStepper } from "@/components/wizard/WizardStepper";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Step2TypePermis } from "@/components/wizard/steps/Step2TypePermis";
import { Step5Documents } from "@/components/wizard/steps/Step5Documents";
import { Step4LocalisationSubstances } from "@/components/wizard/steps/Step4LocalisationSubstances";
import { StepCoordonneesCadastrales } from "@/components/wizard/steps/StepCoordonneesCadastrales";
import { StepFacture } from "@/components/wizard/steps/StepFacture";
import { Step6Paiement } from "@/components/wizard/steps/Step6Paiement";
import { useToast } from "@/hooks/use-toast";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import styles from "./NouvelleDemande.module.css";

// Nouveau flux: Type+Cadastre → Localisation → Documents → Facture → Paiement → Confirmation
const phases = [
  { 
    id: 1, 
    title: "Type & Cadastre", 
    description: "Permis & Coordonnées",
    steps: [
      { id: 1, title: "Type de Permis" },
      { id: 2, title: "Coordonnées Cadastrales" }
    ]
  },
  { 
    id: 2, 
    title: "Localisation", 
    description: "& Substances",
    steps: [{ id: 1, title: "Localisation & Substances" }]
  },
  { 
    id: 3, 
    title: "Documents", 
    description: "Justificatifs",
    steps: [{ id: 1, title: "Documents" }]
  },
  { 
    id: 4, 
    title: "Facture", 
    description: "Récapitulatif",
    steps: [{ id: 1, title: "Facture" }]
  },
  { 
    id: 5, 
    title: "Paiement", 
    description: "Finalisation",
    steps: [{ id: 1, title: "Paiement" }]
  },
];

export interface DemandeFormData {
  typePermis?: any;
  documents?: any[];
  identification?: any;
  capacites?: any;
  localisationSubstances?: any;
  localisation?: any;
  coordonneesCadastrales?: any;
  facture?: any;
  paiement?: any;
}

const NouvelleDemande = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentPhase, setCurrentPhase] = useState(1);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<DemandeFormData>({});

  const updateFormData = (stepData: any) => {
    setFormData(prev => ({ ...prev, ...stepData }));
  };

  const getCurrentPhaseSteps = () => {
    return phases.find(p => p.id === currentPhase)?.steps || [];
  };

  const getTotalStepsInPhase = () => {
    return getCurrentPhaseSteps().length;
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
      toast({
        title: "Demande soumise avec succès",
        description: "Votre demande a été enregistrée. Vous recevrez un reçu par email.",
      });
      navigate('/investor/demandes');
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la soumission.",
        variant: "destructive",
      });
    }
  };

  const renderStep = () => {
    // Phase 1: Type de Permis + Coordonnées Cadastrales
    if (currentPhase === 1) {
      if (currentStep === 1) {
        return <Step2TypePermis data={formData.typePermis} onUpdate={updateFormData} />;
      }
      if (currentStep === 2) {
        return <StepCoordonneesCadastrales data={formData.coordonneesCadastrales} onUpdate={updateFormData} />;
      }
    }
    
    // Phase 2: Localisation & Substances
    if (currentPhase === 2) {
      return <Step4LocalisationSubstances data={formData.localisationSubstances} onUpdate={updateFormData} />;
    }
    
    // Phase 3: Documents
    if (currentPhase === 3) {
      return <Step5Documents data={formData.documents} onUpdate={updateFormData} />;
    }
    
    // Phase 4: Facture récapitulative
    if (currentPhase === 4) {
      return (
        <StepFacture 
          data={formData.facture} 
          formData={formData}
          onUpdate={updateFormData} 
          onNext={handleNext}
          onBack={handlePrevious}
        />
      );
    }
    
    // Phase 5: Paiement
    if (currentPhase === 5) {
      return <Step6Paiement data={formData.paiement} onUpdate={updateFormData} />;
    }
    
    return null;
  };

  const currentPhaseData = phases.find(p => p.id === currentPhase);
  const currentStepData = getCurrentPhaseSteps()[currentStep - 1];
  const isLastStep = currentPhase === phases.length && currentStep === getTotalStepsInPhase();

  return (
    <InvestorLayout>
      <div className={styles.container}>
        <div className={styles.wrapper}>
          {/* Header */}
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Nouvelle demande de permis</h1>
              <p className={styles.subtitle}>
                Complétez les phases pour soumettre votre demande
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/investor/dashboard')}>
              Annuler
            </Button>
          </div>

          {/* Phase Stepper */}
          <Card className={styles.stepperCard}>
            <CardContent className="pt-6">
              <WizardStepper 
                steps={phases} 
                currentStep={currentPhase}
                currentSubStep={currentStep}
              />
            </CardContent>
          </Card>

          {/* Step Content */}
          <Card className={styles.contentCard}>
            <CardHeader>
              <CardTitle className={styles.cardTitle}>
                Phase {currentPhase}: {currentPhaseData?.title}
                {getTotalStepsInPhase() > 1 && ` - ${currentStepData?.title}`}
              </CardTitle>
              <CardDescription>
                {getTotalStepsInPhase() > 1 
                  ? `Étape ${currentStep} sur ${getTotalStepsInPhase()}`
                  : `Phase ${currentPhase} sur ${phases.length}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderStep()}
            </CardContent>
          </Card>

          {/* Navigation Buttons */}
          <div className={styles.navigation}>
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentPhase === 1 && currentStep === 1}
              className={styles.navButton}
            >
              <ChevronLeft className="w-4 h-4" />
              Précédent
            </Button>

            {!isLastStep ? (
              <Button onClick={handleNext} className={styles.navButton}>
                Suivant
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className={styles.submitButton}>
                Soumettre la demande
              </Button>
            )}
          </div>
        </div>
      </div>
    </InvestorLayout>
  );
};

export default NouvelleDemande;
