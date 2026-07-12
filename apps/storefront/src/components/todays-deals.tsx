'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, Clock, ShoppingBag, Star } from 'lucide-react';
import { naira } from '@/lib/format';
import { ProductCard, type ProductCardData } from '@/components/product-card';

// Dummy catalogue — used only when no Today's Deals section is configured. Prices in kobo.
interface Deal {
  name: string;
  price: number;
  was: number;
  bg: string;
  rating?: number;
  sold?: string;
  discount?: number;
}

const MEN: Deal[] = [
  { name: 'Embroidered Agbada 3-Piece Set — Royal Blue', price: 4_850_000, was: 7_200_000, bg: 'from-sky-100 to-sky-200', rating: 4.8, sold: '1,200+ sold' },
  { name: 'Senator Kaftan Wear — Wine', price: 2_650_000, was: 3_900_000, bg: 'from-rose-100 to-rose-200', rating: 4.6, sold: '900+ sold' },
  { name: 'Handwoven Aso-Oke Cap (Fila)', price: 850_000, was: 1_500_000, bg: 'from-amber-100 to-amber-200', rating: 4.7, sold: '2,000+ sold' },
];

const WOMEN: Deal[] = [
  { name: 'Ankara Flare Gown with Gele', price: 1_800_000, was: 3_600_000, bg: 'from-fuchsia-100 to-fuchsia-200', discount: 50 },
  { name: 'Premium Swiss Lace Wrapper Set', price: 3_200_000, was: 6_900_000, bg: 'from-emerald-100 to-emerald-200', discount: 54 },
  { name: 'Beaded Bridal Headtie & Purse', price: 1_150_000, was: 2_500_000, bg: 'from-violet-100 to-violet-200', discount: 54 },
];

function Countdown() {
  const [left, setLeft] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      let s = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
      const h = String(Math.floor(s / 3600)).padStart(2, '0');
      s %= 3600;
      const m = String(Math.floor(s / 60)).padStart(2, '0');
      const sec = String(s % 60).padStart(2, '0');
      setLeft(`${h}:${m}:${sec}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tabular-nums">Ends in: {left}</span>;
}

function DealCard({ deal, priceClass }: { deal: Deal; priceClass: string }) {
  const off = Math.round(((deal.was - deal.price) / deal.was) * 100);
  return (
    <Link
      href={`/search?q=${encodeURIComponent(deal.name)}`}
      className="group flex flex-col overflow-hidden border border-stone-200 bg-white transition-shadow hover:shadow-md"
    >
      <div className={`relative aspect-square overflow-hidden bg-gradient-to-br ${deal.bg}`}>
        <span className="absolute left-0 top-0 bg-[#c02b2b] px-1.5 py-0.5 text-[11px] font-bold text-white">−{deal.discount ?? off}%</span>
        <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold text-white/60 transition-transform duration-300 group-hover:scale-105">
          {deal.name.split(' ')[0]}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <p className="line-clamp-2 min-h-[2.4rem] text-[13px] leading-snug text-stone-700 group-hover:text-stone-950">{deal.name}</p>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className={`text-base font-bold ${priceClass}`}>{naira(deal.price)}</span>
          <span className="text-[11px] text-stone-400 line-through">{naira(deal.was)}</span>
        </div>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-stone-500">
          {deal.rating != null ? (
            <>
              <Star size={11} className="fill-amber-400 text-amber-400" />
              <b className="text-stone-800">{deal.rating}</b>
              <span className="text-stone-300">|</span>
              {deal.sold}
            </>
          ) : (
            <span className="font-medium text-[#c02b2b]">Limited time offer</span>
          )}
        </p>
      </div>
    </Link>
  );
}

function DummyPanel({ title, pill, deals, priceClass }: { title: string; pill: React.ReactNode; deals: Deal[]; priceClass: string }) {
  return (
    <div className="border-4 border-stone-400 p-5 md:p-6">
      <h3 className="text-center text-xl font-bold md:text-2xl">{title}</h3>
      <div className="mt-3 flex justify-center">{pill}</div>
      <div className="mt-5 grid grid-cols-3 gap-3 md:gap-4">
        {deals.map((d) => <DealCard key={d.name} deal={d} priceClass={priceClass} />)}
      </div>
    </div>
  );
}

/** Panel of real, admin-curated products (rendered with the shared card). */
function ProductPanel({ title, products }: { title: string; products: ProductCardData[] }) {
  return (
    <div className="border-4 border-stone-400 p-5 md:p-6">
      <h3 className="text-center text-xl font-bold md:text-2xl">{title}</h3>
      <div className="mt-5 grid grid-cols-3 gap-3 md:gap-4">
        {products.slice(0, 3).map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </div>
  );
}

/**
 * Today's Deals — two panels of three products. Renders admin-curated products
 * when provided (from the `todays_deals` composition section); otherwise falls
 * back to an illustrative set.
 */
export function TodaysDeals({
  men,
  women,
  menTitle = 'Men',
  womenTitle = 'Women',
}: {
  men?: ProductCardData[];
  women?: ProductCardData[];
  menTitle?: string;
  womenTitle?: string;
} = {}) {
  const live = (men?.length ?? 0) > 0 || (women?.length ?? 0) > 0;

  return (
    <section className="mx-auto max-w-[1905px] px-4 py-10 lg:px-[8rem]">
      <h2 className="mb-6 text-center font-display text-2xl font-bold md:text-3xl">Today&apos;s deals</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {live ? (
          <>
            <ProductPanel title={menTitle} products={men ?? []} />
            <ProductPanel title={womenTitle} products={women ?? []} />
          </>
        ) : (
          <>
            <DummyPanel
              title="Men"
              priceClass="text-[#c02b2b]"
              pill={
                <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                  <ShoppingBag size={13} /> 3+ styles from {naira(850_000)} <ChevronRight size={13} />
                </span>
              }
              deals={MEN}
            />
            <DummyPanel
              title="Women"
              priceClass="text-stone-900"
              pill={
                <span className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                  <Clock size={13} /> <Countdown /> <ChevronRight size={13} />
                </span>
              }
              deals={WOMEN}
            />
          </>
        )}
      </div>
    </section>
  );
}
