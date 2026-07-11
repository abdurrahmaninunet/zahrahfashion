'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ProductTile, type ProductTileData } from '@/components/product-tile';

/** Initial tiles shown, batch size per load, and scroll-triggered auto-loads
 *  before the feed hands off to a "View more" button — mirrors the home feed. */
const INITIAL = 6;
const BATCH = 6;
const AUTO_LOADS = 2;

/**
 * Progressive grid over a static list of tiles: shows an initial batch,
 * auto-loads more as the sentinel scrolls into view (AUTO_LOADS times), then
 * offers a "View more" button for the rest.
 */
export function TileFeed({ items }: { items: ProductTileData[] }) {
  const [shown, setShown] = useState(Math.min(INITIAL, items.length));
  const [autoLoads, setAutoLoads] = useState(0);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const hasMore = shown < items.length;

  const loadMore = useCallback(async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400)); // brief pause so the dots register
    setShown((s) => Math.min(s + BATCH, items.length));
    setLoading(false);
  }, [items.length]);

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
        {items.slice(0, shown).map((item) => (
          <ProductTile key={item.id} item={item} />
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
