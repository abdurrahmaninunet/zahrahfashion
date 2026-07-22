/**
 * Visual seed: generates elegant SVG imagery for the sample catalog (product
 * shots, hero slides, category tiles) and wires up the homepage composition —
 * so the storefront looks like a fashion brand out of the box.
 * Idempotent; safe to re-run. Real photography replaces these via the admin
 * media library without any code change.
 */
import { PrismaClient } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const MEDIA_DIR = join(__dirname, '..', 'uploads', 'media');

function save(name: string, svg: string): string {
  writeFileSync(join(MEDIA_DIR, name), svg.trim());
  return `/uploads/media/${name}`;
}

// ── SVG builders ─────────────────────────────────────────────────────────────

/** Ankara-style geometric wax print. */
function ankaraSvg(base: string, accent: string, deep: string): string {
  let motifs = '';
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 5; col++) {
      const x = col * 200 + (row % 2 ? 100 : 0);
      const y = row * 200;
      motifs += `
        <g transform="translate(${x},${y})">
          <circle cx="100" cy="100" r="78" fill="none" stroke="${accent}" stroke-width="7"/>
          <circle cx="100" cy="100" r="52" fill="${deep}"/>
          <circle cx="100" cy="100" r="52" fill="none" stroke="${accent}" stroke-width="3" stroke-dasharray="4 7"/>
          <path d="M100 62 L118 100 L100 138 L82 100 Z" fill="${accent}"/>
          <circle cx="100" cy="100" r="10" fill="${base}"/>
        </g>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1200" viewBox="0 0 1000 1200">
    <rect width="1000" height="1200" fill="${base}"/>${motifs}
    <rect width="1000" height="1200" fill="url(#sh)"/>
    <defs><linearGradient id="sh" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.12"/><stop offset="0.5" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.22"/></linearGradient></defs>
  </svg>`;
}

/** Delicate lace lattice. */
function laceSvg(base: string, thread: string): string {
  let lattice = '';
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 10; col++) {
      const x = col * 100 + (row % 2 ? 50 : 0);
      const y = row * 100;
      lattice += `
        <g transform="translate(${x},${y})" opacity="0.85">
          <circle cx="50" cy="50" r="34" fill="none" stroke="${thread}" stroke-width="1.6"/>
          <circle cx="50" cy="50" r="22" fill="none" stroke="${thread}" stroke-width="1"/>
          ${[0, 60, 120, 180, 240, 300].map((a) => `<ellipse cx="50" cy="24" rx="6" ry="13" fill="none" stroke="${thread}" stroke-width="1.1" transform="rotate(${a} 50 50)"/>`).join('')}
          <circle cx="50" cy="50" r="4" fill="${thread}"/>
        </g>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1200" viewBox="0 0 1000 1200">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${base}"/><stop offset="1" stop-color="#1c1113"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.35" cy="0.3" r="0.9">
        <stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1000" height="1200" fill="url(#bg)"/>${lattice}
    <rect width="1000" height="1200" fill="url(#glow)"/>
  </svg>`;
}

