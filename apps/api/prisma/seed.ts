/**
 * Seed: roles (Settings FR-RBAC-01), zones, units (Product FR-UOM-02),
 * an Owner account, and a small sample catalog for local development.
 * Idempotent — safe to re-run.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { ROLE_SEED } from '../src/auth/capabilities';

const prisma = new PrismaClient();

async function main() {
  // ── Roles ──────────────────────────────────────────────────────────────────
  for (const [key, role] of Object.entries(ROLE_SEED)) {
    await prisma.role.upsert({
      where: { key },
      create: { key, name: role.name, isSystem: true, capabilities: role.capabilities },
      update: { name: role.name, capabilities: role.capabilities },
    });
  }
  console.log(`Seeded ${Object.keys(ROLE_SEED).length} roles`);

  // ── Owner account ──────────────────────────────────────────────────────────
  const ownerEmail = 'zahrah@zahrahfashion.com';
  const ownerPassword = 'ZahrahOwner#2026';
  const existing = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!existing) {
    await prisma.user.create({
      data: {
        name: 'Manager',
        email: ownerEmail,
        roleKey: 'owner',
        status: 'active',
        passwordHash: await argon2.hash(ownerPassword, { type: argon2.argon2id }),
      },
    });
    console.log(`Owner account: ${ownerEmail} / ${ownerPassword}`);
  }

  // ── Zones (Settings §7.2 seed) ─────────────────────────────────────────────
  // Delivery states — Nigeria's 36 states + FCT, tiered by distance from Abuja (home; fees in kobo).
  const zones = [
    { name: 'FCT (Abuja)', deliveryFee: 250_000, sortOrder: 1, areasText: 'Abuja, Gwarinpa, Maitama, Wuse, Kubwa' },
    { name: 'Abia', deliveryFee: 650_000, sortOrder: 2, areasText: 'Umuahia, Aba' },
    { name: 'Adamawa', deliveryFee: 500_000, sortOrder: 3, areasText: 'Yola' },
    { name: 'Akwa Ibom', deliveryFee: 650_000, sortOrder: 4, areasText: 'Uyo' },
    { name: 'Anambra', deliveryFee: 650_000, sortOrder: 5, areasText: 'Awka, Onitsha' },
    { name: 'Bauchi', deliveryFee: 500_000, sortOrder: 6, areasText: 'Bauchi' },
    { name: 'Bayelsa', deliveryFee: 650_000, sortOrder: 7, areasText: 'Yenagoa' },
    { name: 'Benue', deliveryFee: 350_000, sortOrder: 8, areasText: 'Makurdi' },
    { name: 'Borno', deliveryFee: 500_000, sortOrder: 9, areasText: 'Maiduguri' },
    { name: 'Cross River', deliveryFee: 650_000, sortOrder: 10, areasText: 'Calabar' },
    { name: 'Delta', deliveryFee: 650_000, sortOrder: 11, areasText: 'Asaba, Warri' },
    { name: 'Ebonyi', deliveryFee: 650_000, sortOrder: 12, areasText: 'Abakaliki' },
    { name: 'Edo', deliveryFee: 650_000, sortOrder: 13, areasText: 'Benin City' },
    { name: 'Ekiti', deliveryFee: 600_000, sortOrder: 14, areasText: 'Ado-Ekiti' },
    { name: 'Enugu', deliveryFee: 650_000, sortOrder: 15, areasText: 'Enugu' },
    { name: 'Gombe', deliveryFee: 500_000, sortOrder: 16, areasText: 'Gombe' },
    { name: 'Imo', deliveryFee: 650_000, sortOrder: 17, areasText: 'Owerri' },
    { name: 'Jigawa', deliveryFee: 500_000, sortOrder: 18, areasText: 'Dutse' },
    { name: 'Kaduna', deliveryFee: 350_000, sortOrder: 19, areasText: 'Kaduna, Zaria' },
    { name: 'Kano', deliveryFee: 500_000, sortOrder: 20, areasText: 'Kano' },
    { name: 'Katsina', deliveryFee: 500_000, sortOrder: 21, areasText: 'Katsina' },
    { name: 'Kebbi', deliveryFee: 500_000, sortOrder: 22, areasText: 'Birnin Kebbi' },
    { name: 'Kogi', deliveryFee: 350_000, sortOrder: 23, areasText: 'Lokoja' },
    { name: 'Kwara', deliveryFee: 350_000, sortOrder: 24, areasText: 'Ilorin' },
    { name: 'Lagos', deliveryFee: 600_000, sortOrder: 25, areasText: 'Ikeja, Lekki, Victoria Island, Ikoyi, Yaba, Surulere, Ajah, Agege' },
    { name: 'Nasarawa', deliveryFee: 350_000, sortOrder: 26, areasText: 'Lafia' },
    { name: 'Niger', deliveryFee: 350_000, sortOrder: 27, areasText: 'Minna' },
    { name: 'Ogun', deliveryFee: 600_000, sortOrder: 28, areasText: 'Abeokuta, Sagamu' },
    { name: 'Ondo', deliveryFee: 600_000, sortOrder: 29, areasText: 'Akure' },
    { name: 'Osun', deliveryFee: 600_000, sortOrder: 30, areasText: 'Osogbo, Ile-Ife' },
    { name: 'Oyo', deliveryFee: 600_000, sortOrder: 31, areasText: 'Ibadan' },
    { name: 'Plateau', deliveryFee: 350_000, sortOrder: 32, areasText: 'Jos' },
    { name: 'Rivers', deliveryFee: 650_000, sortOrder: 33, areasText: 'Port Harcourt, Bonny' },
    { name: 'Sokoto', deliveryFee: 500_000, sortOrder: 34, areasText: 'Sokoto' },
    { name: 'Taraba', deliveryFee: 500_000, sortOrder: 35, areasText: 'Jalingo' },
    { name: 'Yobe', deliveryFee: 500_000, sortOrder: 36, areasText: 'Damaturu' },
    { name: 'Zamfara', deliveryFee: 500_000, sortOrder: 37, areasText: 'Gusau' },
  ].map((z) => ({ ...z, podAllowed: false, podMaxValue: null }));
  for (const zone of zones) {
    const found = await prisma.zone.findFirst({ where: { name: zone.name } });
    if (!found) await prisma.zone.create({ data: zone });
  }

  // Store locations (physical shops) — seed the head office if none exist. Raw SQL so this
  // works whether or not the Prisma client has been regenerated for the StoreLocation model.
  await prisma.$executeRawUnsafe(`
    INSERT INTO store_locations (id, name, phone, whatsapp, address, opens_at, closes_at, sort_order, status, created_at, updated_at)
    SELECT 'loc_main', 'Zahrah Fashion — Abuja', '+234 7060802195', '+2347060802195',
           'Plot 5, Ademola Adetokunbo Crescent, Wuse 2, Abuja', '09:00', '18:00', 1, 'active', now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM store_locations)`);

  // ── Units (FR-UOM-02) ──────────────────────────────────────────────────────
  const units = [
    { name: 'yard', abbreviation: 'yd', measurementType: 'length', fractionalAllowed: true },
    { name: 'meter', abbreviation: 'm', measurementType: 'length', fractionalAllowed: true },
    { name: 'inch', abbreviation: 'in', measurementType: 'length', fractionalAllowed: true },
    { name: 'millilitre', abbreviation: 'ml', measurementType: 'volume', fractionalAllowed: false },
    { name: 'centilitre', abbreviation: 'cl', measurementType: 'volume', fractionalAllowed: false },
    { name: 'gram', abbreviation: 'g', measurementType: 'weight', fractionalAllowed: true },
    { name: 'kilogram', abbreviation: 'kg', measurementType: 'weight', fractionalAllowed: true },
    { name: 'piece', abbreviation: 'pc', measurementType: 'count', fractionalAllowed: false },
    { name: 'pair', abbreviation: 'pr', measurementType: 'count', fractionalAllowed: false },
    { name: 'set', abbreviation: 'set', measurementType: 'count', fractionalAllowed: false },
    { name: 'dozen', abbreviation: 'dz', measurementType: 'count', fractionalAllowed: false },
    { name: 'pack', abbreviation: 'pk', measurementType: 'count', fractionalAllowed: false },
    { name: 'bundle', abbreviation: 'bnd', measurementType: 'count', fractionalAllowed: false },
    { name: 'carton', abbreviation: 'ctn', measurementType: 'count', fractionalAllowed: false },
  ];
  for (const unit of units) {
    const found = await prisma.unit.findFirst({ where: { name: unit.name } });
    if (!found) await prisma.unit.create({ data: unit });
  }
  const yard = await prisma.unit.findFirstOrThrow({ where: { name: 'yard' } });
  const piece = await prisma.unit.findFirstOrThrow({ where: { name: 'piece' } });

  // ── Location ───────────────────────────────────────────────────────────────
  let location = await prisma.location.findFirst();
  if (!location) location = await prisma.location.create({ data: { name: 'Main Store', type: 'store' } });

  // ── Sample catalog (demo only) ─────────────────────────────────────────────
  // Only seeded when SEED_DEMO=true. Production seeds a BLANK store: roles,
  // owner/Manager, settings, zones, units, location — and no products.
  if (process.env.SEED_DEMO === 'true' && !(await prisma.category.findFirst())) {
    const fabrics = await prisma.category.create({
      data: {
        name: 'Fabrics', slug: 'fabrics', fractionalAllowed: true, defaultUnitId: yard.id,
        minOrderQty: 1, qtyIncrement: 0.5, deadStockDays: 120, sortOrder: 1,
        mediaRules: { minImages: 1, maxImages: 8 },
      },
    });
    const ankara = await prisma.category.create({
      data: {
        name: 'Ankara', slug: 'ankara', parentId: fabrics.id, fractionalAllowed: true,
        defaultUnitId: yard.id, minOrderQty: 1, qtyIncrement: 0.5, deadStockDays: 120, sortOrder: 1,
      },
    });
    const lace = await prisma.category.create({
      data: {
        name: 'Lace', slug: 'lace', parentId: fabrics.id, fractionalAllowed: true,
        defaultUnitId: yard.id, minOrderQty: 2, qtyIncrement: 0.5, deadStockDays: 120, sortOrder: 2,
      },
    });
    const perfumes = await prisma.category.create({
      data: {
        name: 'Perfumes', slug: 'perfumes', defaultUnitId: piece.id, minOrderQty: 1, qtyIncrement: 1,
        deadStockDays: 90, perishable: true, returnEligible: false, sortOrder: 2, // D-09: opened perfumes non-returnable
      },
    });
    const cosmetics = await prisma.category.create({
      data: {
        name: 'Cosmetics', slug: 'cosmetics', defaultUnitId: piece.id, minOrderQty: 1, qtyIncrement: 1,
        deadStockDays: 60, perishable: true, returnEligible: false, sortOrder: 3,
      },
    });

    // Attributes
    const color = await prisma.attribute.create({
      data: {
        name: 'Colour', code: 'colour', inputType: 'color', isFilterable: true, isVariantDefining: true,
        options: { create: [
          { label: 'Royal Blue', value: 'royal-blue', hexCode: '#1e3a8a', sortOrder: 1 },
          { label: 'Emerald', value: 'emerald', hexCode: '#046a38', sortOrder: 2 },
          { label: 'Gold', value: 'gold', hexCode: '#d4a017', sortOrder: 3 },
          { label: 'Wine', value: 'wine', hexCode: '#722f37', sortOrder: 4 },
        ] },
      },
    });
    const width = await prisma.attribute.create({
      data: {
        name: 'Fabric width', code: 'fabric_width', inputType: 'select', isFilterable: true,
        options: { create: [
          { label: '45 inches', value: '45in', sortOrder: 1 },
          { label: '60 inches', value: '60in', sortOrder: 2 },
        ] },
      },
    });
    // Sizes are a fixed set of choices — select + variant-defining so one
    // perfume can carry 50ml/100ml variants with their own price and stock.
    const volume = await prisma.attribute.create({
      data: {
        name: 'Volume', code: 'volume_ml', inputType: 'select', isFilterable: true, isVariantDefining: true,
        options: { create: [
          { label: '30ml', value: '30ml', sortOrder: 1 },
          { label: '50ml', value: '50ml', sortOrder: 2 },
          { label: '100ml', value: '100ml', sortOrder: 3 },
          { label: '200ml', value: '200ml', sortOrder: 4 },
        ] },
      },
    });
    const scentFamily = await prisma.attribute.create({
      data: {
        name: 'Scent family', code: 'scent_family', inputType: 'select', isFilterable: true,
        options: { create: [
          { label: 'Oud', value: 'oud', sortOrder: 1 },
          { label: 'Floral', value: 'floral', sortOrder: 2 },
          { label: 'Citrus', value: 'citrus', sortOrder: 3 },
        ] },
      },
    });

    for (const categoryId of [ankara.id, lace.id]) {
      await prisma.categoryAttribute.createMany({
        data: [
          { categoryId, attributeId: color.id, isRequired: true, sortOrder: 1 },
          { categoryId, attributeId: width.id, isRequired: false, sortOrder: 2 },
        ],
      });
    }
    await prisma.categoryAttribute.createMany({
      data: [
        { categoryId: perfumes.id, attributeId: volume.id, isRequired: true, sortOrder: 1 },
        { categoryId: perfumes.id, attributeId: scentFamily.id, isRequired: false, sortOrder: 2 },
      ],
    });

    // Products
    const ankaraProduct = await prisma.product.create({
      data: {
        categoryId: ankara.id, name: 'Premium Ankara — Geometric Waves', slug: 'premium-ankara-geometric-waves',
        description: 'Vibrant wax print, 100% cotton.', type: 'standard', status: 'active',
        sellUnitId: yard.id, minOrderQty: 1, qtyIncrement: 0.5,
        attributeValues: {}, tags: ['ankara', 'new-arrival'], createdBy: 'seed',
      },
    });
    const ankaraBlue = await prisma.variant.create({
      data: { productId: ankaraProduct.id, sku: 'ANK-GEO-BLU', optionValues: { colour: 'royal-blue' }, price: 350_000, costPrice: 220_000 },
    });
    const ankaraGold = await prisma.variant.create({
      data: { productId: ankaraProduct.id, sku: 'ANK-GEO-GLD', optionValues: { colour: 'gold' }, price: 350_000, costPrice: 220_000 },
    });

    const laceProduct = await prisma.product.create({
      data: {
        categoryId: lace.id, name: 'French Lace — Bridal Collection', slug: 'french-lace-bridal',
        description: 'Premium French lace with sequin detail.', type: 'standard', status: 'active',
        sellUnitId: yard.id, minOrderQty: 2, qtyIncrement: 0.5,
        attributeValues: {}, tags: ['lace', 'bridal'], createdBy: 'seed',
      },
    });
    const laceWine = await prisma.variant.create({
      data: { productId: laceProduct.id, sku: 'LCE-BRD-WIN', optionValues: { colour: 'wine' }, price: 1_500_000, costPrice: 950_000 },
    });

    const oudProduct = await prisma.product.create({
      data: {
        categoryId: perfumes.id, name: 'Oud Royale 50ml', slug: 'oud-royale-50ml',
        description: 'Long-lasting oud eau de parfum.', type: 'standard', status: 'active',
        sellUnitId: piece.id, attributeValues: { scent_family: 'oud' },
        tags: ['perfume', 'best-seller'], createdBy: 'seed',
      },
    });
    const oudVariant = await prisma.variant.create({
      data: { productId: oudProduct.id, sku: 'PRF-OUD-50', optionValues: { volume_ml: '50ml' }, price: 2_500_000, costPrice: 1_400_000 },
    });

    const mistProduct = await prisma.product.create({
      data: {
        categoryId: cosmetics.id, name: 'Shea Body Mist 200ml', slug: 'shea-body-mist',
        description: 'Light daily body mist.', type: 'standard', status: 'active',
        sellUnitId: piece.id, attributeValues: {}, tags: ['cosmetics'], createdBy: 'seed',
      },
    });
    const mistVariant = await prisma.variant.create({
      data: { productId: mistProduct.id, sku: 'CSM-MST-200', optionValues: {}, price: 450_000, costPrice: 250_000 },
    });

    // Opening stock via ledger-consistent rows
    const openingStock: [string, number, number][] = [
      [ankaraBlue.id, 60, 220_000],
      [ankaraGold.id, 42.5, 220_000],
      [laceWine.id, 25, 950_000],
      [oudVariant.id, 30, 1_400_000],
      [mistVariant.id, 80, 250_000],
    ];
    for (const [variantId, qty, unitCost] of openingStock) {
      await prisma.stockLevel.create({
        data: { variantId, locationId: location.id, onHand: qty, reserved: 0 },
      });
      await prisma.stockMovement.create({
        data: {
          variantId, locationId: location.id, type: 'RECEIPT', quantity: qty, unitCost,
          reasonCode: 'opening_stock', note: 'Opening stock (seed)', userId: null,
        },
      });
    }

    // Bundle (A1 T2): Eid gift box
    const eidBox = await prisma.product.create({
      data: {
        categoryId: perfumes.id, name: 'Eid Royal Gift Box', slug: 'eid-royal-gift-box',
        description: 'Oud Royale 50ml + Shea Body Mist in a gift box.', type: 'bundle', status: 'active',
        sellUnitId: piece.id, attributeValues: {}, tags: ['bundle', 'eid'], createdBy: 'seed',
      },
    });
    await prisma.bundleComponent.createMany({
      data: [
        { bundleProductId: eidBox.id, variantId: oudVariant.id, quantity: 1, sortOrder: 1 },
        { bundleProductId: eidBox.id, variantId: mistVariant.id, quantity: 1, sortOrder: 2 },
      ],
    });
    await prisma.bundleConfig.create({
      data: {
        bundleProductId: eidBox.id, pricingMode: 'fixed', fixedPrice: 2_600_000,
        maxSellable: 50, eligibleForPromotions: false, returnMode: 'whole_only',
      },
    });

    // Promotion: WELCOME10
    const promo = await prisma.promotion.create({
      data: {
        name: 'Welcome 10% off first order',
        mechanism: 'code',
        valueType: 'percent',
        valueAmount: 10,
        scope: 'order',
        conditions: { minSpend: 1_000_000, firstOrderOnly: true },
        limits: { totalUses: 500, perCustomerUses: 1 },
        combination: { withProduct: true },
        status: 'active',
        createdBy: 'seed',
      },
    });
    await prisma.promoCode.create({ data: { promotionId: promo.id, code: 'WELCOME10', kind: 'shared' } });

    // Sample customers
    await prisma.customer.create({
      data: {
        fullName: 'Ngozi Okafor', primaryPhone: '+2348031234567', email: 'ngozi@example.com',
        type: 'guest', createdSource: 'seed',
        addresses: { create: { label: 'Home', addressLine: '12 Adeola Odeku Street', area: 'Victoria Island', city: 'Lagos', isDefault: true } },
        consents: { create: { type: 'marketing_email', status: 'granted', source: 'checkout' } },
      },
    });
    await prisma.customer.create({
      data: {
        fullName: 'Aisha Bello', primaryPhone: '+2348059876543',
        type: 'guest', createdSource: 'seed',
        tags: { create: { tag: 'wholesale' } }, // D-19/D-25 reserved tag
        addresses: { create: { label: 'Shop', addressLine: '4 Balogun Market Lane', area: 'Lagos Island', city: 'Lagos', isDefault: true } },
      },
    });

    console.log('Seeded sample catalog, stock, bundle, promotion, customers');
  }

  // ── System pages: publish placeholder bodies so footer links resolve ───────
  const PAGE_BODIES: Record<string, string> = {
    'returns-policy': '<h2>Returns &amp; Refunds</h2><p>You may request a return within 7 days of delivery from your order page. Cut fabric (cut to your yardage) and opened perfumes/cosmetics are non-returnable. The original delivery fee is non-refundable unless the return is due to our error.</p>',
    'privacy-policy': '<h2>Privacy Policy</h2><p>We collect only what your order needs: your name, phone, delivery address and optional email. We never sell your data. Marketing messages are opt-in and you can withdraw consent anytime from your account.</p>',
    'terms-of-service': '<h2>Terms of Service</h2><p>All prices are in Nigerian Naira and confirmed at order time. Unpaid transfer orders are released after 24 hours.</p>',
    'delivery-information': '<h2>Delivery Information</h2><p>We deliver across Lagos (1–2 days) and interstate via courier (3–5 days). Delivery fees are shown by zone at checkout.</p>',
    'about-us': '<h2>About Us</h2><p>Zahrah Fashion brings premium fabrics and fragrances to Nigeria — shop online or visit our Lagos store.</p>',
    'faq': '<h2>FAQ</h2><p><b>How do I pay?</b> Card/bank/USSD via Paystack, or bank transfer.</p><p><b>Where is my order?</b> Use the tracking link in your confirmation, or chat with us on WhatsApp.</p>',
    'contact': '<h2>Contact</h2><p>WhatsApp us via the chat button, Mon–Sat 9:00–19:00. We respond within 15 minutes in business hours.</p>',
  };
  for (const [systemKey, body] of Object.entries(PAGE_BODIES)) {
    const page = await prisma.contentItem.findUnique({ where: { systemKey } });
    if (page && page.status === 'draft' && !(page.fields as { body?: string }).body) {
      await prisma.contentItem.update({ where: { id: page.id }, data: { fields: { body }, status: 'published' } });
    }
  }
  console.log('Published placeholder policy/content pages');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
