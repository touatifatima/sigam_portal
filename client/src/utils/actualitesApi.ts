import type {
  ActualiteCategory,
  ActualiteDraft,
  ActualiteItem,
} from './actualitesStorage';

type ActualiteApiPayload = {
  id?: string;
  slug?: string;
  title?: string;
  excerpt?: string;
  content?: string;
  category?: string;
  author?: string;
  imageUrl?: string;
  isPublished?: boolean;
  isFeatured?: boolean;
  readTimeMinutes?: number;
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ActualitesApiResponse = {
  items?: ActualiteApiPayload[];
  item?: ActualiteApiPayload;
  message?: string;
};

const categoryOptions: ActualiteCategory[] = [
  'Actualite',
  'Reglementation',
  'Evenement',
  'Communique',
  'Technique',
];

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL || (import.meta as any)?.env?.VITE_API_URL || '';

const toCategory = (value: string | undefined): ActualiteCategory => {
  const normalized = String(value || '').trim().toLowerCase();
  return (
    categoryOptions.find((option) => option.toLowerCase() === normalized) ||
    'Actualite'
  );
};

const toIso = (value: string | undefined): string => {
  const date = new Date(String(value || ''));
  const ts = date.getTime();
  if (!Number.isFinite(ts)) {
    return new Date().toISOString();
  }
  return date.toISOString();
};

const toActualiteItem = (value: ActualiteApiPayload): ActualiteItem => {
  const title = String(value.title || '').trim() || 'Actualite';
  const content = String(value.content || '').trim();
  const createdAt = toIso(value.createdAt);
  const publishedAt = value.publishedAt ? toIso(value.publishedAt) : createdAt;

  return {
    id: String(value.id || ''),
    slug: String(value.slug || title),
    title,
    excerpt: String(value.excerpt || '').trim(),
    content,
    category: toCategory(value.category),
    author: String(value.author || 'Equipe POM').trim() || 'Equipe POM',
    imageUrl: String(value.imageUrl || '').trim(),
    isPublished: Boolean(value.isPublished),
    isFeatured: Boolean(value.isFeatured),
    readTimeMinutes:
      Number(value.readTimeMinutes) > 0
        ? Number(value.readTimeMinutes)
        : Math.max(1, Math.ceil(Math.max(1, content.split(/\s+/).length) / 180)),
    publishedAt,
    createdAt,
    updatedAt: toIso(value.updatedAt || createdAt),
  };
};

const buildErrorMessage = async (response: Response): Promise<string> => {
  const base = `Erreur API (${response.status})`;
  try {
    const payload = await response.json();
    const message = String(payload?.message || '').trim();
    if (!message) return base;
    if (Array.isArray(payload?.message)) {
      return payload.message.map((part: unknown) => String(part)).join(', ');
    }
    return message;
  } catch {
    return base;
  }
};

const request = async (
  endpoint: string,
  options?: RequestInit,
): Promise<ActualitesApiResponse> => {
  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL manquante');
  }

  const response = await fetch(`${apiUrl}${endpoint}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return (await response.json()) as ActualitesApiResponse;
};

const toAdminPayload = (draft: Partial<ActualiteDraft>) => ({
  title: typeof draft.title === 'string' ? draft.title : undefined,
  excerpt: typeof draft.excerpt === 'string' ? draft.excerpt : undefined,
  content: typeof draft.content === 'string' ? draft.content : undefined,
  category: typeof draft.category === 'string' ? draft.category : undefined,
  author: typeof draft.author === 'string' ? draft.author : undefined,
  imageUrl: typeof draft.imageUrl === 'string' ? draft.imageUrl : undefined,
  isPublished:
    typeof draft.isPublished === 'boolean' ? draft.isPublished : undefined,
  isFeatured: typeof draft.isFeatured === 'boolean' ? draft.isFeatured : undefined,
});

const parseId = (id: string): number => {
  const parsed = Number(id);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Identifiant d actualite invalide');
  }
  return parsed;
};

export const fetchPublishedActualites = async (params?: {
  search?: string;
  category?: string;
}): Promise<ActualiteItem[]> => {
  const query = new URLSearchParams();
  if (params?.search?.trim()) query.set('search', params.search.trim());
  if (params?.category?.trim()) query.set('category', params.category.trim());
  const suffix = query.toString() ? `?${query.toString()}` : '';

  const payload = await request(`/api/actualites${suffix}`);
  return Array.isArray(payload.items) ? payload.items.map(toActualiteItem) : [];
};

export const fetchAdminActualites = async (): Promise<ActualiteItem[]> => {
  const payload = await request('/api/actualites/admin/all');
  return Array.isArray(payload.items) ? payload.items.map(toActualiteItem) : [];
};

export const createActualite = async (
  draft: ActualiteDraft,
): Promise<ActualiteItem> => {
  const payload = await request('/api/actualites/admin', {
    method: 'POST',
    body: JSON.stringify(toAdminPayload(draft)),
  });
  if (!payload.item) {
    throw new Error('Reponse API invalide');
  }
  return toActualiteItem(payload.item);
};

export const updateActualite = async (
  id: string,
  draft: Partial<ActualiteDraft>,
): Promise<ActualiteItem> => {
  const payload = await request(`/api/actualites/admin/${parseId(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(toAdminPayload(draft)),
  });
  if (!payload.item) {
    throw new Error('Reponse API invalide');
  }
  return toActualiteItem(payload.item);
};

export const deleteActualite = async (id: string): Promise<void> => {
  await request(`/api/actualites/admin/${parseId(id)}`, {
    method: 'DELETE',
  });
};

export const resetActualites = async (): Promise<ActualiteItem[]> => {
  const payload = await request('/api/actualites/admin/reset', {
    method: 'POST',
  });
  return Array.isArray(payload.items) ? payload.items.map(toActualiteItem) : [];
};
