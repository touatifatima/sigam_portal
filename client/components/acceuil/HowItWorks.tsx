import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const steps = [
  {
    step: "01",
    title: "Créer votre compte",
    description: "Inscrivez-vous gratuitement et complétez votre profil investisseur.",
    features: ["Inscription rapide", "Vérification sécurisée", "Accès immédiat"],
  },
  {
    step: "02",
    title: "Explorer les opportunités",
    description: "Consultez la carte minière et identifiez les zones d'intérêt.",
    features: ["Carte interactive", "Données en temps réel", "Filtres avancés"],
  },
  {
    step: "03",
    title: "Soumettre votre demande",
    description: "Remplissez le formulaire de demande avec tous les documents requis.",
    features: ["Formulaire guidé", "Upload sécurisé", "Validation automatique"],
  },
  {
    step: "04",
    title: "Suivre l'avancement",
    description: "Suivez le traitement de votre demande et recevez vos notifications.",
    features: ["Suivi en temps réel", "Notifications", "Support dédié"],
  },
];

export const HowItWorks = () => {
  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-background" />
      
      <div className="container relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest mb-4 block">
            Investir dans le secteur minier
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Explorez l'Algérie, investissez via{" "}
            <span className="text-primary">SIGAM</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Découvrez les services et options qui accélèrent votre processus 
            d'investissement dans le secteur minier avec des procédures simplifiées et fiables.
          </p>
        </div>

        {/* Steps */}
        <div className="grid lg:grid-cols-2 gap-8 mb-16">
          {steps.map((item, index) => (
            <div
              key={item.step}
              className="group relative p-8 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-xl transition-all duration-300"
            >
              {/* Step Number */}
              <div className="absolute -top-4 -left-4 w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-2xl font-bold text-primary-foreground shadow-lg">
                {item.step}
              </div>

              <div className="ml-8 pt-4">
                <h3 className="text-2xl font-bold text-foreground mb-3">
                  {item.title}
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {item.description}
                </p>

                {/* Features */}
                <ul className="space-y-2">
                  {item.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button 
            size="lg" 
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-7 text-lg shadow-lg hover:shadow-xl transition-all group"
            asChild
          >
            <a href="/auth/signup">
              Commencer votre projet
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};