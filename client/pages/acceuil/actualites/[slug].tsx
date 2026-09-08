import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Clock3, Copy, Facebook, Linkedin, Newspaper, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { fetchPublishedActualite, fetchPublishedActualites } from "@/src/utils/actualitesApi";
import { getDefaultActualites, type ActualiteCategory, type ActualiteItem } from "@/src/utils/actualitesStorage";
import styles from "./article-detail.module.css";

const labels: Record<ActualiteCategory, string> = {
  Actualite: "Actualités",
  Reglementation: "Réglementation",
  Evenement: "Événements",
  Communique: "Communiqués",
  Technique: "Technique",
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(date)
    : "";
};

const dateOf = (item: ActualiteItem) => item.publishedAt || item.createdAt;

const paragraphsOf = (content: string) => content.split(/\n\s*\n|\r?\n/).map((part) => part.trim()).filter(Boolean);

export default function ArticleDetailPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<ActualiteItem | null>(null);
  const [related, setRelated] = useState<ActualiteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [loadedArticle, loadedItems] = await Promise.all([
          fetchPublishedActualite(slug),
          fetchPublishedActualites(),
        ]);
        if (cancelled) return;
        setArticle(loadedArticle);
        setRelated(loadedItems.filter((item) => item.id !== loadedArticle.id).slice(0, 4));
      } catch {
        const fallback = getDefaultActualites().find((item) => item.slug === slug);
        if (!cancelled) {
          setArticle(fallback || null);
          setRelated(getDefaultActualites().filter((item) => item.slug !== slug).slice(0, 4));
          setError(fallback ? "Le service est momentanément indisponible. Affichage du contenu disponible localement." : "Cette actualité est introuvable.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (slug) void load();
    return () => { cancelled = true; };
  }, [slug]);

  const paragraphs = useMemo(() => paragraphsOf(article?.content || ""), [article?.content]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  if (loading) return <div className={styles.loading}><Newspaper size={20} /> Chargement de l&apos;article...</div>;
  if (!article) return <div className={styles.loading}><p>{error || "Cette actualité est introuvable."}</p><Link href="/acceuil/actualites" className={styles.backLink}><ArrowLeft size={15} /> Retour aux actualités</Link></div>;

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.heroBand} />
      <div className={styles.breadcrumbBar}>
        <div className={styles.breadcrumbInner}><Link href="/"><ArrowLeft size={14} /> Accueil</Link><span>›</span><Link href="/acceuil/actualites">Actualités</Link><span>›</span><strong>{article.title}</strong></div>
      </div>

      <main className={styles.pageWrap}>
        <article className={styles.article}>
          {error && <div className={styles.notice}>{error}</div>}
          <span className={styles.tag}>{labels[article.category]}</span>
          <h1>{article.title}</h1>
          <div className={styles.articleMeta}>
            <span><CalendarDays size={15} /> {formatDate(dateOf(article))}</span>
            <span><Clock3 size={15} /> {article.readTimeMinutes} min de lecture</span>
            <span>Par <b>{article.author}</b></span>
            <div className={styles.share}><span>Partager</span><a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noreferrer" aria-label="Partager sur Facebook"><Facebook size={15} /></a><a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noreferrer" aria-label="Partager sur LinkedIn"><Linkedin size={15} /></a><button type="button" onClick={() => void copyLink()} aria-label="Copier le lien"><Copy size={15} /></button>{copied && <small>Lien copié</small>}</div>
          </div>
          <div className={styles.cover} style={{ backgroundImage: article.imageUrl ? `url(${article.imageUrl})` : undefined }} />
          <div className={styles.callout}><Sparkles size={19} /><p>{article.excerpt}</p></div>
          <div className={styles.body}>{paragraphs.map((paragraph, index) => <p key={`${article.id}-paragraph-${index}`}>{paragraph}</p>)}</div>
          <div className={styles.articleFooter}><Link href="/acceuil/actualites" className={styles.returnLink}><ArrowLeft size={15} /> Toutes les actualités</Link><span>Publié le {formatDate(dateOf(article))}</span></div>
        </article>

        <aside className={styles.sidebar}>
          <div className={styles.sidebarCard}><h2>À découvrir</h2>{related.map((item) => <Link href={`/acceuil/actualites/${item.slug}`} className={styles.relatedItem} key={item.id}><div className={styles.relatedImage} style={{ backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : undefined }} /><span><b>{item.title}</b><small>{formatDate(dateOf(item))}</small></span><ArrowUpRight size={14} /></Link>)}</div>
          <div className={styles.sidebarCard}><h2>Besoin d&apos;informations ?</h2><p>Retrouvez les ressources et les services du portail des activités minières.</p><Link href="/acceuil/contact" className={styles.sidebarButton}>Nous contacter <ArrowRight size={15} /></Link></div>
        </aside>
      </main>
    </div>
  );
}
