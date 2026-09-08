import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Mail,
  Newspaper,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/Header";
import {
  getDefaultActualites,
  type ActualiteCategory,
  type ActualiteItem,
} from "@/src/utils/actualitesStorage";
import { fetchPublishedActualites } from "@/src/utils/actualitesApi";
import styles from "./actualites.module.css";

const PAGE_SIZE = 5;

const categoryLabels: Record<ActualiteCategory, string> = {
  Actualite: "Actualités",
  Reglementation: "Réglementation",
  Evenement: "Événements",
  Communique: "Communiqués",
  Technique: "Technique",
};

const categoryClass = (category: ActualiteCategory) => {
  const classes: Record<ActualiteCategory, string> = {
    Actualite: styles.tagActualite,
    Reglementation: styles.tagReglementation,
    Evenement: styles.tagEvenement,
    Communique: styles.tagCommunique,
    Technique: styles.tagTechnique,
  };
  return classes[category];
};

const formatDate = (dateValue: string): string => {
  const date = new Date(dateValue);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const articleDate = (item: ActualiteItem) => item.publishedAt || item.createdAt;

export default function ActualitesPage() {
  const [items, setItems] = useState<ActualiteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"Toutes" | ActualiteCategory>("Toutes");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const loaded = await fetchPublishedActualites();
        if (!cancelled) setItems(loaded);
      } catch {
        if (!cancelled) {
          setItems(getDefaultActualites().filter((item) => item.isPublished));
          setLoadError("Le service des actualités est indisponible. Affichage du contenu par défaut.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const publishedItems = useMemo(
    () => items.filter((item) => item.isPublished).sort((a, b) => new Date(articleDate(b)).getTime() - new Date(articleDate(a)).getTime()),
    [items],
  );

  const featured = useMemo(
    () => publishedItems.find((item) => item.isFeatured) || publishedItems[0] || null,
    [publishedItems],
  );

  const categories = useMemo(() => {
    const available = Array.from(new Set(publishedItems.map((item) => item.category)));
    return ["Toutes", ...available] as Array<"Toutes" | ActualiteCategory>;
  }, [publishedItems]);

  const filteredItems = useMemo(() => {
    const value = query.trim().toLowerCase();
    return publishedItems.filter((item) => {
      const matchesCategory = activeCategory === "Toutes" || item.category === activeCategory;
      const matchesQuery = !value || [item.title, item.excerpt, item.content, item.author, item.category]
        .some((field) => field.toLowerCase().includes(value));
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, publishedItems, query]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const visibleItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const recentItems = publishedItems.filter((item) => item.id !== featured?.id).slice(0, 4);
  const categoryCounts = categories.filter((category) => category !== "Toutes").map((category) => ({
    category,
    count: publishedItems.filter((item) => item.category === category).length,
  }));

  useEffect(() => {
    setPage(1);
  }, [activeCategory, query]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
  };

  return (
    <div className={styles.page}>
      <Header />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <Link href="/" className={styles.backHome}><ArrowLeft size={15} /> Retour accueil</Link>
            <span className={styles.heroEyebrow}><Newspaper size={15} /> Actualités</span>
            <h1>Actualités <span>du secteur minier</span></h1>
            <p>Retrouvez les dernières nouvelles, annonces et informations officielles de l&apos;ANAM.</p>
            <form className={styles.searchBox} onSubmit={submitSearch}>
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une actualité..." aria-label="Rechercher une actualité" />
              <button type="submit" aria-label="Lancer la recherche"><ArrowRight size={18} /></button>
            </form>
          </div>
        </section>

        <section className={styles.filterBar}>
          <div className={styles.filterInner}>
            <div className={styles.filterTabs}>
              {categories.map((category) => (
                <button key={category} type="button" className={activeCategory === category ? styles.filterActive : ""} onClick={() => setActiveCategory(category)}>
                  {category === "Toutes" ? "Toutes les actualités" : categoryLabels[category]}
                </button>
              ))}
            </div>
            <button type="button" className={styles.sortButton}><CalendarDays size={15} /> Plus récentes <ChevronDown size={14} /></button>
          </div>
        </section>

        <section className={styles.pageWrap}>
          <div className={styles.articleColumn}>
            {loadError && <div className={styles.notice}>{loadError}</div>}
            {isLoading ? <div className={styles.emptyState}>Chargement des actualités...</div> : null}
            {!isLoading && visibleItems.length === 0 ? <div className={styles.emptyState}>Aucune actualité trouvée.</div> : null}
            <div className={styles.articleList}>
              {visibleItems.map((item) => (
                <article className={styles.articleCard} key={item.id}>
                  <Link href={`/acceuil/actualites/${item.slug}`} className={styles.thumbLink} aria-label={`Lire ${item.title}`}>
                    <div className={styles.thumb} style={{ backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : undefined }} />
                  </Link>
                  <div className={styles.articleContent}>
                    <span className={`${styles.tag} ${categoryClass(item.category)}`}>{categoryLabels[item.category]}</span>
                    <h2><Link href={`/acceuil/actualites/${item.slug}`}>{item.title}</Link></h2>
                    <p>{item.excerpt}</p>
                    <div className={styles.cardFooter}>
                      <div className={styles.cardMeta}><span><CalendarDays size={13} /> {formatDate(articleDate(item))}</span><span><Clock3 size={13} /> {item.readTimeMinutes} min</span></div>
                      <Link href={`/acceuil/actualites/${item.slug}`} className={styles.readMore}>Lire la suite <ArrowRight size={15} /></Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {pageCount > 1 && <div className={styles.pagination}><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} aria-label="Page précédente"><ChevronLeft size={17} /></button><span>Page {page} sur {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)} aria-label="Page suivante"><ChevronRight size={17} /></button></div>}
          </div>

          <aside className={styles.sidebar}>
            {featured && <div className={styles.sidebarCard}>
              <h3><Sparkles size={16} /> À la une</h3>
              <Link href={`/acceuil/actualites/${featured.slug}`} className={styles.featuredLink}>
                <div className={styles.featuredImage} style={{ backgroundImage: featured.imageUrl ? `url(${featured.imageUrl})` : undefined }} />
                <span className={`${styles.tag} ${categoryClass(featured.category)}`}>{categoryLabels[featured.category]}</span>
                <strong>{featured.title}</strong>
                <p>{featured.excerpt}</p>
                <span className={styles.sidebarReadMore}>Découvrir <ArrowUpRight size={14} /></span>
              </Link>
            </div>}

            <div className={styles.sidebarCard}>
              <h3>Dernières publications</h3>
              <div className={styles.recentList}>
                {recentItems.map((item) => <Link href={`/acceuil/actualites/${item.slug}`} className={styles.recentItem} key={item.id}><div className={styles.recentImage} style={{ backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : undefined }} /><span><strong>{item.title}</strong><small>{formatDate(articleDate(item))}</small></span></Link>)}
              </div>
            </div>

            <div className={styles.sidebarCard}>
              <h3>Catégories</h3>
              <div className={styles.categoryList}>
                {categoryCounts.map(({ category, count }) => <button type="button" key={category} onClick={() => setActiveCategory(category)}><span>{categoryLabels[category]}</span><b>{count}</b></button>)}
              </div>
            </div>

            <div className={styles.newsletterCard}>
              <Mail size={22} />
              <h3>Restez informé</h3>
              <p>Recevez les actualités importantes du secteur minier.</p>
              <form onSubmit={(event) => event.preventDefault()}><input type="email" placeholder="Votre adresse email" aria-label="Votre adresse email" /><button type="submit" aria-label="S'inscrire"><ArrowRight size={16} /></button></form>
              <small>Votre adresse reste confidentielle.</small>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
