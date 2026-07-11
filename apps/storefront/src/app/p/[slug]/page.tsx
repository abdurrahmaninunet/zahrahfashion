import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { serverApi } from '@/lib/api';
import { ProductTile } from '@/components/product-tile';
import { BuyBox, PdpProduct } from './buy-box';
import { Gallery } from './gallery';
import { Reviews } from './reviews';

export const revalidate = 60; // interaction-time truth comes from /availability

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const p = await serverApi<PdpProduct>(`/store/products/${slug}`);
    const price = p.bundle ? p.bundle.price : Math.min(...p.variants.map((v) => v.price));
    return {
      title: p.name,
      description: p.description?.slice(0, 155) ?? p.name,
      openGraph: {
        title: p.name,
        description: p.description?.slice(0, 155) ?? '',
        images: p.media[0]?.url ? [{ url: p.media[0].url }] : [],
      },
      other: { 'product:price:amount': String(price / 100), 'product:price:currency': 'NGN' },
    };
  } catch {
    return {};
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product: PdpProduct;
  try {
    product = await serverApi<PdpProduct>(`/store/products/${slug}`, 30);
  } catch {
    notFound();
  }

  // Store name for the buy-box "sold by" line (non-critical — degrades to default).
  let storeName = 'Zahrah Fashion';
  try {
    const ctx = await serverApi<{ store: { name: string } }>('/store/context');
    if (ctx.store.name) storeName = ctx.store.name;
  } catch { /* keep default */ }

  const price = product!.bundle ? product!.bundle.price : product!.variants.length ? Math.min(...product!.variants.map((v) => v.price)) : 0;
  const soldOut = product!.bundle ? product!.bundle.soldOut : product!.variants.every((v) => v.soldOut);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product!.name,
    image: product!.media.map((m) => m.url),
    description: product!.description ?? undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'NGN',
      price: (price / 100).toFixed(2),
      availability: soldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    },
  };

  return (
    <div className="mx-auto max-w-[1905px] px-2.5 py-4 lg:px-[8rem]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-stone-500">
        <Link href="/" className="hover:text-stone-800 hover:underline">Home</Link>
        <ChevronRight size={13} className="text-stone-300" />
        <Link href={`/c/${product!.category.slug}`} className="hover:text-stone-800 hover:underline">{product!.category.name}</Link>
        <ChevronRight size={13} className="text-stone-300" />
        <span className="truncate text-stone-700">{product!.name}</span>
      </nav>

      {/* Top: gallery + buy box (buy box splits into details + card internally) */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,44%)_minmax(0,1fr)] lg:gap-8">
        <Gallery media={product!.media} />
        <BuyBox product={product!} storeName={storeName} />
      </div>

      {/* Below the fold: ratings & reviews only */}
      <Reviews productId={product!.id} slug={product!.slug} />

      {/* Related products */}
      <RelatedProducts />
    </div>
  );
}

// Dummy related products (placeholder — swap for a real recommendations feed). Prices in kobo.
const RELATED = [
  { name: 'Swiss Voile Lace — Emerald, 5 Yards', price: 4_500_000, compareAt: 5_200_000, bg: 'from-emerald-100 to-emerald-200' },
  { name: 'French Corded Lace — Blush Pink', price: 3_800_000, compareAt: null, bg: 'from-rose-100 to-rose-200' },
  { name: 'Beaded Bridal Lace — Ivory', price: 6_200_000, compareAt: 7_400_000, bg: 'from-stone-100 to-stone-200' },
  { name: 'Adire Eleko Fabric — Indigo', price: 2_950_000, compareAt: null, bg: 'from-blue-100 to-indigo-200' },
  { name: 'Atampa Ankara Wax — 6 Yards', price: 1_850_000, compareAt: 2_400_000, bg: 'from-amber-100 to-orange-200' },
  { name: 'George Wrapper — Wine & Gold', price: 8_900_000, compareAt: 10_500_000, bg: 'from-fuchsia-100 to-rose-200' },
  { name: 'Oud Royale Eau de Parfum — 50ml', price: 2_780_000, compareAt: 4_600_000, bg: 'from-yellow-100 to-amber-200' },
  { name: 'Sequined Net Lace — Champagne Gold', price: 5_400_000, compareAt: null, bg: 'from-amber-50 to-yellow-100' },
  { name: 'Aso-Oke Gele & Fila Set — Bronze', price: 3_200_000, compareAt: 3_900_000, bg: 'from-orange-100 to-amber-200' },
  { name: 'Cord Lace — Royal Blue, 5 Yards', price: 4_100_000, compareAt: null, bg: 'from-blue-100 to-sky-200' },
  { name: 'Hand-beaded Clutch — Pearl', price: 2_450_000, compareAt: 3_100_000, bg: 'from-stone-100 to-rose-100' },
  { name: 'Chiffon Silk Fabric — Teal, 4 Yards', price: 1_650_000, compareAt: null, bg: 'from-teal-100 to-emerald-200' },
];

function RelatedProducts() {
  return (
    <section className="mt-12 border-t border-stone-200 pt-8">
      <h2 className="mb-4 font-display text-xl font-bold">Related products</h2>
      <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-6">
        {RELATED.map((p) => (
          <div key={p.name} className="w-[54vw] shrink-0 snap-start md:w-auto">
            <ProductTile
              item={{
                id: p.name,
                name: p.name,
                href: `/search?q=${encodeURIComponent(p.name.split(' —')[0])}`,
                bg: p.bg,
                price: p.price,
                compareAt: p.compareAt,
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
