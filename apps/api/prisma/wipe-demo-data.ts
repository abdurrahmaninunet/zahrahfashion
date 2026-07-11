/**
 * Wipes demo/transactional product data for a clean start:
 * products, variants, stock, receipts, stocktakes, orders and their
 * dependents (shipments, refunds, returns, redemptions).
 *
 * KEEPS: categories, attributes, units, zones, settings, staff, customers
 * (their cached order metrics are reset), content, promotions.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const counts: Record<string, number> = {};
  const del = async (name: string, fn: () => Promise<{ count: number }>) => {
    counts[name] = (await fn()).count;
  };

  // Order-domain dependents first (FK order)
  await del('shipment_geo_events', () => prisma.shipmentGeoEvent.deleteMany());
  await del('shipment_lines', () => prisma.shipmentLine.deleteMany());
  await del('shipments', () => prisma.shipment.deleteMany());
  await del('refund_lines', () => prisma.refundLine.deleteMany());
  await del('refunds', () => prisma.refund.deleteMany());
  await del('return_lines', () => prisma.returnLine.deleteMany());
  await del('returns', () => prisma.return.deleteMany());
  await del('order_events', () => prisma.orderEvent.deleteMany());
  await del('order_notes', () => prisma.orderNote.deleteMany());
  await del('manual_discounts', () => prisma.manualDiscount.deleteMany());
  await del('redemptions', () => prisma.redemption.deleteMany());
  await del('customer_promotion_uses', () => prisma.customerPromotionUse.deleteMany());
  await del('payments', () => prisma.payment.deleteMany());
  await del('order_lines', () => prisma.orderLine.deleteMany());
  await del('orders', () => prisma.order.deleteMany());
  await del('cart_snapshots', () => prisma.cartSnapshot.deleteMany());

  // Inventory domain
  await del('stocktake_lines', () => prisma.stocktakeLine.deleteMany());
  await del('stocktakes', () => prisma.stocktake.deleteMany());
  await del('receipt_lines', () => prisma.receiptLine.deleteMany());
  await del('receipts', () => prisma.receipt.deleteMany());
  await del('stock_movements', () => prisma.stockMovement.deleteMany());
  await del('stock_alerts', () => prisma.stockAlert.deleteMany());
  await del('stock_levels', () => prisma.stockLevel.deleteMany());
  await del('rider_cash_ledger', () => prisma.riderCashLedger.deleteMany());
  await del('rider_day_close', () => prisma.riderDayClose.deleteMany());

  // Catalog products
  await del('bundle_components', () => prisma.bundleComponent.deleteMany());
  await del('bundle_config', () => prisma.bundleConfig.deleteMany());
  await del('bundle_slots', () => prisma.bundleSlot.deleteMany());
  await del('product_media', () => prisma.productMedia.deleteMany());
  await del('promotion_scope_items (product/variant refs)', () =>
    prisma.promotionScopeItem.deleteMany({ where: { kind: { in: ['variant', 'product', 'product_excl'] } } }));
  await del('variants', () => prisma.variant.deleteMany());
  await del('products', () => prisma.product.deleteMany());

  // Categories (children before parents for the self-referencing FK)
  await del('category_attributes', () => prisma.categoryAttribute.deleteMany());
  await del('promotion_scope_items (category refs)', () =>
    prisma.promotionScopeItem.deleteMany({ where: { kind: { in: ['category', 'category_excl'] } } }));
  await del('categories (children)', () => prisma.category.deleteMany({ where: { parentId: { not: null } } }));
  await del('categories (roots)', () => prisma.category.deleteMany());

  // Reset cached customer metrics (their orders are gone)
  await prisma.customer.updateMany({ data: { metrics: undefined as never, failedPodCount: 0 } });

  const printable = Object.entries(counts).filter(([, n]) => n > 0);
  console.log('Wiped:');
  for (const [name, n] of printable) console.log(`  ${name}: ${n}`);
  console.log('Kept: attributes, units, zones, settings, staff, customers, content, promotions');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
