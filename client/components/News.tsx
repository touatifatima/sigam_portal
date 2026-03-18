import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, ArrowUpRight } from "lucide-react";
import styles from "./News.module.css";
import { ScrollReveal } from "./ScrollReveal";

const news = [
  {
    date: "15 Nov 2024",
    category: "Actualite",
    title: "Lancement de la nouvelle plateforme POM 2.0",
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

const newsImageSizes = "(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw";

const unsplashVariant = (url: string, width: number, format: "jpg" | "webp" = "jpg") => {
  const base = url.split("?")[0];
  const height = Math.round(width * 0.6667);
  const webpParam = format === "webp" ? "&fm=webp" : "";
  return `${base}?w=${width}&h=${height}&fit=crop&auto=format&q=72${webpParam}`;
};

export const News = () => {
  return (
    <section id="actualites" className={styles.section}>
      <div className="container">
        <ScrollReveal>
          <div className={styles.header}>
            <div>
              <span className={styles.label}>Actualites</span>
              <h2 className={styles.title}>Dernieres nouvelles</h2>
            </div>
            <Button
              variant="outline"
              className={`${styles.viewAll} homePremiumGhostButtonLight homePremiumButtonMd`}
            >
              Voir toutes les actualites
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </ScrollReveal>

        <div className={styles.grid}>
          {news.map((item, i) => (
            <ScrollReveal key={item.title} delay={i * 100}>
              <article className={styles.article}>
                <div className={styles.imageWrapper}>
                  <picture className={styles.imagePicture}>
                    <source
                      type="image/webp"
                      srcSet={`${unsplashVariant(item.image, 480, "webp")} 480w, ${unsplashVariant(item.image, 900, "webp")} 900w, ${unsplashVariant(item.image, 1280, "webp")} 1280w`}
                      sizes={newsImageSizes}
                    />
                    <img
                      src={unsplashVariant(item.image, 900)}
                      srcSet={`${unsplashVariant(item.image, 480)} 480w, ${unsplashVariant(item.image, 900)} 900w, ${unsplashVariant(item.image, 1280)} 1280w`}
                      sizes={newsImageSizes}
                      alt={item.title}
                      className={styles.image}
                      loading="lazy"
                      decoding="async"
                      width={600}
                      height={400}
                    />
                  </picture>
                  <span className={styles.category}>{item.category}</span>
                </div>

                <div className={styles.content}>
                  <div className={styles.date}>
                    <Calendar className={styles.dateIcon} />
                    {item.date}
                  </div>
                  <h3 className={styles.articleTitle}>{item.title}</h3>
                  <p className={styles.articleDescription}>{item.description}</p>
                  <a href="/auth/login" className={styles.readMore}>
                    Lire plus
                    <ArrowUpRight className={styles.readMoreIcon} />
                  </a>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
};

