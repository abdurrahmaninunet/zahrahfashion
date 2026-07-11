'use client';

/** Guest wishlist — localStorage-backed, shared across all cards via an
 *  external store (no provider needed). Keyed by product/tile id. */
import { useSyncExternalStore } from 'react';

const KEY = 'zahrah_wishlist_v1';
const EMPTY: ReadonlySet<string> = new Set();

let ids: Set<string> | null = null;
const listeners = new Set<() => void>();

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function getSnapshot(): ReadonlySet<string> {
  ids ??= load();
  return ids;
}

function getServerSnapshot(): ReadonlySet<string> {
  return EMPTY;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toggleWishlist(id: string) {
  const next = new Set(getSnapshot());
  if (next.has(id)) next.delete(id);
  else next.add(id);
  ids = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    /* storage unavailable — best effort */
  }
  for (const listener of listeners) listener();
}

export function useWishlisted(id: string): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot).has(id);
}

export function useWishlistCount(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot).size;
}

export function useWishlistIds(): string[] {
  return [...useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)];
}

/** Replace the whole set — used to hydrate from the server on sign-in. */
export function setWishlist(next: string[]) {
  ids = new Set(next);
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    /* storage unavailable — best effort */
  }
  for (const listener of listeners) listener();
}

export function clearWishlist() {
  ids = new Set();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — best effort */
  }
  for (const listener of listeners) listener();
}
