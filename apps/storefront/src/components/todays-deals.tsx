import { ProductCard, type ProductCardData } from '@/components/product-card';

/** Panel of real, admin-curated products (rendered with the shared card). */
function ProductPanel({ title, products }: { title: string; products: ProductCardData[] }) {
  return (
    <div className="border-2 border-stone-300 p-3 sm:border-4 sm:border-stone-400 sm:p-5 md:p-6">
      <h3 className="text-center text-lg font-bold sm:text-xl md:text-2xl">{title}</h3>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-5 sm:gap-3 md:gap-4">
        {products.slice(0, 3).map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </div>
  );
}

/**
 * Today's Deals — two panels of admin-curated products (from the `todays_deals`
 * composition section). Renders nothing when nothing is curated — no placeholder
 * products are ever shown.
 */
export function TodaysDeals({
  men,
  women,
  menTitle = 'Men',
  womenTitle = 'Women',
}: {
  men?: ProductCardData[];
  women?: ProductCardData[];
  menTitle?: string;
  womenTitle?: string;
} = {}) {
  const hasMen = (men?.length ?? 0) > 0;
  const hasWomen = (women?.length ?? 0) > 0;
  if (!hasMen && !hasWomen) return null;

  return (
    <section className="mx-auto max-w-[1905px] px-4 py-8 md:py-10 lg:px-[8rem]">
      <h2 className="mb-5 text-center font-display text-2xl font-bold md:mb-6 md:text-3xl">Today&apos;s deals</h2>
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {hasMen && <ProductPanel title={menTitle} products={men!} />}
        {hasWomen && <ProductPanel title={womenTitle} products={women!} />}
      </div>
    </section>
  );
}
