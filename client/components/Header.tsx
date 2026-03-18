import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Globe } from "lucide-react";
import styles from "./Header.module.css";
const logoJpg = "/logo.jpg";
const logoWebp = "/logo.webp";

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
    { label: "Services", href: "/auth/login" },
    { label: "Carte Minière", href: "/carte/carte_public" },
    { label: "Actualités", href: "/auth/login" },
    { label: "Contact", href: "/auth/login" },
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
          <picture>
            <source srcSet={logoWebp} type="image/webp" />
            <img
              src={logoJpg}
              alt="ANAM Logo"
              className={styles.logoImage}
              width={96}
              height={48}
              decoding="async"
              fetchPriority="high"
            />
          </picture>
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
