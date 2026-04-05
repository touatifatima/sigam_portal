// src/hooks/useSessionLoader.ts
'use client';
import { useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';

// Hydrate auth from the httpOnly session cookie.
// This runs once on app start via ClientLayout so Navbar/Sidebar
// recover the authenticated user after a hard refresh.
export function useSessionLoader() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await initialize();
      } finally {
        if (!mounted) return;
      }
    })();
    return () => { mounted = false };
  }, [initialize]);
}

