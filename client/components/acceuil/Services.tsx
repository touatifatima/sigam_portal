import { Button } from "@/components/ui/button";
import { 
  FileText, 
  MapPin, 
  Shield, 
  Users, 
  Database, 
  BarChart3,
  ArrowRight 
} from "lucide-react";

const services = [
  {
    number: "01",
    icon: FileText,
    title: "Dépôt de demandes",
    description: "Soumettez vos demandes de permis miniers en ligne de manière simple et sécurisée.",
  },
  {
    number: "02",
    icon: MapPin,
    title: "Carte minière interactive",
    description: "Explorez les zones disponibles et les opportunités d'investissement sur notre carte interactive.",
  },
  {
    number: "03",
    icon: Shield,
    title: "Suivi des procédures",
    description: "Suivez l'état de vos demandes en temps réel avec une transparence totale.",
  },
  {
    number: "04",
    icon: Users,
    title: "Support expert",
    description: "Bénéficiez de l'accompagnement de nos experts géologiques et juridiques.",
  },
  {
    number: "05",
    icon: Database,
    title: "Base de données minérale",
    description: "Accédez aux informations détaillées sur les ressources minérales disponibles.",
  },
  {
    number: "06",
    icon: BarChart3,
    title: "Processus transparent",
    description: "Des procédures claires et efficaces pour un investissement réussi.",
  },
];

export const Services = () => {
  return (
    <section id="services" className="py-24 bg-secondary text-secondary-foreground relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/5 to-transparent" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />

      <div className="container relative z-10">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-16">
          <div className="max-w-2xl">
            <span className="text-primary font-semibold text-sm uppercase tracking-widest mb-4 block">
              Plateforme SIGAM
            </span>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Solutions numériques et outils innovants
            </h2>
            <p className="text-xl text-secondary-foreground/70">
              Nous offrons une expérience intelligente et des technologies modernes 
              via notre plateforme pour permettre le succès des investisseurs.
            </p>
          </div>
          <Button 
            size="lg" 
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 group w-fit"
            asChild
          >
            <a href="/auth/signup">
              Investir maintenant
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
          </Button>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <div
              key={service.title}
              className="group p-8 rounded-2xl bg-secondary-foreground/5 border border-secondary-foreground/10 hover:border-primary/30 hover:bg-secondary-foreground/10 transition-all duration-300 cursor-pointer"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start gap-4 mb-4">
                <span className="text-5xl font-bold text-primary/20 group-hover:text-primary/40 transition-colors">
                  {service.number}
                </span>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <service.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">{service.title}</h3>
              </div>
              <p className="text-secondary-foreground/70 leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};