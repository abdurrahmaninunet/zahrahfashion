import type { Metadata } from 'next';
import { serverApi } from '@/lib/api';
import { ProductCard, ProductCardData } from '@/components/product-card';

export const revalidate = 30;
export const metadata: Metadata = {
  title: 'New Arrivals',
  description: 'The latest additions at Zahrah Fashion Hub — fresh lace, fabrics, perfumes and more.',
  alternates: { canonical: '/new-arrivals' },
};

interface Listing { products: ProductCardData[]; total: number }

export default async function NewArrivalsPage() {
  let data: Listing = { products: [], total: 0 };
  try {
    data = await serverApi<Listing>('/store/new-arrivals', 30);
  } catch {
    /* stale-while-error */
  }

  return (
    <div className="mx-auto max-w-[1905px] px-4 py-6 lg:px-[8rem]">
      <h1 className="font-display text-2xl font-bold md:text-3xl">New Arrivals</h1>
      <p className="mt-1 text-sm text-stone-500">Fresh in — our latest pieces.</p>
      {data.products.length ? (
        <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {data.products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-sm text-stone-400">No products yet — check back soon.</p>
      )}
    </div>
  );
}
