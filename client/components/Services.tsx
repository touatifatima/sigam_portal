import { Button } from "@/components/ui/button";
import { 
  FileText, MapPin, Shield, Users, Database, BarChart3, ArrowRight 
} from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";
import styles from "./Services.module.css";

const services = [
  {
    number: "01",
    icon: FileText,
    title: "Dépôt de demandes",
    description: "Soumettez vos demandes de permis miniers en ligne de manière simple et sécurisée.",
    image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=250&fit=crop",
  },
  {
    number: "02",
    icon: MapPin,
    title: "Carte minière interactive",
    description: "Explorez les zones disponibles et les opportunités d'investissement sur notre carte interactive.",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=250&fit=crop",
  },
  {
    number: "03",
    icon: Shield,
    title: "Suivi des procédures",
    description: "Suivez l'état de vos demandes en temps réel avec une transparence totale.",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=250&fit=crop",
  },
  {
    number: "04",
    icon: Users,
    title: "Support expert",
    description: "Bénéficiez de l'accompagnement de nos experts géologiques et juridiques.",
    image: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400&h=250&fit=crop",
  },
  {
    number: "05",
    icon: Database,
    title: "Base de données minérale",
    description: "Accédez aux informations détaillées sur les ressources minérales disponibles.",
    image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=250&fit=crop",
  },
  {
    number: "06",
    icon: BarChart3,
    title: "Processus transparent",
    description: "Des procédures claires et efficaces pour un investissement réussi.",
    image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=250&fit=crop",
  },
];

const cardImageSizes = "(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw";

const unsplashVariant = (url: string, width: number, format: "jpg" | "webp" = "jpg") => {
  const base = url.split("?")[0];
  const height = Math.round(width * 0.625);
  const webpParam = format === "webp" ? "&fm=webp" : "";
  return `${base}?w=${width}&h=${height}&fit=crop&auto=format&q=72${webpParam}`;
};

export const Services = () => {
  return (
    <section id="services" className={styles.section}>
      <div className={styles.backgroundGradient} />
      <div className={styles.backgroundOrb} />

      <div className={`container ${styles.container}`}>
        <ScrollReveal>
          <div className={styles.header}>
            <div className={styles.headerContent}>
              <span className={styles.label}>Plateforme POM</span>
              <h2 className={styles.title}>Solutions numériques et outils innovants</h2>
              <p className={styles.description}>
                Nous offrons une expérience intelligente et des technologies modernes 
                via notre plateforme pour permettre le succès des investisseurs.
              </p>
            </div>
            <Button 
              size="lg" 
              className={`${styles.headerCta} homePremiumSignupButton homePremiumButtonMd`}
              asChild
            >
              <a href="/Signup/page">
                Investir maintenant
                <ArrowRight className="h-5 w-5" />
              </a>
            </Button>
          </div>
        </ScrollReveal>

        <div className={styles.grid}>
          {services.map((service, i) => (
            <ScrollReveal key={service.title} delay={i * 100}>
              <div className={styles.serviceCard}>
                <div className={styles.serviceImageWrapper}>
                  <picture className={styles.servicePicture}>
                    <source
                      type="image/webp"
                      srcSet={`${unsplashVariant(service.image, 360, "webp")} 360w, ${unsplashVariant(service.image, 720, "webp")} 720w, ${unsplashVariant(service.image, 1080, "webp")} 1080w`}
                      sizes={cardImageSizes}
                    />
                    <img
                      src={unsplashVariant(service.image, 720)}
                      srcSet={`${unsplashVariant(service.image, 360)} 360w, ${unsplashVariant(service.image, 720)} 720w, ${unsplashVariant(service.image, 1080)} 1080w`}
                      sizes={cardImageSizes}
                      alt={service.title}
                      className={styles.serviceImage}
                      loading="lazy"
                      decoding="async"
                      width={400}
                      height={250}
                    />
                  </picture>
                  <div className={styles.serviceImageOverlay} />
                  <span className={styles.serviceNumber}>{service.number}</span>
                </div>
                <div className={styles.serviceBody}>
                  <div className={styles.serviceHeader}>
                    <div className={styles.iconWrapper}>
                      <service.icon className={styles.icon} />
                    </div>
                    <h3 className={styles.serviceTitle}>{service.title}</h3>
                  </div>
                  <p className={styles.serviceDescription}>{service.description}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};
