import { Button } from "@/components/ui/button";
import { ArrowRight, Play, ChevronDown } from "lucide-react";
import heroImage from "@/src/assets/hero-mining.jpg";
import styles from "./Hero.module.css";

export const Hero = () => {
  const sideStats = [
    { value: "2380+", label: "Licences" },
    { value: "89Mrd", label: "Investissements" },
    { value: "48", label: "Wilayas" },
  ];

  return (
    <section className={styles.hero}>
      {/* Background Image */}
      <div
        className={styles.background}
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className={`${styles.gradientOverlay} ${styles.gradientLeft}`} />
        <div className={`${styles.gradientOverlay} ${styles.gradientBottom}`} />
      </div>

      {/* Animated Background Elements */}
      <div className={styles.animatedElements}>
        <div className={`${styles.floatingOrb} ${styles.floatingOrb1}`} />
        <div className={`${styles.floatingOrb} ${styles.floatingOrb2}`} />
      </div>

      {/* Content */}
      <div className={`container ${styles.content}`}>
        <div className={styles.contentInner}>
          {/* Badge */}
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            <span className={styles.badgeText}>Portail National des Activités Minières</span>
          </div>

          {/* Main Heading */}
          <h1 className={styles.heading}>
            Explorez les{" "}
            <span className={styles.headingHighlight}>richesses</span>{" "}
            minières de l'Algérie
          </h1>

          {/* Subtitle */}
          <p className={styles.subtitle}>
            Découvrez les opportunités d'investissement minier. Cartes interactives, 
            licences et demandes, disponibilité des minéraux en détail.
          </p>

          {/* CTAs */}
          <div className={styles.ctas}>
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-7 text-lg shadow-lg hover:shadow-xl transition-all group"
              asChild
            >
              <a href="/Signup/page">
                Commencer maintenant
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-2 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 px-8 py-7 text-lg transition-all group"
            >
              <Play className="mr-2 h-5 w-5" />
              Découvrir SIGAM
            </Button>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className={styles.scrollIndicator}>
        <a href="#stats" className={styles.scrollLink}>
          <span className={styles.scrollText}>Défiler</span>
          <ChevronDown className="h-5 w-5" />
        </a>
      </div>

      {/* Side Stats Preview */}
      <div className={styles.sideStats}>
        {sideStats.map((stat, index) => (
          <div 
            key={stat.label}
            className={styles.sideStatItem}
            style={{ animationDelay: `${0.8 + index * 0.2}s` }}
          >
            <div className={styles.sideStatValue}>{stat.value}</div>
            <div className={styles.sideStatLabel}>{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
};