/** Perfume bottle on a moody gradient. */
function perfumeSvg(from: string, to: string, liquid: string, label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1200" viewBox="0 0 1000 1200">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.45"/><stop offset="0.25" stop-color="#ffffff" stop-opacity="0.08"/>
        <stop offset="0.8" stop-color="#ffffff" stop-opacity="0.05"/><stop offset="1" stop-color="#ffffff" stop-opacity="0.3"/>
      </linearGradient>
      <linearGradient id="liq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${liquid}"/><stop offset="1" stop-color="${to}"/></linearGradient>
    </defs>
    <rect width="1000" height="1200" fill="url(#bg)"/>
    <ellipse cx="500" cy="1020" rx="260" ry="36" fill="#000" opacity="0.28"/>
    <g>
      <rect x="330" y="380" width="340" height="620" rx="34" fill="url(#liq)"/>
      <rect x="330" y="380" width="340" height="620" rx="34" fill="url(#glass)"/>
      <rect x="330" y="380" width="340" height="120" rx="34" fill="#fff" opacity="0.10"/>
      <rect x="452" y="300" width="96" height="92" rx="10" fill="#2a2118"/>
      <rect x="440" y="252" width="120" height="58" rx="12" fill="#c9a227"/>
      <rect x="392" y="620" width="216" height="190" rx="8" fill="#f6efe1" opacity="0.94"/>
      <text x="500" y="700" font-family="Georgia, serif" font-size="34" fill="#3d3010" text-anchor="middle" letter-spacing="6">${label}</text>
      <text x="500" y="748" font-family="Georgia, serif" font-size="19" fill="#8a6d1f" text-anchor="middle" letter-spacing="3">ZAHRAH</text>
    </g>
  </svg>`;
}

/** Gift box for the bundle. */
function giftBoxSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1200" viewBox="0 0 1000 1200">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b1d0e"/><stop offset="1" stop-color="#0f0a05"/></linearGradient>
      <linearGradient id="box" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a6d1f"/><stop offset="1" stop-color="#5c4715"/></linearGradient>
    </defs>
    <rect width="1000" height="1200" fill="url(#bg)"/>
    <circle cx="500" cy="560" r="330" fill="#c9a227" opacity="0.08"/>
    <ellipse cx="500" cy="1010" rx="300" ry="38" fill="#000" opacity="0.4"/>
    <rect x="230" y="560" width="540" height="420" rx="14" fill="url(#box)"/>
    <rect x="200" y="470" width="600" height="120" rx="14" fill="#a3822a"/>
    <rect x="462" y="470" width="76" height="510" fill="#f3e8c8"/>
    <path d="M500 470 C 400 380, 300 400, 330 460 C 350 500, 460 480, 500 470 Z" fill="#f3e8c8"/>
    <path d="M500 470 C 600 380, 700 400, 670 460 C 650 500, 540 480, 500 470 Z" fill="#e8d9a8"/>
    <text x="500" y="820" font-family="Georgia, serif" font-size="42" fill="#f6efe1" text-anchor="middle" letter-spacing="8">EID ROYAL</text>
  </svg>`;
}

