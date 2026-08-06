import styles from "./Partners.module.css";
import { ScrollReveal } from "./ScrollReveal";
import anamLogo from "@/src/assets/partners/anam.png";
import ministereLogo from "@/src/assets/partners/ministere-mines.png";
import orgmLogo from "@/src/assets/partners/orgm.png";
import sonaremLogo from "@/src/assets/partners/sonarem.png";
import sonatrachLogo from "@/src/assets/partners/sonatrach.png";

const partners = [
  {
    name: "Ministère des Mines et de l'Industrie Minière",
    logo: ministereLogo,
    href: "https://oilmines.gov.dz",
  },
  { name: "ANAM", logo: anamLogo, href: "https://anam.gov.dz" },
  { name: "ORGM", logo: orgmLogo, href: "https://orgm.dz" },
  { name: "SONAREM", logo: sonaremLogo, href: "https://sonarem.dz" },
  {
    name: "Sonatrach",
    logo: sonatrachLogo,
    href: "https://sonatrach.com",
  },
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
                    <img
                      src={partner.logo}
                      alt={`Logo ${partner.name}`}
                      className={styles.partnerLogoImage}
                      loading="lazy"
                      decoding="async"
                    />
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
