import { InvestorLayout } from "@/components/investor/InvestorLayout";
import styles from "./parametres.module.css";

export default function Parametres() {
  return (
    <InvestorLayout>
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Parametres</h1>
          <p className={styles.subtitle}>
            Cette page sera completee prochainement.
          </p>
        </div>
      </div>
    </InvestorLayout>
  );
}
