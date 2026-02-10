// src/store/useAuthStore.ts
'use client';

import { create, type StoreApi } from 'zustand';
import type { UseBoundStore } from 'zustand';
import axios from 'axios';

interface AuthData {
  antenneId: any;
  token: string | null;
  id: number | null;
  username: string | null;
  email: string | null;
  nom?: string | null;
  Prenom?: string | null;
  telephone?: string | null;
  createdAt?: string | null;
  role: string | null;
  permissions: string[];
  isEntrepriseVerified: boolean;
}

const emptyAuthState: AuthData = {
  token: null,
  id: null,
  username: null,
  email: null,
  nom: null,
  Prenom: null,
  telephone: null,
  createdAt: null,
  role: null,
  permissions: [],
  isEntrepriseVerified: false,
};

interface AuthStore {
  auth: AuthData;
  isLoaded: boolean;
  login: (data: { token: string; user: Omit<AuthData, 'token'> }) => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
  setEntrepriseVerified: (value: boolean) => void;
}

const apiURL = process.env.NEXT_PUBLIC_API_URL;

function readAuthFromStorage(): AuthData | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    // Primary key used by this app
    const raw = window.localStorage.getItem('auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        token: parsed.token ?? null,
        id: parsed.id ?? null,
        username: parsed.username ?? null,
        email: parsed.email ?? null,
        nom: parsed.nom ?? null,
        Prenom: parsed.Prenom ?? null,
        telephone: parsed.telephone ?? null,
        createdAt: parsed.createdAt ?? null,
        role: parsed.role ?? null,
        permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [],
        isEntrepriseVerified: Boolean(parsed.isEntrepriseVerified),
      };
    }

    // Backward-compat: some environments store under 'auth-storage'
    const legacy = window.localStorage.getItem('auth-storage');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const s = parsed?.state?.auth ?? {};
      return {
        token: s.token ?? null,
        id: s.id ?? null,
        username: s.username ?? null,
        email: s.email ?? null,
        nom: s.nom ?? null,
        Prenom: s.Prenom ?? null,
        telephone: s.telephone ?? null,
        createdAt: s.createdAt ?? null,
        role: s.role ?? null,
        permissions: Array.isArray(s.permissions) ? s.permissions : [],
        isEntrepriseVerified: Boolean(s.isEntrepriseVerified),
      };
    }

    return null;
  } catch (error) {
    console.warn('Failed to read auth from storage', error);
    return null;
  }
}

// Ensure a single global store instance across any module duplication
// (e.g. mixed import paths, dynamic chunks). This guards against state
// resets where different parts of the app see different stores.
type BoundStore = UseBoundStore<StoreApi<AuthStore>>;

function createAuthStore(): BoundStore {
  return create<AuthStore>((set, get) => ({
    auth: { ...emptyAuthState },
    isLoaded: false,

    login: (data) => {
      const storedVerified = get().auth.isEntrepriseVerified;
      const newAuth = {
        token: data.token,
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        nom: (data.user as any).nom ?? null,
        Prenom: (data.user as any).Prenom ?? null,
        telephone: (data.user as any).telephone ?? null,
        createdAt: (data.user as any).createdAt ?? null,
        role: data.user.role,
        permissions: data.user.permissions,
        isEntrepriseVerified:
          (data.user as any).isEntrepriseVerified ??
          (data.user as any).entrepriseVerified ??
          (data.user as any).entreprise_verified ??
          storedVerified ??
          false,
      };

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('auth', JSON.stringify(newAuth));
      }

      set({ auth: newAuth, isLoaded: true });
    },

    logout: async () => {
      const { token } = get().auth;
      try {
        await axios.post(`${apiURL}/auth/logout`, {}, { withCredentials: true });
      } catch (error) {
        console.error('Logout error:', error);
      }

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('auth');
      }

      set({
        auth: { ...emptyAuthState },
        isLoaded: true,
      });

      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    },

    initialize: async () => {
      let authState = get().auth;

      if (!authState.token) {
        const stored = readAuthFromStorage();
        if (stored) {
          authState = stored;
          set({ auth: stored });
        }
      }

      const token = authState.token;

      if (!token) {
        try {
          const response = await axios.get(`${apiURL}/auth/me`, {
            withCredentials: true,
          });
          if (response.data?.user) {
            const updatedAuth = {
              token: null,
              id: response.data.user.id,
              username: response.data.user.username,
              email: response.data.user.email,
              nom: (response.data.user as any).nom ?? null,
              Prenom: (response.data.user as any).Prenom ?? null,
              telephone: (response.data.user as any).telephone ?? null,
              createdAt: (response.data.user as any).createdAt ?? null,
              role: response.data.user.role,
              permissions: response.data.user.permissions,
              isEntrepriseVerified:
                (response.data.user as any).isEntrepriseVerified ??
                (response.data.user as any).entrepriseVerified ??
                (response.data.user as any).entreprise_verified ??
                authState.isEntrepriseVerified,
            };

            if (typeof window !== 'undefined') {
              window.localStorage.setItem('auth', JSON.stringify(updatedAuth));
            }

            set({ auth: updatedAuth, isLoaded: true });
            return;
          }
        } catch (error) {
          console.warn('Auth cookie verification failed', error);
        }
        set({ isLoaded: true });
        return;
      }

      try {
        const response = await axios.post(
          `${apiURL}/auth/verify`,
          { token },
          { withCredentials: true }
        );

        if (response.data?.user) {
          const updatedAuth = {
            token,
          id: response.data.user.id,
          username: response.data.user.username,
          email: response.data.user.email,
          nom: (response.data.user as any).nom ?? null,
          Prenom: (response.data.user as any).Prenom ?? null,
          telephone: (response.data.user as any).telephone ?? null,
          createdAt: (response.data.user as any).createdAt ?? null,
          role: response.data.user.role,
          permissions: response.data.user.permissions,
          isEntrepriseVerified:
            (response.data.user as any).isEntrepriseVerified ??
            (response.data.user as any).entrepriseVerified ??
            (response.data.user as any).entreprise_verified ??
              authState.isEntrepriseVerified,
          };

          if (typeof window !== 'undefined') {
            window.localStorage.setItem('auth', JSON.stringify(updatedAuth));
          }

          set({ auth: updatedAuth, isLoaded: true });
          return;
        }
      } catch (error) {
        console.warn('Token verification failed, clearing session');
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('auth');
        }

        set({
          auth: { ...emptyAuthState },
          isLoaded: true,
        });
      }

      set({ isLoaded: true });
    },

    hasPermission: (perm) => {
      const { permissions } = get().auth;
      return Array.isArray(permissions) && permissions.includes(perm);
    },

    setEntrepriseVerified: (value) => {
      const current = get().auth;
      const nextAuth = { ...current, isEntrepriseVerified: value };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('auth', JSON.stringify(nextAuth));
      }
      set({ auth: nextAuth });
    },
  }));
}

declare global {
  interface Window {
    __SIGAM_AUTH_STORE__?: BoundStore;
  }
}

export const useAuthStore: BoundStore = ((): BoundStore => {
  if (typeof window === 'undefined') {
    return createAuthStore();
  }
  if (!window.__SIGAM_AUTH_STORE__) {
    window.__SIGAM_AUTH_STORE__ = createAuthStore();
  }
  return window.__SIGAM_AUTH_STORE__;
})();
