import styles from "./Partners.module.css";
import { ScrollReveal } from "./ScrollReveal";

const partners = [
  {
    name: "Ministere de l'Energie et des Mines",
    short: "Mdl",
    href: "https://oilmines.gov.dz",
  },
  { name: "ANAM", short: "A", href: "https://anam.gov.dz" },
  { name: "ORGM", short: "O", href: "https://orgm.dz" },
  { name: "ENOF", short: "E", href: "https://enof.dz" },
  { name: "Sonatrach", short: "S", href: "https://sonatrach.com" },
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
              <a
                href={partner.href}
                target="_blank"
                rel="noreferrer"
                className={styles.partnerItem}
                aria-label={`Ouvrir le site officiel de ${partner.name}`}
              >
                <div className={styles.partnerContent}>
                  <div className={styles.partnerLogo}>
                    <span className={styles.partnerInitials}>{partner.short}</span>
                  </div>
                  <span className={styles.partnerName}>{partner.name}</span>
                </div>
              </a>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};
