import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, FileText, Map, BarChart3 } from "lucide-react";
import { InvestorLayout } from "@/components/investor/InvestorLayout";
import styles from "./Bienvenue.module.css";
import { useAuthStore } from "@/src/store/useAuthStore";

const Bienvenue = () => {
  const navigate = useNavigate();
  const { auth } = useAuthStore();
  const displayName = auth.username || auth.email || "Investisseur";

  const features = [
    {
      icon: FileText,
      title: "Soumettre des demandes",
      description: "Creez et suivez vos demandes de permis miniers facilement",
    },
    {
      icon: Map,
      title: "Carte SIG interactive",
      description: "Visualisez les zones minieres et verifiez les chevauchements",
    },
    {
      icon: BarChart3,
      title: "Tableau de bord",
      description: "Suivez l'etat de vos demandes et paiements en temps reel",
    },
  ];

  return (
    <InvestorLayout>
      <div className={styles.container}>
        <div className={styles.wrapper}>
          {/* Success Animation */}
          <div className={styles.successIcon}>
            <div className={styles.successCircle}>
              <CheckCircle className={styles.checkIcon} />
            </div>
            <div className={styles.ripple}></div>
            <div className={styles.ripple2}></div>
          </div>

          {/* Welcome Message */}
          <div className={styles.welcomeContent}>
            <h1 className={styles.title}>Bienvenue, {displayName} !</h1>
            <p className={styles.subtitle}>
              Votre compte entreprise a ete verifie avec succes.
              <br />
              Vous pouvez maintenant demarrer vos investissements et demandes.
            </p>
          </div>

          {/* Features Grid */}
          <div className={styles.featuresGrid}>
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={styles.featureCard}
                style={{ animationDelay: `${0.2 + index * 0.1}s` }}
              >
                <div className={styles.featureIconWrapper}>
                  <feature.icon className={styles.featureIcon} />
                </div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDescription}>{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className={styles.actions}>
            <Button
              onClick={() =>
                navigate(
                  "/investisseur/nouvelle_demande/step1_typepermis/page1_typepermis"
                )
              }
              size="lg"
              className={styles.primaryButton}
            >
              <FileText className="w-5 h-5 mr-2" />
              Nouvelle Demande
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>

            <Button
              onClick={() => navigate("/investisseur/InvestorDashboard")}
              variant="outline"
              size="lg"
              className={styles.secondaryButton}
            >
              Acceder au Tableau de Bord
            </Button>
          </div>
        </div>
      </div>
    </InvestorLayout>
  );
};

export default Bienvenue;
