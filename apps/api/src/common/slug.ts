export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Reserved storefront routes slugs must not collide with (Content rule 3). */
export const RESERVED_SLUGS = new Set([
  'products', 'cart', 'checkout', 'account', 'admin', 'api', 'search',
  'collections', 'categories', 'orders', 'login', 'register', 'uploads',
]);
