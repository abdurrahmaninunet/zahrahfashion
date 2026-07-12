import Link from 'next/link';
import {
  ArrowRight,
  Brush,
  Footprints,
  Layers,
  ShoppingBag,
  Sparkles,
  SprayCan,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { naira } from '@/lib/format';

type Category = { id: string; name: string; slug: string; parentId: string | null; image?: string | null };

/** Curated storefront categories for this promo. Icons are graceful
 *  fallbacks when a matching catalogue category has no image yet. */
const CATEGORIES: { label: string; icon: LucideIcon }[] = [
  { label: 'Laces & Veils', icon: Sparkles },
  { label: 'Fabric', icon: Layers },
  { label: 'Bags', icon: ShoppingBag },
  { label: 'Cosmetics', icon: Brush },
  { label: 'Perfumes', icon: SprayCan },
  { label: 'Shoes', icon: Footprints },
];

// Featured trio for the promo panel. Prices in kobo (see lib/format).
interface Featured {
  name: string;
  slug: string;
  price: number;
  was: number;
  bg: string;
  rating: number;
  sold: string;
}
const FEATURED: Featured[] = [
  { name: 'Beaded Bridal Lace Wrapper Set', slug: 'beaded-bridal-lace-wrapper-set', price: 4_687_852, was: 5_141_055, bg: 'from-stone-200 to-stone-300', rating: 5.0, sold: '126 sold' },
  { name: 'Flowing Kaftan Boubou — Cream', slug: 'flowing-kaftan-boubou-cream', price: 3_353_704, was: 4_532_033, bg: 'from-amber-100 to-amber-200', rating: 4.6, sold: '1,000+ sold' },
  { name: 'Printed Adire Kimono Robe — Olive', slug: 'printed-adire-kimono-robe-olive', price: 1_410_973, was: 2_868_777, bg: 'from-emerald-100 to-emerald-200', rating: 4.9, sold: '600+ sold' },
];

/** Resolve a display label to a real category link, else a search fallback
 *  (mirrors the nav behaviour in shell.tsx). */
function hrefFor(label: string, categories: Category[]): string {
  const match = categories.find((c) => c.name.toLowerCase() === label.toLowerCase());
  return match ? `/c/${match.slug}` : `/search?q=${encodeURIComponent(label)}`;
}
function imageFor(label: string, categories: Category[]): string | null {
  return categories.find((c) => c.name.toLowerCase() === label.toLowerCase())?.image ?? null;
}

/** One category tile — label + catalogue image (icon fallback). */
function CategoryTile({ label, icon: Icon, categories }: { label: string; icon: LucideIcon; categories: Category[] }) {
  const image = imageFor(label, categories);
  return (
    <Link
      href={hrefFor(label, categories)}
      className="group flex items-center justify-between gap-2 overflow-hidden bg-stone-100 p-4 transition-all hover:bg-stone-200/70 hover:shadow-md md:p-5"
    >
      <span className="font-display text-base font-bold leading-tight text-stone-900 md:text-lg">{label}</span>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={label}
          loading="lazy"
          className="h-16 w-16 shrink-0 object-cover transition-transform duration-300 group-hover:scale-105 md:h-20 md:w-20"
        />
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-600 transition-transform duration-300 group-hover:scale-105 md:h-20 md:w-20">
          <Icon size={30} strokeWidth={1.5} aria-hidden />
        </span>
      )}
    </Link>
  );
}

/**
 * The Owambe Edit — celebration-fashion promo that follows Today's Deals.
 * When the MIM store is on: category grid (left) + MIM promo & featured looks
 * (right). When MIM is off: the MIM panel is dropped and the category grid fills
 * the whole section.
 */
export function OwambeEdit({ categories = [], mimEnabled = true }: { categories?: Category[]; mimEnabled?: boolean }) {
  // MIM off — the "MIM's ready" panel is hidden, so let the categories fill the row.
  if (!mimEnabled) {
    return (
      <section className="mx-auto max-w-[1905px] px-4 py-10 lg:px-[8rem]">
        <div className="mb-6 text-center">
          <h2 className="font-display text-2xl font-bold md:text-3xl">Shop by Category</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
          {CATEGORIES.map(({ label, icon }) => (
            <CategoryTile key={label} label={label} icon={icon} categories={categories} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[1905px] px-4 py-10 lg:px-[8rem]">
      <div className="mb-6 text-center">
        <h2 className="font-display text-2xl font-bold md:text-3xl">Shop by Category</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Right (lg): brand promo + featured looks ───────────────── */}
        <div className="overflow-hidden bg-accent-100 p-4 sm:p-5 md:p-6 lg:order-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-3xl font-bold italic leading-none text-accent-900 md:text-4xl">MIM&apos;s ready.</p>
              <p className="mt-2 max-w-xs text-sm text-stone-700">Custom printed shirts, jerseys &amp; more — printing for every occasion.</p>
              <Link
                href="/mim"
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700"
              >
                Shop now <ArrowRight size={15} />
              </Link>
            </div>
            <Sparkles className="hidden shrink-0 text-accent-600/40 sm:block" size={72} strokeWidth={1.2} aria-hidden />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
            {FEATURED.map((f) => {
              const off = Math.round(((f.was - f.price) / f.was) * 100);
              return (
                <Link
                  key={f.slug}
                  href={`/p/${f.slug}`}
                  className="group flex flex-col overflow-hidden bg-white transition-shadow hover:shadow-md"
                >
                  <div className={`media-box aspect-square bg-gradient-to-br ${f.bg}`}>
                    <span className="absolute left-0 top-0 z-10 bg-[#c02b2b] px-1.5 py-0.5 text-[11px] font-bold text-white">−{off}%</span>
                    <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold text-white/70 transition-transform duration-300 group-hover:scale-105">
                      {f.name.split(' ')[0]}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-2.5">
                    <p className="line-clamp-2 min-h-[2.4rem] text-[13px] leading-snug text-stone-700 group-hover:text-stone-950">{f.name}</p>
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="tabular text-base font-bold text-stone-900">{naira(f.price)}</span>
                      <span className="text-[11px] text-stone-400 line-through">{naira(f.was)}</span>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-stone-500">
                      <Star size={11} className="fill-amber-400 text-amber-400" />
                      <b className="text-stone-800">{f.rating.toFixed(1)}</b>
                      <span className="text-stone-300">|</span>
                      {f.sold}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Left (lg): category grid — 2 columns × 3 rows ──────────── */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:order-1">
          {CATEGORIES.map(({ label, icon }) => (
            <CategoryTile key={label} label={label} icon={icon} categories={categories} />
          ))}
        </div>
      </div>
    </section>
  );
}
