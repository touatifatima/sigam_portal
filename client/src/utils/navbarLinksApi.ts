export type NavbarQuickLinkItem = {
  id: number;
  key: string;
  label: string;
  href: string;
  description?: string | null;
  icon?: string | null;
  section: string;
  sortOrder: number;
  isActive: boolean;
  showForAdmin: boolean;
  showForOperateur: boolean;
  showForInvestisseur: boolean;
  requiredPermission?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NavbarQuickLinkPayload = {
  key?: string;
  label?: string;
  href?: string;
  description?: string | null;
  icon?: string | null;
  section?: string;
  sortOrder?: number;
  isActive?: boolean;
  showForAdmin?: boolean;
  showForOperateur?: boolean;
  showForInvestisseur?: boolean;
  requiredPermission?: string | null;
};

type VisibleResponse = {
  configured?: boolean;
  items?: NavbarQuickLinkItem[];
};

type AdminListResponse = {
  items?: NavbarQuickLinkItem[];
};

type AdminItemResponse = {
  item?: NavbarQuickLinkItem;
  message?: string;
};

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL || (import.meta as any)?.env?.VITE_API_URL || '';

const buildErrorMessage = async (response: Response) => {
  const fallback = `Erreur API (${response.status})`;
  try {
    const payload = await response.json();
    if (Array.isArray(payload?.message)) {
      return payload.message.map((entry: unknown) => String(entry)).join(', ');
    }
    const msg = String(payload?.message || '').trim();
    return msg || fallback;
  } catch {
    return fallback;
  }
};

const request = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
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

  return (await response.json()) as T;
};

export const fetchVisibleNavbarLinks = async (): Promise<{
  configured: boolean;
  items: NavbarQuickLinkItem[];
}> => {
  const payload = await request<VisibleResponse>('/api/navbar-links/visible');
  return {
    configured: Boolean(payload?.configured),
    items: Array.isArray(payload?.items) ? payload.items : [],
  };
};

export const fetchAdminNavbarLinks = async (): Promise<NavbarQuickLinkItem[]> => {
  const payload = await request<AdminListResponse>('/api/navbar-links/admin/all');
  return Array.isArray(payload?.items) ? payload.items : [];
};

export const createNavbarLink = async (
  input: NavbarQuickLinkPayload,
): Promise<NavbarQuickLinkItem> => {
  const payload = await request<AdminItemResponse>('/api/navbar-links/admin', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!payload?.item) {
    throw new Error('Reponse API invalide');
  }

  return payload.item;
};

export const updateNavbarLink = async (
  id: number,
  input: NavbarQuickLinkPayload,
): Promise<NavbarQuickLinkItem> => {
  const payload = await request<AdminItemResponse>(`/api/navbar-links/admin/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

  if (!payload?.item) {
    throw new Error('Reponse API invalide');
  }

  return payload.item;
};

export const deleteNavbarLink = async (id: number): Promise<void> => {
  await request(`/api/navbar-links/admin/${id}`, { method: 'DELETE' });
};

