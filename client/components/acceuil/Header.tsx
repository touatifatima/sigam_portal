import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Globe } from "lucide-react";
const logo = "/vite.svg";

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

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-500 ${
        isScrolled
          ? "bg-secondary/95 backdrop-blur-xl shadow-lg py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="container flex items-center justify-between">
        {/* Logo */}
        <a href="/acceuil/Home" className="flex items-center gap-3 group">
          <img 
            src={logo} 
            alt="ANAM Logo" 
            className="h-12 w-auto transition-transform duration-300 group-hover:scale-105" 
          />
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-primary-foreground tracking-tight">
              SIGAM
            </span>
            <span className="text-[10px] text-primary-foreground/70 uppercase tracking-widest">
              Portail Minier
            </span>
          </div>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-8">
          {[
            { label: "Accueil", href: "/acceuil/Home" },
            { label: "Services", href: "#services" },
            { label: "Carte Minière", href: "#carte" },
            { label: "Actualités", href: "#actualites" },
            { label: "Contact", href: "#contact" },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-primary-foreground/80 hover:text-primary transition-colors relative group"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="hidden lg:flex items-center gap-4">
          <button className="p-2 text-primary-foreground/80 hover:text-primary transition-colors">
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
            <a href="/signup/page">Créer un compte</a>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="lg:hidden p-2 text-primary-foreground"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-secondary/98 backdrop-blur-xl border-t border-border/10 animate-fade-in">
          <nav className="container py-6 flex flex-col gap-4">
            {[
              { label: "Accueil", href: "/" },
              { label: "Services", href: "#services" },
              { label: "Carte Minière", href: "#carte" },
              { label: "Actualités", href: "#actualites" },
              { label: "Contact", href: "#contact" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-primary-foreground/80 hover:text-primary py-2 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-3 pt-4 border-t border-border/10">
              <Button variant="outline" className="w-full border-primary/30 text-primary-foreground" asChild>
                <a href="/auth/login">Connexion</a>
              </Button>
              <Button className="w-full bg-primary" asChild>
                <a href="/auth/signup">Créer un compte</a>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
