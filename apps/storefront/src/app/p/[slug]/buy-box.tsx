'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Copy, Facebook, Heart, Mail, MapPin, MessageCircle, Minus, Plus, RotateCcw, Share2, ShieldCheck, ShoppingCart, Star, Trash2, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { lineKey, useCart } from '@/lib/cart';
import { toggleWishlist, useWishlisted } from '@/lib/wishlist';
import { naira, qty, endsIn, whatsappLink } from '@/lib/format';

export interface PdpVariant {
  id: string; sku: string; optionValues: Record<string, string>;
  price: number; compareAt: number | null; badge: string | null; saleEndsAt: string | null;
  available: number; soldOut: boolean; onlyLeft: number | null;
}
export interface PdpProduct {
  id: string; slug: string; name: string; description: string | null; type: string;
  mimCustomizable?: boolean;
  mimPrintPrice?: number;
  mimPrintArea?: { x: number; y: number; width: number; height: number } | null;
  mimSides?: { id: string; label: string; image: string | null; printArea: { x: number; y: number; width: number; height: number } | null }[];
  category: { name: string; slug: string };
  media: { url: string; alt: string; type: string; variantId?: string | null }[];
  details: { name: string; value: unknown }[];
  unit: { name: string; fractional: boolean; minQty: number; increment: number };
  selectors: { code: string; name: string; inputType: string; options: { label: string; value: string; hexCode: string | null }[] }[];
  variants: PdpVariant[];
  bulkEligible: boolean;
  wholesale: { enabled: boolean; increment: number; unitPrice: number; note: string | null } | null;
  anko: { enabled: boolean; increment: number; unitPrice: number; exclusivityDays: number; note: string | null; lockedUntil: string | null } | null;
  sellFormats: { id: string; label: string; price: number; baseQty: number; minQty: number; increment: number; fractional: boolean; default: boolean }[];
  baseUnit: string | null;
  rating?: { average: number; count: number };
  bundle: {
    price: number; worth: number; savings: number; available: number;
    onlyLeft: number | null; soldOut: boolean;
    contents: { name: string; slug: string; image: string | null; quantity: number }[];
  } | null;
}

/** PDP buy box — Amazon-style two-pane layout: center details (title, price,
 *  variants, about) + right sticky buy-box card. All variant selection,
 *  unit-aware quantity and live-availability logic is preserved. */
