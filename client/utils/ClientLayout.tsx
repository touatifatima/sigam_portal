'use client';
import { useSessionLoader } from '../src/hooks/useSessionLoader';
import { useAuthStore } from '../src/store/useAuthStore';
import { useLocation } from 'react-router-dom';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useSessionLoader();
  const isLoaded = useAuthStore((state) => state.isLoaded);
  const location = useLocation();
  const baseFontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  const pathname = (location.pathname || '').toLowerCase();
  const disableGlobalZoom =
    pathname === '/' ||
    pathname.startsWith('/signup') ||
    pathname === '/carte' ||
    pathname.startsWith('/carte/carte_public') ||
    pathname.startsWith('/admin/identifications-entreprises') ||
    pathname.startsWith('/admin_panel/gestion-demandes') ||
    pathname.startsWith('/admin_panel/gestion_notifications') ||
    pathname.startsWith('/admin_panel/dossieradminpage') ||
    pathname.startsWith('/permis_dashboard/permisdashboard');

  if (!isLoaded) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: baseFontFamily,
          color: 'white',
          textAlign: 'center',
        }}
      >
        <style>{'@keyframes sigamSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
        <div>
          <div
            style={{
              width: '64px',
              height: '64px',
              border: '4px solid #3b82f6',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              margin: '0 auto 24px',
              animation: 'sigamSpin 1s linear infinite',
            }}
          />
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              marginBottom: '8px',
            }}
          >
            Initializing Session
          </h1>
          <p
            style={{
              color: '#9ca3af',
              marginBottom: '24px',
            }}
          >
            Securing your connection...
          </p>
          <div
            style={{
              marginTop: '24px',
              display: 'flex',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#3b82f6',
                  borderRadius: '50%',
                  display: 'inline-block',
                  opacity: 0.7,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={disableGlobalZoom ? undefined : 'anam-app-zoom'}
      style={{
        fontFamily: baseFontFamily,
      }}
    >
      {children}
    </div>
  );
}

