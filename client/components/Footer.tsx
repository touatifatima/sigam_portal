import Link from "next/link";
import { ArrowUpRight, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import styles from "./Footer.module.css";

const logo = "/Logo.png?v=7";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  const links = {
    platform: [
      { label: "Tableau de bord", href: "/investisseur/InvestorDashboard" },
      { label: "Nouvelle demande", href: "/investisseur/nouvelle_demande/step1_typepermis/page1_typepermis" },
      { label: "Demande posterieure", href: "/investisseur/nouvelle-demande-posterieure" },
      { label: "Carte publique", href: "/carte/carte_public" },
    ],
    resources: [
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
      <div className={styles.surface}>
        <div className={styles.main}>
          <div className={styles.brandPanel}>
            <div className={styles.brandMark} aria-label="GUNAM">
              <img
                src={logo}
                alt="GUNAM"
                className={styles.brandLogo}
                width={210}
                height={92}
                loading="lazy"
                decoding="async"
              />
            </div>
            <p className={styles.brandDescription}>
              Portail numerique de gestion des demarches minieres, du suivi des
              demandes et de la consultation des titres.
            </p>
            <div className={styles.trustBadge}>
              <ShieldCheck aria-hidden="true" />
              <span>Plateforme securisee</span>
            </div>
          </div>

          <nav className={styles.linksGrid} aria-label="Liens du pied de page">
            <div className={styles.linksSection}>
              <h4 className={styles.linksSectionTitle}>Plateforme</h4>
              <ul className={styles.linksList}>
                {links.platform.map((link) => (
                  <li key={link.label} className={styles.linkItem}>
                    <Link href={link.href}>
                      <span>{link.label}</span>
                      <ArrowUpRight aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.linksSection}>
              <h4 className={styles.linksSectionTitle}>Ressources</h4>
              <ul className={styles.linksList}>
                {links.resources.map((link) => (
                  <li key={link.label} className={styles.linkItem}>
                    <Link href={link.href}>
                      <span>{link.label}</span>
                      <ArrowUpRight aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.linksSection}>
              <h4 className={styles.linksSectionTitle}>Juridique</h4>
              <ul className={styles.linksList}>
                {links.legal.map((link) => (
                  <li key={link.label} className={styles.linkItem}>
                    <Link href={link.href}>
                      <span>{link.label}</span>
                      <ArrowUpRight aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className={styles.contactCard}>
            <h4 className={styles.linksSectionTitle}>Contact</h4>
            <div className={styles.contactInfo}>
              <div className={styles.contactLine}>
                <MapPin className={styles.contactIcon} />
                <span>Seghir Gacem, 42 Chemin Mohamed Gacem, El Mouradia</span>
              </div>
              <a href="tel:+21321699932" className={styles.contactLine}>
                <Phone className={styles.contactIcon} />
                <span>+213 (0)21 69 99 32</span>
              </a>
              <a href="mailto:anam@anam.gov.dz" className={styles.contactLine}>
                <Mail className={styles.contactIcon} />
                <span>anam@anam.gov.dz</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.bottomBar}>
        <div className={styles.bottomContent}>
          <p className={styles.copyright}>
            (c) {currentYear} GUNAM. Tous droits reserves.
          </p>
        </div>
      </div>
    </footer>
  );
};
