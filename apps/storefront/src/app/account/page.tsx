'use client';

import Link from 'next/link';
import { ChevronRight, Heart, Lock, MapPin, MessageCircle, Package, Wallet } from 'lucide-react';
import { AccountShell } from './account-shell';

// Amazon-style landing cards: each links to its own account route (or out).
const CARDS: { icon: typeof Package; title: string; desc: string; href: string }[] = [
  { icon: Package, title: 'Your Orders', desc: 'Track, return, or view your past orders', href: '/account/orders' },
  { icon: Wallet, title: 'Your Balance', desc: 'Top up or claim a gift card to your balance', href: '/balance' },
  { icon: Lock, title: 'Login & Security', desc: 'Edit your name, password & preferences', href: '/account/profile' },
  { icon: MapPin, title: 'Your Addresses', desc: 'Edit the addresses for your deliveries', href: '/account/addresses' },
  { icon: Heart, title: 'Your Wishlist', desc: "Items you've saved for later", href: '/wishlist' },
  { icon: MessageCircle, title: 'Help & Contact', desc: 'Get help or reach our team', href: '/contact' },
];

export default function AccountPage() {
  return (
    <AccountShell title="Your Account">
      {() => (
        <div className="grid gap-3 sm:grid-cols-2">
          {CARDS.map((c) => (
            <Link key={c.title} href={c.href} className="block cursor-pointer">
              <div className="flex h-full items-center gap-4 rounded-xl border border-stone-200 bg-white p-4 transition-all hover:border-stone-400 hover:shadow-sm">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#faf5e6] text-[#8a6d1f]">
                  <c.icon size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-900">{c.title}</p>
                  <p className="mt-0.5 text-sm leading-snug text-stone-500">{c.desc}</p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-stone-300" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </AccountShell>
  );
}
