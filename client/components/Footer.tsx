import Link from "next/link";
import { MapPin, Phone, Mail } from "lucide-react";
import styles from "./Footer.module.css";
import { ScrollReveal } from "./ScrollReveal";

const logo = "/anamlogo.png";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  const links = {
    services: [
      { label: "Depot de demandes", href: "/auth/login" },
      { label: "Carte miniere", href: "/auth/login" },
      { label: "Suivi des procedures", href: "/auth/login" },
      { label: "Base de donnees", href: "/auth/login" },
    ],
    resources: [
      { label: "Guide d'utilisation", href: "/auth/login" },
      { label: "FAQ", href: "/acceuil/faq" },
      { label: "Actualites", href: "/acceuil/actualites" },
      { label: "Documentation", href: "/acceuil/documentation" },
    ],
    legal: [
      { label: "Conditions d'utilisation", href: "/conditions-utilisation" },
      { label: "Politique de confidentialite", href: "/politique-confidentialite" },
      { label: "Mentions legales", href: "/mentions-legales" },
    ],
  };

  return (
    <footer id="contact" className={styles.footer}>
      <div className={styles.gradient} />

      <div className={`container ${styles.main}`}>
        <div className={styles.grid}>
          <ScrollReveal delay={0}>
            <div className={styles.brand}>
              <a href="/acceuil/Home" className={styles.brandLink}>
                <img
                  src={logo}
                  alt="ANAM Logo"
                  className={styles.brandLogo}
                  width={120}
                  height={120}
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <span className={styles.brandTitle}>POM</span>
                  <p className={styles.brandSubtitle}>Portail Minier National</p>
                </div>
              </a>
              <p className={styles.brandDescription}>
                Plateforme nationale de gestion des activites minieres. Simplifiez vos
                demarches et investissez dans le secteur minier algerien.
              </p>

              <div className={styles.contactInfo}>
                <div className={styles.contactLine}>
                  <MapPin className={styles.contactIcon} />
                  <span>Alger, Algerie</span>
                </div>
                <a href="tel:+21323488125" className={styles.contactLine}>
                  <Phone className={styles.contactIcon} />
                  <span>+213 (0)23 48 81 25</span>
                </a>
                <a href="mailto:anam@anam.gov.dz" className={styles.contactLine}>
                  <Mail className={styles.contactIcon} />
                  <span>anam@anam.gov.dz</span>
                </a>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <div className={styles.linksSection}>
              <h4 className={styles.linksSectionTitle}>Services</h4>
              <ul className={styles.linksList}>
                {links.services.map((link) => (
                  <li key={link.label} className={styles.linkItem}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className={styles.linksSection}>
              <h4 className={styles.linksSectionTitle}>Ressources</h4>
              <ul className={styles.linksList}>
                {links.resources.map((link) => (
                  <li key={link.label} className={styles.linkItem}>
                    {link.href === "/acceuil/actualites" ? (
                      <Link
                        href={link.href}
                        onClick={() => {
                          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
                        }}
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href}>{link.label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <div className={styles.linksSection}>
              <h4 className={styles.linksSectionTitle}>Juridique</h4>
              <ul className={styles.linksList}>
                {links.legal.map((link) => (
                  <li key={link.label} className={styles.linkItem}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </div>
      </div>

      <div className={styles.bottomBar}>
        <div className={`container ${styles.bottomContent}`}>
          <ScrollReveal delay={250}>
            <p className={styles.copyright}>
              (c) {currentYear} ANAM - Agence Nationale des Activites Minieres. Tous droits
              reserves.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={300}>
            <div className={styles.languages}>
              <a href="/auth/login" className={styles.languageLink}>
                Francais
              </a>
              <a href="/auth/login" className={styles.languageLink}>
                Arabe
              </a>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </footer>
  );
};
