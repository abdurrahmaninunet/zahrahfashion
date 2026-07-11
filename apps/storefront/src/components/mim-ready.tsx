import Link from 'next/link';
import { ArrowRight, Shirt } from 'lucide-react';
import { serverApi } from '@/lib/api';
import { ProductCard, type ProductCardData } from '@/components/product-card';

interface MimReadyResponse {
  enabled: boolean;
  title: string;
  subtitle: string;
  products: ProductCardData[];
}

/**
 * Homepage "ready to personalise" MIM band — a curated trio of MIM products the
 * owner picks in the admin MIM → Content tab. Renders nothing when the MIM store
 * is switched off or no products are featured (content mistakes never break the
 * homepage). Cards route to the /mim configurator.
 */
export async function MimReady() {
  let data: MimReadyResponse | null = null;
  try {
    data = await serverApi<MimReadyResponse>('/store/mim/ready', 30);
  } catch {
    /* API unavailable — skip the section silently */
  }
  if (!data || !data.enabled || !data.products.length) return null;

  return (
    <section className="mx-auto max-w-[1905px] px-2.5 py-10 lg:px-[8rem]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#faf5e6] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#8a6d1f]">
            <Shirt size={13} /> MIM · Custom printing
          </span>
          <h2 className="mt-2 font-display text-2xl font-bold md:text-3xl">{data.title || 'Ready to personalise'}</h2>
          {data.subtitle && <p className="mt-1 max-w-xl text-sm text-stone-500">{data.subtitle}</p>}
        </div>
        <Link href="/mim" className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-stone-800">
          Shop MIM <ArrowRight size={16} />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
        {data.products.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 3} hrefBase="/mim/shop" />)}
      </div>
    </section>
  );
}
