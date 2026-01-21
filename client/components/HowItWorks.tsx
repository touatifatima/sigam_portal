import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import styles from "./HowItWorks.module.css";

const steps = [
  {
    step: "01",
    title: "Creer votre compte",
    description:
      "Inscrivez-vous gratuitement et completez votre profil investisseur.",
    features: ["Inscription rapide", "Verification securisee", "Acces immediat"],
  },
  {
    step: "02",
    title: "Explorer les opportunites",
    description:
      "Consultez la carte miniere et identifiez les zones d'interet.",
    features: ["Carte interactive", "Donnees en temps reel", "Filtres avances"],
  },
  {
    step: "03",
    title: "Soumettre votre demande",
    description:
      "Remplissez le formulaire de demande avec tous les documents requis.",
    features: ["Formulaire guide", "Upload securise", "Validation automatique"],
  },
  {
    step: "04",
    title: "Suivre l'avancement",
    description:
      "Suivez le traitement de votre demande et recevez vos notifications.",
    features: ["Suivi en temps reel", "Notifications", "Support dedie"],
  },
];

export const HowItWorks = () => {
  return (
    <section className={styles.section}>
      <div className={styles.backgroundGradient} />

      <div className={`container ${styles.container}`}>
        <div className={styles.header}>
          <span className={styles.label}>Investir dans le secteur minier</span>
          <h2 className={styles.title}>
            Explorez l'Algerie, investissez via{" "}
            <span className={styles.titleHighlight}>SIGAM</span>
          </h2>
          <p className={styles.description}>
            Decouvrez les services et options qui accelerent votre processus
            d'investissement dans le secteur minier avec des procedures
            simplifiees et fiables.
          </p>
        </div>

        <div className={styles.grid}>
          {steps.map((item) => (
            <div key={item.step} className={styles.stepCard}>
              <div className={styles.stepNumber}>{item.step}</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>{item.title}</h3>
                <p className={styles.stepDescription}>{item.description}</p>
                <ul className={styles.featuresList}>
                  {item.features.map((feature) => (
                    <li key={feature} className={styles.featureItem}>
                      <CheckCircle2 className={styles.featureIcon} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.cta}>
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-7 text-lg shadow-lg hover:shadow-xl transition-all group"
            asChild
          >
            <a href="/auth/signup">
              Commencer votre projet
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};
