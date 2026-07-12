import type { Metadata } from 'next';
import { Users } from 'lucide-react';
import { serverApi } from '@/lib/api';
import { ProductCard, ProductCardData } from '@/components/product-card';

export const metadata: Metadata = {
  title: 'Anko — Group & Event Fabrics',
  description: 'Anko (aso-ebi) fabrics for the whole group — the lowest bulk price, exclusive to the buyer once taken.',
};
export const revalidate = 30;

/** Anko store — fabrics available for a group/event bulk buy right now. Once a
 *  fabric is bought as anko it's exclusive to that buyer and drops off this list
 *  until the exclusivity period ends. Cards open the normal product page. */
export default async function AnkoStorePage() {
  let products: ProductCardData[] = [];
  try {
    const data = await serverApi<{ products: ProductCardData[] }>('/store/anko', 30);
    products = data.products ?? [];
  } catch {
    /* API unavailable — show the empty state */
  }

  return (
    <div className="mx-auto max-w-[1905px] px-4 py-8 lg:px-[8rem]">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold md:text-3xl">Anko</h1>
        <p className="mt-0.5 text-sm text-stone-500">Group &amp; event fabrics (aso-ebi) at the lowest bulk price — yours exclusively once you take it.</p>
      </div>

      {products.length ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {products.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 6} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-20 text-center">
          <Users size={30} className="mx-auto text-stone-300" />
          <p className="mt-3 font-medium text-stone-700">No anko fabrics available right now</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">
            Fabrics open for a group/event bulk buy will appear here. Taken ones return once their exclusivity period ends.
          </p>
        </div>
      )}
    </div>
  );
}
