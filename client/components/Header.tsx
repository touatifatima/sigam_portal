import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Globe } from "lucide-react";
import styles from "./Header.module.css";
const logo = "/logo.jpg";

export const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Accueil", href: "/" },
    { label: "Services", href: "#services" },
    { label: "Carte Minière", href: "#carte" },
    { label: "Actualités", href: "#actualites" },
    { label: "Contact", href: "#contact" },
  ];

  return (
    <header
      className={`${styles.header} ${
        isScrolled ? styles.headerScrolled : styles.headerTransparent
      }`}
    >
      <div className={`container ${styles.container}`}>
        {/* Logo */}
        <a href="/acceuil/Home" className={styles.logoLink}>
          <img 
            src={logo} 
            alt="ANAM Logo" 
            className={styles.logoImage} 
          />
          <div className={styles.logoText}>
            <span className={styles.logoTitle}>SIGAM</span>
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
            className="text-primary-foreground/90 hover:text-primary hover:bg-primary/10"
            asChild
          >
            <a href="/">Connexion</a>
          </Button>
          <Button 
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 shadow-lg hover:shadow-xl transition-all"
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
                <a href="/">Connexion</a>
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
