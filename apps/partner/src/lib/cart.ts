'use client';

import { useSyncExternalStore } from 'react';

/** Partner order cart — localStorage-backed, shared across the catalogue and
 *  product pages via an external store (no provider needed). */
const KEY = 'zahrah_partner_cart_v1';

export interface CartItem {
  productId: string; name: string; price: number; image: string | null; qty: number; stock: number;
  // Style products: how the quantity was chosen.
  styleMode?: 'auto' | 'manual';
  styleQtys?: Record<string, number>;
}
type CartMap = Record<string, CartItem>;

const EMPTY: CartMap = {};
let items: CartMap | null = null;
const listeners = new Set<() => void>();

function load(): CartMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartMap) : {};
  } catch {
    return {};
  }
}

function snapshot(): CartMap {
  items ??= load();
  return items;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(items ?? {})); } catch { /* best effort */ }
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Set the quantity for a product (0 removes it). Clamped to available stock. */
export function setCartQty(product: Omit<CartItem, 'qty'>, qty: number) {
  const cur = snapshot();
  const next: CartMap = { ...cur };
  const n = Math.max(0, Math.min(Math.round(qty), product.stock));
  if (n <= 0) delete next[product.productId];
  else next[product.productId] = { ...product, qty: n };
  items = next;
  persist();
}

/** Set/replace a full cart entry (used for style products). qty ≤ 0 removes it. */
export function setCartItem(item: CartItem) {
  const cur = snapshot();
  const next: CartMap = { ...cur };
  if (item.qty <= 0) delete next[item.productId];
  else next[item.productId] = item;
  items = next;
  persist();
}

export function clearCart() {
  items = {};
  persist();
}

export function useCartMap(): CartMap {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

/** Convenience selector: items array + totals. */
export function useCart() {
  const map = useCartMap();
  const list = Object.values(map);
  return {
    map,
    items: list,
    count: list.reduce((s, i) => s + i.qty, 0),
    total: list.reduce((s, i) => s + i.price * i.qty, 0),
    qtyOf: (id: string) => map[id]?.qty ?? 0,
  };
}
