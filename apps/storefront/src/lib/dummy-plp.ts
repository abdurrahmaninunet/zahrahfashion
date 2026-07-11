/**
 * Placeholder catalogue for category pages that have no real stock yet
 * (Fabric, Laces, Perfumes, Caps). Swap for real products when the backend
 * catalogue is populated. Prices are in kobo.
 */

export interface DummyProduct {
  id: string;
  name: string;
  price: number;
  compareAt: number | null;
  badge: string | null;
  bg: string; // tailwind gradient classes for the placeholder tile
  rating: number;
  reviews: number;
}

type Seed = [name: string, price: number, compareAt: number | null, badge: string | null, bg: string];

function make(prefix: string, seeds: Seed[]): DummyProduct[] {
  return seeds.map(([name, price, compareAt, badge, bg], i) => ({
    id: `${prefix}-${i + 1}`,
    name,
    price,
    compareAt,
    badge,
    bg,
    // Deterministic sample ratings so the cards look populated.
    rating: Number((4.5 + ((i * 3) % 5) / 10).toFixed(1)),
    reviews: 18 + ((i * 41) % 620),
  }));
}

export const DUMMY_PLP: Record<string, { name: string; products: DummyProduct[] }> = {
  fabric: {
    name: 'Fabric',
    products: make('fab', [
      ['Swiss Voile Lace Fabric — Emerald, 5 Yards', 4_500_000, 5_200_000, 'NEW', 'from-emerald-100 to-emerald-200'],
      ['Cotton Ankara Wax Print — 6 Yards', 1_850_000, 2_400_000, null, 'from-amber-100 to-orange-200'],
      ['Atampa Printed Fabric — Coral Red', 2_100_000, null, null, 'from-rose-100 to-red-200'],
      ['Adire Eleko Handdyed — Indigo', 2_950_000, 3_600_000, null, 'from-blue-100 to-indigo-200'],
      ['Chiffon Silk Fabric — Teal, 4 Yards', 1_650_000, null, null, 'from-teal-100 to-emerald-200'],
      ['George Wrapper — Wine & Gold', 8_900_000, 10_500_000, 'NEW', 'from-fuchsia-100 to-rose-200'],
      ['Aso-Oke Handwoven — Bronze', 6_700_000, null, null, 'from-orange-100 to-amber-200'],
      ['Damask Bazin Riche — Cream', 3_400_000, 4_100_000, null, 'from-stone-100 to-stone-200'],
      ['Brocade Jacquard — Teal', 3_900_000, null, null, 'from-teal-100 to-cyan-200'],
      ['Sequined Net Fabric — Rose Gold', 5_200_000, 6_100_000, 'NEW', 'from-rose-100 to-amber-100'],
      ['Plain Cotton Poplin — White, 5 Yards', 950_000, null, null, 'from-stone-50 to-stone-200'],
      ['Kampala Tie-Dye — Multicolour', 1_750_000, 2_200_000, null, 'from-fuchsia-100 to-purple-200'],
      ['Velvet Plush — Royal Blue', 4_300_000, 5_000_000, null, 'from-blue-100 to-indigo-300'],
      ['Guinea Brocade — White', 3_100_000, null, null, 'from-stone-50 to-stone-300'],
      ['Ankara Wax — Geometric Green', 1_950_000, 2_500_000, null, 'from-green-100 to-emerald-200'],
      ['Silk Satin — Champagne', 2_800_000, null, 'NEW', 'from-amber-50 to-yellow-100'],
      ['Cord Lace Fabric — Peach', 4_600_000, 5_400_000, null, 'from-orange-100 to-rose-100'],
      ['Aso-Oke Strip — Maroon', 5_800_000, null, null, 'from-rose-200 to-red-300'],
      ['Cotton Voile — Sky Blue', 1_450_000, 1_900_000, null, 'from-sky-100 to-blue-200'],
      ['Sequin Mesh — Silver', 4_900_000, null, null, 'from-slate-100 to-stone-300'],
      ['Adire Tie & Dye — Teal', 2_300_000, 2_900_000, null, 'from-teal-100 to-cyan-200'],
      ['Georgette — Dusty Rose', 1_700_000, null, null, 'from-rose-100 to-pink-200'],
      ['Jacquard Damask — Gold', 3_700_000, 4_400_000, 'NEW', 'from-yellow-100 to-amber-200'],
      ['Chiffon Print — Floral', 2_050_000, null, null, 'from-fuchsia-100 to-purple-200'],
    ]),
  },
  laces: {
    name: 'Laces',
    products: make('lac', [
      ['French Corded Lace — Blush Pink', 3_800_000, null, null, 'from-rose-100 to-pink-200'],
      ['Beaded Bridal Lace — Ivory', 6_200_000, 7_400_000, 'NEW', 'from-stone-100 to-amber-100'],
      ['Sequined Net Lace — Champagne Gold', 5_400_000, null, null, 'from-amber-50 to-yellow-200'],
      ['Guipure Cord Lace — Royal Blue', 4_100_000, 4_900_000, null, 'from-blue-100 to-sky-200'],
      ['Soft Tulle Lace — Lilac', 2_900_000, null, null, 'from-violet-100 to-purple-200'],
      ['Cord Lace — Emerald', 4_500_000, 5_100_000, null, 'from-emerald-100 to-green-200'],
      ['Hand-cut Lace — Wine', 5_900_000, null, null, 'from-rose-200 to-red-300'],
      ['Swiss Voile Lace — Pure White', 4_700_000, 5_600_000, 'NEW', 'from-stone-50 to-stone-200'],
      ['Chantilly Lace — Black', 5_100_000, 6_000_000, null, 'from-stone-300 to-stone-500'],
      ['Organza Lace — Peach', 3_300_000, null, null, 'from-orange-100 to-rose-100'],
      ['Embroidered Voile — Sky Blue', 4_400_000, 5_200_000, 'NEW', 'from-sky-100 to-blue-200'],
      ['Ribbon Cord Lace — Mint', 3_700_000, null, null, 'from-emerald-100 to-teal-100'],
      ['Alençon Lace — Champagne', 5_600_000, 6_500_000, null, 'from-amber-50 to-yellow-100'],
      ['Venise Lace — White', 4_800_000, null, null, 'from-stone-50 to-stone-200'],
      ['Beaded Tulle — Silver', 6_100_000, 7_000_000, null, 'from-slate-100 to-stone-300'],
      ['Corded Guipure — Coral', 4_200_000, null, 'NEW', 'from-orange-100 to-red-200'],
      ['Metallic Lace — Rose Gold', 5_300_000, 6_200_000, null, 'from-rose-100 to-amber-100'],
      ['Eyelash Lace — Black', 3_900_000, null, null, 'from-stone-400 to-stone-600'],
      ['3D Floral Lace — Ivory', 6_400_000, 7_500_000, null, 'from-stone-100 to-rose-100'],
      ['Stretch Lace — Nude', 2_800_000, null, null, 'from-amber-50 to-orange-100'],
      ['Scalloped Lace — Mint', 3_600_000, 4_300_000, null, 'from-emerald-100 to-teal-200'],
      ['Bridal Illusion — Pearl', 5_700_000, null, 'NEW', 'from-stone-50 to-stone-200'],
      ['Sequined Cord — Emerald', 4_600_000, 5_400_000, null, 'from-emerald-100 to-green-200'],
      ['Embroidered Net — Lilac', 3_500_000, null, null, 'from-violet-100 to-purple-200'],
    ]),
  },
  perfumes: {
    name: 'Perfumes',
    products: make('per', [
      ['Oud Royale Eau de Parfum — 50ml', 2_780_000, 4_600_000, 'NEW', 'from-yellow-100 to-amber-200'],
      ['Amber Musk Parfum — 100ml', 3_200_000, null, null, 'from-amber-100 to-orange-200'],
      ['Rose Attar Oil — 30ml', 1_950_000, 2_500_000, null, 'from-rose-100 to-pink-200'],
      ['Sandalwood Noir — 75ml', 3_600_000, null, null, 'from-stone-200 to-amber-200'],
      ['Jasmine Bloom — 50ml', 2_100_000, 2_800_000, null, 'from-lime-100 to-emerald-200'],
      ['Vanilla Oud — 100ml', 4_100_000, null, null, 'from-orange-100 to-amber-300'],
      ['Citrus Breeze — 50ml', 1_650_000, 2_100_000, null, 'from-yellow-100 to-lime-200'],
      ['Arabian Nights — 75ml', 3_900_000, 4_700_000, 'NEW', 'from-violet-100 to-fuchsia-200'],
      ['Musk Al Tahara — 60ml', 2_450_000, 3_100_000, null, 'from-stone-100 to-amber-100'],
      ['Blackcurrant Oud — 100ml', 4_400_000, null, 'NEW', 'from-purple-100 to-fuchsia-200'],
      ['White Musk — 50ml', 1_850_000, 2_300_000, null, 'from-stone-50 to-stone-200'],
      ['Saffron Rose — 75ml', 3_700_000, 4_500_000, null, 'from-rose-100 to-red-200'],
      ['Amber Wood — 100ml', 3_300_000, null, null, 'from-amber-100 to-orange-300'],
      ['Velvet Orchid — 50ml', 2_600_000, 3_200_000, null, 'from-fuchsia-100 to-purple-200'],
      ['Leather Oud — 75ml', 4_200_000, null, null, 'from-stone-300 to-amber-200'],
      ['Peony Blush — 50ml', 2_000_000, 2_600_000, null, 'from-rose-100 to-pink-200'],
      ['Tobacco Vanille — 100ml', 4_500_000, 5_400_000, 'NEW', 'from-amber-200 to-orange-300'],
      ['Sea Salt & Sage — 60ml', 2_300_000, null, null, 'from-cyan-100 to-teal-200'],
      ['Midnight Musk — 75ml', 3_400_000, 4_100_000, null, 'from-slate-200 to-stone-400'],
      ['Fig & Cassis — 50ml', 1_900_000, null, null, 'from-purple-100 to-violet-200'],
      ['Golden Amber — 100ml', 4_000_000, 4_800_000, null, 'from-yellow-100 to-amber-300'],
      ['Cashmere Woods — 75ml', 3_500_000, null, 'NEW', 'from-stone-200 to-amber-100'],
      ['Bergamot Neroli — 50ml', 2_150_000, 2_700_000, null, 'from-lime-100 to-yellow-200'],
      ['Royal Saffron — 90ml', 4_300_000, null, null, 'from-orange-100 to-amber-200'],
    ]),
  },
  caps: {
    name: 'Caps',
    products: make('cap', [
      ['Handwoven Aso-Oke Fila — Bronze', 850_000, 1_500_000, 'NEW', 'from-amber-100 to-orange-200'],
      ['Embroidered Cap — Navy', 1_200_000, null, null, 'from-blue-100 to-indigo-200'],
      ['Velvet Fila — Wine', 1_450_000, 1_800_000, null, 'from-rose-200 to-red-300'],
      ['Beaded Ceremonial Cap — Gold', 1_650_000, null, null, 'from-yellow-100 to-amber-200'],
      ['Kufi Cap — Ivory White', 650_000, 900_000, null, 'from-stone-50 to-stone-200'],
      ['Fila Abeti-Aja — Black', 1_100_000, null, null, 'from-stone-300 to-stone-400'],
      ['Damask Cap — Cream', 1_350_000, 1_700_000, null, 'from-amber-50 to-stone-200'],
      ['Traditional Fila — Forest Green', 950_000, null, 'NEW', 'from-emerald-100 to-green-200'],
      ['Aso-Oke Cap — Silver Grey', 1_250_000, 1_600_000, null, 'from-stone-200 to-slate-300'],
      ['Embellished Fila — Royal Blue', 1_550_000, null, 'NEW', 'from-blue-100 to-indigo-200'],
      ['Woolen Kufi — Charcoal', 750_000, 1_000_000, null, 'from-stone-300 to-stone-500'],
      ['Beaded Fila — Emerald', 1_700_000, null, null, 'from-emerald-100 to-green-200'],
      ['Fila Gobi — Navy', 1_150_000, 1_450_000, null, 'from-blue-100 to-indigo-300'],
      ['Aso-Oke Fila — Wine', 1_400_000, null, null, 'from-rose-200 to-red-300'],
      ['Embroidered Kufi — Gold', 1_050_000, 1_350_000, null, 'from-yellow-100 to-amber-200'],
      ['Velvet Cap — Emerald', 1_500_000, null, 'NEW', 'from-emerald-100 to-green-300'],
      ['Beaded Fila — Silver', 1_750_000, 2_100_000, null, 'from-slate-100 to-stone-300'],
      ['Damask Fila — Black', 1_300_000, null, null, 'from-stone-400 to-stone-600'],
      ['Woven Cap — Cream', 900_000, 1_200_000, null, 'from-amber-50 to-stone-200'],
      ['Ceremonial Fila — Purple', 1_600_000, null, null, 'from-purple-100 to-violet-200'],
      ['Cotton Kufi — White', 600_000, 850_000, null, 'from-stone-50 to-stone-200'],
      ['Aso-Oke Fila — Teal', 1_350_000, 1_700_000, 'NEW', 'from-teal-100 to-cyan-200'],
      ['Sequin Cap — Rose Gold', 1_800_000, null, null, 'from-rose-100 to-amber-100'],
      ['Traditional Fila — Brown', 1_000_000, 1_300_000, null, 'from-amber-200 to-stone-400'],
    ]),
  },
};
