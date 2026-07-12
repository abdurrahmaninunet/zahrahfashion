/** Canonical public origin, used for SEO: metadataBase, canonicals, sitemap,
 *  robots and JSON-LD. Override with the SITE_URL env var per environment. */
export const SITE_URL = (process.env.SITE_URL ?? 'https://zahrahfashion.com').replace(/\/+$/, '');
