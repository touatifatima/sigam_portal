import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Newspaper,
  Search,
  Sparkles,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  getDefaultActualites,
  type ActualiteCategory,
  type ActualiteItem,
} from "@/src/utils/actualitesStorage";
import { fetchPublishedActualites } from "@/src/utils/actualitesApi";
import styles from "./actualites.module.css";

const formatDate = (dateValue: string): string => {
  const ts = new Date(dateValue).getTime();
  if (!Number.isFinite(ts)) return "";
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const matchesSearch = (item: ActualiteItem, query: string): boolean => {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return (
    item.title.toLowerCase().includes(q) ||
    item.excerpt.toLowerCase().includes(q) ||
    item.content.toLowerCase().includes(q) ||
    item.category.toLowerCase().includes(q) ||
    item.author.toLowerCase().includes(q)
  );
};

export default function ActualitesPage() {
  const [items, setItems] = useState<ActualiteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"Toutes" | ActualiteCategory>(
    "Toutes",
  );
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const loaded = await fetchPublishedActualites();
        if (!cancelled) {
          setItems(loaded);
        }
      } catch {
        if (!cancelled) {
          setItems(getDefaultActualites().filter((item) => item.isPublished));
          setLoadError(
            "Le service des actualites est indisponible. Affichage du contenu par defaut.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const publishedItems = useMemo(
    () =>
      items
        .filter((item) => item.isPublished)
        .sort(
          (a, b) =>
            new Date(b.publishedAt || b.createdAt).getTime() -
            new Date(a.publishedAt || a.createdAt).getTime(),
        ),
    [items],
  );

  const featured = useMemo(
    () => publishedItems.find((item) => item.isFeatured) || publishedItems[0] || null,
    [publishedItems],
  );

  const categories = useMemo(() => {
    const unique = Array.from(new Set(publishedItems.map((item) => item.category)));
    return ["Toutes", ...unique] as Array<"Toutes" | ActualiteCategory>;
  }, [publishedItems]);

  const feedItems = useMemo(() => {
    const withoutFeatured = publishedItems.filter((item) => item.id !== featured?.id);
    return withoutFeatured.filter(
      (item) =>
        (activeCategory === "Toutes" || item.category === activeCategory) &&
        matchesSearch(item, query),
    );
  }, [activeCategory, featured?.id, publishedItems, query]);

  const selectedArticle = useMemo(() => {
    const allVisible = [featured, ...feedItems].filter(Boolean) as ActualiteItem[];
    if (!allVisible.length) return null;
    return allVisible.find((item) => item.id === selectedId) || allVisible[0];
  }, [featured, feedItems, selectedId]);

  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        <section className={styles.hero}>
          <div
            className={styles.heroImage}
            style={{
              backgroundImage: featured?.imageUrl
                ? `url(${featured.imageUrl})`
                : "linear-gradient(135deg, #2a1923, #1c1421)",
            }}
          />
          <div className={styles.heroOverlay} />
          <div className={`container ${styles.heroContent}`}>
            <div className={styles.heroBadge}>
              <Newspaper size={16} />
              <span>Actualites du portail</span>
            </div>

            <h1 className={styles.heroTitle}>Actualites, annonces et informations officielles</h1>

            <p className={styles.heroSubtitle}>
              Retrouvez toutes les publications du Portail des Activites Minieres:
              nouveautes produit, communications institutionnelles et evolutions
              reglementaires.
            </p>

            {featured ? (
              <div className={styles.heroHighlight}>
                <span className={styles.heroHighlightTag}>
                  <Sparkles size={14} />
                  A la une
                </span>
                <h2>{featured.title}</h2>
                <p>{featured.excerpt}</p>
                <div className={styles.heroMeta}>
                  <span>
                    <CalendarDays size={14} />
                    {formatDate(featured.publishedAt || featured.createdAt)}
                  </span>
                  <span>
                    <Clock3 size={14} />
                    {featured.readTimeMinutes} min
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className={`container ${styles.filtersWrap}`}>
          <label className={styles.searchWrap}>
            <Search size={16} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher une actualite, un theme ou un auteur"
              aria-label="Rechercher une actualite"
            />
          </label>

          <div className={styles.categories}>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`${styles.categoryChip} ${
                  activeCategory === category ? styles.categoryChipActive : ""
                }`}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        <section className={`container ${styles.layout}`}>
          <div className={styles.feed}>
            {loadError ? (
              <div className={styles.emptyState}>
                <h3>Connexion backend indisponible</h3>
                <p>{loadError}</p>
              </div>
            ) : null}

            {isLoading ? (
              <div className={styles.emptyState}>
                <h3>Chargement des actualites</h3>
                <p>Veuillez patienter...</p>
              </div>
            ) : null}

            {featured && activeCategory === "Toutes" && !query.trim() ? (
              <button
                type="button"
                className={`${styles.feedCard} ${styles.feedCardFeatured}`}
                onClick={() => setSelectedId(featured.id)}
              >
                <div className={styles.feedCardText}>
                  <span className={styles.feedTag}>A la une</span>
                  <h3>{featured.title}</h3>
                  <p>{featured.excerpt}</p>
                  <div className={styles.feedMeta}>
                    <span>{formatDate(featured.publishedAt || featured.createdAt)}</span>
                    <span>{featured.category}</span>
                  </div>
                </div>
                <ArrowUpRight size={16} />
              </button>
            ) : null}

            {!isLoading && feedItems.length === 0 ? (
              <div className={styles.emptyState}>
                <h3>Aucune actualite trouvee</h3>
                <p>Essayez de modifier le filtre ou votre recherche.</p>
              </div>
            ) : (
              feedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.feedCard} ${
                    selectedArticle?.id === item.id ? styles.feedCardActive : ""
                  }`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className={styles.feedCardText}>
                    <span className={styles.feedTag}>{item.category}</span>
                    <h3>{item.title}</h3>
                    <p>{item.excerpt}</p>
                    <div className={styles.feedMeta}>
                      <span>{formatDate(item.publishedAt || item.createdAt)}</span>
                      <span>{item.readTimeMinutes} min</span>
                    </div>
                  </div>
                  <ArrowUpRight size={16} />
                </button>
              ))
            )}
          </div>

          <aside className={styles.articlePanel}>
            {selectedArticle ? (
              <article className={styles.articleCard}>
                <div
                  className={styles.articleCover}
                  style={{
                    backgroundImage: selectedArticle.imageUrl
                      ? `url(${selectedArticle.imageUrl})`
                      : "linear-gradient(135deg, #2f1b26, #251927)",
                  }}
                />
                <div className={styles.articleBody}>
                  <div className={styles.articleTopMeta}>
                    <span>{selectedArticle.category}</span>
                    <span>{formatDate(selectedArticle.publishedAt || selectedArticle.createdAt)}</span>
                  </div>
                  <h2>{selectedArticle.title}</h2>
                  <p className={styles.articleExcerpt}>{selectedArticle.excerpt}</p>
                  <p className={styles.articleContent}>{selectedArticle.content}</p>
                  <div className={styles.articleFooter}>
                    <span>Par {selectedArticle.author}</span>
                    <span>{selectedArticle.readTimeMinutes} min de lecture</span>
                  </div>
                </div>
              </article>
            ) : (
              <div className={styles.emptyArticle}>
                <h3>Aucune publication disponible</h3>
                <p>
                  Les actualites publiees depuis l'administration apparaitront ici.
                </p>
                <Link href="/admin_panel/gestion_actualites" className={styles.adminLink}>
                  Ouvrir la gestion des actualites
                </Link>
              </div>
            )}
          </aside>
        </section>
      </main>

      <Footer />
    </div>
  );
}
