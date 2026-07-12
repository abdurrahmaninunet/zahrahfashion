'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { ProductCardData } from '@/components/product-card';
import { ProductTile } from '@/components/product-tile';
import { fromProduct, type LoveItem } from './more-to-love-data';

/** Scroll-triggered auto-loads before the feed switches to a manual button. */
const AUTO_LOADS = 3;

interface PlpPage {
  products: ProductCardData[];
  total: number;
  pageSize: number;
}

/**
 * Client feed: renders the initial grid (SSR'd), then auto-loads the next
 * pages as the sentinel scrolls into view — AUTO_LOADS times — before handing
 * off to a "View more" button for every subsequent page.
 */
export function MoreToLoveFeed({
  initialItems,
  total,
  pageSize,
}: {
  initialItems: LoveItem[];
  total: number;
  pageSize: number;
}) {
  const [items, setItems] = useState<LoveItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [autoLoads, setAutoLoads] = useState(0);
  const [done, setDone] = useState<boolean>(() => total > 0 && initialItems.length >= total);
  const pageRef = useRef(1);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const hasMore = !done;

  const loadMore = useCallback(async () => {
    setLoading(true);
    const next = pageRef.current + 1;
    try {
      const data = await api.get<PlpPage>(`/store/plp?page=${next}`);
      pageRef.current = next;
      const mapped = data.products.map(fromProduct);
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...mapped.filter((m) => !seen.has(m.id))];
      });
      const size = data.pageSize || pageSize || data.products.length;
      if (!data.products.length || (data.total && next * size >= data.total)) {
        setDone(true);
      }
    } catch {
      setDone(true); // stop trying on error — never spin forever
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  // Auto-load while the sentinel is visible, up to AUTO_LOADS times. Re-creating
  // the observer when loading settles lets it re-fire if the user is parked at
  // the bottom, and the AUTO_LOADS guard hands off to the button afterwards.
  useEffect(() => {
    if (autoLoads >= AUTO_LOADS || !hasMore || loading) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setAutoLoads((n) => n + 1);
          loadMore();
        }
      },
      { rootMargin: '300px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [autoLoads, hasMore, loading, loadMore]);

  const inAutoPhase = hasMore && autoLoads < AUTO_LOADS;
  const showButton = hasMore && autoLoads >= AUTO_LOADS;

  return (
    <>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.map((item, i) => (
          <ProductTile
            key={`${item.id}:${i}`}
            item={{
              id: item.id,
              name: item.name,
              href: `/p/${item.slug}`,
              image: item.image,
              bg: item.bg,
              price: item.price,
              compareAt: item.compareAt,
              badge: item.badge,
              savings: item.savings,
              onlyLeft: item.onlyLeft,
              rating: item.rating,
              reviews: item.reviews,
              sold: item.sold,
              soldOut: item.soldOut,
              variantId: item.variantId ?? null,
              unitName: item.unitName,
            }}
          />
        ))}
      </div>

      {inAutoPhase && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          <Dots />
        </div>
      )}

      {showButton && (
        <div className="flex justify-center py-8">
          {loading ? (
            <Dots />
          ) : (
            <button
              type="button"
              onClick={loadMore}
              className="border border-stone-300 px-8 py-3 text-sm font-semibold uppercase tracking-wide text-stone-800 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-white"
            >
              View more
            </button>
          )}
        </div>
      )}
    </>
  );
}

function Dots() {
  return (
    <span className="flex items-center gap-1.5" role="status" aria-label="Loading more products">
      <span className="h-2.5 w-2.5 rounded-full bg-stone-400 [animation-delay:-0.3s] animate-bounce" />
      <span className="h-2.5 w-2.5 rounded-full bg-stone-400 [animation-delay:-0.15s] animate-bounce" />
      <span className="h-2.5 w-2.5 rounded-full bg-stone-400 animate-bounce" />
    </span>
  );
}

