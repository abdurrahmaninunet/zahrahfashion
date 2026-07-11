import type { ProductCardData } from '@/components/product-card';

/** Card shape for the "More to love" feed. Real catalogue products carry no
 *  rating/sold data, so those (and the gradient fallback) only appear on the
 *  illustrative set. Kept directive-free so both server and client can import. */
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
    variantId: p.variantId ?? null, unitName: p.unitName, soldOut: p.soldOut,
  };
}

// Illustrative feed shown when the live catalogue is unavailable/empty. Prices in kobo.
export const FALLBACK: LoveItem[] = [
  { id: 'f1', slug: 'swiss-voile-lace-2yards', name: 'Swiss Voile Lace — 2¾ Yards, Wine', image: null, price: 1_495_570, compareAt: 3_893_090, badge: 'NEW', savings: 239_752, onlyLeft: null, rating: 4.4, sold: '3,000+ sold', bg: 'from-rose-100 to-rose-200' },
  { id: 'f2', slug: 'embroidered-bownot-clutch', name: 'Embroidered Bowknot Clutch Bag', image: null, price: 1_495_570, compareAt: 7_734_670, badge: null, savings: 623_910, onlyLeft: null, rating: 4.3, sold: '1,000+ sold', bg: 'from-amber-100 to-orange-200' },
  { id: 'f3', slug: 'french-net-bridal-veil', name: 'French Net Bridal Veil with Comb', image: null, price: 1_495_570, compareAt: 5_363_360, badge: null, savings: 386_779, onlyLeft: 8, rating: 4.7, sold: '4,000+ sold', bg: 'from-stone-100 to-stone-200' },
  { id: 'f4', slug: 'diy-lash-clusters-30d', name: '30D DIY Lash Clusters Kit', image: null, price: 1_495_570, compareAt: 2_822_540, badge: 'Sale', savings: 132_697, onlyLeft: null, rating: 4.5, sold: '5,000+ sold', bg: 'from-fuchsia-100 to-pink-200' },
  { id: 'f5', slug: 'oud-royale-perfume-50ml', name: 'Oud Royale Eau de Parfum — 50ml', image: null, price: 2_778_350, compareAt: 14_620_760, badge: null, savings: 1_184_241, onlyLeft: null, rating: 4.8, sold: '900+ sold', bg: 'from-yellow-100 to-amber-200' },
  { id: 'f6', slug: 'adire-eleko-gele-set', name: 'Adire Eleko Gele & Ipele Set — Indigo', image: null, price: 3_685_390, compareAt: 6_900_000, badge: 'NEW', savings: 512_000, onlyLeft: 5, rating: 4.9, sold: '600+ sold', bg: 'from-blue-100 to-indigo-200' },
  { id: 'f7', slug: 'satin-lined-headwrap', name: 'Satin-Lined Ankara Headwrap', image: null, price: 895_000, compareAt: 1_649_790, badge: null, savings: 75_479, onlyLeft: null, rating: 4.2, sold: '5,000+ sold', bg: 'from-emerald-100 to-teal-200' },
  { id: 'f8', slug: 'rose-gold-cherry-pendant', name: 'Rose Gold Cherry Pendant Necklace', image: null, price: 287_020, compareAt: 589_160, badge: 'Sale', savings: 30_214, onlyLeft: null, rating: 4.4, sold: '5,000+ sold', bg: 'from-red-100 to-rose-200' },
  { id: 'f9', slug: 'cushioned-slide-slippers', name: 'Cushioned EVA Slide Slippers — Black', image: null, price: 1_495_570, compareAt: 3_755_680, badge: null, savings: 226_000, onlyLeft: null, rating: 4.2, sold: '1,000+ sold', bg: 'from-stone-200 to-stone-300' },
  { id: 'f10', slug: 'matte-liquid-lipstick-set', name: 'Matte Liquid Lipstick Set of 6', image: null, price: 1_195_570, compareAt: 3_147_090, badge: null, savings: 195_000, onlyLeft: 12, rating: 4.6, sold: '2,000+ sold', bg: 'from-pink-100 to-rose-300' },
  { id: 'f11', slug: 'beaded-bridal-purse', name: 'Beaded Bridal Purse & Fan Set', image: null, price: 1_150_000, compareAt: 2_500_000, badge: null, savings: 135_000, onlyLeft: null, rating: 4.5, sold: '700+ sold', bg: 'from-violet-100 to-purple-200' },
  { id: 'f12', slug: 'laffaya-shadda-fabric-5yd', name: 'Laffaya Shadda Bazin — 5 Yards, Cream', image: null, price: 4_895_570, compareAt: 6_947_970, badge: 'NEW', savings: 205_240, onlyLeft: null, rating: 4.8, sold: '202 sold', bg: 'from-amber-50 to-yellow-100' },
];
