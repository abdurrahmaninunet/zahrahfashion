import Link from 'next/link';
import type { Metadata } from 'next';
import { serverApi } from '@/lib/api';

export const revalidate = 60;
export const metadata: Metadata = {
  title: 'Collections',
  description: 'Shop Zahrah Fashion Hub by collection — curated edits of lace, fabrics and more.',
  alternates: { canonical: '/collections' },
};

interface Collection { id: string; name: string; slug: string }

const GRADIENTS = [
  'from-stone-700 to-stone-900',
  'from-[#8a6d1f] to-[#3d3010]',
  'from-emerald-800 to-emerald-950',
  'from-rose-900 to-stone-900',
  'from-blue-900 to-stone-900',
];

export default async function CollectionsIndexPage() {
  let collections: Collection[] = [];
  try {
    collections = await serverApi<Collection[]>('/store/collections', 60);
  } catch {
    /* none configured */
  }

  return (
    <div className="mx-auto max-w-[1905px] px-4 py-8 lg:px-[8rem]">
      <h1 className="font-display text-3xl font-bold md:text-4xl">Collections</h1>
      <p className="mt-2 text-stone-500">Curated edits — shop by the looks we&apos;ve put together.</p>

      {collections.length ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {collections.map((c, i) => (
            <Link
              key={c.id}
              href={`/collections/${c.slug}`}
              className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-xl"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} transition-transform duration-500 group-hover:scale-105`} />
              <span className="relative z-10 w-full bg-gradient-to-t from-black/60 to-transparent p-4 font-display text-lg font-bold uppercase tracking-[0.06em] text-white">
                {c.name}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-2xl border border-stone-200 bg-stone-50 p-8 text-center text-sm text-stone-500">
          Our collections will appear here soon.
        </p>
      )}
    </div>
  );
}
