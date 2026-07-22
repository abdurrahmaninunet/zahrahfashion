'use client';

/** Guest wishlist — localStorage-backed, shared across all cards via an
 *  external store (no provider needed). Keyed by product/tile id. */
import { useSyncExternalStore } from 'react';

const KEY = 'zahrah_wishlist_v1';
const DATES_KEY = 'zahrah_wishlist_dates_v1';
const EMPTY: ReadonlySet<string> = new Set();

let ids: Set<string> | null = null;
let dates: Record<string, number> = {};
let datesLoaded = false;
const listeners = new Set<() => void>();

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function loadDates(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DATES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function ensureDates() {
  if (!datesLoaded) { dates = loadDates(); datesLoaded = true; }
}

function persistDates() {
  try { localStorage.setItem(DATES_KEY, JSON.stringify(dates)); } catch { /* best effort */ }
}

/** When the item was saved (ms epoch), or undefined if unknown. Device-local. */
export function getWishlistSavedAt(id: string): number | undefined {
  ensureDates();
  return dates[id];
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
  ensureDates();
  const next = new Set(getSnapshot());
  if (next.has(id)) { next.delete(id); delete dates[id]; }
  else { next.add(id); dates[id] = Date.now(); }
  ids = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    /* storage unavailable — best effort */
  }
  persistDates();
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

/** Replace the whole set — used to hydrate from the server on sign-in.
 *  Keeps known save-dates; stamps newly-appearing ids with "now". */
export function setWishlist(next: string[]) {
  ensureDates();
  ids = new Set(next);
  const now = Date.now();
  const kept: Record<string, number> = {};
  for (const id of next) kept[id] = dates[id] ?? now;
  dates = kept;
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    /* storage unavailable — best effort */
  }
  persistDates();
  for (const listener of listeners) listener();
}

export function clearWishlist() {
  ids = new Set();
  dates = {};
  datesLoaded = true;
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(DATES_KEY);
  } catch {
    /* storage unavailable — best effort */
  }
  for (const listener of listeners) listener();
}
