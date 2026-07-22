'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, LogOut, Settings, ShoppingBag, ShoppingCart, User } from 'lucide-react';
import { api } from '@/lib/api';
import { useCart } from '@/lib/cart';

interface Me { id: string; email: string; name: string | null; businessName: string | null }

/** Portal header — mirrors the storefront: sticky white bar, wide container,
 *  uppercase display logo, right-side account dropdown (with Account settings). */
export function PortalHeader({ active }: { active?: 'catalog' | 'orders' | 'account' | 'cart' }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { count } = useCart();

  useEffect(() => { api.get<{ partner: Me | null }>('/partnership/me').then((r) => setMe(r.partner)).catch(() => {}); }, []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  async function signOut() {
    await api.post('/partnership/logout').catch(() => {});
    router.replace('/');
  }

  const label = me?.businessName || me?.name || me?.email || 'Account';
  const navLink = (href: string, text: string, on: boolean) => (
    <Link href={href} className={`hidden text-[13px] font-semibold md:inline ${on ? 'text-accent-700' : 'text-stone-700 hover:text-stone-950'}`}>{text}</Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1905px] items-center gap-x-6 px-4 py-3.5 lg:px-6 xl:px-12 2xl:px-[8rem]">
        <Link href="/catalog" className="flex flex-1 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" aria-hidden="true" className="h-8 w-8 shrink-0" />
          <span className="font-display whitespace-nowrap text-[17px] font-bold uppercase tracking-[0.08em] sm:text-[22px] sm:tracking-[0.16em]">Zahrah Fashion Hub</span>
          <span className="hidden rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-accent-700 sm:inline">Partners</span>
        </Link>

        <nav className="flex items-center gap-5 sm:gap-7">
          {navLink('/catalog', 'Catalogue', active === 'catalog')}
          {navLink('/orders', 'My orders', active === 'orders')}

          <Link href="/cart" aria-label="Cart" className={`flex items-center gap-2 ${active === 'cart' ? 'text-accent-700' : 'text-stone-700 hover:text-stone-950'}`}>
            <span className="relative">
              <ShoppingCart size={22} strokeWidth={1.7} />
              {count > 0 && (
                <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-600 px-1 text-[10px] font-bold text-white">{count}</span>
              )}
            </span>
            <span className="text-[13px] font-semibold">Cart</span>
          </Link>

          <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 cursor-pointer">
              <User size={22} strokeWidth={1.7} />
              <span className="hidden max-w-[150px] truncate text-[13px] font-semibold sm:inline">{label}</span>
            </button>
            {open && (
              <div className="absolute right-0 top-full z-50 w-60 pt-2">
                <div className="rounded-2xl border border-stone-100 bg-white p-2 shadow-2xl">
                  <p className="truncate px-3 pb-2 pt-1 text-sm font-bold text-stone-900">{label}</p>
                  <div className="space-y-0.5">
                    <MenuLink href="/catalog" icon={ShoppingBag} onClick={() => setOpen(false)}>Catalogue</MenuLink>
                    <MenuLink href="/cart" icon={ShoppingCart} onClick={() => setOpen(false)}>My cart{count > 0 ? ` (${count})` : ''}</MenuLink>
                    <MenuLink href="/orders" icon={ClipboardList} onClick={() => setOpen(false)}>My orders</MenuLink>
                    <MenuLink href="/account" icon={Settings} onClick={() => setOpen(false)}>Account settings</MenuLink>
                  </div>
                  <hr className="my-1.5 border-stone-100" />
                  <button onClick={signOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-50">
                    <LogOut size={16} className="text-stone-400" /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

function MenuLink({ href, icon: Icon, onClick, children }: { href: string; icon: typeof User; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-50">
      <Icon size={16} className="text-stone-400" /> {children}
    </Link>
  );
}
