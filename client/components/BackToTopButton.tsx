'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FiArrowUp } from 'react-icons/fi';
import { useAuthStore } from '@/src/store/useAuthStore';
import { isAdminRole } from '@/src/utils/roleNavigation';
import styles from './BackToTopButton.module.css';

const ADMIN_ROUTE_PREFIXES = [
  '/permis_dashboard',
  '/admin_panel',
  '/admin/identifications-entreprises',
  '/admin/pages-statiques',
  '/audit-logs',
];

function isAdminRoute(pathname: string) {
  const normalized = pathname.toLowerCase();
  return ADMIN_ROUTE_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

export default function BackToTopButton() {
  const location = useLocation();
  const auth = useAuthStore((state) => state.auth);
  const isLoaded = useAuthStore((state) => state.isLoaded);
  const [isVisible, setIsVisible] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const shouldRender = useMemo(() => {
    if (!isLoaded) return false;
    if (!isAdminRole(auth?.role)) return false;
    return isAdminRoute(location.pathname);
  }, [auth?.role, isLoaded, location.pathname]);

  useEffect(() => {
    if (!shouldRender) {
      setIsVisible(false);
      return;
    }

    const updateVisibility = () => {
      setIsVisible(window.scrollY > 300);
    };

    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', updateVisibility);

    return () => {
      window.removeEventListener('scroll', updateVisibility);
      window.removeEventListener('resize', updateVisibility);
    };
  }, [shouldRender]);

  if (!shouldRender) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="Back to top"
      className={[
        styles.backToTopButton,
        isVisible ? styles.visible : styles.hidden,
        isPressed ? styles.pressed : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      <FiArrowUp />
    </button>
  );
}
