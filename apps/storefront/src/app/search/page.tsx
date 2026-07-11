'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ProductCard, ProductCardData } from '@/components/product-card';

interface SearchResults {
  products: ProductCardData[];
  total: number;
  didYouMean: string | null;
  popularCategories?: { name: string; slug: string }[];
}

function SearchPageInner() {
  const params = useSearchParams();
  const q = params.get('q') ?? '';

  const { data, isLoading } = useQuery({
    queryKey: ['search', q],
    queryFn: () => api.get<SearchResults>(`/store/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
  });

  return (
    <div className="mx-auto max-w-[1905px] px-2.5 lg:px-[8rem] py-6">
      {q.trim().length >= 2 ? (
        isLoading ? (
          <p className="py-12 text-center text-sm text-stone-400">Searching…</p>
        ) : data?.products.length ? (
          <>
            <p className="mb-4 text-sm text-stone-500">{data.total} result{data.total === 1 ? '' : 's'} for “{q}”</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {data.products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </>
        ) : data ? (
          <div className="py-12 text-center">
            <p className="text-stone-600">Nothing found for “{q}”.</p>
            {data.didYouMean && (
              <p className="mt-2 text-sm">
                Did you mean{' '}
                <Link href={`/search?q=${encodeURIComponent(data.didYouMean)}`} className="font-medium text-[#8a6d1f] underline underline-offset-2">
                  {data.didYouMean}
                </Link>?
              </p>
            )}
            {data.popularCategories?.length ? (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {data.popularCategories.map((c) => (
                  <Link key={c.slug} href={`/c/${c.slug}`} className="rounded-full border border-stone-200 bg-white px-4 py-1.5 text-sm hover:border-stone-400">
                    {c.name}
                  </Link>
                ))}
              </div>
            ) : null}
            <p className="mt-6 text-xs text-stone-400">Can’t find it? Tap the WhatsApp button and tell us what you’re looking for.</p>
          </div>
        ) : null
      ) : (
        <p className="py-16 text-center text-sm text-stone-400">Use the search bar at the top to find lace, ankara, perfumes and more.</p>
      )}
    </div>
  );
}

export default function SearchPage() {
  return <Suspense fallback={<p className="py-12 text-center text-sm text-stone-400">Loading…</p>}><SearchPageInner /></Suspense>;
}