/** Wide editorial hero. */
function heroSvg(name: string, from: string, mid: string, to: string, pattern: 'drape' | 'dots'): string {
  const drape = Array.from({ length: 9 }, (_, i) => {
    const x = i * 220 - 120;
    return `<path d="M${x} 0 Q ${x + 160} 450 ${x + 60} 900 L ${x + 200} 900 Q ${x + 300} 430 ${x + 140} 0 Z" fill="#fff" opacity="${0.05 + (i % 3) * 0.025}"/>`;
  }).join('');
  const dots = Array.from({ length: 60 }, (_, i) => {
    const x = (i * 293) % 1800;
    const y = (i * 157) % 900;
    return `<circle cx="${x}" cy="${y}" r="${18 + (i % 4) * 10}" fill="none" stroke="#fff" stroke-width="1.4" opacity="0.14"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="900" viewBox="0 0 1800 900">
    <defs><linearGradient id="g-${name}" x1="0" y1="0" x2="1" y2="0.6">
      <stop offset="0" stop-color="${from}"/><stop offset="0.55" stop-color="${mid}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="1800" height="900" fill="url(#g-${name})"/>
    ${pattern === 'drape' ? drape : dots}
    <rect width="1800" height="900" fill="#000" opacity="0.08"/>
  </svg>`;
}

/** Category tile crop. */
function tileSvg(name: string, from: string, to: string, motif: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs><linearGradient id="t-${name}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="800" height="600" fill="url(#t-${name})"/>
    ${motif}
  </svg>`;
}

// ── Seed ─────────────────────────────────────────────────────────────────────

async function attachMedia(productSlug: string, images: { url: string; alt: string }[]) {
  const product = await prisma.product.findUnique({ where: { slug: productSlug }, include: { media: true } });
  if (!product || product.media.length > 0) return; // don't overwrite real photography
  for (const [i, image] of images.entries()) {
    await prisma.productMedia.create({
      data: { productId: product.id, url: image.url, altText: image.alt, sortOrder: i },
    });
  }
  console.log(`media → ${productSlug} (${images.length})`);
}

async function main() {
  mkdirSync(MEDIA_DIR, { recursive: true });

  // Product imagery
  const ankaraBlue = save('ankara-blue.svg', ankaraSvg('#101c3a', '#c9a227', '#1e3a8a'));
  const ankaraBlue2 = save('ankara-blue-2.svg', ankaraSvg('#1e3a8a', '#f3e8c8', '#101c3a'));
  const ankaraGold = save('ankara-gold.svg', ankaraSvg('#2b1d0e', '#d4a017', '#8a6d1f'));
  const laceWine = save('lace-wine.svg', laceSvg('#722f37', '#f3d9c8'));
  const laceWine2 = save('lace-wine-2.svg', laceSvg('#4a1f25', '#e8c9b0'));
  const oud = save('perfume-oud.svg', perfumeSvg('#3a2a14', '#12100c', '#7a4a12', 'OUD ROYALE'));
  const mist = save('mist.svg', perfumeSvg('#2e4638', '#101a14', '#4e7a5a', 'SHEA MIST'));
  const giftBox = save('eid-gift-box.svg', giftBoxSvg());

  await attachMedia('premium-ankara-geometric-waves', [
    { url: ankaraBlue, alt: 'Premium Ankara geometric waves — royal blue wax print' },
    { url: ankaraBlue2, alt: 'Premium Ankara geometric waves — pattern detail' },
    { url: ankaraGold, alt: 'Premium Ankara geometric waves — gold colourway' },
  ]);
  await attachMedia('french-lace-bridal', [
    { url: laceWine, alt: 'French bridal lace — wine, sequin lattice detail' },
    { url: laceWine2, alt: 'French bridal lace — drape detail' },
  ]);
  await attachMedia('oud-royale-50ml', [{ url: oud, alt: 'Oud Royale 50ml eau de parfum' }]);
  await attachMedia('shea-body-mist', [{ url: mist, alt: 'Shea body mist 200ml' }]);
  await attachMedia('eid-royal-gift-box', [{ url: giftBox, alt: 'Eid Royal gift box — oud and body mist set' }]);

  // Category tile imagery
  const tiles: Record<string, string> = {
    fabrics: save('tile-fabrics.svg', tileSvg('fab', '#1e3a8a', '#101c3a',
      Array.from({ length: 12 }, (_, i) => `<circle cx="${(i % 4) * 260 + 120}" cy="${Math.floor(i / 4) * 240 + 100}" r="70" fill="none" stroke="#c9a227" stroke-width="5" opacity="0.7"/>`).join(''))),
    ankara: save('tile-ankara.svg', tileSvg('ank', '#8a6d1f', '#2b1d0e',
      Array.from({ length: 12 }, (_, i) => `<path d="M${(i % 4) * 260 + 60} ${Math.floor(i / 4) * 240 + 60} l60 60 l-60 60 l-60 -60 Z" fill="#d4a017" opacity="0.55"/>`).join(''))),
    lace: save('tile-lace.svg', tileSvg('lce', '#722f37', '#2a1114',
      Array.from({ length: 20 }, (_, i) => `<circle cx="${(i % 5) * 200 + 100}" cy="${Math.floor(i / 5) * 180 + 80}" r="46" fill="none" stroke="#f3d9c8" stroke-width="1.6" opacity="0.7"/>`).join(''))),
    perfumes: save('tile-perfumes.svg', tileSvg('prf', '#3a2a14', '#12100c',
      '<rect x="300" y="180" width="200" height="330" rx="22" fill="#7a4a12" opacity="0.9"/><rect x="360" y="120" width="80" height="70" rx="8" fill="#c9a227"/><rect x="330" y="300" width="140" height="120" rx="6" fill="#f6efe1" opacity="0.9"/>')),
    cosmetics: save('tile-cosmetics.svg', tileSvg('csm', '#2e4638', '#101a14',
      '<rect x="320" y="160" width="160" height="360" rx="80" fill="#4e7a5a" opacity="0.85"/><rect x="360" y="110" width="80" height="60" rx="10" fill="#f6efe1" opacity="0.9"/>')),
  };
  for (const [slug, image] of Object.entries(tiles)) {
    await prisma.category.updateMany({ where: { slug, image: null }, data: { image } });
  }

  // Hero slides
  const hero1 = save('hero-lace.svg', heroSvg('h1', '#722f37', '#3d1a20', '#1c1113', 'drape'));
  const hero2 = save('hero-eid.svg', heroSvg('h2', '#8a6d1f', '#5c4715', '#2b1d0e', 'dots'));
  const hero3 = save('hero-ankara.svg', heroSvg('h3', '#1e3a8a', '#16265c', '#101c3a', 'drape'));

  // Homepage composition (only if staff haven't built one yet)
  const composition = await prisma.composition.findUnique({
    where: { surface: 'homepage' },
    include: { sections: true },
  });
  if (!composition || composition.sections.length === 0) {
    const fabrics = await prisma.category.findFirst({ where: { slug: 'fabrics' } });
    const heroItem = await prisma.contentItem.create({
      data: {
        type: 'section', sectionKey: 'hero_slider', title: 'Launch hero', status: 'published', createdBy: 'seed',
        fields: {
          slides: [
            { image: { url: hero1, alt: 'French lace draped in low light' }, headline: 'Lace that makes the moment', subtext: 'Bridal-grade French lace, cut to your yardage', ctaLabel: 'Shop Lace', link: { url: '/c/lace' } },
            { image: { url: hero2, alt: 'Eid gift packages' }, headline: 'The Eid Royal Package', subtext: 'Worth more. Wrapped beautifully. Limited to 50 boxes.', ctaLabel: 'Shop Packages', link: { url: '/p/eid-royal-gift-box' } },
            { image: { url: hero3, alt: 'Ankara wax prints' }, headline: 'Ankara, loud and proud', subtext: 'New wax prints land every week', ctaLabel: 'Shop Ankara', link: { url: '/c/ankara' } },
          ],
        } as never,
      },
    });
    const testimonialItem = await prisma.contentItem.create({
      data: {
        type: 'section', sectionKey: 'testimonial_strip', title: 'Customer love', status: 'published', createdBy: 'seed',
        fields: {
          testimonials: [
            { quote: 'The lace arrived in 2 days and the colour is exactly like the video. My tailor was impressed!', name: 'Amaka O.', location: 'Lekki' },
            { quote: 'Ordered on WhatsApp at 9pm, paid on delivery next afternoon. Seamless.', name: 'Hauwa B.', location: 'Surulere' },
            { quote: 'The Oud Royale lasts all day. Bought two more as gifts.', name: 'Tola A.', location: 'Ikeja' },
          ],
        } as never,
      },
    });
    const railNew = await prisma.contentItem.create({
      data: { type: 'section', sectionKey: 'collection_rail', title: 'New Arrivals', status: 'published', createdBy: 'seed', fields: { title: 'New Arrivals', rule: 'newest' } as never },
    });
    const railBest = await prisma.contentItem.create({
      data: { type: 'section', sectionKey: 'collection_rail', title: 'Best Sellers', status: 'published', createdBy: 'seed', fields: { title: 'Best Sellers', rule: 'best_sellers' } as never },
    });
    const catTiles = await prisma.contentItem.create({
      data: {
        type: 'section', sectionKey: 'category_tiles', title: 'Shop by category', status: 'published', createdBy: 'seed',
        fields: { tiles: (await prisma.category.findMany({ where: { parentId: fabrics ? { not: null } : undefined, slug: { in: ['ankara', 'lace'] } } })).length ? [] : [] } as never,
      },
    });
    const comp = composition ?? (await prisma.composition.create({ data: { surface: 'homepage' } }));
    const order = [heroItem.id, catTiles.id, railNew.id, railBest.id, testimonialItem.id];
    for (const [i, contentItemId] of order.entries()) {
      await prisma.compositionSection.create({ data: { compositionId: comp.id, contentItemId, sortOrder: i } });
    }
    console.log('homepage composition seeded');
  }

  // Announcement
  const announcement = await prisma.contentItem.findFirst({ where: { type: 'announcement' } });
  if (!announcement) {
    await prisma.contentItem.create({
      data: {
        type: 'announcement', title: 'Launch announcement', status: 'published', createdBy: 'seed',
        fields: { message: 'Free delivery in Abuja on orders over ₦100,000' } as never,
      },
    });
  }

  // Store identity niceties for the shell
  const upsert = async (key: string, value: unknown) => {
    const existing = await prisma.settingValue.findUnique({ where: { key } });
    if (!existing) await prisma.settingValue.create({ data: { key, value: value as never, updatedBy: 'seed' } });
  };
  await upsert('store.address', 'Plot 5, Ademola Adetokunbo Crescent, Wuse 2, Abuja');
  await upsert('store.phone', '+234 7060805195');
  await upsert('notifications.whatsapp_chat', { number: '+2347060805195', message: "Hi ZahrahFashion! I'm browsing your store" });
  await upsert('store.social', { instagram: 'zahrah.fashion.nlg', facebook: 'https://www.facebook.com/share/19CE5n2aR2/', tiktok: 'zahrah.fashion.nlg' });

  console.log('Visual seed complete');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
