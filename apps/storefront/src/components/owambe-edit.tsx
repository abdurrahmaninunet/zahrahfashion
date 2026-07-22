import Link from 'next/link';
import {
  ArrowRight,
  Flame,
  Layers,
  Shirt,
  Sparkles,
  SprayCan,
  type LucideIcon,
} from 'lucide-react';

type Category = { id: string; name: string; slug: string; parentId: string | null; image?: string | null };

/** Curated storefront categories for this promo. Icons are graceful
 *  fallbacks when a matching catalogue category has no image yet. */
const CATEGORIES: { label: string; icon: LucideIcon }[] = [
  { label: 'Luxury Lace', icon: Sparkles },
  { label: 'Premium Atampa', icon: Layers },
  { label: 'Swiss Voile', icon: Layers },
  { label: "Men's Fabrics", icon: Shirt },
  { label: 'Perfumes', icon: SprayCan },
  { label: 'Incense', icon: Flame },
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
export function OwambeEdit({ categories = [], mimEnabled = true, mimProducts = [] }: { categories?: Category[]; mimEnabled?: boolean; mimProducts?: { image: string; name: string }[] }) {
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
        {/* ── Right (lg): MIM promo — copy + CTA, then featured products offset
             20px diagonally from the "Shop now" button's bottom-left ── */}
        <div className="relative bg-accent-100 p-4 sm:p-5 md:p-6 lg:order-2">
          <Sparkles className="pointer-events-none absolute right-3 top-3 z-10 text-accent-600/40" size={40} strokeWidth={1.2} aria-hidden />
          <p className="font-display text-3xl font-bold italic leading-none text-accent-900 md:text-4xl">MIM&apos;s ready.</p>
          <p className="mt-2 max-w-xs text-sm text-stone-700">Custom printed shirts, jerseys &amp; more — printing for every occasion.</p>
          <Link
            href="/mim"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700"
          >
            Shop now <ArrowRight size={15} />
          </Link>
          {mimProducts.length ? (
            // 3-column grid below the button; fits the panel width.
            <div className="mt-5 grid grid-cols-3 gap-4 md:gap-5">
              {mimProducts.map((p, i) => (
                <Link key={i} href="/mim" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image}
                    alt={p.name || 'MIM custom printing'}
                    className="aspect-[3/4] w-full rounded-md object-cover shadow-md ring-1 ring-black/5"
                  />
                </Link>
              ))}
            </div>
          ) : null}
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
