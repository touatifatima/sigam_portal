export type StaticPageLocale = 'fr' | 'ar';

export type StaticPageSlug =
  | 'conditions-utilisation'
  | 'politique-confidentialite'
  | 'mentions-legales'
  | 'faq'
  | 'documentation'
  | 'contact';

export type StaticPageItem = {
  id: string;
  slug: StaticPageSlug;
  title: string;
  content: string;
  locale: StaticPageLocale;
  updatedAt: string;
  updatedBy?: string | null;
};

type StaticPagesApiResponse = {
  item?: StaticPageItem;
  items?: StaticPageItem[];
  message?: string;
};

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL || (import.meta as any)?.env?.VITE_API_URL || '';

const SUPPORTED_LOCALES: StaticPageLocale[] = ['fr', 'ar'];

const normalizeLocale = (value?: string | null): StaticPageLocale => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  return normalized === 'ar' ? 'ar' : 'fr';
};

const readLocaleFromPreferences = (): StaticPageLocale | null => {
  if (typeof window === 'undefined') return null;

  try {
    const direct = window.localStorage.getItem('sigam_locale');
    if (direct) {
      const locale = normalizeLocale(direct);
      if (SUPPORTED_LOCALES.includes(locale)) return locale;
    }

    const keys = Object.keys(window.localStorage).filter((key) =>
      key.startsWith('sigam_preferences_'),
    );

    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { language?: string };
      if (parsed?.language) {
        const locale = normalizeLocale(parsed.language);
        if (SUPPORTED_LOCALES.includes(locale)) return locale;
      }
    }
  } catch {
    return null;
  }

  return null;
};

export const getCurrentLocale = (): StaticPageLocale => {
  if (typeof window === 'undefined') return 'fr';

  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('locale') || params.get('lang');
  if (fromQuery) return normalizeLocale(fromQuery);

  const fromHtml = document.documentElement?.lang;
  if (fromHtml) return normalizeLocale(fromHtml);

  const fromPreferences = readLocaleFromPreferences();
  if (fromPreferences) return fromPreferences;

  if (navigator.language?.toLowerCase().startsWith('ar')) {
    return 'ar';
  }

  return 'fr';
};

const buildErrorMessage = async (response: Response): Promise<string> => {
  const fallback = `Erreur API (${response.status})`;

  try {
    const payload = await response.json();
    if (Array.isArray(payload?.message)) {
      return payload.message.map((entry: unknown) => String(entry)).join(', ');
    }

    const message = String(payload?.message || '').trim();
    return message || fallback;
  } catch {
    return fallback;
  }
};

const request = async (
  endpoint: string,
  options?: RequestInit,
): Promise<StaticPagesApiResponse> => {
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

  return (await response.json()) as StaticPagesApiResponse;
};

export const fetchPublicStaticPage = async (
  slug: StaticPageSlug,
  locale?: string,
): Promise<StaticPageItem> => {
  const selectedLocale = normalizeLocale(locale || getCurrentLocale());

  const payload = await request(
    `/api/static-pages/${encodeURIComponent(slug)}?locale=${encodeURIComponent(selectedLocale)}`,
  );

  if (!payload.item) {
    throw new Error('Page statique introuvable');
  }

  return payload.item;
};

export const fetchAdminStaticPages = async (
  locale?: string,
): Promise<StaticPageItem[]> => {
  const selectedLocale = normalizeLocale(locale || getCurrentLocale());

  const payload = await request(
    `/api/static-pages?locale=${encodeURIComponent(selectedLocale)}`,
  );

  return Array.isArray(payload.items) ? payload.items : [];
};

export const updateStaticPage = async (
  slug: StaticPageSlug,
  payload: {
    title: string;
    content: string;
    locale: StaticPageLocale;
  },
): Promise<StaticPageItem> => {
  const response = await request(`/api/static-pages/${encodeURIComponent(slug)}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: payload.title,
      content: payload.content,
      locale: payload.locale,
    }),
  });

  if (!response.item) {
    throw new Error('Reponse API invalide');
  }

  return response.item;
};

export const addStaticPage = async (
  slug: StaticPageSlug,
  locale: StaticPageLocale,
): Promise<StaticPageItem> => {
  const response = await request(`/api/static-pages/${encodeURIComponent(slug)}`, {
    method: 'POST',
    body: JSON.stringify({ locale }),
  });

  if (!response.item) {
    throw new Error('Reponse API invalide');
  }

  return response.item;
};

export const deleteStaticPage = async (
  slug: StaticPageSlug,
  locale: StaticPageLocale,
): Promise<StaticPageItem> => {
  const response = await request(
    `/api/static-pages/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
    {
      method: 'DELETE',
    },
  );

  if (!response.item) {
    throw new Error('Reponse API invalide');
  }

  return response.item;
};
