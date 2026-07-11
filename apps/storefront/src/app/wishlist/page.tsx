'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Heart, ShoppingCart } from 'lucide-react';
import { api } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { ProductCard, ProductCardData } from '@/components/product-card';
import { useWishlistIds, clearWishlist } from '@/lib/wishlist';

/** Wishlist — saved items (device-local, and account-synced when signed in),
 *  hydrated with live card data. Removing a heart updates the store + re-fetches. */
export default function WishlistPage() {
  const ids = useWishlistIds();
  const idsKey = ids.join(',');
  const { add } = useCart();
  const [note, setNote] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['wishlist', idsKey],
    queryFn: () => api.get<{ products: ProductCardData[] }>(`/store/products-by-ids?ids=${encodeURIComponent(idsKey)}`),
    enabled: ids.length > 0,
  });
  const products = data?.products ?? [];

  // Add every item that can be added directly; the rest need options on the PDP.
  function addAllToCart() {
    let addedCount = 0;
    let needOptions = 0;
    for (const p of products) {
      if (p.variantId) {
        add({ variantId: p.variantId, quantity: 1, name: p.name, image: p.image, unitName: p.unitName || 'piece', slug: p.slug, minQty: 1, increment: 1 });
        addedCount += 1;
      } else {
        needOptions += 1;
      }
    }
    setNote(
      addedCount === 0
        ? 'These items need options — open each product to choose.'
        : `Added ${addedCount} item${addedCount === 1 ? '' : 's'} to your cart${needOptions ? ` · ${needOptions} need options (open them to choose)` : ''}.`,
    );
  }

  return (
    <div className="mx-auto max-w-[1905px] px-2.5 py-8 lg:px-[8rem]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">
          My wishlist{ids.length > 0 && <span className="ml-2 text-base font-normal text-stone-400">{ids.length} {ids.length === 1 ? 'item' : 'items'}</span>}
        </h1>
        {products.length > 0 && (
          <div className="flex items-center gap-4">
            <button onClick={addAllToCart} className="flex items-center gap-1.5 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-500 cursor-pointer">
              <ShoppingCart size={15} /> Add all to cart
            </button>
            <button onClick={clearWishlist} className="text-sm text-stone-400 transition-colors hover:text-stone-800 cursor-pointer">
              Clear all
            </button>
          </div>
        )}
      </div>
      {note && <p className="mb-4 rounded-lg bg-stone-100 px-4 py-2.5 text-sm text-stone-700">{note}</p>}

      {ids.length === 0 ? (
        <Empty />
      ) : isLoading ? (
        <p className="py-16 text-center text-sm text-stone-400">Loading your saved items…</p>
      ) : products.length === 0 ? (
        <Empty note="Your saved items are no longer available." />
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ note }: { note?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-400">
        <Heart size={28} />
      </span>
      <p className="mt-4 text-lg font-semibold text-stone-800">{note ?? 'No saved items yet'}</p>
      <p className="mt-1 max-w-sm text-sm text-stone-500">
        Tap the heart on any product to save it here for later.
      </p>
      <Link href="/" className="mt-5 rounded-full bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-700">
        Start shopping
      </Link>
    </div>
  );
}
