import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Globe } from "lucide-react";
import styles from "./Header.module.css";
const logo = "/anamlogo.png";

export const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Accueil", href: "/" },
    { label: "Services", href: "#services" },
    { label: "Carte Minière", href: "/carte/carte_public" },
    { label: "Actualites", href: "/acceuil/actualites" },
    { label: "Contact", href: "/acceuil/contact" },
  ];

  return (
    <header
      className={`${styles.header} ${
        isScrolled ? styles.headerScrolled : styles.headerTransparent
      }`}
    >
      <div className={`container ${styles.container}`}>
        {/* Logo */}
        <a href="/" className={styles.logoLink}>
          <div className={styles.flagBadge} aria-hidden="true">
            <svg
              className={styles.algerianFlag}
              viewBox="0 0 60 40"
              role="img"
              aria-label="Drapeau algérien"
            >
              <title>Drapeau algérien</title>
              <rect width="60" height="40" fill="#FFFFFF" />
              <rect width="30" height="40" fill="#006233" />
              <circle cx="30" cy="20" r="10.8" fill="#D21034" />
              <circle cx="32.9" cy="20" r="8.7" fill="#FFFFFF" />
              <polygon
                fill="#D21034"
                points="40.5,20 36.71,21.23 36.71,25.22 34.37,21.99 30.57,23.23 32.91,20 30.57,16.77 34.37,18.01 36.71,14.78 36.71,18.77"
              />
            </svg>
            <span className={styles.flagDivider} />
          </div>
          <img
            src={logo}
            alt="ANAM Logo"
            className={styles.logoImage}
            width={120}
            height={120}
            decoding="async"
            fetchPriority="high"
          />
          <div className={styles.logoText}>
            <span className={styles.logoTitle}>POM</span>
            <span className={styles.logoSubtitle}>Portail Minier</span>
          </div>
        </a>

        {/* Desktop Navigation */}
        <nav className={styles.nav}>
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={styles.navLink}
            >
              {link.label}
              <span className={styles.navLinkUnderline} />
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.globeButton}>
            <Globe className="h-5 w-5" />
          </button>
          <Button 
            variant="ghost" 
            className={styles.loginButton}
            asChild
          >
            <a href="/auth/login">Connexion</a>
          </Button>
          <Button 
            className={styles.signupButton}
            asChild
          >
            <a href="/Signup/page">Créer un compte</a>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className={styles.mobileMenuButton}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className={styles.mobileMenu}>
          <nav className={`container ${styles.mobileNav}`}>
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={styles.mobileNavLink}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className={styles.mobileActions}>
              <Button variant="outline" className="w-full border-primary/30 text-primary-foreground" asChild>
                <a href="/auth/login">Connexion</a>
              </Button>
              <Button className="w-full bg-primary" asChild>
                <a href="/Signup/page">Créer un compte</a>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
