// src/store/useAuthStore.ts
'use client';

import { create, type StoreApi } from 'zustand';
import type { UseBoundStore } from 'zustand';
import axios from 'axios';
import { purgeLocalStorageKeys } from '../utils/sessionBackedStorage';

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
  identificationStatus?: 'EN_ATTENTE' | 'CONFIRMEE' | 'REFUSEE' | null;
  firstLoginAfterConfirmation?: boolean;
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
  identificationStatus: null,
  firstLoginAfterConfirmation: false,
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

const LEGACY_AUTH_STORAGE_KEYS = ['auth', 'auth-storage'];

function purgeLegacyAuthStorage() {
  purgeLocalStorageKeys(LEGACY_AUTH_STORAGE_KEYS);
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
        identificationStatus:
          (data.user as any).identificationStatus ??
          (data.user as any).identification_status ??
          null,
        firstLoginAfterConfirmation: Boolean(
          (data.user as any).firstLoginAfterConfirmation ??
            (data.user as any).first_login_after_confirmation,
        ),
      };

      purgeLegacyAuthStorage();

      set({ auth: newAuth, isLoaded: true });
    },

    logout: async () => {
      try {
        await axios.post(`${apiURL}/auth/logout`, {}, { withCredentials: true });
      } catch (error) {
        console.error('Logout error:', error);
      }

      purgeLegacyAuthStorage();

      set({
        auth: { ...emptyAuthState },
        isLoaded: true,
      });

      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    },

    initialize: async () => {
      const authState = get().auth;
      purgeLegacyAuthStorage();

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
            identificationStatus:
              (response.data.user as any).identificationStatus ??
              (response.data.user as any).identification_status ??
              null,
            firstLoginAfterConfirmation: Boolean(
              (response.data.user as any).firstLoginAfterConfirmation ??
                (response.data.user as any).first_login_after_confirmation,
            ),
          };

          set({ auth: updatedAuth, isLoaded: true });
          return;
        }
      } catch (error) {
        console.warn('Auth cookie verification failed', error);

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
      const nextAuth = {
        ...current,
        isEntrepriseVerified: value,
        identificationStatus: value ? 'CONFIRMEE' : current.identificationStatus ?? null,
      };
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
