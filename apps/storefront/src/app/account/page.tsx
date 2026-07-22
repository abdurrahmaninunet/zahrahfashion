'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight, Crown, Gift, Heart, Mail, MapPin, MessageCircle,
  Package, Phone, Settings, Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { naira } from '@/lib/format';
import { AccountShell, type Me } from './account-shell';

interface OrderRow { id: string; total: number }
interface Address { id: string }

// Amazon-style landing cards: each links to its own account route (or out).
const CARDS: { icon: typeof Package; title: string; desc: string; href: string }[] = [
  { icon: Package, title: 'Your Orders', desc: 'Track, return, or view your past orders', href: '/account/orders' },
  { icon: Wallet, title: 'Store Credit & Gift Cards', desc: 'Top up, claim or send a gift card', href: '/balance' },
  { icon: Heart, title: 'Your Wishlist', desc: "Items you've saved for later", href: '/wishlist' },
  { icon: MapPin, title: 'Your Addresses', desc: 'Manage the addresses for your deliveries', href: '/account/addresses' },
  { icon: Settings, title: 'Account Settings', desc: 'Name, password, security & preferences', href: '/account/profile' },
  { icon: MessageCircle, title: 'Help & Contact', desc: 'Get help or reach our team', href: '/pages/contact' },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'ZH';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function AccountPage() {
  return (
    <AccountShell title="My Account">
      {({ customer }) => <Dashboard customer={customer} />}
    </AccountShell>
  );
}

function Dashboard({ customer }: { customer: NonNullable<Me['customer']> }) {
  const { data: orders } = useQuery({ queryKey: ['store-orders'], queryFn: () => api.get<OrderRow[]>('/store/account/orders') });
  const { data: balance } = useQuery({ queryKey: ['balance'], queryFn: () => api.get<{ balance: number }>('/store/account/balance') });
  const { data: addresses } = useQuery({ queryKey: ['store-addresses'], queryFn: () => api.get<Address[]>('/store/account/addresses') });

  const firstName = customer.fullName.split(' ')[0];
  const orderCount = orders?.length ?? 0;

  // Profile completion — five signals the customer can actually control.
  const checks = [
    Boolean(customer.fullName?.trim()),
    Boolean(customer.email),
    Boolean(customer.phone),
    Boolean(addresses?.length),
    Boolean(customer.hasPassword),
  ];
  const complete = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return (
    <div className="space-y-5">
      {/* Profile hero */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <div className="flex flex-col gap-4 bg-gradient-to-br from-stone-900 to-stone-700 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#c9a227] text-lg font-bold text-stone-900">
              {initials(customer.fullName)}
            </span>
            <div className="min-w-0">
              <p className="font-display text-xl font-bold">Welcome back, {firstName} 👋</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-stone-200">
                {customer.phone && <span className="inline-flex items-center gap-1.5"><Phone size={13} /> {customer.phone}</span>}
                {customer.email && <span className="inline-flex items-center gap-1.5"><Mail size={13} /> {customer.email}</span>}
              </div>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#f0d97a] ring-1 ring-[#c9a227]/40">
            <Crown size={14} /> ZAHRA Rewards · Gold Member
          </span>
        </div>

        {/* Profile completion */}
        {complete < 100 && (
          <div className="border-t border-stone-100 px-5 py-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-stone-600">Complete your profile</span>
              <span className="font-semibold text-stone-900">{complete}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-[#c9a227] transition-all" style={{ width: `${complete}%` }} />
            </div>
            <Link href="/account/profile" className="mt-1.5 inline-block text-xs font-medium text-[#8a6d1f] hover:underline">
              Finish setting up →
            </Link>
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile icon={Package} label="Orders" value={String(orderCount)} href="/account/orders" />
        <StatTile icon={Wallet} label="Store Credit" value={naira(balance?.balance ?? 0)} href="/balance" />
        <StatTile icon={Gift} label="Gift Cards" value="Send / Redeem" href="/gift-card" />
      </div>

      {/* Account cards */}
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
    </div>
  );
}

function StatTile({ icon: Icon, label, value, href }: { icon: typeof Package; label: string; value: string; href: string }) {
  return (
    <Link href={href} className="flex flex-col justify-between gap-2 rounded-xl border border-stone-200 bg-white p-4 transition-all hover:border-stone-400 hover:shadow-sm">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#faf5e6] text-[#8a6d1f]"><Icon size={17} /></span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
        <p className="mt-0.5 truncate text-base font-bold text-stone-900">{value}</p>
      </div>
    </Link>
  );
}
