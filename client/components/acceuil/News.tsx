import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, ArrowUpRight } from "lucide-react";

const news = [
  {
    date: "15 Nov 2024",
    category: "Actualité",
    title: "Lancement de la nouvelle plateforme SIGAM 2.0",
    description: "Découvrez les nouvelles fonctionnalités de la plateforme pour une meilleure expérience utilisateur.",
    image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&h=400&fit=crop",
  },
  {
    date: "10 Nov 2024",
    category: "Événement",
    title: "Forum International des Mines d'Algérie",
    description: "Participez au plus grand événement minier de l'année avec des experts du monde entier.",
    image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&h=400&fit=crop",
  },
  {
    date: "05 Nov 2024",
    category: "Réglementation",
    title: "Nouvelles dispositions pour les permis d'exploration",
    description: "Le ministère annonce de nouvelles mesures pour faciliter l'obtention des permis.",
    image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=400&fit=crop",
  },
];

export const News = () => {
  return (
    <section id="actualites" className="py-24 bg-background">
      <div className="container">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <span className="text-primary font-semibold text-sm uppercase tracking-widest mb-4 block">
              Actualités
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground">
              Dernières nouvelles
            </h2>
          </div>
          <Button variant="outline" className="group w-fit">
            Voir toutes les actualités
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>

        {/* News Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {news.map((item, index) => (
            <article
              key={item.title}
              className="group bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/30 hover:shadow-xl transition-all duration-300"
            >
              {/* Image */}
              <div className="relative h-48 overflow-hidden">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                <span className="absolute bottom-4 left-4 px-3 py-1 rounded-full bg-primary/90 text-primary-foreground text-xs font-medium">
                  {item.category}
                </span>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
                  <Calendar className="h-4 w-4" />
                  {item.date}
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3 group-hover:text-primary transition-colors line-clamp-2">
                  {item.title}
                </h3>
                <p className="text-muted-foreground line-clamp-2 mb-4">
                  {item.description}
                </p>
                <a 
                  href="#" 
                  className="inline-flex items-center gap-1 text-primary font-medium text-sm group/link"
                >
                  Lire plus
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};