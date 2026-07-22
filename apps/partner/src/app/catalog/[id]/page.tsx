'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ChevronRight, Loader2, MapPin, Minus, Package, Plus, ShieldCheck, ShoppingCart, Truck } from 'lucide-react';
import { api } from '@/lib/api';
import { naira } from '@/lib/format';
import { useCart, setCartQty, setCartItem } from '@/lib/cart';
import { PortalHeader } from '@/components/portal-header';
import { OrderBar } from '@/components/order-bar';

interface Partner { id: string; email: string; name: string | null; businessName: string | null }
interface Style { id: string; image: string | null; label: string | null; stock: number }
interface Product { id: string; name: string; description: string | null; wholesalePrice: number; stock: number; image: string | null; hasStyles: boolean; styles: Style[] }

/** Storefront-style gallery: thumbnail rail + large object-contain main image. */
function Gallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  if (!images.length) {
    return <div className="flex h-[400px] items-center justify-center rounded-lg border border-stone-200 bg-stone-50 font-display text-6xl text-stone-200 sm:h-[460px] lg:h-[520px]">Z</div>;
  }
  return (
    <div className="flex min-w-0 flex-col-reverse gap-3 sm:flex-row sm:gap-4">
      {images.length > 1 && (
        <div className="flex flex-wrap gap-2 sm:w-14 sm:flex-col sm:flex-nowrap">
          {images.map((src, i) => (
            <button
              key={i}
              aria-label={`Image ${i + 1}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => setIndex(i)}
              className={`media-box aspect-square w-14 shrink-0 cursor-pointer rounded border transition-colors sm:w-full ${i === index ? 'border-[#8a6d1f] ring-1 ring-[#8a6d1f]' : 'border-stone-200 hover:border-stone-400'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <div className="relative h-[400px] w-full min-w-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-50 sm:h-[460px] sm:flex-1 lg:h-[520px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[index]} alt={name} className="h-full w-full object-contain" />
      </div>
    </div>
  );
}

export default function PartnerProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [partner, setPartner] = useState<Partner | null | undefined>(undefined);
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const { qtyOf } = useCart();

  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [autoQty, setAutoQty] = useState(1);
  const [styleQtys, setStyleQtys] = useState<Record<string, number>>({});
  const [added, setAdded] = useState(false);

  function loadProduct() {
    api.get<Product>(`/partnership/catalog/${id}`).then(setProduct).catch(() => setProduct(null));
  }
  useEffect(() => {
    api.get<{ partner: Partner | null }>('/partnership/me')
      .then((r) => { if (!r.partner) { router.replace('/'); return; } setPartner(r.partner); loadProduct(); })
      .catch(() => router.replace('/'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, id]);

  if (partner === undefined || product === undefined) {
    return <main className="flex min-h-screen items-center justify-center text-stone-400"><Loader2 className="animate-spin" /></main>;
  }

  if (product === null) {
    return (
      <main className="min-h-screen bg-canvas">
        <PortalHeader active="catalog" />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <p className="text-stone-500">This product is no longer available.</p>
          <Link href="/catalog" className="mt-4 inline-block rounded-full bg-stone-950 px-6 py-2.5 text-sm font-semibold text-white hover:bg-stone-800">Back to catalogue</Link>
        </div>
      </main>
    );
  }

  const images = (product.hasStyles ? product.styles.map((s) => s.image) : [product.image]).filter((x): x is string => !!x);
  const out = product.stock <= 0;
  const styleTotal = product.hasStyles ? (mode === 'auto' ? autoQty : Object.values(styleQtys).reduce((s, q) => s + (q || 0), 0)) : 0;

  function setStyleQty(styleId: string, qty: number, max: number) {
    setStyleQtys((s) => ({ ...s, [styleId]: Math.max(0, Math.min(Math.round(qty), max)) }));
  }
  function addStyled() {
    if (!product || styleTotal <= 0) return;
    setCartItem({
      productId: product.id, name: product.name, price: product.wholesalePrice, image: product.image,
      qty: styleTotal, stock: product.stock, styleMode: mode,
      styleQtys: mode === 'manual' ? Object.fromEntries(Object.entries(styleQtys).filter(([, q]) => q > 0)) : undefined,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  const simpleQty = qtyOf(product.id);
  const snap = { productId: product.id, name: product.name, price: product.wholesalePrice, image: product.image, stock: product.stock };

  return (
    <main className="min-h-screen bg-canvas pb-28">
      <PortalHeader active="catalog" />

      <div className="mx-auto max-w-[1905px] px-4 py-4 lg:px-[8rem]">
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-1.5 text-xs text-stone-500">
          <Link href="/catalog" className="hover:text-stone-800 hover:underline">Catalogue</Link>
          <ChevronRight size={13} className="text-stone-300" />
          <span className="truncate text-stone-700">{product.name}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,44%)_minmax(0,1fr)] lg:gap-8">
          <Gallery images={images} name={product.name} />

          {/* Buy box */}
          <div className="min-w-0 max-w-xl">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[#8a6d1f]">Wholesale</p>
            <h1 className="mt-1 text-2xl font-semibold leading-snug text-stone-900 md:text-[28px]">{product.name}</h1>

            <p className="mt-3 text-3xl font-bold text-stone-900">{naira(product.wholesalePrice)} <span className="text-sm font-normal text-stone-400">/ unit</span></p>
            <p className={`mt-1 text-sm font-medium ${out ? 'text-red-600' : product.stock <= 5 ? 'text-amber-600' : 'text-emerald-700'}`}>
              {out ? 'Currently unavailable' : `${product.stock} available${product.hasStyles ? ` · ${product.styles.length} styles` : ''}`}
            </p>

            <p className="mt-3 flex items-start gap-1.5 text-sm text-stone-700">
              <Truck size={16} className="mt-0.5 shrink-0 text-stone-500" /> <span>Ships across Nigeria</span>
            </p>

            {product.description && (
              <div className="mt-5 border-t border-stone-100 pt-4">
                <p className="text-sm font-semibold text-stone-800">About this item</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">{product.description}</p>
              </div>
            )}

            {/* Selection */}
            {product.hasStyles ? (
              <div className="mt-5 border-t border-stone-100 pt-4">
                <p className="text-sm font-semibold text-stone-800">Choose your styles</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => setMode('auto')} className={`rounded-xl border px-3 py-3 text-left text-sm transition-colors ${mode === 'auto' ? 'border-[#8a6d1f] bg-[#faf5e6]' : 'border-stone-300 hover:border-stone-500'}`}>
                    <span className="font-medium text-stone-900">Combine for me</span>
                    <span className="mt-0.5 block text-xs text-stone-500">We mix styles to your total.</span>
                  </button>
                  <button onClick={() => setMode('manual')} className={`rounded-xl border px-3 py-3 text-left text-sm transition-colors ${mode === 'manual' ? 'border-[#8a6d1f] bg-[#faf5e6]' : 'border-stone-300 hover:border-stone-500'}`}>
                    <span className="font-medium text-stone-900">Choose per style</span>
                    <span className="mt-0.5 block text-xs text-stone-500">Pick how many of each.</span>
                  </button>
                </div>

                {mode === 'auto' ? (
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex items-center rounded-full border border-stone-300">
                      <button onClick={() => setAutoQty((q) => Math.max(1, q - 1))} className="flex h-11 w-11 items-center justify-center text-stone-600 hover:text-stone-900"><Minus size={17} /></button>
                      <span className="w-12 text-center text-base font-semibold">{autoQty}</span>
                      <button onClick={() => setAutoQty((q) => Math.min(product.stock, q + 1))} disabled={autoQty >= product.stock} className="flex h-11 w-11 items-center justify-center text-stone-600 hover:text-stone-900 disabled:opacity-40"><Plus size={17} /></button>
                    </div>
                    <span className="text-sm text-stone-500">We&apos;ll combine styles to make up {autoQty}.</span>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {product.styles.map((st) => {
                      const q = styleQtys[st.id] ?? 0;
                      return (
                        <div key={st.id} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-2">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-stone-100 text-stone-300">
                            {st.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={st.image} alt={st.label ?? ''} className="h-full w-full object-cover" />
                            ) : <Package size={18} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-stone-800">{st.label || 'Style'}</p>
                            <p className="text-xs text-stone-400">{st.stock} available</p>
                          </div>
                          <div className="flex shrink-0 items-center rounded-full border border-stone-300">
                            <button onClick={() => setStyleQty(st.id, q - 1, st.stock)} className="flex h-9 w-9 items-center justify-center text-stone-600 hover:text-stone-900"><Minus size={14} /></button>
                            <span className="w-8 text-center text-sm font-semibold">{q}</span>
                            <button onClick={() => setStyleQty(st.id, q + 1, st.stock)} disabled={q >= st.stock} className="flex h-9 w-9 items-center justify-center text-stone-600 hover:text-stone-900 disabled:opacity-40"><Plus size={14} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button onClick={addStyled} disabled={styleTotal <= 0} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-stone-950 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-40">
                  {added ? <><Check size={16} /> Added — {styleTotal} pcs</> : <><ShoppingCart size={16} /> Add {styleTotal > 0 ? `${styleTotal} pcs` : ''} to order · {naira(product.wholesalePrice * styleTotal)}</>}
                </button>
              </div>
            ) : (
              <div className="mt-5">
                {simpleQty > 0 ? (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center rounded-full border border-stone-300">
                      <button onClick={() => setCartQty(snap, simpleQty - 1)} className="flex h-11 w-11 items-center justify-center text-stone-600 hover:text-stone-900"><Minus size={17} /></button>
                      <span className="w-10 text-center text-base font-semibold">{simpleQty}</span>
                      <button onClick={() => setCartQty(snap, simpleQty + 1)} disabled={simpleQty >= product.stock} className="flex h-11 w-11 items-center justify-center text-stone-600 hover:text-stone-900 disabled:opacity-40"><Plus size={17} /></button>
                    </div>
                    <span className="text-sm text-stone-500">In your order · {naira(product.wholesalePrice * simpleQty)}</span>
                  </div>
                ) : (
                  <button onClick={() => setCartQty(snap, 1)} disabled={out} className="flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-full bg-stone-950 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-40">
                    <ShoppingCart size={16} /> Add to order
                  </button>
                )}
              </div>
            )}

            {/* Trust / fulfilment */}
            <dl className="mt-5 space-y-1.5 border-t border-stone-100 pt-4 text-xs text-stone-500">
              <div className="flex gap-2"><ShieldCheck size={14} className="shrink-0 text-stone-400" /><span>Partner wholesale pricing — for resale only</span></div>
              <div className="flex gap-2"><Truck size={14} className="shrink-0 text-stone-400" /><span>Dispatched to you or your customers nationwide</span></div>
              <div className="flex gap-2"><MapPin size={14} className="shrink-0 text-stone-400" /><span>Sold by <b className="text-stone-700">ZAHRA FASHION HUB LIMITED</b></span></div>
            </dl>
          </div>
        </div>
      </div>

      <OrderBar />
    </main>
  );
}
