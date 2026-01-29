import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StepIdentification } from "@/components/wizard/steps/StepIdentification";
import { useToast } from "@/src/hooks/use-toast";
import { Building2, CheckCircle, ChevronRight } from "lucide-react";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import styles from "./IdentificationEntreprise.module.css";
import { useAuthStore } from "@/src/store/useAuthStore";

const IdentificationEntreprise = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const justConfirmedRef = useRef(false);
  const setEntrepriseVerified = useAuthStore((s) => s.setEntrepriseVerified);
  const { auth, isLoaded } = useAuthStore();
  const apiURL = process.env.NEXT_PUBLIC_API_URL;

  const handleUpdate = useCallback((data: any) => {
    setFormData(data);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (auth.isEntrepriseVerified && !justConfirmedRef.current) {
      navigate("/investisseur/InvestorDashboard");
    }
  }, [auth.isEntrepriseVerified, isLoaded, navigate]);

  const handleConfirm = async () => {
    setIsSubmitting(true);

    try {
      const payload = formData?.identification ?? formData;
      if (!apiURL) {
        throw new Error("API URL manquante");
      }

      await axios.post(`${apiURL}/api/investisseur/identification`, payload, {
        withCredentials: true,
        headers: {
          "Content-Type": "application/json",
        },
      });

      justConfirmedRef.current = true;
      setEntrepriseVerified(true);

      toast({
        title: "Entreprise confirmee",
        description: "Votre entreprise a ete enregistree avec succes.",
      });

      navigate("/investisseur/Identification/bienvenue");
    } catch (error) {
      console.error("Erreur enregistrement entreprise:", error);
      const err = error as any;
      toast({
        title: "Erreur",
        description:
          err?.response?.data?.message ||
          err?.message ||
          "Echec de l'enregistrement de l'entreprise.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <InvestorLayout>
      <div className={styles.container}>
        <div className={styles.wrapper}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.iconWrapper}>
              <Building2 className={styles.icon} />
            </div>
            <h1 className={styles.title}>Confirmation de votre entreprise</h1>
            <p className={styles.subtitle}>
              Pour acceder a l'espace investisseur, veuillez confirmer les informations de votre entreprise
            </p>
          </div>

          {/* Form Card */}
          <Card className={styles.card}>
            <CardHeader className={styles.cardHeader}>
              <CardTitle className={styles.cardTitle}>
                <CheckCircle className={styles.sectionIcon} />
                Informations de l'entreprise
              </CardTitle>
              <CardDescription className={styles.cardDescription}>
                Remplissez les informations ci-dessous pour valider votre compte entreprise
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StepIdentification data={formData} onUpdate={handleUpdate} />
              
              <div className={styles.actions}>
                <Button
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  size="lg"
                  className={styles.confirmButton}
                >
                  {isSubmitting ? (
                    <>
                      <span className={styles.spinner}></span>
                      Verification en cours...
                    </>
                  ) : (
                    <>
                      Confirmer l'entreprise
                      <ChevronRight className={styles.actionIcon} />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </InvestorLayout>
  );
};

export default IdentificationEntreprise;
