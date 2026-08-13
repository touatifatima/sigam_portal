'use client';
import { useSessionLoader } from '../src/hooks/useSessionLoader';
import { useAuthStore } from '../src/store/useAuthStore';
import { useLocation } from 'react-router-dom';
import { BrandLoader } from '@/components/loading/BrandLoader';
import BackToTopButton from '@/components/BackToTopButton';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useSessionLoader();
  const isLoaded = useAuthStore((state) => state.isLoaded);
  const location = useLocation();
  const baseFontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  const pathname = (location.pathname || '').toLowerCase();
  const disableGlobalZoom =
    pathname === '/' ||
    pathname === '/auth/login' ||
    pathname.startsWith('/signup') ||
    pathname === '/carte' ||
    pathname.startsWith('/carte/carte_public') ||
    pathname.startsWith('/admin_panel/gestion-demandes') ||
    pathname.startsWith('/admin_panel/gestion_notifications') ||
    pathname.startsWith('/admin_panel/dossieradminpage');

  if (!isLoaded) {
    return <BrandLoader fullScreen label="Initialisation de la session..." />;
  }

  return (
    <div
      className={disableGlobalZoom ? undefined : 'anam-app-zoom'}
      style={{
        fontFamily: baseFontFamily,
      }}
    >
      {children}
      <BackToTopButton />
    </div>
  );
}

