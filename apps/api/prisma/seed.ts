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

  // Store locations (physical shops) — seed the two branches if none exist. Raw SQL so this
  // works whether or not the Prisma client has been regenerated for the StoreLocation model.
  await prisma.$executeRawUnsafe(`
    INSERT INTO store_locations (id, name, phone, whatsapp, email, address, opens_at, closes_at, sort_order, status, created_at, updated_at)
    SELECT * FROM (VALUES
      ('loc_main', 'Kubwa Branch', '+234 706 080 5195', '+2347060805195', 'hello@zahrahfashion.com', 'Block C3, Shop No. 7, Maitama Ultra Modern Market, Kubwa Village, Abuja', '09:00', '18:00', 1, 'active', now(), now()),
      ('loc_dutsenalhaji', 'Dutsen Alhaji Branch', '+234 706 080 5195', '+2347060805195', 'hello@zahrahfashion.com', 'No. E4, Interlocks, Dutse-Alhaji Market, Bwari Area Council, Abuja', '09:00', '18:00', 2, 'active', now(), now())
    ) AS v(id, name, phone, whatsapp, email, address, opens_at, closes_at, sort_order, status, created_at, updated_at)
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
    'privacy-policy': `<p><strong>Effective Date:</strong> 10 July 2026<br/><strong>Last Updated:</strong> 10 July 2026</p><p>At ZAHRA FASHION HUB LIMITED ("ZAHRA FASHION HUB", "we", "our", or "us"), we respect your privacy and are committed to protecting your personal information.</p><p>This Privacy Policy explains how we collect, use, store, disclose and safeguard your personal information when you visit our website, purchase our products, communicate with us, or use any of our services.</p><p>By accessing or using this website, you acknowledge that you have read and understood this Privacy Policy.</p><h2>Information We Collect</h2><p>Depending on how you interact with our website, we may collect the following information:</p><h3>Personal Information</h3><ul><li>Full Name</li><li>Email Address</li><li>Telephone Number</li><li>WhatsApp Number</li><li>Delivery Address</li><li>Billing Address</li><li>Order Information</li><li>Payment Reference Information</li></ul><p><strong>Important:</strong> We do not store your debit card or credit card details. Payments are securely processed through trusted third-party payment providers such as Paystack.</p><h3>Technical Information</h3><p>We may automatically collect:</p><ul><li>IP Address</li><li>Browser Type</li><li>Device Information</li><li>Operating System</li><li>Website Usage Information</li><li>Pages Visited</li><li>Time Spent on Pages</li><li>Referral Source</li><li>Cookies and Similar Technologies</li></ul><h2>How We Use Your Information</h2><p>We use your information to:</p><ul><li>Process and fulfil your orders.</li><li>Deliver purchased products.</li><li>Respond to customer enquiries.</li><li>Provide customer support.</li><li>Send order confirmations and delivery updates.</li><li>Improve our website and services.</li><li>Personalise your shopping experience.</li><li>Prevent fraud and enhance security.</li><li>Comply with legal obligations.</li><li>Send promotional offers where you have chosen to receive them.</li></ul><h2>Cookies and Tracking Technologies</h2><p>Our website uses cookies and similar technologies to improve your browsing experience. These technologies help us:</p><ul><li>Remember your preferences.</li><li>Improve website performance.</li><li>Understand visitor behaviour.</li><li>Measure advertising effectiveness.</li><li>Deliver more relevant advertising.</li></ul><p>You may disable cookies through your browser settings; however, some website features may not function properly.</p><h2>Analytics and Advertising Technologies</h2><p>To improve our services and marketing performance, we may use trusted analytics and advertising technologies to boost awareness.</p><h2>WhatsApp Communication</h2><p>When you contact us through WhatsApp, you voluntarily provide information that allows us to respond to your enquiries and provide customer support. We may also use WhatsApp to:</p><ul><li>Confirm orders</li><li>Provide delivery updates</li><li>Respond to customer enquiries</li><li>Share promotional offers (only where permitted)</li></ul><p>You may request to stop receiving promotional WhatsApp messages at any time.</p><h2>How We Share Your Information</h2><p>We value your privacy. We do not sell your personal information. However, we may share information with trusted third parties where necessary, including:</p><ul><li>Payment processors</li><li>Delivery partners</li><li>Analytics providers</li><li>Advertising platforms</li><li>Government authorities where required by law</li></ul><p>All third parties are expected to protect your information appropriately.</p><h2>Data Security</h2><p>We implement appropriate administrative, technical and organisational measures designed to protect your personal information against:</p><ul><li>Unauthorised access</li><li>Loss</li><li>Misuse</li><li>Disclosure</li><li>Alteration</li><li>Destruction</li></ul><p>While we take reasonable precautions, no internet transmission or electronic storage system can be guaranteed to be completely secure.</p><h2>Data Retention</h2><p>We retain your personal information to:</p><ul><li>Provide our services.</li><li>Complete transactions.</li><li>Comply with legal obligations.</li><li>Resolve disputes.</li><li>Enforce our agreements.</li></ul><p>When your information is no longer required, it will be securely deleted or anonymised.</p><h2>Your Rights</h2><p>Subject to applicable law, you may have the right to:</p><ul><li>Request access to your personal information.</li><li>Request correction of inaccurate information.</li><li>Request deletion of your personal information.</li><li>Withdraw consent where applicable.</li><li>Object to certain processing activities.</li><li>Request restriction of processing.</li><li>Request a copy of your personal information.</li></ul><p>To exercise any of these rights, please contact us using the details below.</p><h2>Marketing Communications</h2><p>If you subscribe to receive promotional communications, we may send information about:</p><ul><li>New arrivals</li><li>Special offers</li><li>Seasonal collections</li><li>Promotions</li><li>Events</li></ul><p>You may unsubscribe at any time by:</p><ul><li>Clicking the unsubscribe link in our emails;</li><li>Contacting us directly; or</li><li>Sending us a WhatsApp message requesting removal.</li></ul><h2>Children's Privacy</h2><p>Our website is intended for adults. We do not knowingly collect personal information from children under the age of 18 without appropriate parental or guardian consent.</p><h2>Third-Party Websites</h2><p>Our website may contain links to third-party websites. We are not responsible for the privacy practices or content of external websites. We encourage you to review their privacy policies before providing personal information.</p><h2>Changes to This Privacy Policy</h2><p>We may update this Privacy Policy from time to time. Any changes will be posted on this page together with the updated revision date. Your continued use of the website after changes are published constitutes acceptance of the updated Privacy Policy.</p><h2>Governing Law</h2><p>This Privacy Policy shall be governed by and interpreted in accordance with the laws of the Federal Republic of Nigeria, including the Nigeria Data Protection Act (NDPA) 2023, where applicable.</p><h2>Contact Us</h2><p>If you have any questions regarding this Privacy Policy or how we handle your personal information, please contact us:</p><p><strong>ZAHRA FASHION HUB LIMITED</strong></p><p><strong>Kubwa Branch</strong><br/>Block C3, Shop No. 7<br/>Maitama Ultra Modern Market<br/>Kubwa Village, Abuja, Nigeria</p><p><strong>Dutsen Alhaji Branch</strong><br/>No. E4, Interlocks<br/>Dutse-Alhaji Market<br/>Bwari Area Council, Abuja, Nigeria</p><p><strong>Email:</strong> hello@zahrahfashion.com<br/><strong>WhatsApp / Customer Service:</strong> +234 706 080 5195</p><h2>Thank You</h2><p>Thank you for trusting ZAHRA FASHION HUB LIMITED. Your privacy is important to us, and we remain committed to protecting your personal information while providing premium products, exceptional customer service, and a secure online shopping experience.</p><p><em>Style Defined.</em></p>`,
    'terms-of-service': `<p><strong>Effective Date:</strong> 10 July 2026<br/><strong>Last Updated:</strong> 10 July 2026</p><h2>1. Introduction</h2><p>Welcome to ZAHRA FASHION HUB LIMITED ("ZAHRA FASHION HUB", "we", "our", or "us"). These Terms of Service ("Terms") govern your access to and use of our website, products, services and online store.</p><p>By accessing our website or placing an order, you agree to be bound by these Terms. If you do not agree with these Terms, please do not use this website.</p><h2>2. Eligibility</h2><p>By using this website, you confirm that:</p><ul><li>You are at least 18 years old or have the permission of a parent or legal guardian.</li><li>The information you provide is accurate and complete.</li><li>You have the legal authority to enter into this agreement.</li></ul><h2>3. Products</h2><p>We make every effort to display our products accurately. However:</p><ul><li>Colours may vary depending on your device or screen settings.</li><li>Fabric patterns may vary slightly from photographs.</li><li>Measurements are approximate.</li><li>Product availability may change without notice.</li></ul><p>We reserve the right to discontinue or modify products at any time.</p><h2>4. Pricing</h2><p>All prices are displayed in Nigerian Naira (₦) unless otherwise stated. Prices may change without prior notice. The applicable price is the one displayed at the time your order is confirmed.</p><h2>5. Orders</h2><p>Placing an order does not automatically guarantee acceptance. We reserve the right to:</p><ul><li>Accept or decline any order.</li><li>Limit purchase quantities.</li><li>Cancel orders where pricing errors occur.</li><li>Cancel orders where products become unavailable.</li></ul><p>Where payment has already been received for an order we cannot fulfil, a full refund will be processed.</p><h2>6. Payments</h2><p>Payments are securely processed through trusted payment providers including Paystack. We do not store your debit or credit card details. Orders will only be processed after payment has been successfully confirmed unless another payment arrangement has been expressly agreed.</p><h2>7. Delivery</h2><p>Delivery times are estimates only. Actual delivery may vary depending on:</p><ul><li>Customer location</li><li>Courier availability</li><li>Weather conditions</li><li>Public holidays</li><li>Other unforeseen circumstances</li></ul><p>Delivery charges, where applicable, will be displayed before checkout.</p><h2>8. Store Collection</h2><p>Customers may choose to collect eligible orders from our retail stores. Collection details will be communicated after order confirmation.</p><h2>9. Returns and Refunds</h2><p>Returns, exchanges and refunds are governed by our Returns &amp; Refund Policy. Please review that policy before placing an order.</p><h2>10. Product Availability</h2><p>Although we work hard to maintain accurate inventory, products may occasionally become unavailable. Where this occurs, we may:</p><ul><li>Offer a suitable alternative;</li><li>Delay delivery pending restocking; or</li><li>Provide a full refund.</li></ul><h2>11. Customer Responsibilities</h2><p>You agree to:</p><ul><li>Provide accurate information.</li><li>Keep your account secure.</li><li>Use the website lawfully.</li><li>Respect intellectual property rights.</li><li>Not misuse the website.</li></ul><h2>12. Acceptable Use</h2><p>You must not:</p><ul><li>Use the website for unlawful purposes.</li><li>Attempt to hack or interfere with website security.</li><li>Copy website content without written permission.</li><li>Misrepresent products or the company.</li></ul><h2>13. Intellectual Property</h2><p>All website content including logos, images, product photographs, graphics, designs, text, videos, branding and software remain the exclusive property of ZAHRA FASHION HUB LIMITED unless otherwise stated. No content may be copied, reproduced or distributed without prior written permission.</p><h2>14. User Content</h2><p>Where customers submit reviews, comments, testimonials or photographs, they grant ZAHRA FASHION HUB LIMITED a non-exclusive licence to display and use such content for marketing and promotional purposes.</p><h2>15. Promotions</h2><p>Special promotions, discounts and promotional codes:</p><ul><li>cannot be exchanged for cash;</li><li>may be withdrawn at any time;</li><li>may have additional terms and conditions.</li></ul><h2>16. Limitation of Liability</h2><p>To the maximum extent permitted by law, ZAHRA FASHION HUB LIMITED shall not be liable for:</p><ul><li>indirect losses;</li><li>consequential damages;</li><li>business interruption;</li><li>loss of profits;</li><li>delays beyond our reasonable control.</li></ul><p>Our total liability shall not exceed the value of the products purchased.</p><h2>17. Indemnity</h2><p>You agree to indemnify and hold harmless ZAHRA FASHION HUB LIMITED, its directors, employees and representatives from any claims arising from misuse of the website, violation of these Terms, or unlawful conduct.</p><h2>18. Privacy</h2><p>Your use of this website is also governed by our Privacy Policy. Please review our Privacy Policy to understand how we collect and process personal information.</p><h2>19. Third-Party Services</h2><p>Our website may integrate third-party services including Paystack, WhatsApp, Google Maps and Google Analytics. Your use of those services may also be subject to their respective terms.</p><h2>20. Force Majeure</h2><p>We shall not be liable for delays or failure to perform caused by circumstances beyond our reasonable control, including natural disasters, strikes, civil unrest, internet failures, government actions and pandemics.</p><h2>21. Governing Law</h2><p>These Terms shall be governed by and interpreted in accordance with the laws of the Federal Republic of Nigeria.</p><h2>22. Dispute Resolution</h2><p>Before commencing legal proceedings, both parties agree to make reasonable efforts to resolve disputes amicably. Where disputes cannot be resolved amicably, they shall be submitted to the courts of competent jurisdiction in Nigeria.</p><h2>23. Changes to These Terms</h2><p>We may update these Terms from time to time. The latest version will always be published on this website together with the updated revision date. Continued use of the website constitutes acceptance of the revised Terms.</p><h2>24. Contact Us</h2><p>For questions regarding these Terms, please contact us:</p><p><strong>ZAHRA FASHION HUB LIMITED</strong></p><p><strong>Kubwa Branch</strong><br/>Block C3, Shop No. 7<br/>Maitama Ultra Modern Market<br/>Kubwa Village, Abuja</p><p><strong>Dutsen Alhaji Branch</strong><br/>No. E4, Interlocks<br/>Dutse-Alhaji Market<br/>Bwari Area Council, Abuja</p><p><strong>Email:</strong> hello@zahrahfashion.com<br/><strong>Customer Service / WhatsApp:</strong> +234 706 080 5195</p><h2>Thank You</h2><p>Thank you for choosing ZAHRA FASHION HUB LIMITED. We appreciate your trust and remain committed to providing premium products, exceptional customer service and a secure shopping experience.</p><p><em>Style Defined.</em></p>`,
    'delivery-information': '<h2>Delivery Information</h2><p>We deliver across Abuja (1–2 days) and interstate via courier (3–5 days). Delivery fees are shown by zone at checkout.</p>',
    'about-us': '<h2>About Us</h2><p>Zahrah Fashion Hub brings premium fabrics and fragrances to Nigeria — shop online or visit our Abuja store.</p><h3>Our Vision</h3><p>Our vision is to become Nigeria\'s most trusted premium fabrics retail brand, delivering exceptional products and memorable customer experiences.</p>',
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
