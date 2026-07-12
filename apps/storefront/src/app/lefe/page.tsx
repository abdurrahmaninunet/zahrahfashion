import type { Metadata } from 'next';
import { Gift } from 'lucide-react';
import { serverApi } from '@/lib/api';
import { ProductCard, ProductCardData } from '@/components/product-card';

export const metadata: Metadata = {
  title: 'Lefe — Bridal Gift Packages',
  description: 'Curated bridal gift sets (kayan lefe) — fabrics, scents, bags and more, packaged and priced as one.',
};
export const revalidate = 30;

/** Lefe store — bridal gift packages. Each Lefe is one product (a bundle);
 *  cards open the standard PDP which shows "What's inside" and a single Buy. */
export default async function LefeStorePage() {
  let products: ProductCardData[] = [];
  try {
    const data = await serverApi<{ products: ProductCardData[] }>('/store/plp?store=lefe', 30);
    products = data.products ?? [];
  } catch {
    /* API unavailable — show the empty state */
  }

  return (
    <div className="mx-auto max-w-[1905px] px-4 py-8 lg:px-[8rem]">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold md:text-3xl">Lefe</h1>
        <p className="mt-0.5 text-sm text-stone-500">Bridal gift sets — everything for the bride, curated and priced as one.</p>
      </div>

      {products.length ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {products.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 6} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-20 text-center">
          <Gift size={30} className="mx-auto text-stone-300" />
          <p className="mt-3 font-medium text-stone-700">No Lefe yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">
            Curated bridal gift packages will appear here soon.
          </p>
        </div>
      )}
    </div>
  );
}
