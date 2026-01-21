import { Button } from "@/components/ui/button";
import { ArrowRight, Play, ChevronDown } from "lucide-react";
const heroImage = "/src/assets/hero-mining.jpg";

export const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${heroImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-secondary/95 via-secondary/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary/60 via-transparent to-secondary/30" />
      </div>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "1s" }} />
      </div>

      {/* Content */}
      <div className="container relative z-10 pt-32 pb-20">
        <div className="max-w-3xl">
          {/* Badge */}
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 border border-primary/30 text-primary mb-8 animate-fade-in"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-medium">Portail National des Activités Minières</span>
          </div>

          {/* Main Heading */}
          <h1 
            className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-primary-foreground leading-[1.1] animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            Explorez les{" "}
            <span className="text-primary">richesses</span>{" "}
            minières de l'Algérie
          </h1>

          {/* Subtitle */}
          <p 
            className="text-xl md:text-2xl text-primary-foreground/70 mb-10 leading-relaxed max-w-2xl animate-fade-in-up"
            style={{ animationDelay: "0.4s" }}
          >
            Découvrez les opportunités d'investissement minier. Cartes interactives, 
            licences et demandes, disponibilité des minéraux en détail.
          </p>

          {/* CTAs */}
          <div 
            className="flex flex-wrap gap-4 animate-fade-in-up"
            style={{ animationDelay: "0.6s" }}
          >
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-7 text-lg shadow-lg hover:shadow-xl transition-all group"
              asChild
            >
              <a href="/auth/signup">
                Commencer maintenant
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-2 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 px-8 py-7 text-lg transition-all group"
            >
              <Play className="mr-2 h-5 w-5" />
              Découvrir SIGAM
            </Button>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <a href="#stats" className="flex flex-col items-center gap-2 text-primary-foreground/60 hover:text-primary transition-colors">
          <span className="text-xs uppercase tracking-widest">Défiler</span>
          <ChevronDown className="h-5 w-5" />
        </a>
      </div>

      {/* Side Stats Preview */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 z-10 hidden xl:flex flex-col gap-6">
        {[
          { value: "2380+", label: "Licences" },
          { value: "89Mrd", label: "Investissements" },
          { value: "48", label: "Wilayas" },
        ].map((stat, index) => (
          <div 
            key={stat.label}
            className="text-right animate-slide-in-right"
            style={{ animationDelay: `${0.8 + index * 0.2}s` }}
          >
            <div className="text-3xl font-bold text-primary">{stat.value}</div>
            <div className="text-sm text-primary-foreground/60">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
};
