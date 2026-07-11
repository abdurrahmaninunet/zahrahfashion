'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronRight, Minus, Plus, ShoppingCart, Trash2, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { naira } from '@/lib/format';
import type { ProductCardData } from '@/components/product-card';

/** MIM team / bulk order builder — pick a blank, set how many, and type a name
 *  for each piece. One order line = N individually-personalised items. */
export default function MimTeamPage() {
  const cart = useCart();
  const { data } = useQuery({
    queryKey: ['mim-products'],
    queryFn: () => api.get<{ products: ProductCardData[] }>('/store/plp?store=mim'),
  });
  const { data: ctx } = useQuery({
    queryKey: ['store-context-mim'],
    queryFn: () => api.get<{ mimEnabled?: boolean }>('/store/context'),
  });
  const products = data?.products ?? [];

  const [productId, setProductId] = useState('');
  // Preselect from ?product=slug (e.g. arriving from a MIM product page).
  const wantedSlug = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('product') : null;
  const product = products.find((p) => p.id === productId)
    ?? (wantedSlug ? products.find((p) => p.slug === wantedSlug) : undefined)
    ?? products[0] ?? null;

  const [names, setNames] = useState<string[]>(['', '', '']);
  const [added, setAdded] = useState(false);

  const validNames = useMemo(() => names.map((n) => n.trim()).filter(Boolean), [names]);
  const unitPrice = product?.price ?? 0;
  const total = validNames.length * unitPrice;

  const setCount = (n: number) => {
    const size = Math.max(1, Math.min(200, n));
    setNames((prev) => {
      const next = [...prev];
      while (next.length < size) next.push('');
      return next.slice(0, size);
    });
    setAdded(false);
  };
  const setName = (i: number, v: string) => { setNames((prev) => prev.map((n, j) => (j === i ? v : n))); setAdded(false); };
  const removeRow = (i: number) => setNames((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev));

  function addToCart() {
    if (!product?.variantId || !validNames.length) return;
    cart.add({
      variantId: product.variantId,
      quantity: validNames.length,
      personalization: { mode: 'names', names: validNames },
      name: `${product.name} (team of ${validNames.length})`,
      image: product.image,
      unitName: 'piece',
      slug: product.slug,
      minQty: 1,
      increment: 1,
    });
    setAdded(true);
  }

  const canAdd = !!product?.variantId && validNames.length > 0;

  // MIM store switched off — don't let the team builder be used via a direct link.
  if (ctx && ctx.mimEnabled === false) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold">MIM is currently unavailable</h1>
        <p className="mt-2 text-sm text-stone-500">Our custom-printing store is taking a short break. Please check back soon.</p>
        <Link href="/" className="mt-4 inline-block rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-800">Back to shop</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <nav className="flex items-center gap-1.5 text-xs text-stone-500">
        <Link href="/mim" className="hover:text-stone-800 hover:underline">MIM</Link>
        <ChevronRight size={13} className="text-stone-300" />
        <span className="text-stone-700">Team order</span>
      </nav>
      <h1 className="mt-2 flex items-center gap-2 font-display text-3xl font-bold"><Users size={26} /> Team order</h1>
      <p className="mt-1 text-sm text-stone-500">Kit out a whole squad — set how many, then type a name for each piece.</p>

      {/* Step 1 — pick a blank */}
      <section className="mt-6">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400">1. Choose a blank</label>
        {products.length ? (
          <select
            value={product?.id ?? ''}
            onChange={(e) => setProductId(e.target.value)}
            className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-900"
          >
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {naira(p.price)}</option>)}
          </select>
        ) : (
          <p className="rounded-md border border-dashed border-stone-300 bg-stone-50 px-3 py-3 text-sm text-stone-500">
            No MIM blanks yet — add products in the admin and tick <b>MIM product</b>. You can still build your list below.
          </p>
        )}
      </section>

      {/* Step 2 — quantity + names */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wide text-stone-400">2. Names ({validNames.length} of {names.length})</label>
          <div className="flex items-center rounded-full border border-stone-300 bg-white">
            <button type="button" aria-label="Fewer" onClick={() => setCount(names.length - 1)} className="flex h-8 w-9 items-center justify-center rounded-l-full hover:bg-stone-100 cursor-pointer"><Minus size={14} /></button>
            <input type="number" min={1} value={names.length} onChange={(e) => setCount(Number(e.target.value) || 1)}
              className="tabular w-14 border-x border-stone-200 py-1 text-center text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
            <button type="button" aria-label="More" onClick={() => setCount(names.length + 1)} className="flex h-8 w-9 items-center justify-center rounded-r-full hover:bg-stone-100 cursor-pointer"><Plus size={14} /></button>
          </div>
        </div>
        <div className="space-y-2">
          {names.map((n, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-7 shrink-0 text-right text-xs font-medium text-stone-400">{i + 1}.</span>
              <input
                value={n}
                onChange={(e) => setName(i, e.target.value)}
                placeholder={`Name / text for piece ${i + 1}`}
                className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-900"
              />
              <button type="button" aria-label={`Remove ${i + 1}`} onClick={() => removeRow(i)} disabled={names.length === 1}
                className="flex h-9 w-8 shrink-0 items-center justify-center text-stone-400 hover:text-red-600 disabled:opacity-30 cursor-pointer"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setCount(names.length + 1)} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#8a6d1f] hover:underline">
          <Plus size={14} /> Add another
        </button>
      </section>

      {/* Step 3 — total + add */}
      <section className="mt-8 rounded-xl border border-stone-200 bg-stone-50 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-stone-600">{validNames.length} {validNames.length === 1 ? 'piece' : 'pieces'}{product ? ` × ${naira(unitPrice)}` : ''}</span>
          <span className="tabular text-xl font-bold text-stone-900">{naira(total)}</span>
        </div>
        <button
          type="button"
          onClick={addToCart}
          disabled={!canAdd}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-stone-950 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-50 cursor-pointer"
        >
          {added ? <><Check size={17} /> Added {validNames.length} to cart</> : <><ShoppingCart size={17} /> Add {validNames.length || ''} to cart</>}
        </button>
        {!product?.variantId && products.length > 0 && (
          <p className="mt-2 text-center text-[11px] text-stone-400">This blank needs options chosen on its page before a team order.</p>
        )}
        {added && <Link href="/cart" className="mt-2 block text-center text-sm text-[#8a6d1f] hover:underline">Go to cart →</Link>}
      </section>
    </div>
  );
}
