'use client';

/**
 * Open/close state for the sign-in / register slide-over. Communicates via a
 * window CustomEvent (a real singleton, immune to bundler module duplication)
 * and mirrors a `?auth=signin` URL param so the URL is shareable and the back
 * button closes the panel.
 */
import { useEffect, useState } from 'react';

const EVENT = 'zahrah-auth-drawer';

function syncUrl(on: boolean, push: boolean) {
  try {
    const url = new URL(window.location.href);
    if (on) url.searchParams.set('auth', 'signin');
    else url.searchParams.delete('auth');
    window.history[push ? 'pushState' : 'replaceState'](null, '', url);
  } catch {
    /* history unavailable — ignore */
  }
}

export function openAuthDrawer() {
  syncUrl(true, true);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: true }));
}

export function closeAuthDrawer() {
  syncUrl(false, false);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: false }));
}

export function useAuthDrawerOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const fromUrl = () => setOpen(new URLSearchParams(window.location.search).has('auth'));
    fromUrl();
    const onEvent = (e: Event) => setOpen((e as CustomEvent<boolean>).detail);
    window.addEventListener(EVENT, onEvent);
    window.addEventListener('popstate', fromUrl);
    return () => {
      window.removeEventListener(EVENT, onEvent);
      window.removeEventListener('popstate', fromUrl);
    };
  }, []);
  return open;
}
