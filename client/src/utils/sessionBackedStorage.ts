'use client';

export function getSessionBackedItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const current = window.sessionStorage.getItem(key);
  if (current !== null) {
    return current;
  }

  const legacy = window.localStorage.getItem(key);
  if (legacy !== null) {
    window.sessionStorage.setItem(key, legacy);
    window.localStorage.removeItem(key);
    return legacy;
  }

  return null;
}

export function setSessionBackedItem(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(key, value);
  window.localStorage.removeItem(key);
}

export function removeSessionBackedItem(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(key);
  window.localStorage.removeItem(key);
}

export function readSessionBackedJson<T>(key: string, fallback: T): T {
  const raw = getSessionBackedItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    removeSessionBackedItem(key);
    return fallback;
  }
}

export function writeSessionBackedJson<T>(key: string, value: T): void {
  setSessionBackedItem(key, JSON.stringify(value));
}

export function purgeLocalStorageKeys(keys: string[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  keys.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}
