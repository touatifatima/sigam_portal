import { Button } from "@/components/ui/button";
import {
  FileText,
  MapPin,
  Shield,
  Users,
  Database,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import styles from "./Services.module.css";

const services = [
  {
    number: "01",
    icon: FileText,
    title: "Depot de demandes",
    description:
      "Soumettez vos demandes de permis miniers en ligne de maniere simple et securisee.",
  },
  {
    number: "02",
    icon: MapPin,
    title: "Carte miniere interactive",
    description:
      "Explorez les zones disponibles et les opportunites d'investissement sur notre carte interactive.",
  },
  {
    number: "03",
    icon: Shield,
    title: "Suivi des procedures",
    description:
      "Suivez l'etat de vos demandes en temps reel avec une transparence totale.",
  },
  {
    number: "04",
    icon: Users,
    title: "Support expert",
    description:
      "Beneficiez de l'accompagnement de nos experts geologiques et juridiques.",
  },
  {
    number: "05",
    icon: Database,
    title: "Base de donnees minerale",
    description:
      "Accedez aux informations detaillees sur les ressources minerales disponibles.",
  },
  {
    number: "06",
    icon: BarChart3,
    title: "Processus transparent",
    description:
      "Des procedures claires et efficaces pour un investissement reussi.",
  },
];

export const Services = () => {
  return (
    <section id="services" className={styles.section}>
      <div className={styles.backgroundGradient} />
      <div className={styles.backgroundOrb} />

      <div className={`container ${styles.container}`}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <span className={styles.label}>Plateforme SIGAM</span>
            <h2 className={styles.title}>
              Solutions numeriques et outils innovants
            </h2>
            <p className={styles.description}>
              Nous offrons une experience intelligente et des technologies
              modernes via notre plateforme pour permettre le succes des
              investisseurs.
            </p>
          </div>
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 group w-fit"
            asChild
          >
            <a href="/auth/signup">
              Investir maintenant
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
          </Button>
        </div>

        <div className={styles.grid}>
          {services.map((service) => (
            <div key={service.title} className={styles.serviceCard}>
              <span className={styles.serviceNumber}>{service.number}</span>
              <div className={styles.serviceHeader}>
                <div className={styles.iconWrapper}>
                  <service.icon className={styles.icon} />
                </div>
                <h3 className={styles.serviceTitle}>{service.title}</h3>
              </div>
              <p className={styles.serviceDescription}>{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