export function BuyBox({ product, storeName, asideExtra }: {
  product: PdpProduct;
  storeName: string;
  /** Optional extra content rendered at the bottom of the buy-box card, given the
   *  live selected variant (used by the MIM store to add its personalise cards). */
  asideExtra?: (ctx: { variant: PdpVariant | null; soldOut: boolean }) => ReactNode;
}) {
  const { add, lines, updateQty, remove } = useCart();
  const router = useRouter();
  const wishlisted = useWishlisted(product.id);
  const [selection, setSelection] = useState<Record<string, string>>(() => {
    const first = product.variants.find((v) => !v.soldOut) ?? product.variants[0];
    return (first?.optionValues as Record<string, string>) ?? {};
  });
  // Sell formats (piece / yard / …) — when present they drive pricing and the
  // quantity granularity; the customer picks one and the line carries its id.
  const sellFormats = product.sellFormats ?? [];
  const hasFormats = sellFormats.length > 0;
  const [formatId, setFormatId] = useState<string | null>(
    () => sellFormats.find((f) => f.default)?.id ?? sellFormats[0]?.id ?? null,
  );
  const format = hasFormats ? sellFormats.find((f) => f.id === formatId) ?? sellFormats[0] : null;

  const [quantity, setQuantity] = useState(format ? format.minQty : product.unit.minQty);
  const [stockNote, setStockNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const variant = useMemo(() => {
    if (!product.variants.length) return null;
    if (!product.selectors.length) return product.variants[0];
    return product.variants.find((v) =>
      Object.entries(selection).every(([code, value]) => (v.optionValues as Record<string, string>)[code] === value),
    ) ?? null;
  }, [product, selection]);

  // Effective purchase params — from the chosen format, else the product's unit.
  const unitMin = format ? format.minQty : product.unit.minQty;
  const unitInc = format ? format.increment : product.unit.increment;
  const unitFractional = format ? format.fractional : product.unit.fractional;
  const unitLabel = format ? format.label : product.unit.name;

  const isBundle = !!product.bundle;
  const price = format ? format.price : isBundle ? product.bundle!.price : variant?.price ?? 0;
  const compareAt = isBundle ? product.bundle!.worth : variant?.compareAt ?? null;
  const soldOut = isBundle ? product.bundle!.soldOut : variant?.soldOut ?? true;
  const onlyLeft = isBundle ? product.bundle!.onlyLeft : variant?.onlyLeft ?? null;
  const saleEnds = !isBundle ? variant?.saleEndsAt : null;
  // Show a "× qty" line for measured formats/units, not whole-item ones.
  const perUnit = hasFormats ? (format ? format.fractional || format.baseQty !== 1 : false) : !['piece', 'package', 'set', 'pair'].includes(product.unit.name);
  const lineTotal = Math.round(price * quantity);
  const off = compareAt != null && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0;

  // How much of this exact line (variant + chosen format, or bundle) is in the
  // cart — drives the Amazon-style stepper that replaces "Add to cart" once added.
  const cartKey = isBundle
    ? lineKey({ bundleProductId: product.id })
    : variant ? lineKey({ variantId: variant.id, formatId: format?.id }) : '';
  const inCart = cartKey ? (lines.find((l) => lineKey(l) === cartKey)?.quantity ?? 0) : 0;
  const cartLineMax = cartKey ? lines.find((l) => lineKey(l) === cartKey)?.maxAvailable : undefined;
  const atMaxCart = cartLineMax != null && inCart >= cartLineMax;

  function decCart() {
    const next = Number((inCart - unitInc).toFixed(2));
    if (next < unitMin) remove(cartKey);
    else updateQty(cartKey, next);
  }
  function incCart() {
    if (atMaxCart) return;
    updateQty(cartKey, Number((inCart + unitInc).toFixed(2)));
  }

  function selectFormat(id: string) {
    const f = sellFormats.find((x) => x.id === id);
    if (!f) return;
    setFormatId(id);
    setQuantity(f.minQty);
    setStockNote(null);
  }

  // "About this item" — show BOTH the written description (from the admin) and
  // the structured spec bullets. Previously details suppressed the description.
  const descriptionParas = product.description
    ? product.description.split(/\n+/).map((s) => s.trim()).filter(Boolean)
    : [];
  const specBullets = product.details.slice(0, 8).map((d) => `${d.name}: ${String(d.value)}`);
  const hasAbout = descriptionParas.length > 0 || specBullets.length > 0;

  function snapQuantity(raw: number): number {
    let value = Math.max(unitMin, raw);
    if (!unitFractional) value = Math.round(value);
    else value = Math.round(value / unitInc) * unitInc;
    return Math.max(unitMin, Number(value.toFixed(2)));
  }

  /** Core add — runs the live availability check, returns whether it succeeded.
   *  `qtyOverride` lets the wholesale panel add its own (larger) quantity. */
  async function doAdd(qtyOverride?: number): Promise<boolean> {
    if (soldOut || busy || (!isBundle && !variant)) return false;
    const q = qtyOverride ?? quantity;
    setBusy(true);
    setStockNote(null);
    try {
      const check = await api.post<{ ok: boolean; lines: { available: number }[] }>('/store/availability', {
        lines: [isBundle ? { bundleProductId: product.id, quantity: q } : { variantId: variant!.id, formatId: format?.id, quantity: q }],
      });
      if (!check.ok) {
        const available = check.lines[0]?.available ?? 0;
        setStockNote(available > 0
          ? `Only ${qty(available)} ${perUnit ? unitLabel : ''} left — quantity adjusted`
          : 'This just sold out — sorry!');
        if (available > 0) setQuantity(snapQuantity(available));
        return false;
      }
      add({
        variantId: isBundle ? undefined : variant!.id,
        bundleProductId: isBundle ? product.id : undefined,
        formatId: format?.id,
        quantity: q,
        name: product.name
          + (variant && Object.values(variant.optionValues).length ? ` — ${Object.values(variant.optionValues).join(' / ')}` : '')
          + (format ? ` — ${format.label}` : ''),
        image: product.media[0]?.url ?? null,
        unitName: unitLabel,
        slug: product.slug,
        minQty: unitMin,
        increment: unitInc,
        // Cap the stepper at what's actually in stock (in this line's own units).
        maxAvailable: typeof check.lines[0]?.available === 'number' ? check.lines[0].available : undefined,
      });
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function handleBuyNow() {
    if (inCart > 0) { router.push('/checkout'); return; }
    if (await doAdd()) router.push('/checkout');
  }

  const stockLabel = soldOut
    ? { text: 'Currently unavailable', cls: 'text-red-600' }
    : onlyLeft != null
      ? { text: `Only ${qty(onlyLeft)} ${perUnit ? product.unit.name : ''} left in stock`, cls: 'text-amber-600' }
      : { text: 'In stock', cls: 'text-emerald-700' };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-8">
      {/* ── CENTER: title · rating · price · variants · about ──────────── */}
      <div className="min-w-0">
        <Link href={`/c/${product.category.slug}`} className="text-[13px] font-medium text-[#8a6d1f] hover:text-[#6f571a] hover:underline">
          {product.category.name}
        </Link>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold leading-snug text-stone-900 md:text-[28px]">{product.name}</h1>
          <div className="mt-0.5 flex shrink-0 items-center gap-2">
            <ShareMenu name={product.name} slug={product.slug} />
            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
              aria-pressed={wishlisted}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition-colors hover:border-stone-400 hover:bg-stone-50 cursor-pointer"
            >
              <Heart size={18} className={wishlisted ? 'fill-rose-500 text-rose-500' : ''} />
            </button>
          </div>
        </div>

        {/* Rating row — real aggregate; honest empty state when there are none. */}
        <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800">
          <Stars value={product.rating?.average ?? 0} />
          {product.rating && product.rating.count > 0 ? (
            <>
              <span className="font-medium text-stone-700">{product.rating.average.toFixed(1)}</span>
              <span className="text-[#8a6d1f] hover:underline">{product.rating.count} review{product.rating.count === 1 ? '' : 's'}</span>
            </>
          ) : (
            <>
              <span>No ratings yet</span>
              <span className="text-stone-300">·</span>
              <span className="text-[#8a6d1f] hover:underline">Write a review</span>
            </>
          )}
        </a>

        <hr className="my-4 border-stone-200" />

        {/* Price */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {off > 0 && <span className="text-2xl font-light text-red-600">-{off}%</span>}
          <span className="tabular text-3xl font-semibold text-stone-900">{naira(price)}</span>
          {perUnit && <span className="text-sm text-stone-500">per {product.unit.name}</span>}
          {!isBundle && variant?.badge && (
            <span className="rounded bg-[#8a6d1f] px-2 py-0.5 text-xs font-bold text-white">{variant.badge}</span>
          )}
        </div>
        {compareAt != null && compareAt > price && (
          <p className="mt-0.5 text-xs text-stone-500">
            List Price: <span className="line-through">{naira(compareAt)}</span>
          </p>
        )}
        {saleEnds && endsIn(saleEnds) && <p className="mt-1 text-xs font-medium text-amber-600">Sale ends in {endsIn(saleEnds)}</p>}
        {isBundle && product.bundle!.savings > 0 && (
          <p className="mt-1 inline-block rounded bg-[#faf5e6] px-2 py-0.5 text-sm font-semibold text-[#6f571a]">
            You save {naira(product.bundle!.savings)} — worth {naira(product.bundle!.worth)}
          </p>
        )}

        {/* Variant selectors */}
        {product.selectors.map((selector) => (
          <div key={selector.code} className="mt-5">
            <p className="mb-1.5 text-sm">
              <span className="font-semibold text-stone-900">{selector.name}:</span>{' '}
              <span className="text-stone-600">{selector.options.find((o) => o.value === selection[selector.code])?.label ?? '—'}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {selector.options.map((option) => {
                const wouldSelect = { ...selection, [selector.code]: option.value };
                const matching = product.variants.find((v) =>
                  Object.entries(wouldSelect).every(([c, val]) => (v.optionValues as Record<string, string>)[c] === val),
                );
                const active = selection[selector.code] === option.value;
                const unavailable = !matching || matching.soldOut;
                if (selector.inputType === 'color' && option.hexCode) {
                  return (
                    <button key={option.value} title={option.label} aria-label={option.label}
                      onClick={() => setSelection(wouldSelect)}
                      className={`relative h-9 w-9 cursor-pointer rounded-full border-2 ${active ? 'border-[#8a6d1f] ring-2 ring-[#f3e8c8]' : 'border-stone-200'} ${unavailable ? 'opacity-40' : ''}`}
                      style={{ background: option.hexCode }}>
                      {unavailable && <span className="absolute inset-0 flex items-center justify-center text-white">/</span>}
                    </button>
                  );
                }
                return (
                  <button key={option.value} onClick={() => setSelection(wouldSelect)}
                    className={`cursor-pointer rounded-md border px-3.5 py-2 text-sm transition-colors ${active ? 'border-[#8a6d1f] bg-[#faf5e6] font-medium text-[#6f571a]' : 'border-stone-300 bg-white hover:border-stone-500'} ${unavailable ? 'text-stone-300 line-through' : 'text-stone-800'}`}>
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Bundle contents */}
        {isBundle && (
          <div className="mt-5 rounded-lg border border-stone-200 bg-white p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-400">What&apos;s inside</p>
            <ul className="space-y-2">
              {product.bundle!.contents.map((c, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className="media-box aspect-square w-10 rounded-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.image && <img src={c.image} alt="" loading="lazy" />}
                  </span>
                  <span>{c.quantity > 1 ? `${qty(c.quantity)}× ` : ''}{c.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* About this item */}
        {hasAbout && (
          <div className="mt-6">
            <h2 className="mb-2 text-base font-bold text-stone-900">About this item</h2>
            {descriptionParas.length > 0 && (
              <div className="space-y-2 text-sm leading-relaxed text-stone-600">
                {descriptionParas.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            )}
            {specBullets.length > 0 && (
              <ul className={`space-y-1.5 ${descriptionParas.length > 0 ? 'mt-3' : ''}`}>
                {specBullets.map((b, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-stone-600">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-stone-400" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ── RIGHT: buy-box card ───────────────────────────────────────── */}
      <aside className="h-fit rounded-lg border border-stone-300 p-4 lg:sticky lg:top-20">
        {/* Sell-format selector — how the shopper wants to buy (piece / yard / …) */}
        {hasFormats && (
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">Buy as</p>
            <div className="grid gap-1.5">
              {sellFormats.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => selectFormat(f.id)}
                  aria-pressed={format?.id === f.id}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm cursor-pointer ${
                    format?.id === f.id ? 'border-[#8a6d1f] bg-[#faf5e6] font-medium' : 'border-stone-200 bg-white hover:border-stone-400'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className="tabular font-semibold text-stone-900">{naira(f.price)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-baseline gap-2">
          <span className="tabular text-2xl font-semibold text-stone-900">{naira(price)}</span>
          {perUnit && <span className="text-sm text-stone-500">/ {unitLabel}</span>}
        </div>

        <p className="mt-3 flex items-start gap-1.5 text-sm text-stone-700">
          <Truck size={16} className="mt-0.5 shrink-0 text-stone-500" />
          <span>Ships across Nigeria</span>
        </p>

        <p className={`mt-3 text-lg font-medium ${stockLabel.cls}`}>{stockLabel.text}</p>

        {/* Quantity — hidden once the item is in the cart (the stepper below takes over) */}
        {!soldOut && inCart === 0 && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400">
              Quantity{perUnit ? ` (${unitLabel}s)` : ''}
            </label>
            <div className="flex items-center rounded-md border border-stone-300 bg-white">
              <button aria-label="Decrease" className="flex h-10 w-10 items-center justify-center text-stone-600 disabled:text-stone-300"
                disabled={quantity <= unitMin}
                onClick={() => setQuantity(snapQuantity(quantity - unitInc))}><Minus size={15} /></button>
              <input
                inputMode="decimal"
                value={qty(quantity)}
                onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) setQuantity(n); }}
                onBlur={() => setQuantity(snapQuantity(quantity))}
                className="h-10 w-full border-x border-stone-200 text-center text-sm font-semibold outline-none"
              />
              <button aria-label="Increase" className="flex h-10 w-10 items-center justify-center text-stone-600"
                onClick={() => setQuantity(snapQuantity(quantity + unitInc))}><Plus size={15} /></button>
            </div>
            {perUnit && (
              <p className="tabular mt-1.5 text-xs text-stone-500">{qty(quantity)} {unitLabel} × {naira(price)} = <b className="text-stone-800">{naira(lineTotal)}</b></p>
            )}
            {unitInc !== 1 && (
              <p className="mt-1 text-xs text-stone-400">Sold in steps of {qty(unitInc)} {unitLabel}s</p>
            )}
          </div>
        )}

        {stockNote && <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{stockNote}</p>}

        {/* CTAs — "Add to cart" becomes an in-cart quantity stepper once added */}
        <div className="mt-4 space-y-2">
          {inCart === 0 ? (
            <button
              onClick={() => doAdd()}
              disabled={soldOut || (!isBundle && !variant) || busy}
              className="h-11 w-full rounded-full bg-amber-400 text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Checking stock…' : 'Add to cart'}
            </button>
          ) : (
            <div className="flex h-11 w-full items-center justify-between rounded-full bg-amber-400 text-stone-900">
              <button
                type="button"
                onClick={decCart}
                aria-label={inCart <= unitMin ? 'Remove from cart' : 'Decrease quantity'}
                className="flex h-full w-12 items-center justify-center rounded-l-full transition-colors hover:bg-amber-500"
              >
                {inCart <= unitMin ? <Trash2 size={16} /> : <Minus size={16} />}
              </button>
              <span className="tabular text-sm font-semibold">{qty(inCart)} {perUnit ? `${unitLabel}s ` : ''}in cart</span>
              <button
                type="button"
                onClick={incCart}
                disabled={atMaxCart}
                aria-label="Increase quantity"
                title={atMaxCart ? 'No more in stock' : undefined}
                className="flex h-full w-12 items-center justify-center rounded-r-full transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={16} />
              </button>
            </div>
          )}
          <button
            onClick={handleBuyNow}
            disabled={soldOut || (!isBundle && !variant) || busy}
            className="h-11 w-full rounded-full bg-[#8a6d1f] text-sm font-semibold text-white transition-colors hover:bg-[#6f571a] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Buy now
          </button>
          {inCart > 0 && (
            <button onClick={() => router.push('/cart')} className="h-10 w-full rounded-full border border-stone-300 text-sm font-medium text-stone-700 hover:border-stone-500 cursor-pointer">
              View cart
            </button>
          )}
        </div>

        {/* Trust / fulfilment */}
        <dl className="mt-4 space-y-1.5 border-t border-stone-100 pt-4 text-xs text-stone-500">
          <div className="flex gap-2"><ShieldCheck size={14} className="shrink-0 text-stone-400" /><span>Secure payment — Paystack (card, bank &amp; USSD)</span></div>
          <div className="flex gap-2"><RotateCcw size={14} className="shrink-0 text-stone-400" /><span><Link href="/pages/returns-policy" className="underline underline-offset-2 hover:text-stone-800">7-day returns</Link> on eligible items</span></div>
          <div className="flex gap-2"><MapPin size={14} className="shrink-0 text-stone-400" /><span>Ships from &amp; sold by <b className="text-stone-700">{storeName}</b></span></div>
        </dl>

        {/* WhatsApp handoff */}
        <WhatsAppPdp product={product} />

        {/* Wholesale offer — only shown when wholesale is enabled for this product */}
        {product.wholesale?.enabled && (
          <WholesaleElement
            wholesale={product.wholesale}
            unitName={product.unit.name}
            busy={busy}
            disabled={soldOut || !variant}
            onAdd={(wholesaleQty) => doAdd(wholesaleQty)}
          />
        )}

        {/* Anko — group/event bulk with exclusivity lock */}
        {product.anko?.enabled && variant && (
          <AnkoElement anko={product.anko} product={product} variant={variant} />
        )}

        {asideExtra?.({ variant, soldOut })}
      </aside>
    </div>
  );
}

function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={size} className={i < Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-stone-200 text-stone-200'} />
      ))}
    </span>
  );
}

/** Anko (group/event, aso-ebi) — the lowest bulk tier, with an exclusivity lock:
 *  buying reserves the fabric's bulk to the buyer for a set period. Blocked for
 *  others while locked (unless the viewer is the current holder). */
function AnkoElement({ anko, product, variant }: { anko: NonNullable<PdpProduct['anko']>; product: PdpProduct; variant: PdpVariant }) {
  const { add } = useCart();
  const step = anko.increment > 0 ? anko.increment : 1;
  const perUnit = Math.round(anko.unitPrice / step);
  const [q, setQ] = useState(step);
  const [added, setAdded] = useState(false);
  const [heldByMe, setHeldByMe] = useState(false);

  const locked = !!anko.lockedUntil;
  useEffect(() => {
    if (!locked) { setHeldByMe(false); return; }
    api.get<{ heldByMe: boolean }>(`/store/account/anko/mine?productId=${product.id}`).then((r) => setHeldByMe(r.heldByMe)).catch(() => setHeldByMe(false));
  }, [locked, product.id]);

  const blocked = locked && !heldByMe;
  const untilStr = anko.lockedUntil ? new Date(anko.lockedUntil).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const total = perUnit * q;

  function addAnko() {
    add({
      variantId: variant.id, anko: true, quantity: q,
      name: `${product.name} — Anko`, image: product.media[0]?.url ?? null,
      unitName: product.unit.name, slug: product.slug, minQty: step, increment: step,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div className="mt-3 rounded-lg border border-[#8a6d1f]/40 bg-[#faf5e6] p-4">
      <p className="text-sm font-semibold text-[#6f571a]">Anko — group / event (aso-ebi)</p>
      <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
        Our lowest bulk price for outfitting your people. Buying it makes this fabric <b>exclusively yours for {anko.exclusivityDays} days</b> — no one else can buy it in bulk in that time.
      </p>

      {blocked ? (
        <p className="mt-3 rounded-md bg-white/70 px-3 py-2 text-sm text-stone-600"><b>Currently taken.</b> This anko is exclusive to another buyer — available again on {untilStr}.</p>
      ) : (
        <>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-stone-600">Anko price</span>
            <span className="tabular font-semibold text-stone-900">{naira(anko.unitPrice)}<span className="font-normal text-stone-400"> per {qty(step)} {product.unit.name}s</span></span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-stone-600">Quantity ({product.unit.name}s)</span>
            <div className="flex items-center rounded-full border border-stone-300 bg-white">
              <button type="button" aria-label="Fewer" onClick={() => setQ((v) => Math.max(step, Number((v - step).toFixed(2))))} className="flex h-8 w-9 items-center justify-center rounded-l-full hover:bg-stone-100 cursor-pointer"><Minus size={14} /></button>
              <input type="number" min={step} step={step} value={q} onChange={(e) => setQ(Math.max(step, Number(e.target.value) || step))}
                className="tabular w-14 border-x border-stone-200 py-1 text-center text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              <button type="button" aria-label="More" onClick={() => setQ((v) => Number((v + step).toFixed(2)))} className="flex h-8 w-9 items-center justify-center rounded-r-full hover:bg-stone-100 cursor-pointer"><Plus size={14} /></button>
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between border-t border-[#8a6d1f]/20 pt-2">
            <span className="text-sm text-stone-600">{qty(q)} {product.unit.name}s</span>
            <span className="tabular text-lg font-bold text-stone-900">{naira(total)}</span>
          </div>
          <button type="button" onClick={addAnko}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#8a6d1f] text-sm font-semibold text-white hover:bg-[#75591a] cursor-pointer">
            {added ? <><Check size={16} /> Added to cart</> : <><ShoppingCart size={16} /> Add anko — {naira(total)}</>}
          </button>
          {heldByMe && <p className="mt-2 text-xs font-medium text-emerald-700">You currently hold this anko — you can keep topping up.</p>}
          {anko.note && <p className="mt-2 text-xs leading-relaxed text-stone-500">{anko.note}</p>}
        </>
      )}
    </div>
  );
}

function WhatsAppPdp({ product }: { product: PdpProduct }) {
  return (
    <button
      onClick={async () => {
        const context = await api.get<{ store: { whatsapp: string } }>('/store/context');
        if (!context.store.whatsapp) return;
        const message = `Hi! I'm interested in "${product.name}" — ${window.location.href}`;
        window.open(whatsappLink(context.store.whatsapp, message), '_blank');
      }}
      className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#25d366]/40 bg-[#25d366]/10 text-sm font-medium text-[#128c4b] hover:bg-[#25d366]/20 cursor-pointer"
    >
      <MessageCircle size={16} /> Ask about this on WhatsApp
    </button>
  );
}

/** Wholesale offer — expands to a quantity picker (stepped by the wholesale
 *  increment) at the wholesale unit price, with add-to-cart. Shown in place of
 *  the aso-ebi band when the product has wholesale enabled. */
function WholesaleElement({
  wholesale, unitName, busy, disabled, onAdd,
}: {
  wholesale: { increment: number; unitPrice: number; note: string | null };
  unitName: string;
  busy: boolean;
  disabled: boolean;
  onAdd: (qty: number) => Promise<boolean>;
}) {
  // The increment is both the minimum wholesale quantity and the step.
  const step = wholesale.increment > 0 ? wholesale.increment : 1;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(step);
  const [added, setAdded] = useState(false);

  // `unitPrice` is the price for one lot of `step` units — derive the per-unit
  // price so the total is (lots × lot price).
  const perUnit = wholesale.unitPrice / step;
  const total = Math.round(q * perUnit);

  async function addWholesale() {
    if (await onAdd(q)) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    }
  }

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-[#8a6d1f]/40 bg-[#faf5e6]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer hover:bg-[#f5edd6]"
      >
        <div>
          <p className="text-sm font-semibold text-[#6f571a]">Wholesale available for this product</p>
          <p className="text-xs text-stone-500">
            {naira(wholesale.unitPrice)} per {qty(step)} {unitName}s — tap to {open ? 'hide' : 'see'} details.
          </p>
        </div>
        <ChevronDown size={18} className={`shrink-0 text-[#8a6d1f] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-[#8a6d1f]/20 px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-600">Wholesale price</span>
            <span className="tabular font-semibold text-stone-900">{naira(wholesale.unitPrice)}<span className="font-normal text-stone-400"> per {qty(step)} {unitName}s</span></span>
          </div>

          {/* Quantity picker — steps by the wholesale increment */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-600">Quantity ({unitName}s)</span>
            <div className="flex items-center rounded-full border border-stone-300 bg-white">
              <button type="button" aria-label="Decrease quantity" onClick={() => setQ((v) => Math.max(step, Number((v - step).toFixed(2))))}
                className="flex h-8 w-9 items-center justify-center rounded-l-full hover:bg-stone-100 cursor-pointer">
                <Minus size={14} />
              </button>
              <input
                type="number" min={step} step={step} value={q}
                onChange={(e) => setQ(Math.max(step, Number(e.target.value) || step))}
                className="tabular w-14 border-x border-stone-200 py-1 text-center text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button type="button" aria-label="Increase quantity" onClick={() => setQ((v) => Number((v + step).toFixed(2)))}
                className="flex h-8 w-9 items-center justify-center rounded-r-full hover:bg-stone-100 cursor-pointer">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Total */}
          <div className="flex items-baseline justify-between border-t border-[#8a6d1f]/20 pt-2">
            <span className="text-sm text-stone-600">{qty(q)} {unitName}s ({qty(q / step)} × {naira(wholesale.unitPrice)})</span>
            <span className="tabular text-lg font-bold text-stone-900">{naira(total)}</span>
          </div>

          <button
            type="button"
            onClick={addWholesale}
            disabled={busy || disabled}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#8a6d1f] text-sm font-semibold text-white hover:bg-[#75591a] disabled:opacity-60 cursor-pointer"
          >
            {added ? <><Check size={16} /> Added to cart</> : <><ShoppingCart size={16} /> Add {qty(q)} {unitName}s to cart</>}
          </button>

          {wholesale.note && <p className="text-xs leading-relaxed text-stone-500">{wholesale.note}</p>}
        </div>
      )}
    </div>
  );
}

/** Share this product — native share sheet where available, otherwise a small
 *  Copy link / WhatsApp / Facebook / Email menu. */
function ShareMenu({ name, slug }: { name: string; slug: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setUrl(`${window.location.origin}/p/${slug}`); }, [slug]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    // Defer so the same click that opened the menu doesn't immediately close it.
    const t = setTimeout(() => document.addEventListener('click', onDoc), 0);
    return () => { clearTimeout(t); document.removeEventListener('click', onDoc); };
  }, [open]);

  const text = `Check out ${name} on Zahrah Fashion Hub`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const mail = `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(`${text}: ${url}`)}`;

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  const item = 'flex w-full items-center gap-2.5 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 !no-underline cursor-pointer';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Share this product"
        aria-haspopup="true"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition-colors hover:border-stone-400 hover:bg-stone-50 cursor-pointer"
      >
        <Share2 size={17} />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
          <button type="button" onClick={copy} className={item}>
            {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} className="text-stone-400" />}
            {copied ? 'Link copied' : 'Copy link'}
          </button>
          <a href={wa} target="_blank" rel="noopener noreferrer" className={item} onClick={() => setOpen(false)}>
            <MessageCircle size={15} className="text-emerald-600" /> WhatsApp
          </a>
          <a href={fb} target="_blank" rel="noopener noreferrer" className={item} onClick={() => setOpen(false)}>
            <Facebook size={15} className="text-blue-600" /> Facebook
          </a>
          <a href={mail} className={item} onClick={() => setOpen(false)}>
            <Mail size={15} className="text-stone-400" /> Email
          </a>
        </div>
      )}
    </div>
  );
}
