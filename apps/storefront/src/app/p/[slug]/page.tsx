import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { serverApi } from '@/lib/api';
import { ProductCard, type ProductCardData } from '@/components/product-card';
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
  let storeName = 'Zahra Fashion';
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
    <div className="mx-auto max-w-[1905px] px-4 py-4 lg:px-[8rem]">
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

      {/* Below the fold: ratings & reviews */}
      <Reviews productId={product!.id} slug={product!.slug} />

      {/* Related products from the same category */}
      <RelatedProducts categorySlug={product!.category.slug} currentId={product!.id} />
    </div>
  );
}

/** Real related products — other items in the same category, current one excluded.
 *  Renders nothing when there's nothing else to show. */
async function RelatedProducts({ categorySlug, currentId }: { categorySlug: string; currentId: string }) {
  let products: ProductCardData[] = [];
  try {
    const listing = await serverApi<{ products: ProductCardData[] }>(`/store/plp?category=${categorySlug}`, 60);
    products = listing.products.filter((p) => p.id !== currentId).slice(0, 12);
  } catch {
    /* no related products */
  }
  if (!products.length) return null;

  return (
    <section className="mt-12 border-t border-stone-200 pt-8">
      <h2 className="mb-4 font-display text-xl font-bold">Related products</h2>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

