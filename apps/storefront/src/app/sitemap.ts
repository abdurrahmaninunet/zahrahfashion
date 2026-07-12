import type { MetadataRoute } from 'next';
import { serverApi } from '@/lib/api';
import { SITE_URL } from '@/lib/site';
import { STATIC_PAGES } from '@/lib/static-pages';

export const revalidate = 3600; // rebuild the sitemap hourly

interface SitemapData {
  products: { slug: string; updatedAt: string }[];
  categories: { slug: string; updatedAt: string }[];
}

/** /sitemap.xml — home, shops, static pages, every active category and product,
 *  so Google can discover the whole catalogue. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let data: SitemapData = { products: [], categories: [] };
  try {
    data = await serverApi<SitemapData>('/store/sitemap', 3600);
  } catch {
    /* API offline during build — emit the static routes only */
  }

  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/shops`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    ...Object.entries(STATIC_PAGES)
      .filter(([, page]) => !page.redirect)
      .map(([slug]) => ({
        url: `${SITE_URL}/pages/${slug}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.3,
      })),
  ];

  const categoryRoutes: MetadataRoute.Sitemap = data.categories.map((c) => ({
    url: `${SITE_URL}/c/${c.slug}`,
    lastModified: c.updatedAt ? new Date(c.updatedAt) : now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const productRoutes: MetadataRoute.Sitemap = data.products.map((p) => ({
    url: `${SITE_URL}/p/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
