import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import styles from "./CallToAction.module.css";

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
          <div className={styles.badge}>
            <Sparkles className={styles.badgeIcon} />
            <span className={styles.badgeText}>Rejoignez la plateforme SIGAM</span>
          </div>

          <h2 className={styles.title}>
            Faites partie de l'avenir{" "}
            <span className={styles.titleHighlight}>minier de l'Algerie</span>
          </h2>

          <p className={styles.description}>
            Participez a faconner l'experience utilisateur de la plateforme.
            Testez les fonctionnalites, partagez vos commentaires et contribuez a ameliorer l'experience.
          </p>

          <div className={styles.ctas}>
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-7 text-lg shadow-lg hover:shadow-xl transition-all group"
              asChild
            >
              <a href="/auth/signup">
                Creer mon compte
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-secondary-foreground/30 text-secondary-foreground hover:bg-secondary-foreground/10 px-10 py-7 text-lg"
              asChild
            >
              <a href="#contact">Nous contacter</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
