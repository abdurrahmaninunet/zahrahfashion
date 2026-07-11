'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/** Guest cart — localStorage-persisted (FR-SF-CRT-01), server-evaluated. */
export interface CartLine {
  variantId?: string;
  bundleProductId?: string;
  /** Chosen sell-format id (e.g. "piece" / "yard"). Present only for products
   *  that define sell formats; the server re-prices the line by this format. */
  formatId?: string;
  /** MIM custom-printing personalization. `solo` = one design on all pieces;
   *  `names` = one text per piece (quantity equals names.length). */
  personalization?: {
    mode: 'solo' | 'names' | 'design';
    text?: string;
    names?: string[];
    /** MIM design editor: flattened preview image URL + structured recipe. */
    previewUrl?: string;
    spec?: unknown;
  };
  /** Anko (group/event) bulk line — priced at the anko rate; locks the fabric. */
  anko?: boolean;
  quantity: number;
  // display cache (server re-prices everything)
  name: string;
  image: string | null;
  unitName: string;
  slug: string;
  minQty: number;
  increment: number;
  maxAvailable?: number;
}

interface CartState {
  lines: CartLine[];
  code: string | null;
  add: (line: CartLine) => void;
  updateQty: (key: string, quantity: number) => void;
  /** Replace a line (found by its current key) — for editing personalization,
   *  e.g. removing/duplicating a piece of a MIM team design. Dropped if qty ≤ 0. */
  updateLine: (key: string, updater: (line: CartLine) => CartLine) => void;
  remove: (key: string) => void;
  setCode: (code: string | null) => void;
  clear: () => void;
  count: number;
}

const CartContext = createContext<CartState>({
  lines: [], code: null, add: () => {}, updateQty: () => {}, updateLine: () => {}, remove: () => {}, setCode: () => {}, clear: () => {}, count: 0,
});

const STORAGE_KEY = 'zahrah_cart_v1';

export function lineKey(line: { variantId?: string; bundleProductId?: string; formatId?: string; personalization?: unknown; anko?: boolean }) {
  const base = line.variantId ?? `bundle:${line.bundleProductId}`;
  const fmt = line.formatId ? `#${line.formatId}` : '';
  // Personalized lines never merge with each other (each carries its own text).
  const per = line.personalization ? `@${JSON.stringify(line.personalization)}` : '';
  const anko = line.anko ? '@anko' : ''; // an anko line is distinct from a normal one
  return base + fmt + per + anko;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [code, setCodeState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { lines: CartLine[]; code: string | null; at: number };
        // 30-day soft expiry (FR-SF-CRT-01)
        if (Date.now() - parsed.at < 30 * 86_400_000) {
          setLines(parsed.lines);
          setCodeState(parsed.code);
        }
      }
    } catch { /* fresh cart */ }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, code, at: Date.now() }));
  }, [lines, code, loaded]);

  const add = useCallback((line: CartLine) => {
    setLines((prev) => {
      const key = lineKey(line);
      const existing = prev.find((l) => lineKey(l) === key);
      if (existing) {
        return prev.map((l) => (lineKey(l) === key ? { ...l, quantity: l.quantity + line.quantity } : l));
      }
      return [...prev, line];
    });
  }, []);

  const updateQty = useCallback((key: string, quantity: number) => {
    setLines((prev) => prev.map((l) => (lineKey(l) === key ? { ...l, quantity } : l)).filter((l) => l.quantity > 0));
  }, []);

  const updateLine = useCallback((key: string, updater: (line: CartLine) => CartLine) => {
    setLines((prev) => prev.flatMap((l) => {
      if (lineKey(l) !== key) return [l];
      const next = updater(l);
      return next.quantity > 0 ? [next] : [];
    }));
  }, []);

  const remove = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => lineKey(l) !== key));
  }, []);

  const setCode = useCallback((c: string | null) => setCodeState(c), []);
  const clear = useCallback(() => { setLines([]); setCodeState(null); }, []);

  return (
    <CartContext.Provider value={{ lines, code, add, updateQty, updateLine, remove, setCode, clear, count: lines.length }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
