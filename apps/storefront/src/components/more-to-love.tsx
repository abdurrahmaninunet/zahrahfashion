import { serverApi } from '@/lib/api';
import type { ProductCardData } from '@/components/product-card';
import { MoreToLoveFeed } from './more-to-love-feed';
import { fromProduct } from './more-to-love-data';

interface PlpResponse {
  products: ProductCardData[];
  total: number;
  pageSize: number;
}

/**
 * "More to love" — the discovery feed that closes the homepage. Server-renders
 * the first page (SEO + fast first paint), then a client feed auto-loads the
 * next pages on scroll and finally offers a "View more" button. Renders nothing
 * when the catalogue is empty — no placeholder products are ever shown.
 */
export async function MoreToLove() {
  let page1: PlpResponse | null = null;
  try {
    page1 = await serverApi<PlpResponse>('/store/plp', 60);
  } catch {
    /* API unavailable — hide the section */
  }

  if (!page1 || page1.products.length === 0) return null;
  const initialItems = page1.products.map(fromProduct);

  return (
    <section className="mx-auto max-w-[1905px] px-4 py-10 lg:px-[8rem]">
      <h2 className="mb-6 text-center font-display text-2xl font-bold md:text-3xl">More to love</h2>
      <MoreToLoveFeed
        initialItems={initialItems}
        total={page1.total}
        pageSize={page1.pageSize}
      />
    </section>
  );
}
