import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Eye,
  EyeOff,
  Newspaper,
  PlusCircle,
  RefreshCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import Navbar from "@/pages/navbar/Navbar";
import Sidebar from "@/pages/sidebar/Sidebar";
import { useViewNavigator } from "@/src/hooks/useViewNavigator";
import { useAuthStore } from "@/src/store/useAuthStore";
import { isAdminRole } from "@/src/utils/roleNavigation";
import {
  defaultActualiteDraft,
  type ActualiteCategory,
  type ActualiteDraft,
  type ActualiteItem,
} from "@/src/utils/actualitesStorage";
import {
  createActualite,
  deleteActualite,
  fetchAdminActualites,
  resetActualites,
  updateActualite,
} from "@/src/utils/actualitesApi";
import styles from "./gestion_actualites.module.css";

const formatDate = (dateValue: string): string => {
  const ts = new Date(dateValue).getTime();
  if (!Number.isFinite(ts)) return "--";
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

type StatusFilter = "all" | "published" | "draft";

const categoryOptions: ActualiteCategory[] = [
  "Actualite",
  "Reglementation",
  "Evenement",
  "Communique",
  "Technique",
];

const defaultImagePaths = ["/actualites/engineers.jpg", "/actualites/land.jpg"];

const normalizeImagePathInput = (rawValue: string): string => {
  const value = String(rawValue || "").trim();
  if (!value) return "";
  if (value.startsWith("data:image/")) return value;

  const normalizedSlashes = value.replace(/\\/g, "/");
  if (
    normalizedSlashes.startsWith("/") ||
    /^https?:\/\//i.test(normalizedSlashes)
  ) {
    return normalizedSlashes;
  }

  const publicMarker = "/public/";
  const markerIndex = normalizedSlashes.toLowerCase().indexOf(publicMarker);
  if (markerIndex >= 0) {
    const fromPublic = normalizedSlashes
      .slice(markerIndex + publicMarker.length)
      .replace(/^\/+/, "");
    return `/${fromPublic}`;
  }

  return value;
};

const isUnsupportedLocalPath = (rawValue: string): boolean => {
  const value = String(rawValue || "").trim();
  if (!value) return false;
  if (value.startsWith("data:image/")) return false;

  const normalizedSlashes = value.replace(/\\/g, "/");
  if (
    normalizedSlashes.startsWith("/") ||
    /^https?:\/\//i.test(normalizedSlashes)
  ) {
    return false;
  }

  return /^[a-zA-Z]:\//.test(normalizedSlashes) || normalizedSlashes.startsWith("file://");
};

const imageOptionLabel = (value: string, index: number): string => {
  if (value.startsWith("data:image/")) {
    return `Image importee ${index + 1}`;
  }

  const normalized = value.replace(/\\/g, "/");
  const fileName = normalized.split("/").filter(Boolean).pop();
  if (fileName) return fileName;

  return value.length > 62 ? `${value.slice(0, 62)}...` : value;
};

export default function GestionActualitesPage() {
  const auth = useAuthStore((state) => state.auth);
  const isAuthLoaded = useAuthStore((state) => state.isLoaded);
  const { currentView, navigateTo } = useViewNavigator("manage_actualites");

  const [items, setItems] = useState<ActualiteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ActualiteDraft>(defaultActualiteDraft);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [feedback, setFeedback] = useState<string>("");
  const isAdmin = useMemo(() => isAdminRole(auth?.role), [auth?.role]);
  const normalizedFormImageUrl = useMemo(
    () => normalizeImagePathInput(form.imageUrl),
    [form.imageUrl],
  );

  const showFeedback = (message: string, delay = 2400) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), delay);
  };

  const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }
    return fallback;
  };

  const refreshItems = async (notice?: string) => {
    const loaded = await fetchAdminActualites();
    setItems(loaded);
    if (notice) {
      showFeedback(notice);
    }
  };

  useEffect(() => {
    if (!isAuthLoaded || !isAdmin) {
      if (isAuthLoaded) {
        setIsLoading(false);
      }
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const loaded = await fetchAdminActualites();
        if (!cancelled) {
          setItems(loaded);
        }
      } catch (error) {
        if (!cancelled) {
          showFeedback(
            getErrorMessage(error, "Chargement des actualites impossible."),
            3200,
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
  }, [isAdmin, isAuthLoaded]);

  const publishCount = useMemo(
    () => items.filter((item) => item.isPublished).length,
    [items],
  );

  const draftCount = useMemo(
    () => items.filter((item) => !item.isPublished).length,
    [items],
  );

  const filteredItems = useMemo(() => {
    return [...items]
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      )
      .filter((item) =>
        statusFilter === "all"
          ? true
          : statusFilter === "published"
          ? item.isPublished
          : !item.isPublished,
      )
      .filter((item) => {
        if (!query.trim()) return true;
        const q = query.trim().toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.author.toLowerCase().includes(q)
        );
      });
  }, [items, query, statusFilter]);

  const imageOptions = useMemo(() => {
    const uniqueValues = new Set<string>();

    defaultImagePaths.forEach((value) => uniqueValues.add(value));
    items.forEach((item) => {
      const normalized = normalizeImagePathInput(item.imageUrl);
      if (normalized) uniqueValues.add(normalized);
    });
    if (normalizedFormImageUrl) {
      uniqueValues.add(normalizedFormImageUrl);
    }

    return Array.from(uniqueValues).map((value, index) => ({
      value,
      label: imageOptionLabel(value, index),
    }));
  }, [items, normalizedFormImageUrl]);

  const resetForm = () => {
    setEditingId(null);
    setForm(defaultActualiteDraft);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!form.title.trim() || !form.excerpt.trim() || !form.content.trim()) {
      showFeedback("Titre, resume et contenu sont obligatoires.", 2200);
      return;
    }

    const normalizedImageUrl = normalizeImagePathInput(form.imageUrl);
    if (isUnsupportedLocalPath(normalizedImageUrl)) {
      showFeedback(
        "Chemin local direct non accessible dans le navigateur. Utilisez une URL web ou un chemin /actualites/...",
        3600,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: ActualiteDraft = {
        ...form,
        imageUrl: normalizedImageUrl,
      };

      if (editingId) {
        await updateActualite(editingId, payload);
        await refreshItems("Actualite mise a jour.");
      } else {
        await createActualite(payload);
        await refreshItems("Actualite ajoutee.");
      }
      resetForm();
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Enregistrement de l actualite impossible."),
        3200,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (item: ActualiteItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      excerpt: item.excerpt,
      content: item.content,
      category: item.category,
      author: item.author,
      imageUrl: item.imageUrl,
      isPublished: item.isPublished,
      isFeatured: item.isFeatured,
    });
  };

  const handleImagePathBlur = () => {
    const normalized = normalizeImagePathInput(form.imageUrl);
    if (normalized && normalized !== form.imageUrl) {
      setForm((prev) => ({ ...prev, imageUrl: normalized }));
      showFeedback("Chemin image converti automatiquement en URL web.", 2600);
      return;
    }

    if (isUnsupportedLocalPath(normalized)) {
      showFeedback(
        "Chemin local direct non supporte. Utilisez une URL web ou /actualites/nom-image.jpg.",
        3600,
      );
    }
  };

  const togglePublish = async (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;

    setIsSubmitting(true);
    try {
      await updateActualite(id, { isPublished: !item.isPublished });
      await refreshItems("Statut de publication mis a jour.");
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Mise a jour du statut impossible."),
        3200,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const setFeatured = async (id: string) => {
    setIsSubmitting(true);
    try {
      await updateActualite(id, { isPublished: true, isFeatured: true });
      await refreshItems("Actualite mise a la une.");
    } catch (error) {
      showFeedback(getErrorMessage(error, "Operation impossible."), 3200);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeItem = async (id: string) => {
    if (!window.confirm("Supprimer cette actualite ?")) return;
    setIsSubmitting(true);
    try {
      await deleteActualite(id);
      await refreshItems("Actualite supprimee.");
      if (editingId === id) resetForm();
    } catch (error) {
      showFeedback(getErrorMessage(error, "Suppression impossible."), 3200);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetDefaults = async () => {
    setIsSubmitting(true);
    try {
      const defaults = await resetActualites();
      setItems(defaults);
      showFeedback("Catalogue reinitialise.");
      resetForm();
    } catch (error) {
      showFeedback(getErrorMessage(error, "Reinitialisation impossible."), 3200);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthLoaded) {
    return (
      <div className={styles.loadingState}>
        <p>Chargement...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles.blockedPage}>
        <div className={styles.blockedCard}>
          <ShieldAlert size={26} />
          <h1>Acces limite</h1>
          <p>
            Cette page est reservee aux administrateurs du portail.
          </p>
          <Link href="/" className={styles.backLink}>
            Retour accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.appContainer}>
      <Navbar />
      <div className={styles.appContent}>
        <Sidebar currentView={currentView} navigateTo={navigateTo} />
        <main className={styles.mainContent}>
          <div className={styles.page}>
            <section className={styles.hero}>
              <div>
                <div className={styles.heroBadge}>
                  <Newspaper size={15} />
                  <span>Administration - Actualites</span>
                </div>
                <h1>Gestion et publication des actualites</h1>
                <p>
                  Creez, modifiez et publiez les actualites visibles sur la page
                  publique. Les changements sont immediatement pris en compte cote site.
                </p>
              </div>

              <div className={styles.heroActions}>
                <Link href="/acceuil/actualites" className={styles.viewPublicLink}>
                  Voir la page publique
                </Link>
                <button type="button" onClick={resetDefaults} className={styles.resetBtn}>
                  <RefreshCcw size={14} />
                  Reinitialiser les actualites
                </button>
              </div>
            </section>

            <section className={styles.statsRow}>
              <article className={styles.statCard}>
                <span>Publiees</span>
                <strong>{publishCount}</strong>
              </article>
              <article className={styles.statCard}>
                <span>Brouillons</span>
                <strong>{draftCount}</strong>
              </article>
              <article className={styles.statCard}>
                <span>Total</span>
                <strong>{items.length}</strong>
              </article>
            </section>

            {feedback ? <div className={styles.feedback}>{feedback}</div> : null}

            <section className={styles.layout}>
              <article className={styles.formCard}>
                <header className={styles.blockHeader}>
                  <h2>{editingId ? "Modifier actualite" : "Nouvelle actualite"}</h2>
                </header>

                <form className={styles.form} onSubmit={handleSubmit}>
                  <label className={styles.field}>
                    <span>Titre</span>
                    <input
                      disabled={isSubmitting}
                      value={form.title}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="Titre de publication"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Resume court</span>
                    <textarea
                      disabled={isSubmitting}
                      rows={3}
                      value={form.excerpt}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, excerpt: event.target.value }))
                      }
                      placeholder="Resume visible dans les cartes"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Contenu</span>
                    <textarea
                      disabled={isSubmitting}
                      rows={6}
                      value={form.content}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, content: event.target.value }))
                      }
                      placeholder="Texte detaille de l'actualite"
                    />
                  </label>

                  <div className={styles.fieldRow}>
                    <label className={styles.field}>
                      <span>Categorie</span>
                      <select
                        disabled={isSubmitting}
                        value={form.category}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            category: event.target.value as ActualiteCategory,
                          }))
                        }
                      >
                        {categoryOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.field}>
                      <span>Auteur</span>
                      <input
                        disabled={isSubmitting}
                        value={form.author}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, author: event.target.value }))
                        }
                        placeholder="Nom de l'auteur"
                      />
                    </label>
                  </div>

                  <label className={styles.field}>
                    <span>Image (URL ou chemin local)</span>
                    <input
                      disabled={isSubmitting}
                      value={form.imageUrl}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, imageUrl: event.target.value }))
                      }
                      onBlur={handleImagePathBlur}
                      placeholder="https://... ou C:\\...\\public\\actualites\\eng.jpg"
                    />
                  </label>

                  <div className={styles.imageTools}>
                    <label className={styles.field}>
                      <span>Image du projet</span>
                      <select
                        disabled={isSubmitting}
                        value={
                          imageOptions.some((option) => option.value === normalizedFormImageUrl)
                            ? normalizedFormImageUrl
                            : ""
                        }
                        onChange={(event) => {
                          setForm((prev) => ({ ...prev, imageUrl: event.target.value }));
                        }}
                      >
                        <option value="">Choisir une image locale</option>
                        {imageOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <p className={styles.imageHint}>
                      Les chemins absolus contenant <code>/public/</code> sont convertis
                      automatiquement en URL web (ex:{" "}
                      <code>/actualites/eng.jpg</code>). Les chemins locaux hors{" "}
                      <code>public</code> ne sont pas accessibles depuis le navigateur.
                    </p>

                    <div className={styles.imagePreviewWrap}>
                      <span>Apercu image</span>
                      {normalizedFormImageUrl && !isUnsupportedLocalPath(normalizedFormImageUrl) ? (
                        <div className={styles.imagePreviewCard}>
                          <img
                            src={normalizedFormImageUrl}
                            alt="Apercu actualite"
                            className={styles.imagePreview}
                          />
                          <small>{normalizedFormImageUrl}</small>
                        </div>
                      ) : normalizedFormImageUrl ? (
                        <div className={styles.imagePreviewEmpty}>
                          Chemin local detecte. Utilisez une URL web ou un chemin /actualites/...
                        </div>
                      ) : (
                        <div className={styles.imagePreviewEmpty}>
                          Aucune image selectionnee.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.checks}>
                    <label>
                      <input
                        type="checkbox"
                        disabled={isSubmitting}
                        checked={form.isPublished}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, isPublished: event.target.checked }))
                        }
                      />
                      <span>Publier maintenant</span>
                    </label>

                    <label>
                      <input
                        type="checkbox"
                        disabled={isSubmitting}
                        checked={form.isFeatured}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, isFeatured: event.target.checked }))
                        }
                      />
                      <span>Mettre a la une</span>
                    </label>
                  </div>

                  <div className={styles.formActions}>
                    <button type="submit" className={styles.submitBtn}>
                      <PlusCircle size={15} />
                      {isSubmitting
                        ? "Traitement..."
                        : editingId
                        ? "Enregistrer"
                        : "Ajouter actualite"}
                    </button>
                    {editingId ? (
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={resetForm}
                        disabled={isSubmitting}
                      >
                        Annuler
                      </button>
                    ) : null}
                  </div>
                </form>
              </article>

              <article className={styles.listCard}>
                <header className={styles.blockHeader}>
                  <h2>Publications</h2>
                  <div className={styles.toolbar}>
                    <label className={styles.searchMini}>
                      <Search size={14} />
                      <input
                        disabled={isSubmitting}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Recherche"
                      />
                    </label>
                    <select
                      disabled={isSubmitting}
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                    >
                      <option value="all">Tous</option>
                      <option value="published">Publiees</option>
                      <option value="draft">Brouillons</option>
                    </select>
                  </div>
                </header>

                <div className={styles.list}>
                  {isLoading ? (
                    <div className={styles.emptyList}>Chargement...</div>
                  ) : filteredItems.length === 0 ? (
                    <div className={styles.emptyList}>Aucune actualite.</div>
                  ) : (
                    filteredItems.map((item) => (
                      <article key={item.id} className={styles.newsItem}>
                        <div className={styles.newsTop}>
                          <div className={styles.newsTitleWrap}>
                            <h3>{item.title}</h3>
                            <div className={styles.newsMeta}>
                              <span>{item.category}</span>
                              <span className={item.isPublished ? styles.tagPublished : styles.tagDraft}>
                                {item.isPublished ? "Publiee" : "Brouillon"}
                              </span>
                              {item.isFeatured ? (
                                <span className={styles.tagFeatured}>
                                  <Sparkles size={12} />
                                  A la une
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            className={styles.deleteBtn}
                            onClick={() => void removeItem(item.id)}
                            title="Supprimer"
                            disabled={isSubmitting}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        <p className={styles.newsExcerpt}>{item.excerpt}</p>

                        <div className={styles.newsDate}>
                          <CalendarClock size={13} />
                          Mis a jour le {formatDate(item.updatedAt)}
                        </div>

                        <div className={styles.newsActions}>
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => startEdit(item)}
                            disabled={isSubmitting}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className={styles.actionBtn}
                            onClick={() => void togglePublish(item.id)}
                            disabled={isSubmitting}
                          >
                            {item.isPublished ? (
                              <>
                                <EyeOff size={14} />
                                Depublier
                              </>
                            ) : (
                              <>
                                <Eye size={14} />
                                Publier
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.featureBtn}`}
                            onClick={() => void setFeatured(item.id)}
                            disabled={isSubmitting}
                          >
                            <Star size={14} />
                            Mettre a la une
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </article>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
