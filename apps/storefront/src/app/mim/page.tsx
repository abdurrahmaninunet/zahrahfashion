import type { Metadata } from 'next';
import Link from 'next/link';
import { Shirt } from 'lucide-react';
import { serverApi } from '@/lib/api';
import { ProductCard, ProductCardData } from '@/components/product-card';

export const metadata: Metadata = {
  title: 'MIM — Custom Printing',
  description: 'Personalised shirts, jerseys and clothing — add your own text, or name every piece for the whole team.',
};
export const revalidate = 30;

/** MIM store — product catalogue (only products marked MIM). Cards open the MIM
 *  product page, which carries the personalise-one and team options. */
export default async function MimStorePage() {
  let products: ProductCardData[] = [];
  let enabled = true;
  try {
    const [plp, context] = await Promise.all([
      serverApi<{ products: ProductCardData[] }>('/store/plp?store=mim', 30),
      serverApi<{ mimEnabled?: boolean }>('/store/context', 30),
    ]);
    products = plp.products ?? [];
    enabled = context.mimEnabled !== false;
  } catch {
    /* API unavailable — show the empty state */
  }

  if (!enabled) {
    return (
      <div className="mx-auto max-w-[1905px] px-4 py-8 lg:px-[8rem]">
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-24 text-center">
          <Shirt size={30} className="mx-auto text-stone-300" />
          <p className="mt-3 font-medium text-stone-700">MIM is currently unavailable</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">Our custom-printing store is taking a short break. Please check back soon.</p>
          <Link href="/" className="mt-4 inline-block rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-800">Back to shop</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1905px] px-4 py-8 lg:px-[8rem]">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold md:text-3xl">MIM</h1>
      </div>

      {products.length ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {products.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 6} hrefBase="/mim/shop" />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-20 text-center">
          <Shirt size={30} className="mx-auto text-stone-300" />
          <p className="mt-3 font-medium text-stone-700">No products yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">
            Add products in the admin and tick <b>MIM product</b> — they&apos;ll appear here.
          </p>
        </div>
      )}
    </div>
  );
}
