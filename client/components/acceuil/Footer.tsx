import { MapPin, Phone, Mail, ArrowUpRight } from "lucide-react";
const logo = "/vite.svg";

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  const links = {
    services: [
      { label: "Dépôt de demandes", href: "#" },
      { label: "Carte minière", href: "#" },
      { label: "Suivi des procédures", href: "#" },
      { label: "Base de données", href: "#" },
    ],
    resources: [
      { label: "Guide d'utilisation", href: "#" },
      { label: "FAQ", href: "#" },
      { label: "Actualités", href: "#" },
      { label: "Documentation", href: "#" },
    ],
    legal: [
      { label: "Conditions d'utilisation", href: "#" },
      { label: "Politique de confidentialité", href: "#" },
      { label: "Mentions légales", href: "#" },
    ],
  };

  return (
    <footer id="contact" className="bg-secondary text-secondary-foreground">
      {/* Main Footer */}
      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <a href="/" className="flex items-center gap-3 mb-6">
              <img src={logo} alt="ANAM Logo" className="h-12 w-auto" />
              <div>
                <span className="text-2xl font-bold text-primary">SIGAM</span>
                <p className="text-xs text-secondary-foreground/60">Portail Minier National</p>
              </div>
            </a>
            <p className="text-secondary-foreground/70 mb-6 leading-relaxed">
              Plateforme nationale de gestion des activités minières. 
              Simplifiez vos démarches et investissez dans le secteur minier algérien.
            </p>
            
            {/* Contact Info */}
            <div className="space-y-3">
              <a href="#" className="flex items-center gap-3 text-secondary-foreground/70 hover:text-primary transition-colors">
                <MapPin className="h-5 w-5 text-primary" />
                <span className="text-sm">Alger, Algérie</span>
              </a>
              <a href="tel:+213123456789" className="flex items-center gap-3 text-secondary-foreground/70 hover:text-primary transition-colors">
                <Phone className="h-5 w-5 text-primary" />
                <span className="text-sm">+213 123 456 789</span>
              </a>
              <a href="mailto:contact@sigam.dz" className="flex items-center gap-3 text-secondary-foreground/70 hover:text-primary transition-colors">
                <Mail className="h-5 w-5 text-primary" />
                <span className="text-sm">contact@sigam.dz</span>
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-semibold text-lg mb-6">Services</h4>
            <ul className="space-y-3">
              {links.services.map((link) => (
                <li key={link.label}>
                  <a 
                    href={link.href} 
                    className="text-secondary-foreground/70 hover:text-primary transition-colors flex items-center gap-1 group"
                  >
                    {link.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold text-lg mb-6">Ressources</h4>
            <ul className="space-y-3">
              {links.resources.map((link) => (
                <li key={link.label}>
                  <a 
                    href={link.href} 
                    className="text-secondary-foreground/70 hover:text-primary transition-colors flex items-center gap-1 group"
                  >
                    {link.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-lg mb-6">Légal</h4>
            <ul className="space-y-3">
              {links.legal.map((link) => (
                <li key={link.label}>
                  <a 
                    href={link.href} 
                    className="text-secondary-foreground/70 hover:text-primary transition-colors flex items-center gap-1 group"
                  >
                    {link.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-secondary-foreground/10">
        <div className="container py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-secondary-foreground/60">
            © {currentYear} ANAM - Agence Nationale des Activités Minières. Tous droits réservés.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-secondary-foreground/60 hover:text-primary transition-colors">
              Français
            </a>
            <a href="#" className="text-sm text-secondary-foreground/60 hover:text-primary transition-colors">
              العربية
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
