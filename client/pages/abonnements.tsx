import { Header } from "@/components/Header";
import { Subscriptions } from "@/components/Subscriptions";
import styles from "./abonnements.module.css";

export default function AbonnementsPage() {
  return (
    <div className={styles.page}>
      <Header />
      <section className={styles.hero}>
        <span className={styles.heroLabel}>Tarifs &amp; abonnements</span>
        <h1 className={styles.heroTitle}>Choisissez votre abonnement GUNAM</h1>
        <p className={styles.heroSubtitle}>
          Consultation, verification et gestion de vos activites minieres : une offre pour chaque
          besoin.
        </p>
      </section>
      <Subscriptions />
    </div>
  );
}
