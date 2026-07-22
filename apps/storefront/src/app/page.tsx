import Link from 'next/link';
import { serverApi } from '@/lib/api';
import { ProductCardData, ProductRail } from '@/components/product-card';
import { HeroSlider } from '@/components/hero-slider';
import { TodaysDeals } from '@/components/todays-deals';
import { OwambeEdit } from '@/components/owambe-edit';
import { MoreToLove } from '@/components/more-to-love';
import { StoreContext } from '@/components/shell';

// Short revalidate so Content-tab edits (hero, deals, sections) reflect quickly.
export const revalidate = 10; // FR-SF-PRF-02

interface Section {
  id: string;
  sectionKey: string | null;
  title: string;
  fields: Record<string, unknown>;
  products?: ProductCardData[];
  menProducts?: ProductCardData[];
  womenProducts?: ProductCardData[];
}

/**
 * Homepage — rendered entirely from the Content composition (S-BR-01).
 * Unknown/broken sections skip silently (Content Business Rule 7).
 */
export default async function HomePage() {
  let sections: Section[] = [];
  let context: StoreContext | null = null;
  try {
    [{ sections }, context] = await Promise.all([
      serverApi<{ sections: Section[] }>('/store/composition/homepage', 10),
      serverApi<StoreContext>('/store/context', 10),
    ]);
  } catch { /* stale-while-error */ }

  // Featured MIM products (up to 3, picked in admin) — shown in the "Shop by
  // Category" MIM panel. Fetched separately so a miss never breaks the page.
  let mimFeatured: { image: string; name: string }[] = [];
  try {
    const mr = await serverApi<{ enabled: boolean; products: { image: string | null; name: string }[] }>('/store/mim/ready', 30);
    if (mr.enabled) {
      mimFeatured = mr.products
        .filter((p): p is { image: string; name: string } => !!p.image)
        .slice(0, 3)
        .map((p) => ({ image: p.image, name: p.name }));
    }
  } catch { /* ignore */ }

  // Homepage is curated in code (deals → categories → discovery feed). Pull out
  // Today's Deals so it always renders above Shop by Category, and hide the CMS
  // rails/tiles/strips so they don't render alongside the handcrafted sections.
  const dealsSection = sections.find((s) => s.sectionKey === 'todays_deals');
  const HIDDEN_SECTIONS = new Set(['collection_rail', 'category_tiles', 'testimonial_strip', 'todays_deals']);
  sections = sections.filter((s) => !HIDDEN_SECTIONS.has(s.sectionKey ?? ''));

  const hasHero = sections.some((s) => s.sectionKey === 'hero_slider');
  const todaysDeals = dealsSection ? (
    <TodaysDeals
      men={dealsSection.menProducts}
      women={dealsSection.womenProducts}
      menTitle={(dealsSection.fields.menTitle as string) ?? 'Men'}
      womenTitle={(dealsSection.fields.womenTitle as string) ?? 'Women'}
    />
  ) : (
    <TodaysDeals />
  );

  return (
    <div>
      {!hasHero && <DefaultHero categories={context?.categories ?? []} />}
      {!hasHero && <><TrustBar /><StatBand count={context?.homepage?.fabricsCount} /><PartnerCTA /></>}
      {sections.map((section, i) => (
        <div key={section.id}>
          <SectionRenderer section={section} first={i === 0} context={context} />
          {i === 0 && (
            <>
              {hasHero && <><TrustBar /><StatBand count={context?.homepage?.fabricsCount} /><PartnerCTA /></>}
              {todaysDeals}
              <OwambeEdit categories={context?.categories ?? []} mimEnabled={context?.mimEnabled ?? true} mimProducts={mimFeatured} />
              <MoreToLove />
              <WhyUs />
            </>
          )}
        </div>
      ))}
      {!sections.length && (
        <>
          {todaysDeals}
          <OwambeEdit categories={context?.categories ?? []} mimProducts={mimFeatured} />
          <MoreToLove />
          <WhyUs />
        </>
      )}
    </div>
  );
}

