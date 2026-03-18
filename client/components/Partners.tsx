import styles from "./Partners.module.css";
import { ScrollReveal } from "./ScrollReveal";

const partners = [
  { name: "Ministere de l'Energie et des Mines", short: "Mdl" },
  { name: "ANAM", short: "A" },
  { name: "ORGM", short: "O" },
  { name: "ENOF", short: "E" },
  { name: "Sonatrach", short: "S" },
];

export const Partners = () => {
  return (
    <section className={styles.section}>
      <div className="container">
        <ScrollReveal>
          <div className={styles.header}>
            <span className={styles.label}>
              Organismes gouvernementaux de soutien
            </span>
            <h2 className={styles.title}>Partenaires du secteur minier</h2>
          </div>
        </ScrollReveal>

        <div className={styles.grid}>
          {partners.map((partner, i) => (
            <ScrollReveal key={partner.name} delay={i * 100}>
              <div className={styles.partnerItem}>
                <div className={styles.partnerContent}>
                  <div className={styles.partnerLogo}>
                    <span className={styles.partnerInitials}>{partner.short}</span>
                  </div>
                  <span className={styles.partnerName}>{partner.name}</span>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};
