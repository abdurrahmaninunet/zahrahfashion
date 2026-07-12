import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/** /robots.txt — allow crawling of public pages, keep private/checkout flows out
 *  of the index, and point crawlers at the sitemap. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/cart', '/checkout', '/account', '/track/', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
