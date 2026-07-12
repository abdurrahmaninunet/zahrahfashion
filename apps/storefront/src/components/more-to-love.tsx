import { serverApi } from '@/lib/api';
import type { ProductCardData } from '@/components/product-card';
import { MoreToLoveFeed } from './more-to-love-feed';
import { FALLBACK, fromProduct } from './more-to-love-data';

interface PlpResponse {
  products: ProductCardData[];
  total: number;
  pageSize: number;
}

/**
 * "More to love" — the discovery feed that closes the homepage. Server-renders
 * the first page (SEO + fast first paint), then a client feed auto-loads the
 * next pages on scroll and finally offers a "View more" button.
 */
export async function MoreToLove() {
  let page1: PlpResponse | null = null;
  try {
    page1 = await serverApi<PlpResponse>('/store/plp', 60);
  } catch {
    /* API unavailable — fall through to the illustrative set */
  }

  // Show real products whenever the catalogue has any; only fall back to the
  // illustrative set when the API is down or returns nothing.
  const live = Boolean(page1 && page1.products.length > 0);
  const initialItems = live ? page1!.products.map(fromProduct) : FALLBACK;

  return (
    <section className="mx-auto max-w-[1905px] px-4 py-10 lg:px-[8rem]">
      <h2 className="mb-6 text-center font-display text-2xl font-bold md:text-3xl">More to love</h2>
      <MoreToLoveFeed
        initialItems={initialItems}
        live={live}
        total={page1?.total ?? 0}
        pageSize={page1?.pageSize ?? 0}
      />
    </section>
  );
}
