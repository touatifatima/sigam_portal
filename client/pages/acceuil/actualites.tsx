import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Newspaper,
  Search,
  Sparkles,
  X,
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
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const visibleItems = useMemo(
    () =>
      publishedItems.filter(
      (item) =>
        (activeCategory === "Toutes" || item.category === activeCategory) &&
        matchesSearch(item, query),
      ),
    [activeCategory, publishedItems, query],
  );

  const selectedArticle = useMemo(() => {
    const pool = visibleItems.length ? visibleItems : publishedItems;
    if (!pool.length) return null;
    return pool.find((item) => item.id === selectedId) || pool[0];
  }, [visibleItems, publishedItems, selectedId]);

  useEffect(() => {
    const pool = visibleItems.length ? visibleItems : publishedItems;
    if (!pool.length) return;
    if (!pool.some((item) => item.id === selectedId)) {
      setSelectedId(pool[0].id);
    }
  }, [visibleItems, publishedItems, selectedId]);

  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsModalOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalOpen]);

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
              <button
                type="button"
                className={styles.heroHighlight}
                onClick={() => {
                  setSelectedId(featured.id);
                  setIsModalOpen(true);
                }}
              >
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
                <span className={styles.heroHighlightCta}>
                  Consulter cette publication
                  <ArrowUpRight size={14} />
                </span>
              </button>
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

        <section className={`container ${styles.cardsSection}`}>
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

            {!isLoading && visibleItems.length === 0 ? (
              <div className={styles.emptyState}>
                <h3>Aucune actualite trouvee</h3>
                <p>Essayez de modifier le filtre ou votre recherche.</p>
              </div>
            ) : (
              <div className={styles.cardsGrid}>
              {visibleItems.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.newsCard} ${
                    selectedArticle?.id === item.id ? styles.newsCardActive : ""
                  }`}
                  style={{ animationDelay: `${Math.min(index, 12) * 70}ms` }}
                  onClick={() => {
                    setSelectedId(item.id);
                    setIsModalOpen(true);
                  }}
                >
                  <div
                    className={styles.newsImage}
                    style={{
                      backgroundImage: item.imageUrl
                        ? `url(${item.imageUrl})`
                        : "linear-gradient(135deg, #2f1b26, #251927)",
                    }}
                  />
                  <div className={styles.newsDate}>
                    <CalendarDays size={14} />
                    <span>{formatDate(item.publishedAt || item.createdAt)}</span>
                  </div>
                  <div className={styles.newsBody}>
                    <span className={styles.newsCategory}>{item.category}</span>
                    <h3>{item.title}</h3>
                    <p>{item.excerpt}</p>
                    <div className={styles.newsMeta}>
                      <span>{item.author}</span>
                      <span>{item.readTimeMinutes} min</span>
                    </div>
                    <div className={styles.newsAction}>
                      <span>Consulter plus de details</span>
                      <ArrowUpRight size={15} />
                    </div>
                  </div>
                </button>
              ))}
              </div>
            )}
        </section>

        {isModalOpen && selectedArticle ? (
          <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
            <article className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setIsModalOpen(false)}
                aria-label="Fermer le detail"
              >
                <X size={18} />
              </button>

              <div
                className={styles.modalCover}
                style={{
                  backgroundImage: selectedArticle.imageUrl
                    ? `url(${selectedArticle.imageUrl})`
                    : "linear-gradient(135deg, #2f1b26, #251927)",
                }}
              >
                <div className={styles.modalCoverOverlay} />
                <div className={styles.modalCoverContent}>
                  <span className={styles.modalCategory}>{selectedArticle.category}</span>
                  <h2>{selectedArticle.title}</h2>
                  <div className={styles.modalMeta}>
                    <span>
                      <CalendarDays size={14} />
                      {formatDate(selectedArticle.publishedAt || selectedArticle.createdAt)}
                    </span>
                    <span>
                      <Clock3 size={14} />
                      {selectedArticle.readTimeMinutes} min
                    </span>
                    <span>Par {selectedArticle.author}</span>
                  </div>
                </div>
              </div>

              <div className={styles.modalBody}>
                <p className={styles.modalExcerpt}>{selectedArticle.excerpt}</p>
                <p className={styles.modalContent}>{selectedArticle.content}</p>
              </div>
            </article>
          </div>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}