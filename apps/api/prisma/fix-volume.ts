/**
 * One-off fix: Volume was a number+variant-defining attribute — a combination
 * that can't generate variants, filter, or even be edited. Converts it to a
 * select with size options and moves product-level values onto variants.
 * Idempotent.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SIZES = ['30ml', '50ml', '100ml', '200ml'];

async function main() {
  const attr = await prisma.attribute.findUnique({ where: { code: 'volume_ml' }, include: { options: true } });
  if (!attr) {
    console.log('volume_ml attribute not found — nothing to do');
    return;
  }

  if (attr.inputType !== 'select') {
    await prisma.attribute.update({ where: { id: attr.id }, data: { inputType: 'select', name: 'Volume' } });
    console.log('volume_ml → select');
  }

  const existing = new Set(attr.options.map((o) => o.value));
  for (const [i, size] of SIZES.entries()) {
    if (!existing.has(size)) {
      await prisma.attributeOption.create({
        data: { attributeId: attr.id, label: size, value: size, sortOrder: i + 1 },
      });
      existing.add(size);
      console.log('option added:', size);
    }
  }

  // Move product-level numeric values onto the product's variants.
  const products = await prisma.product.findMany({ include: { variants: true } });
  for (const product of products) {
    const values = (product.attributeValues as Record<string, unknown>) ?? {};
    if (values.volume_ml === undefined) continue;

    const label = typeof values.volume_ml === 'number' ? `${values.volume_ml}ml` : String(values.volume_ml);
    if (!existing.has(label)) {
      await prisma.attributeOption.create({
        data: { attributeId: attr.id, label, value: label, sortOrder: 99 },
      });
      existing.add(label);
      console.log('option added (from product data):', label);
    }

    const { volume_ml: _moved, ...rest } = values;
    await prisma.product.update({ where: { id: product.id }, data: { attributeValues: rest as never } });
    for (const variant of product.variants) {
      const optionValues = (variant.optionValues as Record<string, string>) ?? {};
      if (!optionValues.volume_ml) {
        await prisma.variant.update({
          where: { id: variant.id },
          data: { optionValues: { ...optionValues, volume_ml: label } as never },
        });
      }
    }
    console.log(`migrated ${product.name}: volume ${label} moved to ${product.variants.length} variant(s)`);
  }
  console.log('done');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
