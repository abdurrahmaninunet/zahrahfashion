import type { Metadata } from 'next';
import { ShopCards } from '@/components/shop-cards';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Our shops',
  description: 'Visit Zahrah Fashion Hub in person — store locations, opening hours and contact details.',
  alternates: { canonical: '/shops' },
};

export default async function ShopsPage() {
  return (
    <div className="mx-auto max-w-[1905px] px-4 py-12 lg:px-[8rem]">
      <h1 className="font-display text-3xl font-bold md:text-4xl">Our shops</h1>
      <p className="mt-2 text-stone-500">Come see and feel the fabrics in person — here&apos;s where to find us.</p>

      <div className="mt-10">
        <ShopCards
          empty={
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-8 text-center">
              <p className="text-sm text-stone-600">Our shop locations will appear here soon.</p>
              <p className="mt-1 text-sm text-stone-400">In the meantime, tap the WhatsApp button for directions and opening hours.</p>
            </div>
          }
        />
      </div>
    </div>
  );
}
