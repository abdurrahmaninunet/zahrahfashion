import type { ProductCardData } from '@/components/product-card';

/** Card shape for the "More to love" feed. Kept directive-free so both server
 *  and client can import. */
export interface LoveItem {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  price: number;
  compareAt: number | null;
  badge: string | null;
  savings: number | null;
  onlyLeft: number | null;
  rating?: number;
  reviews?: number;
  sold?: string;
  bg?: string;
  variantId?: string | null;
  unitName?: string;
  soldOut?: boolean;
}

export function fromProduct(p: ProductCardData): LoveItem {
  return {
    id: p.id, slug: p.slug, name: p.name, image: p.image,
    price: p.price, compareAt: p.compareAt, badge: p.badge,
    savings: p.savings, onlyLeft: p.soldOut ? null : p.onlyLeft,
    rating: p.rating ?? undefined, reviews: p.reviews,
    variantId: p.variantId ?? null, unitName: p.unitName, soldOut: p.soldOut,
  };
}