/** Brand positioning section — why shop with us. */
function WhyUs() {
  return (
    <section className="mx-auto max-w-[1905px] px-2.5 py-14 text-center lg:px-[8rem]">
      <h2 className="font-display text-2xl font-bold text-stone-900 md:text-4xl">Why ZAHRA FASHION HUB LIMITED?</h2>
      <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-stone-600 md:text-lg">
        Every collection is carefully selected to combine quality, elegance and timeless beauty. Whether you are
        preparing for a wedding, celebration, Eid, corporate event or everyday sophistication, our mission is to
        help you define your style with confidence.
      </p>
    </section>
  );
}

/** Social-proof statistic — reinforces scale. The number is editable in
 *  admin Settings → Storefront (homepage.fabrics_count). */
function StatBand({ count }: { count?: number }) {
  const n = (count && count > 0 ? count : 1000).toLocaleString('en-NG');
  return (
    <section className="mx-auto max-w-[1905px] px-2.5 py-12 text-center lg:px-[8rem]">
      <p className="font-display text-3xl font-bold text-stone-900 md:text-4xl">
        Over <span className="text-[#c9a227]">{n}</span> premium fabrics
      </p>
      <p className="mx-auto mt-2 max-w-md text-stone-500 md:text-lg">carefully curated for every occasion.</p>
    </section>
  );
}

/** Reseller / affiliate recruitment banner — sits below the trust strip. */
function PartnerCTA() {
  return (
    <section className="mx-auto max-w-[1905px] px-2.5 pb-10 lg:px-[8rem]">
      <div className="rounded-lg bg-stone-900 px-6 py-12 text-center md:px-12 md:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#c9a227]">Reseller network</p>
        <h2 className="mx-auto mt-3 max-w-3xl font-display text-2xl font-bold text-white md:text-4xl">
          Become a Zahrah Fashion Hub Partner
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-stone-300 md:text-base">
          Join our growing reseller network and build your business with premium fabrics trusted by customers
          across Abuja. Enjoy competitive pricing, dedicated support and access to carefully curated collections.
        </p>
        <Link
          href="/partner"
          className="mt-7 inline-block rounded-md bg-[#c9a227] px-9 py-3 text-sm font-semibold text-stone-900 transition-colors hover:bg-[#d8b53a]"
        >
          Become a Partner
        </Link>
      </div>
    </section>
  );
}

