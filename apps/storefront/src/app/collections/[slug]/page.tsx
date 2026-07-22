import { notFound } from 'next/navigation';
import { serverApi } from '@/lib/api';
import { ProductCard, ProductCardData } from '@/components/product-card';

export const revalidate = 30;

interface CollectionListing {
  collection: { name: string; slug: string };
  products: ProductCardData[];
  total: number;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const data = await serverApi<CollectionListing>(`/store/collections/${slug}`);
    return {
      title: data.collection.name,
      description: `Shop the ${data.collection.name} collection at Zahrah Fashion Hub.`,
      alternates: { canonical: `/collections/${slug}` },
    };
  } catch {
    return {};
  }
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let data: CollectionListing | null = null;
  try {
    data = await serverApi<CollectionListing>(`/store/collections/${slug}`, 30);
  } catch {
    notFound();
  }
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-[1905px] px-4 py-6 lg:px-[8rem]">
      <h1 className="font-display text-2xl font-bold md:text-3xl">{data.collection.name}</h1>
      {data.products.length ? (
        <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {data.products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-sm text-stone-400">No products in this collection yet.</p>
      )}
    </div>
  );
}
