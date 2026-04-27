export type ActualiteCategory =
  | "Actualite"
  | "Reglementation"
  | "Evenement"
  | "Communique"
  | "Technique";

export type ActualiteItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: ActualiteCategory;
  author: string;
  imageUrl: string;
  isPublished: boolean;
  isFeatured: boolean;
  readTimeMinutes: number;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ActualiteDraft = {
  title: string;
  excerpt: string;
  content: string;
  category: ActualiteCategory;
  author: string;
  imageUrl: string;
  isPublished: boolean;
  isFeatured: boolean;
};

const STORAGE_KEY = "pom_actualites_v1";

const nowIso = () => new Date().toISOString();

export const slugifyActualite = (value: string): string =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const readTimeFromText = (text: string): number => {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
};

const fallbackDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString();
};

const defaults: ActualiteItem[] = [
  {
    id: "act-001",
    slug: "lancement-guichet-numerique-pom",
    title: "Lancement du guichet numerique POM pour les demandes minieres",
    excerpt:
      "Le portail evolue avec un parcours de depot plus rapide, une meilleure tracabilite et un suivi de dossier en temps reel.",
    content:
      "Le Portail des Activites Minieres met en service une nouvelle experience de depot numerique. Les utilisateurs peuvent preparer leurs pieces, suivre les etapes et recevoir des notifications consolidees depuis un seul espace.",
    category: "Actualite",
    author: "Equipe POM",
    imageUrl:
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&h=700&fit=crop&auto=format&q=80",
    isPublished: true,
    isFeatured: true,
    readTimeMinutes: 2,
    publishedAt: "2026-03-18T09:30:00.000Z",
    createdAt: "2026-03-18T09:00:00.000Z",
    updatedAt: "2026-03-18T09:30:00.000Z",
  },
  {
    id: "act-002",
    slug: "mise-a-jour-regles-controle-geometrique",
    title: "Mise a jour des regles de controle geometrique avant depot",
    excerpt:
      "De nouvelles regles de verification prealable renforcent la qualite des dossiers et reduisent les rejets pour incoherences cartographiques.",
    content:
      "Le module de verification prealable integre des controles supplementaires sur les perimetres, les chevauchements et la projection des coordonnees. Cette evolution facilite l'instruction technique et la fiabilite des informations transmises.",
    category: "Reglementation",
    author: "Direction Cadastre",
    imageUrl:
      "https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?w=1200&h=700&fit=crop&auto=format&q=80",
    isPublished: true,
    isFeatured: false,
    readTimeMinutes: 2,
    publishedAt: "2026-02-26T11:00:00.000Z",
    createdAt: "2026-02-26T10:30:00.000Z",
    updatedAt: "2026-02-26T11:00:00.000Z",
  },
  {
    id: "act-003",
    slug: "forum-minier-national-2026",
    title: "Forum minier national 2026: ouverture des inscriptions",
    excerpt:
      "Le forum reunira operateurs, investisseurs et experts autour des priorites de developpement durable du secteur minier.",
    content:
      "Les inscriptions au forum minier national 2026 sont ouvertes. L'evenement couvrira les axes innovation, securite operationnelle, traitement des demandes et valorisation des ressources.",
    category: "Evenement",
    author: "Cellule Communication",
    imageUrl:
      "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&h=700&fit=crop&auto=format&q=80",
    isPublished: true,
    isFeatured: false,
    readTimeMinutes: 1,
    publishedAt: "2026-01-28T08:40:00.000Z",
    createdAt: "2026-01-28T08:10:00.000Z",
    updatedAt: "2026-01-28T08:40:00.000Z",
  },
];

const isActualiteCategory = (value: string): value is ActualiteCategory =>
  ["Actualite", "Reglementation", "Evenement", "Communique", "Technique"].includes(
    value,
  );

const normalizeItem = (item: Partial<ActualiteItem>, index: number): ActualiteItem => {
  const title = String(item.title || "Actualite");
  const content = String(item.content || "");
  const createdAt = item.createdAt || fallbackDate();
  const updatedAt = item.updatedAt || createdAt;

  return {
    id: String(item.id || `act-${Date.now()}-${index}`),
    slug: slugifyActualite(String(item.slug || title || `actualite-${index}`)),
    title,
    excerpt: String(item.excerpt || ""),
    content,
    category: isActualiteCategory(String(item.category || ""))
      ? (item.category as ActualiteCategory)
      : "Actualite",
    author: String(item.author || "Equipe POM"),
    imageUrl: String(item.imageUrl || ""),
    isPublished: Boolean(item.isPublished),
    isFeatured: Boolean(item.isFeatured),
    readTimeMinutes:
      Number(item.readTimeMinutes) > 0
        ? Number(item.readTimeMinutes)
        : readTimeFromText(content || title),
    publishedAt: String(item.publishedAt || createdAt),
    createdAt,
    updatedAt,
  };
};

const normalizeList = (items: Partial<ActualiteItem>[]): ActualiteItem[] => {
  const normalized = items.map(normalizeItem);
  const featured = normalized.filter((item) => item.isFeatured);

  if (featured.length > 1) {
    const keepId = featured[0].id;
    return normalized.map((item) =>
      item.id === keepId ? item : { ...item, isFeatured: false },
    );
  }

  return normalized;
};

export const getDefaultActualites = (): ActualiteItem[] =>
  normalizeList(defaults).sort(
    (a, b) =>
      new Date(b.publishedAt || b.createdAt).getTime() -
      new Date(a.publishedAt || a.createdAt).getTime(),
  );

export const loadActualitesFromStorage = (): ActualiteItem[] => {
  if (typeof window === "undefined") return getDefaultActualites();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = getDefaultActualites();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const seeded = getDefaultActualites();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }

    return normalizeList(parsed).sort(
      (a, b) =>
        new Date(b.publishedAt || b.createdAt).getTime() -
        new Date(a.publishedAt || a.createdAt).getTime(),
    );
  } catch {
    return getDefaultActualites();
  }
};

export const saveActualitesToStorage = (items: ActualiteItem[]): void => {
  if (typeof window === "undefined") return;
  const normalized = normalizeList(items);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
};

export const buildActualiteItemFromDraft = (
  draft: ActualiteDraft,
  previous?: ActualiteItem,
): ActualiteItem => {
  const baseTime = nowIso();
  const title = String(draft.title || "").trim();
  const content = String(draft.content || "").trim();

  return normalizeItem({
    id: previous?.id || `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    slug: slugifyActualite(previous?.slug || title),
    title,
    excerpt: String(draft.excerpt || "").trim(),
    content,
    category: draft.category,
    author: String(draft.author || "").trim() || "Equipe POM",
    imageUrl: String(draft.imageUrl || "").trim(),
    isPublished: draft.isPublished,
    isFeatured: draft.isFeatured,
    publishedAt: draft.isPublished
      ? previous?.publishedAt || baseTime
      : previous?.publishedAt || "",
    createdAt: previous?.createdAt || baseTime,
    updatedAt: baseTime,
    readTimeMinutes: readTimeFromText(content || title),
  }, 0);
};

export const defaultActualiteDraft: ActualiteDraft = {
  title: "",
  excerpt: "",
  content: "",
  category: "Actualite",
  author: "Equipe POM",
  imageUrl: "",
  isPublished: false,
  isFeatured: false,
};

