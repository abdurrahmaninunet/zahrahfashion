import Link from "next/link";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api";
import { ProductCard, ProductCardData } from "@/components/product-card";
import type { ProductTileData } from "@/components/product-tile";
import { TileFeed } from "@/components/tile-feed";
import { DUMMY_PLP } from "@/lib/dummy-plp";

export const revalidate = 60;

interface Filter {
  code: string;
  name: string;
  inputType: string;
  values: {
    label: string;
    value: string;
    hexCode: string | null;
    count: number;
  }[];
}
interface Listing {
  category: {
    id: string;
    name: string;
    slug: string;
    image: string | null;
  } | null;
  total: number;
  page: number;
  pageSize: number;
  products: ProductCardData[];
  filters: Filter[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const listing = await serverApi<Listing>(`/store/plp?category=${slug}`);
    const name = listing.category?.name ?? DUMMY_PLP[slug]?.name ?? "Shop";
    return {
      title: name,
      description: `Shop ${name} — pay with card, transfer or on delivery in Abuja.`,
    };
  } catch {
    if (DUMMY_PLP[slug]) return { title: DUMMY_PLP[slug].name };
    return {};
  }
}

/** PLP — filters URL-encoded (shareable, back-button-safe, FR-SF-CAT-01). */
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  const apiQuery = new URLSearchParams({ category: slug });
  let hasQuery = false;
  for (const [key, value] of Object.entries(query)) {
    if (
      key.startsWith("f_") ||
      ["sort", "page", "priceMin", "priceMax"].includes(key)
    ) {
      apiQuery.set(key, value);
      hasQuery = true;
    }
  }

  let listing: Listing | null = null;
  try {
    listing = await serverApi<Listing>(`/store/plp?${apiQuery}`, 30);
  } catch {
    listing = null;
  }

  // Real stock always wins. Demo categories (Fabric, Laces, Perfumes, Caps) fall
  // back to illustrative placeholders only when the live catalogue has nothing to
  // show for them — an empty *base* listing (no filters) or the API being down.
  const emptyBase = !hasQuery && (!listing || listing.products.length === 0);
  if (emptyBase && DUMMY_PLP[slug]) return <DummyCategory slug={slug} />;
  if (!listing) notFound();

  const makeHref = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(query as Record<string, string>);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    next.delete("page");
    const qs = next.toString();
    return `/c/${slug}${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-[1905px] px-4 lg:px-[8rem] py-6">
      {listing.products.length ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {listing.products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-sm text-stone-400">
          No products in this category yet.
        </p>
      )}

      {listing.total > listing.pageSize && (
        <div className="mt-8 flex justify-center gap-2 text-sm">
          {listing.page > 1 && (
            <Link
              href={makeHref({ page: String(listing.page - 1) })}
              className="rounded-md border border-stone-200 bg-white px-4 py-2"
            >
              ← Previous
            </Link>
          )}
          {listing.page * listing.pageSize < listing.total && (
            <Link
              href={makeHref({ page: String(listing.page + 1) })}
              className="rounded-md border border-stone-200 bg-white px-4 py-2"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** Placeholder category listing — gradient tiles until real stock is added. */
function DummyCategory({ slug }: { slug: string }) {
  const { products } = DUMMY_PLP[slug];
  const items: ProductTileData[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    href: `/search?q=${encodeURIComponent(p.name.split(" —")[0])}`,
    bg: p.bg,
    price: p.price,
    compareAt: p.compareAt,
    badge: p.badge,
    rating: p.rating,
    reviews: p.reviews,
  }));
  return (
    <div className="mx-auto max-w-[1905px] px-4 py-6 lg:px-[8rem]">
      <TileFeed items={items} />
    </div>
  );
}
