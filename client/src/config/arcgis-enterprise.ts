// src/config/arcgis-enterprise.ts
//
// Centralized ArcGIS Enterprise setup for the SIGAM client:
// - portalUrl / assetsPath / CORS servers (via arcgis-config)
// - persist IdentityManager credentials (avoid re-login on refresh)
// - request interceptor: remove app headers + include cookies for sig.anam.dz
//
// Import this module once (early) in any page that uses @arcgis/core.

import './arcgis-config';
import esriConfig from '@arcgis/core/config';
import esriId from '@arcgis/core/identity/IdentityManager';

const CREDENTIALS_KEY = 'sigam_arcgis_credentials';
const INTERCEPTOR_KEY = '__SIGAM_ARCGIS_INTERCEPTOR__';

const isBrowser = typeof window !== 'undefined';

const restoreCredentials = () => {
  if (!isBrowser) return;
  try {
    const raw = window.localStorage.getItem(CREDENTIALS_KEY);
    if (!raw) return;
    const json = JSON.parse(raw);
    esriId.initialize(json);
  } catch (e) {
    console.warn('Failed to restore ArcGIS credentials from storage', e);
  }
};

const persistCredentials = () => {
  if (!isBrowser) return;
  try {
    const json = esriId.toJSON();
    window.localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(json));
  } catch (e) {
    console.warn('Failed to persist ArcGIS credentials', e);
  }
};

restoreCredentials();
try {
  (esriId as any).on?.('credential-create', persistCredentials);
} catch {}

if (isBrowser) {
  try {
    const w = window as any;
    if (!w[INTERCEPTOR_KEY]) {
      const req = esriConfig.request as any;
      req.corsEnabledServers = req.corsEnabledServers || [];
      const corsServers = req.corsEnabledServers as string[];
      const ensure = (h: string) => {
        if (!corsServers.includes(h)) corsServers.push(h);
      };
      [
        'sig.anam.dz',
        'sig.anam.dz:443',
        'cdn.arcgis.com',
        'js.arcgis.com',
        'services.arcgisonline.com',
        'server.arcgisonline.com',
        'basemaps.arcgis.com',
        'tiles.arcgis.com',
      ].forEach(ensure);

      if (!esriConfig.request.interceptors) {
        esriConfig.request.interceptors = [];
      }

      esriConfig.request.interceptors.push({
        urls: ['sig.anam.dz', /\.arcgis\.com$/, /\.arcgisonline\.com$/, 'cdn.arcgis.com'],
        before: (params: any) => {
          try {
            const urlStr = params.url || params.requestOptions?.url || '';
            const u = new URL(urlStr, window.location.origin);
            const hostname = u.hostname.toLowerCase();

            if (
              hostname === 'sig.anam.dz' ||
              hostname.endsWith('.arcgis.com') ||
              hostname.endsWith('arcgisonline.com') ||
              hostname === 'cdn.arcgis.com'
            ) {
              const headers = new Headers(params.requestOptions?.headers || {});
              headers.delete('X-User-Id');
              headers.delete('x-user-id');
              headers.delete('X-User-Name');
              headers.delete('x-user-name');

              const credentials = hostname === 'sig.anam.dz' ? 'include' : 'omit';
              params.requestOptions = {
                ...params.requestOptions,
                headers,
                credentials,
              };
            }
          } catch {}
          return params;
        },
      });

      w[INTERCEPTOR_KEY] = true;
    }
  } catch {}
}

export {};

