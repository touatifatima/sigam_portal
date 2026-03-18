import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import styles from "./CallToAction.module.css";
import { ScrollReveal } from "./ScrollReveal";

export const CallToAction = () => {
  return (
    <section className={styles.section}>
      <div className={styles.backgroundElements}>
        <div className={styles.backgroundOrb1} />
        <div className={styles.backgroundOrb2} />
      </div>
      <div className={styles.backgroundPattern}>
        <div className={styles.dotPattern} />
      </div>

      <div className={`container ${styles.container}`}>
        <div className={styles.content}>
          <ScrollReveal>
            <div className={styles.badge}>
              <Sparkles className={styles.badgeIcon} />
              <span className={styles.badgeText}>Rejoignez la plateforme SIGAM</span>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <h2 className={styles.title}>
              Faites partie de l'avenir{" "}
              <span className={styles.titleHighlight}>minier de l'Algerie</span>
            </h2>
          </ScrollReveal>

          <ScrollReveal delay={180}>
            <p className={styles.description}>
              Participez a faconner l'experience utilisateur de la plateforme.
              Testez les fonctionnalites, partagez vos commentaires et contribuez a ameliorer l'experience.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={240}>
            <div className={styles.ctas}>
              <Button
                size="lg"
                className="homePremiumSignupButton homePremiumButtonLg"
                asChild
              >
                <a href="/Signup/page">
                  Creer mon compte
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="homePremiumGhostButton homePremiumButtonLg"
                asChild
              >
                <a href="/auth/login">Nous contacter</a>
              </Button>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
};