/** Trust indicators strip — sits directly below the hero to establish credibility. */
function TrustBar() {
  const items = [
    'Premium Quality Fabrics',
    'Carefully Curated Collections',
    'Trusted by Families Across Abuja',
    'Nationwide Delivery',
    'Personal Shopping Experience',
    'Growing Reseller Network',
  ];
  return (
    <div className="bg-white shadow-[0_2px_6px_rgba(0,0,0,0.05)]">
      <div className="mx-auto flex max-w-[1905px] flex-wrap items-center justify-center gap-x-7 gap-y-2 px-2.5 py-3.5 lg:px-[8rem]">
        {items.map((t) => (
          <span key={t} className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-stone-700">
            <span className="font-bold text-emerald-600">✓</span> {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function SectionRenderer({ section, first, context }: { section: Section; first: boolean; context: StoreContext | null }) {
  switch (section.sectionKey) {
    case 'hero_slider':
      return <HeroSlider slides={(section.fields.slides as never[]) ?? []} priority={first} whatsapp={context?.store.whatsapp} />;
    case 'todays_deals':
      return (
        <TodaysDeals
          men={section.menProducts}
          women={section.womenProducts}
          menTitle={(section.fields.menTitle as string) ?? 'Men'}
          womenTitle={(section.fields.womenTitle as string) ?? 'Women'}
        />
      );
    case 'category_tiles':
      return context ? <CategoryTilesFromFields fields={section.fields} context={context} /> : null;
    case 'collection_rail':
      return (
        <ProductRail
          title={(section.fields.title as string) ?? section.title}
          products={section.products ?? []}
        />
      );
    case 'banner_grid':
      return <BannerGrid fields={section.fields} />;
    case 'rich_text':
      return (
        <section className="mx-auto max-w-3xl px-4 py-8">
          <div className="prose prose-stone" dangerouslySetInnerHTML={{ __html: (section.fields.body as string) ?? '' }} />
        </section>
      );
    case 'testimonial_strip':
      return context ? <TrustBand context={context} testimonials={(section.fields.testimonials as never[]) ?? []} /> : null;
    case 'newsletter_signup':
      return <Newsletter headline={section.fields.headline as string} subtext={section.fields.subtext as string} />;
    default:
      return null; // unknown sections skip — content mistakes never break commerce
  }
}

function DefaultHero({ categories }: { categories: StoreContext['categories'] }) {
  return (
    <section className="bg-gradient-to-br from-[#f3e8c8] via-[#faf8f5] to-[#faf5e6] px-4 py-16 text-center">
      <h1 className="font-display mx-auto max-w-xl text-3xl font-bold leading-tight md:text-4xl">
        Fabrics that drape. Scents that linger.
      </h1>
      <p className="mx-auto mt-3 max-w-md text-stone-600">
        Premium lace, ankara and perfumes — delivered across Nigeria.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {categories.filter((c) => !c.parentId).slice(0, 4).map((c) => (
          <Link key={c.id} href={`/c/${c.slug}`} className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-700">
            Shop {c.name}
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Category tiles (§3.3): 2-across mobile, express lane one flick from the top. */
function CategoryTiles({ categories }: { categories: { id: string; name: string; slug: string; image?: string | null }[] }) {
  return (
    <section className="mx-auto max-w-[1905px] px-4 lg:px-[8rem] py-8">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold md:text-2xl">Shop by category</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {categories.slice(0, 5).map((c, i, list) => (
          <Link
            key={c.id}
            href={`/c/${c.slug}`}
            className={`media-box group relative flex aspect-[4/3] items-end rounded-xl md:aspect-[3/4] ${i === list.length - 1 && list.length % 2 === 1 ? 'col-span-2 md:col-span-1' : ''}`}
          >
            {c.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.image} alt={c.name} loading="lazy" className="transition-transform duration-500 group-hover:scale-[1.05]" />
            ) : (
              <div className={`absolute inset-0 bg-gradient-to-br ${
                ['from-stone-700 to-stone-900', 'from-[#8a6d1f] to-[#3d3010]', 'from-emerald-800 to-emerald-950', 'from-rose-900 to-stone-900', 'from-blue-900 to-stone-900'][i % 5]
              }`} />
            )}
            <span className="relative z-10 w-full bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
              <span className="font-display text-lg font-bold uppercase tracking-[0.08em] text-white">{c.name}</span>
              <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-white/70 opacity-0 transition-opacity group-hover:opacity-100">
                Shop now →
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function CategoryTilesFromFields({ fields, context }: { fields: Record<string, unknown>; context: StoreContext }) {
  const tiles = (fields.tiles as { categoryId: string; image?: { url?: string } }[]) ?? [];
  const resolved = tiles
    .map((t) => ({ ...t, category: context.categories.find((c) => c.id === t.categoryId) }))
    .filter((t) => t.category);
  if (!resolved.length) return <CategoryTiles categories={context.categories.filter((c) => !c.parentId)} />;
  return (
    <section className="mx-auto max-w-[1905px] px-4 lg:px-[8rem] py-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {resolved.map((t) => (
          <Link key={t.categoryId} href={`/c/${t.category!.slug}`} className="media-box group relative flex aspect-[4/3] items-end rounded-xl md:aspect-[3/4]">
            {(t.image?.url ?? t.category!.image) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={(t.image?.url ?? t.category!.image)!} alt={t.category!.name} loading="lazy" className="transition-transform duration-500 group-hover:scale-[1.05]" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-stone-700 to-stone-900" />
            )}
            <span className="relative z-10 w-full bg-gradient-to-t from-black/60 to-transparent p-3 font-display text-lg font-bold text-white">
              {t.category!.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function BannerGrid({ fields }: { fields: Record<string, unknown> }) {
  const tiles = (fields.tiles as { image?: { url?: string; alt?: string }; title?: string; link?: { url?: string } }[]) ?? [];
  if (!tiles.length) return null;
  const cols = Math.min(Number(fields.columns) || tiles.length, 4);
  return (
    <section className="mx-auto max-w-[1905px] px-4 lg:px-[8rem] py-6">
      <div className={`grid gap-3 ${cols === 1 ? '' : cols === 2 ? 'md:grid-cols-2' : cols === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
        {tiles.map((tile, i) => {
          const inner = (
            <>
              {tile.image?.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tile.image.url} alt={tile.image.alt ?? tile.title ?? ''} loading="lazy" className="transition-transform duration-300 group-hover:scale-[1.02]" />
              )}
              {tile.title && (
                <span className="absolute bottom-0 w-full bg-gradient-to-t from-black/60 to-transparent p-4 font-display text-xl font-bold text-white">
                  {tile.title}
                </span>
              )}
            </>
          );
          const cls = 'media-box group relative aspect-[16/9] rounded-xl md:aspect-[4/3]';
          // Only wrap in a link when the tile actually points somewhere — a
          // CMS tile with no URL renders as a plain, non-clickable banner.
          return tile.link?.url ? (
            <Link key={i} href={tile.link.url} className={cls}>{inner}</Link>
          ) : (
            <div key={i} className={cls}>{inner}</div>
          );
        })}
      </div>
    </section>
  );
}

/** Trust band (§3.7): store presence + payment promise + testimonials. */
function TrustBand({ context, testimonials }: { context: StoreContext; testimonials: { quote: string; name: string; location?: string }[] | null }) {
  return (
    <section className="mt-6 bg-white py-10">
      <div className="mx-auto grid max-w-[1905px] gap-8 px-4 lg:px-[8rem] md:grid-cols-2">
        <div>
          <h2 className="font-display text-lg font-bold">A real store, real people</h2>
          {context.store.address ? (
            <p className="mt-2 text-sm text-stone-600">Visit us: {context.store.address}</p>
          ) : (
            <p className="mt-2 text-sm text-stone-600">Shop online or visit our Abuja store.</p>
          )}
          {context.podAvailable && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
              ✓ Pay on Delivery available across Abuja
            </p>
          )}
          <p className="mt-3 text-xs text-stone-400">Secure payments via Paystack — card, bank & USSD · WhatsApp support all day</p>
        </div>
        <div className="space-y-2">
          {(testimonials?.length ? testimonials : [
            { quote: 'The lace arrived in 2 days and the colour is exactly like the video.', name: 'Amaka O.', location: 'Lekki' },
            { quote: 'Ordered on WhatsApp, paid on delivery. Smooth!', name: 'Hauwa B.', location: 'Surulere' },
          ]).slice(0, 3).map((t, i) => (
            <figure key={i} className="rounded-2xl rounded-tl-sm bg-[#e7f8ef] px-4 py-3">
              <blockquote className="text-sm text-stone-700">“{t.quote}”</blockquote>
              <figcaption className="mt-1 text-xs text-stone-400">— {t.name}{t.location ? `, ${t.location}` : ''}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Newsletter({ headline, subtext }: { headline?: string; subtext?: string }) {
  return (
    <section className="mx-auto max-w-[1905px] px-4 lg:px-[8rem] py-8">
      <div className="rounded-2xl bg-stone-900 px-6 py-8 text-center text-white">
        <h2 className="font-display text-lg font-bold">{headline || 'First to know when new lace lands'}</h2>
        {subtext && <p className="mt-1 text-sm text-stone-300">{subtext}</p>}
        <form className="mx-auto mt-4 flex max-w-sm gap-2" action="#">
          <input type="email" required placeholder="Your email" className="h-10 w-full rounded-md border-0 bg-white/10 px-3 text-sm placeholder:text-stone-400 focus:bg-white/20 focus:outline-none" />
          <button className="h-10 shrink-0 rounded-md bg-[#8a6d1f] px-4 text-sm font-medium hover:bg-[#6f571a] cursor-pointer">Sign up</button>
        </form>
        <p className="mt-2 text-[11px] text-stone-400">Only new arrivals and offers. Unsubscribe anytime.</p>
      </div>
    </section>
  );
}
