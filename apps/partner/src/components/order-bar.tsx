'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { naira } from '@/lib/format';

/** Sticky summary bar on the catalogue / product pages — surfaces the running
 *  cart and routes to /cart, where the order is confirmed and paid. */
export function OrderBar() {
  const { count, total } = useCart();
  if (count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <ShoppingCart size={18} className="text-stone-500" />
          <span className="font-semibold text-stone-900">{count} item{count === 1 ? '' : 's'}</span>
          <span className="text-stone-400"> · </span>
          <span className="font-bold text-stone-900">{naira(total)}</span>
        </div>
        <Link href="/cart" className="ml-auto inline-flex h-10 items-center gap-2 rounded-full bg-accent-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-700">
          View cart &amp; checkout
        </Link>
      </div>
    </div>
  );
}
