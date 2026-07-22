'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, BellRing, Check, Copy, Facebook, Heart, Mail, Share2, ShoppingCart, Truck, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { naira } from '@/lib/format';
import { useCart } from '@/lib/cart';
import { ProductCard, ProductCardData } from '@/components/product-card';
import { useWishlistIds, toggleWishlist, clearWishlist, getWishlistSavedAt } from '@/lib/wishlist';

type Sort = 'recent' | 'price' | 'name';

/** Wishlist — saved items (device-local, and account-synced when signed in),
 *  hydrated with live card data: stock, price drops, save-dates, sharing,
 *  sorting/filtering, a price monitor and recommendations. */
export default function WishlistPage() {
  const ownIds = useWishlistIds();

  // Shared view — someone opened /wishlist?ids=a,b,c. Read once on the client
  // (avoids the useSearchParams Suspense requirement) and render read-only.
  const [sharedIds, setSharedIds] = useState<string[] | null>(null);
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('ids');
    setSharedIds(raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : null);
  }, []);
  const isShared = !!sharedIds?.length;
  const ids = isShared ? sharedIds! : ownIds;
  const idsKey = ids.join(',');

  const { add } = useCart();
  const alerts = useWishlistAlerts();
  const [note, setNote] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [sort, setSort] = useState<Sort>('recent');
  const [filter, setFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['wishlist', idsKey],
    queryFn: () => api.get<{ products: ProductCardData[] }>(`/store/products-by-ids?ids=${encodeURIComponent(idsKey)}`),
    enabled: ids.length > 0,
  });
  const products = useMemo(() => data?.products ?? [], [data]);

  // Filter chips — built from the categories actually present.
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) if (p.category) map.set(p.category.slug, p.category.name);
    return [...map.entries()].map(([slug, name]) => ({ slug, name }));
  }, [products]);

  const visible = useMemo(() => {
    let list = products;
    if (filter !== 'all') list = list.filter((p) => p.category?.slug === filter);
    const sorted = [...list];
    if (sort === 'price') sorted.sort((a, b) => a.price - b.price);
    else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else sorted.sort((a, b) => (getWishlistSavedAt(b.id) ?? 0) - (getWishlistSavedAt(a.id) ?? 0));
    return sorted;
  }, [products, filter, sort]);

  const estimatedTotal = products.reduce((sum, p) => sum + (p.soldOut ? 0 : p.price), 0);

  function addOne(p: ProductCardData) {
    if (!p.variantId) { setNote(`Open ${p.name} to choose options before adding.`); return; }
    add({ variantId: p.variantId, quantity: 1, name: p.name, image: p.image, unitName: p.unitName || 'piece', slug: p.slug, minQty: 1, increment: 1 });
    setNote(`Added ${p.name} to your cart.`);
  }

  // Add every item that can be added directly; the rest need options on the PDP.
  function moveAllToCart() {
    let added = 0;
    let needOptions = 0;
    for (const p of products) {
      if (p.soldOut) continue;
      if (p.variantId) {
        add({ variantId: p.variantId, quantity: 1, name: p.name, image: p.image, unitName: p.unitName || 'piece', slug: p.slug, minQty: 1, increment: 1 });
        added += 1;
      } else needOptions += 1;
    }
    setNote(
      added === 0
        ? 'These items need options — open each product to choose.'
        : `Moved ${added} item${added === 1 ? '' : 's'} to your cart${needOptions ? ` · ${needOptions} need options (open them to choose)` : ''}.`,
    );
  }

  if (ids.length === 0) {
    return (
      <div className="mx-auto max-w-[1905px] px-4 py-8 lg:px-[8rem]">
        <Header count={0} />
        <Empty />
        <Recommendations exclude={[]} heading="Popular right now" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1905px] px-4 py-8 lg:px-[8rem]">
      <Header count={products.length} />

      {isShared && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#c9a227]/40 bg-[#faf5e6] px-4 py-3 text-sm">
          <span className="font-medium text-stone-700">You&apos;re viewing a shared wishlist.</span>
          <Link href="/wishlist" className="font-semibold text-[#8a6d1f] hover:underline">Go to my wishlist →</Link>
        </div>
      )}

      {/* Summary + primary actions */}
      {products.length > 0 && (
        <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-stone-900">
              {products.length} {products.length === 1 ? 'Item' : 'Items'} Saved
              <span className="text-stone-400"> • </span>
              Estimated Total: <span className="text-stone-900">{naira(estimatedTotal)}</span>
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500">
              <Truck size={13} /> Complete your purchase today and enjoy fast nationwide delivery.
            </p>
          </div>
          {!isShared && (
            <div className="flex items-center gap-3">
              <button onClick={moveAllToCart} className="flex items-center gap-1.5 rounded-full bg-amber-400 px-4 py-2.5 text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-500 cursor-pointer">
                <ShoppingCart size={15} /> Move All Items to Cart
              </button>
              {confirmClear ? (
                <span className="flex items-center gap-2 text-sm">
                  <span className="text-stone-500">Clear all?</span>
                  <button onClick={() => { clearWishlist(); setConfirmClear(false); setNote(null); }} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer">Yes, clear</button>
                  <button onClick={() => setConfirmClear(false)} className="rounded-full border border-stone-300 px-3 py-1.5 text-xs text-stone-600 hover:border-stone-400 cursor-pointer">Cancel</button>
                </span>
              ) : (
                <button onClick={() => setConfirmClear(true)} className="rounded-full border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-900 cursor-pointer">
                  Clear Wishlist
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {note && <p className="mb-4 rounded-lg bg-stone-100 px-4 py-2.5 text-sm text-stone-700">{note}</p>}

      {!isShared && products.length > 0 && <ShareBar ids={ownIds} />}
      {!isShared && products.length > 0 && <PriceMonitor ids={ownIds} alerts={alerts} />}

      {/* Toolbar: filters + sort */}
      {products.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
            {categories.map((c) => (
              <Chip key={c.slug} active={filter === c.slug} onClick={() => setFilter(c.slug)}>{c.name}</Chip>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-500">
            Sort by:
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-medium text-stone-800 outline-none focus:border-stone-900 cursor-pointer">
              <option value="recent">Recently Added</option>
              <option value="price">Price: Low to High</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
      )}

      {isLoading ? (
        <p className="py-16 text-center text-sm text-stone-400">Loading your saved items…</p>
      ) : products.length === 0 ? (
        <Empty note="Your saved items are no longer available." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visible.map((p) => (
            <WishlistCard key={p.id} product={p} savedAt={getWishlistSavedAt(p.id)} alerts={alerts} onAdd={() => addOne(p)} onRemove={isShared ? undefined : () => toggleWishlist(p.id)} />
          ))}
        </div>
      )}

      <Recommendations exclude={ids} heading="You may also like" />
    </div>
  );
}

function Header({ count }: { count: number }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-2xl font-bold md:text-3xl">My Wishlist{count > 0 && <span className="ml-2 text-base font-normal text-stone-400">({count} {count === 1 ? 'item' : 'items'})</span>}</h1>
      <p className="mt-1 text-sm text-stone-500">Your favourite fabrics, ready whenever you&apos;re ready to shop.</p>
    </div>
  );
}

/** Rich wishlist card with a prominent image, stock, price-drop + save-date. */
function WishlistCard({ product: p, savedAt, alerts, onAdd, onRemove }: {
  product: ProductCardData;
  savedAt?: number;
  alerts: AlertsApi;
  onAdd: () => void;
  onRemove?: () => void;
}) {
  const [localAlerted, setLocalAlerted] = useState(false);
  const dropped = p.compareAt != null && p.compareAt > p.price;
  const savings = p.savings ?? (dropped ? p.compareAt! - p.price : 0);

  useEffect(() => { setLocalAlerted(hasStockAlert(p.id)); }, [p.id]);
  const alerted = alerts.signedIn ? alerts.getStock(p.id) : localAlerted;
  async function toggleAlert() {
    if (alerts.signedIn) await alerts.persist([p.id], { notifyStock: !alerted });
    else { toggleStockAlert(p.id); setLocalAlerted((v) => !v); }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="relative aspect-[3/4] bg-stone-100">
        <Link href={`/p/${p.slug}`}>
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt={p.imageAlt || p.name} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-stone-300"><Heart size={32} /></span>
          )}
        </Link>
        {dropped && <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">Save {naira(savings)}</span>}
        {onRemove && (
          <button onClick={onRemove} aria-label="Remove from wishlist" title="Remove"
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-stone-500 shadow-sm transition-colors hover:text-red-600 cursor-pointer">
            <X size={15} />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <StockLine soldOut={p.soldOut} onlyLeft={p.onlyLeft} />
        <Link href={`/p/${p.slug}`} className="mt-1 line-clamp-2 text-sm font-medium text-stone-800 hover:text-stone-950">{p.name}</Link>

        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-base font-bold text-stone-900">{naira(p.price)}</span>
          {dropped && <span className="text-xs text-stone-400 line-through">{naira(p.compareAt!)}</span>}
        </div>
        {dropped && <p className="mt-0.5 text-[11px] font-medium text-emerald-600">Price dropped from {naira(p.compareAt!)} to {naira(p.price)}</p>}

        {savedAt && <p className="mt-1 text-[11px] text-stone-400">Saved on {new Date(savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}

        <div className="mt-2.5">
          {p.soldOut ? (
            <button
              onClick={toggleAlert}
              className={`flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${alerted ? 'bg-emerald-50 text-emerald-700' : 'border border-stone-300 text-stone-600 hover:border-stone-400'}`}
            >
              {alerted ? <><BellRing size={14} /> We&apos;ll notify you</> : <><Bell size={14} /> Notify me when back in stock</>}
            </button>
          ) : p.variantId ? (
            <button onClick={onAdd} className="flex w-full items-center justify-center gap-1.5 rounded-full bg-stone-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-stone-700 cursor-pointer">
              <ShoppingCart size={14} /> Add to cart
            </button>
          ) : (
            <Link href={`/p/${p.slug}`} className="flex w-full items-center justify-center gap-1.5 rounded-full border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 transition-colors hover:border-stone-400">
              Choose options
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function StockLine({ soldOut, onlyLeft }: { soldOut: boolean; onlyLeft: number | null }) {
  if (soldOut) return <span className="text-[11px] font-semibold text-red-600">Sold out</span>;
  if (onlyLeft != null) return <span className="text-[11px] font-semibold text-amber-600">Only {onlyLeft} left</span>;
  return <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><Check size={12} /> In stock</span>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer ${active ? 'bg-stone-900 text-white' : 'border border-stone-300 text-stone-600 hover:border-stone-400'}`}>
      {children}
    </button>
  );
}

/** Share the current wishlist as a link (Copy / WhatsApp / Facebook / Email). */
function ShareBar({ ids }: { ids: string[] }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');
  useEffect(() => {
    setUrl(`${window.location.origin}/wishlist?ids=${encodeURIComponent(ids.join(','))}`);
  }, [ids]);

  const text = 'Check out my Zahrah Fashion Hub wishlist';
  const wa = `https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const mail = `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(`${text}: ${url}`)}`;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3">
      <span className="mr-1 flex items-center gap-1.5 text-sm font-semibold text-stone-700"><Share2 size={15} /> Share Wishlist</span>
      <button
        onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } }}
        className="flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-400 cursor-pointer"
      >
        {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy Link</>}
      </button>
      <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-400 !no-underline">
        <ShoppingCart size={13} className="hidden" /> WhatsApp
      </a>
      <a href={fb} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-400 !no-underline">
        <Facebook size={13} /> Facebook
      </a>
      <a href={mail} className="flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-stone-400 !no-underline">
        <Mail size={13} /> Email
      </a>
    </div>
  );
}

interface AlertsApi {
  signedIn: boolean;
  getStock: (id: string) => boolean;
  allPrice: (ids: string[]) => boolean;
  allStock: (ids: string[]) => boolean;
  persist: (ids: string[], patch: { notifyPrice?: boolean; notifyStock?: boolean }) => Promise<void>;
}

/** Reads/writes the customer's server-side wishlist alert opt-ins. For guests
 *  the query 401s → signedIn is false and the UI falls back to local prefs. */
function useWishlistAlerts(): AlertsApi {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['wishlist-alerts'],
    queryFn: () => api.get<{ items: { productId: string; notifyPrice: boolean; notifyStock: boolean }[] }>('/store/account/wishlist-alerts'),
    retry: false,
    staleTime: 60_000,
  });
  const map = new Map((q.data?.items ?? []).map((i) => [i.productId, i]));
  return {
    signedIn: q.isSuccess,
    getStock: (id) => !!map.get(id)?.notifyStock,
    allPrice: (ids) => ids.length > 0 && ids.every((id) => map.get(id)?.notifyPrice),
    allStock: (ids) => ids.length > 0 && ids.every((id) => map.get(id)?.notifyStock),
    persist: async (ids, patch) => {
      if (!ids.length) return;
      await api.post('/store/account/wishlist-alerts', { productIds: ids, ...patch });
      qc.invalidateQueries({ queryKey: ['wishlist-alerts'] });
    },
  };
}

/** Price / back-in-stock monitor. When signed in, opt-ins persist to the server
 *  and the hourly job emails on a drop or restock; guests get local-only prefs
 *  with a nudge to sign in for email alerts. */
function PriceMonitor({ ids, alerts }: { ids: string[]; alerts: AlertsApi }) {
  const [localPrefs, setLocalPrefs] = useState({ price: false, stock: false });
  useEffect(() => { setLocalPrefs(loadMonitorPrefs()); }, []);
  const signedIn = alerts.signedIn;
  const price = signedIn ? alerts.allPrice(ids) : localPrefs.price;
  const stock = signedIn ? alerts.allStock(ids) : localPrefs.stock;

  async function set(kind: 'price' | 'stock', on: boolean) {
    if (signedIn) await alerts.persist(ids, kind === 'price' ? { notifyPrice: on } : { notifyStock: on });
    else { const next = { ...localPrefs, [kind]: on }; setLocalPrefs(next); saveMonitorPrefs(next); }
  }

  return (
    <div className="mb-5 rounded-xl border border-stone-200 bg-white p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-900"><Bell size={15} className="text-[#8a6d1f]" /> Wishlist Price Monitor</p>
      <p className="mt-0.5 text-xs text-stone-500">We&apos;ll notify you when a price drops or when an item is almost sold out.</p>
      <div className="mt-3 space-y-2">
        <label className="flex items-center gap-2.5 text-sm text-stone-700 cursor-pointer">
          <input type="checkbox" checked={price} onChange={(e) => set('price', e.target.checked)} className="h-4 w-4 accent-stone-900" />
          Notify me of price changes
        </label>
        <label className="flex items-center gap-2.5 text-sm text-stone-700 cursor-pointer">
          <input type="checkbox" checked={stock} onChange={(e) => set('stock', e.target.checked)} className="h-4 w-4 accent-stone-900" />
          Notify me when stock is running low
        </label>
      </div>
      {!signedIn && (
        <p className="mt-2.5 text-[11px] text-stone-400">
          <Link href="/account" className="font-medium text-[#8a6d1f] hover:underline">Sign in</Link> to receive these alerts by email.
        </p>
      )}
    </div>
  );
}

function Recommendations({ exclude, heading }: { exclude: string[]; heading: string }) {
  const { data } = useQuery({
    queryKey: ['wishlist-recs'],
    queryFn: () => api.get<{ products: ProductCardData[] }>('/store/new-arrivals'),
  });
  const excludeSet = new Set(exclude);
  const recs = (data?.products ?? []).filter((p) => !excludeSet.has(p.id)).slice(0, 6);
  if (!recs.length) return null;
  return (
    <section className="mt-12">
      <h2 className="mb-3 font-display text-lg font-bold">{heading}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {recs.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

function Empty({ note }: { note?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-400">
        <Heart size={28} />
      </span>
      <p className="mt-4 text-lg font-semibold text-stone-800">{note ?? 'No saved items yet'}</p>
      <p className="mt-1 max-w-sm text-sm text-stone-500">Tap the heart on any product to save it here for later.</p>
      <Link href="/" className="mt-5 rounded-full bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-700">
        Start shopping
      </Link>
    </div>
  );
}

// ── Local preference helpers (device-local, best-effort) ──────────────────────

const STOCK_ALERT_KEY = 'zahrah_stock_alerts_v1';
const MONITOR_KEY = 'zahrah_price_monitor_v1';

function readSet(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]') as string[]); } catch { return new Set(); }
}
function hasStockAlert(id: string): boolean {
  return readSet(STOCK_ALERT_KEY).has(id);
}
function toggleStockAlert(id: string) {
  const set = readSet(STOCK_ALERT_KEY);
  if (set.has(id)) set.delete(id); else set.add(id);
  try { localStorage.setItem(STOCK_ALERT_KEY, JSON.stringify([...set])); } catch { /* best effort */ }
}
function loadMonitorPrefs(): { price: boolean; stock: boolean } {
  try { return { price: false, stock: false, ...(JSON.parse(localStorage.getItem(MONITOR_KEY) || '{}') as object) }; } catch { return { price: false, stock: false }; }
}
function saveMonitorPrefs(prefs: { price: boolean; stock: boolean }) {
  try { localStorage.setItem(MONITOR_KEY, JSON.stringify(prefs)); } catch { /* best effort */ }
}
