'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Minus, Package, Plus, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/api';
import { naira } from '@/lib/format';
import { useCart, setCartQty } from '@/lib/cart';
import { PortalHeader } from '@/components/portal-header';
import { OrderBar } from '@/components/order-bar';

interface Partner { id: string; email: string; name: string | null; businessName: string | null }
interface Product { id: string; name: string; description: string | null; wholesalePrice: number; stock: number; image: string | null; hasStyles?: boolean }

export default function CatalogPage() {
  const router = useRouter();
  const [partner, setPartner] = useState<Partner | null | undefined>(undefined);
  const [products, setProducts] = useState<Product[]>([]);
  const { qtyOf } = useCart();

  function load() {
    api.get<Product[]>('/partnership/catalog').then(setProducts).catch(() => setProducts([]));
  }
  useEffect(() => {
    api.get<{ partner: Partner | null }>('/partnership/me')
      .then((r) => { if (!r.partner) { router.replace('/'); return; } setPartner(r.partner); load(); })
      .catch(() => router.replace('/'));
  }, [router]);

  if (partner === undefined) {
    return <main className="flex min-h-screen items-center justify-center text-stone-400"><Loader2 className="animate-spin" /></main>;
  }

  return (
    <main className="min-h-screen bg-canvas pb-28">
      <PortalHeader active="catalog" />

      <div className="mx-auto max-w-[1905px] px-4 py-8 lg:px-[8rem]">
        <h1 className="font-display text-2xl font-bold">Wholesale catalogue</h1>
        <p className="mt-1 text-sm text-stone-500">Partner pricing on every item. Tap a product for details, or add quantities and place your order.</p>

        {products.length ? (
          <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {products.map((p) => {
              const qty = qtyOf(p.id);
              const out = p.stock <= 0;
              const snap = { productId: p.id, name: p.name, price: p.wholesalePrice, image: p.image, stock: p.stock };
              return (
                <div key={p.id} className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white">
                  <Link href={`/catalog/${p.id}`} className="block">
                    <div className="aspect-[3/4] bg-stone-100">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-stone-300"><Package size={32} /></div>
                      )}
                    </div>
                  </Link>
                  <div className="flex flex-1 flex-col p-3">
                    <Link href={`/catalog/${p.id}`} className="line-clamp-2 text-sm font-medium text-stone-800 hover:text-stone-950">{p.name}</Link>
                    <p className="mt-1 text-base font-bold text-stone-900">{naira(p.wholesalePrice)}</p>
                    <p className="mt-0.5 text-xs text-stone-400">{out ? 'Out of stock' : `${p.stock} in stock`}</p>
                    <div className="mt-2.5">
                      {p.hasStyles ? (
                        <Link href={`/catalog/${p.id}`} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-stone-300 text-xs font-semibold text-stone-700 transition-colors hover:border-stone-400">
                          Choose styles
                        </Link>
                      ) : qty > 0 ? (
                        <div className="flex items-center justify-between rounded-full border border-stone-300">
                          <button onClick={() => setCartQty(snap, qty - 1)} className="flex h-9 w-9 items-center justify-center text-stone-600 hover:text-stone-900"><Minus size={15} /></button>
                          <span className="text-sm font-semibold">{qty}</span>
                          <button onClick={() => setCartQty(snap, qty + 1)} disabled={qty >= p.stock} className="flex h-9 w-9 items-center justify-center text-stone-600 hover:text-stone-900 disabled:opacity-40"><Plus size={15} /></button>
                        </div>
                      ) : (
                        <button onClick={() => setCartQty(snap, 1)} disabled={out} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-stone-950 text-xs font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-40">
                          <ShoppingCart size={14} /> Add
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-10 rounded-xl border border-dashed border-stone-300 bg-white py-16 text-center text-sm text-stone-400">
            No wholesale products available yet — check back soon.
          </p>
        )}
      </div>

      <OrderBar />
    </main>
  );
}
