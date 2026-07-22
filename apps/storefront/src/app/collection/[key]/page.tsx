import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/api';
import { ProductCard, ProductCardData } from '@/components/product-card';

export const revalidate = 60;

const TITLES: Record<string, { title: string; blurb: string }> = {
  mens: { title: "Men's Collection", blurb: 'Handpicked lace, fabrics and finishing touches for the modern gentleman.' },
  'luxury-lace': { title: 'Luxury Lace', blurb: 'Our finest Swiss voile and premium lace, curated for life’s grand occasions.' },
  perfumes: { title: 'Perfumes', blurb: 'Long-lasting oud and signature fragrances that leave an impression.' },
};

interface Curated { title: string; products: ProductCardData[] }

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const meta = TITLES[key];
  if (!meta) return {};
  return { title: meta.title, description: meta.blurb, alternates: { canonical: `/collection/${key}` } };
}

export default async function CollectionPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const meta = TITLES[key];
  if (!meta) notFound();

  let data: Curated = { title: meta.title, products: [] };
  try {
    data = await serverApi<Curated>(`/store/curated/${key}`, 60);
  } catch {
    /* stale-while-error */
  }

  return (
    <div className="mx-auto max-w-[1905px] px-4 py-6 lg:px-[8rem]">
      <h1 className="font-display text-2xl font-bold md:text-3xl">{meta.title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-stone-500">{meta.blurb}</p>
      {data.products.length ? (
        <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {data.products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-sm text-stone-400">Nothing here just yet — check back soon.</p>
      )}
    </div>
  );
}
