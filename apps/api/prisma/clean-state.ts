/**
 * Blank-store reset for go-live. Wipes ALL catalog, inventory, orders,
 * customers, media, promotions, reviews, gift cards/wallet, content/homepage
 * and messages — a completely empty shop.
 *
 * KEEPS: roles, staff/owner (Manager) accounts, store settings, delivery zones,
 * units, store locations, suppliers.
 *
 * Run:  npx tsx prisma/clean-state.ts     (destructive — no undo)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Root/leaf tables to empty. TRUNCATE ... CASCADE also clears any dependent we
// don't list. None of the KEPT tables reference these, so CASCADE can't reach them.
const TABLES = [
  // catalog
  'categories', 'attributes', 'attribute_options', 'category_attributes',
  'products', 'variants', 'product_media', 'catalog_audit_log',
  'bundle_components', 'bundle_config', 'bundle_slots',
  // inventory
  'stock_levels', 'stock_movements', 'stock_alerts', 'receipts', 'receipt_lines',
  'stocktakes', 'stocktake_lines', 'rider_cash_ledger', 'rider_day_close',
  // orders
  'orders', 'order_lines', 'payments', 'shipments', 'shipment_lines', 'shipment_geo_events',
  'refunds', 'refund_lines', 'returns', 'return_lines', 'order_events', 'order_notes',
  'manual_discounts', 'cart_snapshots',
  // promotions
  'promotions', 'promotion_scope_items', 'promo_codes', 'redemptions',
  'customer_promotion_uses', 'promotion_events',
  // customers
  'customers', 'customer_addresses', 'customer_aliases', 'customer_tags', 'customer_notes',
  'consents', 'customer_access_log', 'merge_events', 'customer_sessions', 'customer_credentials',
  // media
  'media_assets', 'media_renditions', 'media_usages',
  // content / homepage
  'content_items', 'compositions', 'composition_sections', 'content_versions', 'content_events',
  // dashboard
  'notifications',
  // raw feature tables (wallet / reviews / anko / contact)
  'gift_cards', 'customer_balances', 'balance_ledger', 'wallet_topups',
  'product_reviews', 'anko_locks', 'contact_messages',
];

async function main() {
  // Only truncate tables that actually exist (raw feature tables are created on
  // service boot, so skip any that haven't been created yet).
  const rows = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ANY(${TABLES}::text[])`;
  const present = rows.map((r) => r.table_name);
  const missing = TABLES.filter((t) => !present.includes(t));

  const list = present.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);

  const [products, customers, orders, media] = await Promise.all([
    prisma.product.count(), prisma.customer.count(), prisma.order.count(), prisma.mediaAsset.count(),
  ]);
  const [users, settings, zones, units] = await Promise.all([
    prisma.user.count(), prisma.settingValue.count(), prisma.zone.count(), prisma.unit.count(),
  ]);

  console.log(`Emptied ${present.length} tables.`);
  if (missing.length) console.log(`Skipped (not present): ${missing.join(', ')}`);
  console.log(`\nBlank store now → products:${products} customers:${customers} orders:${orders} media:${media}`);
  console.log(`Kept → staff:${users} settings:${settings} zones:${zones} units:${units}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
