import { MapPin, Phone, Mail } from "lucide-react";
import styles from "./Footer.module.css";

const logo = "/logo.jpg";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  const links = {
    services: [
      { label: "Depot de demandes", href: "#" },
      { label: "Carte miniere", href: "#" },
      { label: "Suivi des procedures", href: "#" },
      { label: "Base de donnees", href: "#" },
    ],
    resources: [
      { label: "Guide d'utilisation", href: "#" },
      { label: "FAQ", href: "#" },
      { label: "Actualites", href: "#" },
      { label: "Documentation", href: "#" },
    ],
    legal: [
      { label: "Conditions d'utilisation", href: "#" },
      { label: "Politique de confidentialite", href: "#" },
      { label: "Mentions legales", href: "#" },
    ],
  };

  return (
    <footer id="contact" className={styles.footer}>
      <div className={styles.gradient} />

      <div className={`container ${styles.main}`}>
        <div className={styles.grid}>
          <div className={styles.brand}>
            <a href="/acceuil/Home" className={styles.brandLink}>
              <img src={logo} alt="ANAM Logo" className={styles.brandLogo} />
              <div>
                <span className={styles.brandTitle}>SIGAM</span>
                <p className={styles.brandSubtitle}>Portail Minier National</p>
              </div>
            </a>
            <p className={styles.brandDescription}>
              Plateforme nationale de gestion des activites minieres. Simplifiez vos demarches et investissez dans le secteur minier algerien.
            </p>

            <div className={styles.contactInfo}>
              <div className={styles.contactLine}>
                <MapPin className={styles.contactIcon} />
                <span>Alger, Algerie</span>
              </div>
              <a href="tel:+213123456789" className={styles.contactLine}>
                <Phone className={styles.contactIcon} />
                <span>+213 123 456 789</span>
              </a>
              <a href="mailto:contact@sigam.dz" className={styles.contactLine}>
                <Mail className={styles.contactIcon} />
                <span>contact@sigam.dz</span>
              </a>
            </div>
          </div>

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

          <div className={styles.linksSection}>
            <h4 className={styles.linksSectionTitle}>Ressources</h4>
            <ul className={styles.linksList}>
              {links.resources.map((link) => (
                <li key={link.label} className={styles.linkItem}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.linksSection}>
            <h4 className={styles.linksSectionTitle}>Legal</h4>
            <ul className={styles.linksList}>
              {links.legal.map((link) => (
                <li key={link.label} className={styles.linkItem}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className={styles.bottomBar}>
        <div className={`container ${styles.bottomContent}`}>
          <p className={styles.copyright}>
            © {currentYear} ANAM - Agence Nationale des Activites Minieres. Tous droits reserves.
          </p>
          <div className={styles.languages}>
            <a href="#" className={styles.languageLink}>
              Francais
            </a>
            <a href="#" className={styles.languageLink}>
              Arabe
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
