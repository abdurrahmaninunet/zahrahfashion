import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { serverApi } from '@/lib/api';
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

      {/* Below the fold: ratings & reviews only */}
      <Reviews productId={product!.id} slug={product!.slug} />
    </div>
  );
}

