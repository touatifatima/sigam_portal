import { AnimatePresence, motion } from "framer-motion";
import styles from "./OnboardingWelcomeModal.module.css";

type OnboardingWelcomeModalProps = {
  isOpen: boolean;
  onStart: () => void;
  onSkip: () => void;
};

export function OnboardingWelcomeModal({
  isOpen,
  onStart,
  onSkip,
}: OnboardingWelcomeModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-label="Demarrage du guide"
          >
            <div className={styles.badge}>Guide rapide</div>
            <h2 className={styles.title}>Bienvenue sur le Portail ANAM</h2>
            <p className={styles.text}>
              Souhaitez-vous decouvrir rapidement comment utiliser la plateforme ?
            </p>

            <div className={styles.actions}>
              <button className={styles.primary} onClick={onStart}>
                Commencer le guide
              </button>
              <button className={styles.secondary} onClick={onSkip}>
                Passer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

