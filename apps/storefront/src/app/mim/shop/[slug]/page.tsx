import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { serverApi } from '@/lib/api';
import { ProductCard, type ProductCardData } from '@/components/product-card';
import type { PdpProduct } from '@/app/p/[slug]/buy-box';
import { Gallery } from '@/app/p/[slug]/gallery';
import { Reviews } from '@/app/p/[slug]/reviews';
import { MimBuyBox } from './configurator';

export const revalidate = 30;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const p = await serverApi<PdpProduct>(`/store/products/${slug}`);
    return { title: `${p.name} — MIM Custom Printing` };
  } catch {
    return { title: 'MIM Custom Printing' };
  }
}

/** MIM product page — the full Zahrah PDP (gallery + buy box with quantity,
 *  add-to-cart, buy now and trust strip), with the personalise-one / team
 *  options appended inside the buy card via BuyBox's `asideExtra`. */
export default async function MimProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product: PdpProduct;
  try {
    product = await serverApi<PdpProduct>(`/store/products/${slug}`, 30);
  } catch {
    notFound();
  }

  let storeName = 'Zahrah Fashion Hub';
  let mimEnabled = true;
  try {
    const ctx = await serverApi<{ store: { name: string }; mimEnabled?: boolean }>('/store/context');
    mimEnabled = ctx.mimEnabled !== false;
    if (ctx.store.name) storeName = ctx.store.name;
  } catch { /* keep default */ }
  // MIM store switched off — send to /mim, which shows the "unavailable" state.
  // (Called outside the try/catch — redirect() throws NEXT_REDIRECT internally.)
  if (!mimEnabled) redirect('/mim');

  return (
    <div className="mx-auto max-w-[1905px] px-4 py-4 lg:px-[8rem]">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-stone-500">
        <Link href="/mim" className="hover:text-stone-800 hover:underline">MIM</Link>
        <ChevronRight size={13} className="text-stone-300" />
        <span className="truncate text-stone-700">{product.name}</span>
      </nav>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,44%)_minmax(0,1fr)] lg:gap-8">
        <Gallery media={product.media} />
        <MimBuyBox product={product} storeName={storeName} />
      </div>

      {/* Below the fold: ratings & reviews (same as the standard product page) */}
      <Reviews productId={product.id} slug={slug} />

      {/* Related MIM products */}
      <MimRelated currentId={product.id} />
    </div>
  );
}

/** Other MIM products to personalise — current one excluded. Cards route back
 *  to the MIM product page. Renders nothing when there's nothing else. */
async function MimRelated({ currentId }: { currentId: string }) {
  let products: ProductCardData[] = [];
  try {
    const listing = await serverApi<{ products: ProductCardData[] }>('/store/plp?store=mim', 60);
    products = listing.products.filter((p) => p.id !== currentId).slice(0, 12);
  } catch {
    /* no related products */
  }
  if (!products.length) return null;

  return (
    <section className="mt-12 border-t border-stone-200 pt-8">
      <h2 className="mb-4 font-display text-xl font-bold">You may also like</h2>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} hrefBase="/mim/shop" />
        ))}
      </div>
    </section>
  );
}
