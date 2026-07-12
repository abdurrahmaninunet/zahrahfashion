import Link from 'next/link';
import { ProductTile, type ProductTileData } from '@/components/product-tile';

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  type: string;
  image: string | null;
  imageAlt: string;
  secondImage: string | null;
  price: number;
  compareAt: number | null;
  badge: string | null;
  savings: number | null;
  unitName: string;
  soldOut: boolean;
  onlyLeft: number | null;
  /** Live available stock — caps the add-to-cart stepper. */
  maxAvailable?: number;
  /** Real review rating — null when the product has no visible reviews. */
  rating: number | null;
  /** Number of visible reviews. */
  reviews: number;
  swatches: string[];
  /** Set only for simple single-variant products that can be added directly. */
  variantId?: string | null;
}

/** Maps a catalogue product onto the shared ProductTile so every product card
 *  across the store (search, category listings, rails) looks identical. */
export function toTile(product: ProductCardData, priority?: boolean, hrefBase = '/p'): ProductTileData {
  return {
    id: product.id,
    name: product.name,
    href: `${hrefBase}/${product.slug}`,
    image: product.image,
    price: product.price,
    compareAt: product.compareAt,
    badge: product.badge,
    savings: product.savings,
    onlyLeft: product.soldOut ? null : product.onlyLeft,
    soldOut: product.soldOut,
    variantId: product.variantId ?? null,
    unitName: product.unitName,
    maxAvailable: product.maxAvailable,
    rating: product.rating ?? undefined,
    reviews: product.reviews,
    priority,
  };
}

/** Product card — FR-SF-CAT-02. Now a thin wrapper over the shared ProductTile.
 *  `hrefBase` lets MIM cards point at /mim/shop/[slug] instead of /p/[slug]. */
export function ProductCard({ product, priority, hrefBase }: { product: ProductCardData; priority?: boolean; hrefBase?: string }) {
  return <ProductTile item={toTile(product, priority, hrefBase)} />;
}

export function ProductRail({ title, products, viewAllHref }: { title: string; products: ProductCardData[]; viewAllHref?: string }) {
  if (!products.length) return null; // empty rails self-skip
  return (
    <section className="mx-auto max-w-[1905px] px-4 lg:px-[8rem] py-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {viewAllHref && <Link href={viewAllHref} className="text-sm text-[#8a6d1f] hover:underline">View all →</Link>}
      </div>
      {/* 1.8 cards visible on mobile — the cut-off card invites the swipe (§3.4) */}
      <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-5 xl:grid-cols-6">
        {products.slice(0, 12).map((p) => (
          <div key={p.id} className="w-[54vw] shrink-0 snap-start md:w-auto">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
