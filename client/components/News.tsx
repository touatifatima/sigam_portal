import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, ArrowUpRight } from "lucide-react";
import styles from "./News.module.css";

const news = [
  {
    date: "15 Nov 2024",
    category: "Actualite",
    title: "Lancement de la nouvelle plateforme SIGAM 2.0",
    description:
      "Decouvrez les nouvelles fonctionnalites de la plateforme pour une meilleure experience utilisateur.",
    image:
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&h=400&fit=crop",
  },
  {
    date: "10 Nov 2024",
    category: "Evenement",
    title: "Forum International des Mines d'Algerie",
    description:
      "Participez au plus grand evenement minier de l'annee avec des experts du monde entier.",
    image:
      "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&h=400&fit=crop",
  },
  {
    date: "05 Nov 2024",
    category: "Reglementation",
    title: "Nouvelles dispositions pour les permis d'exploration",
    description:
      "Le ministere annonce de nouvelles mesures pour faciliter l'obtention des permis.",
    image:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=400&fit=crop",
  },
];

export const News = () => {
  return (
    <section id="actualites" className={styles.section}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <span className={styles.label}>Actualites</span>
            <h2 className={styles.title}>Dernieres nouvelles</h2>
          </div>
          <Button
            variant="outline"
            className={`${styles.viewAll} group w-fit`}
          >
            Voir toutes les actualites
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>

        <div className={styles.grid}>
          {news.map((item) => (
            <article key={item.title} className={styles.article}>
              <div className={styles.imageWrapper}>
                <img src={item.image} alt={item.title} className={styles.image} />
                <span className={styles.category}>{item.category}</span>
              </div>

              <div className={styles.content}>
                <div className={styles.date}>
                  <Calendar className={styles.dateIcon} />
                  {item.date}
                </div>
                <h3 className={styles.articleTitle}>{item.title}</h3>
                <p className={styles.articleDescription}>{item.description}</p>
                <a href="#" className={styles.readMore}>
                  Lire plus
                  <ArrowUpRight className={styles.readMoreIcon} />
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
