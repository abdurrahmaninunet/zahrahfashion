'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ClipboardList, Gift, Heart, Menu, Search, ShoppingCart, Ticket, User, Wallet, X } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { whatsappLink } from '@/lib/format';
import { api } from '@/lib/api';
import { openAuthDrawer } from '@/lib/auth-drawer';
import { useWishlistCount } from '@/lib/wishlist';
import { AuthDrawer } from '@/components/auth/auth-drawer';
import { WishlistSync } from '@/components/wishlist-sync';

export interface StoreContext {
  store: { name: string; phone: string; whatsapp: string; whatsappMessage: string; email: string; address: string; social: { instagram?: string; facebook?: string; tiktok?: string } };
  mimEnabled: boolean;
  podAvailable: boolean;
  announcement: { message: string; link: string | null } | null;
  categories: { id: string; name: string; slug: string; parentId: string | null; image?: string | null }[];
}

// ── Announcement bar (§3.0) ───────────────────────────────────────────────────

export function AnnouncementBar({ announcement }: { announcement: StoreContext['announcement'] }) {
  if (!announcement?.message) return null;
  return (
    <div className="relative z-40 bg-stone-900 px-8 py-2 text-center text-xs text-stone-100">
      {announcement.link ? <a href={announcement.link} className="underline-offset-2 hover:underline">{announcement.message}</a> : announcement.message}
    </div>
  );
}

// ── Header: two-row marketplace layout — logo · pill search · utilities, then
//    an "All Categories" bar with inline category links + "More" dropdown.

const NAV_LABELS = ['Fabric', 'Laces', 'Perfumes', 'Caps', 'Cosmetics', 'Lefe', 'Anko', 'MIM Store', 'Gift Card', 'Balance'];

export function Header({ context }: { context: StoreContext }) {
  const { count } = useCart();
  const wishCount = useWishlistCount();
  const [menuOpen, setMenuOpen] = useState(false); // mobile drawer
  const [catsOpen, setCatsOpen] = useState(false); // "All Categories" mega-menu
  const [activeRootId, setActiveRootId] = useState<string | null>(null); // hovered top category
  const [acctOpen, setAcctOpen] = useState(false); // account dropdown
  const [q, setQ] = useState('');
  const catsRef = useRef<HTMLDivElement>(null);
  const acctRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Signed-in customer (if any) for the account block.
  const { data: me } = useQuery({
    queryKey: ['store-me-header'],
    queryFn: () => api.get<{ customer: { fullName: string } | null }>('/store/account/me'),
    staleTime: 60_000,
  });
  const firstName = me?.customer?.fullName?.split(' ')[0];

  // Close dropdowns on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (catsRef.current && !catsRef.current.contains(e.target as Node)) setCatsOpen(false);
      if (acctRef.current && !acctRef.current.contains(e.target as Node)) setAcctOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const roots = context.categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) => context.categories.filter((c) => c.parentId === id);
  // Active (hovered) top category for the mega-menu; defaults to the first.
  const activeRoot = roots.find((r) => r.id === activeRootId) ?? roots[0];
  // Every category beneath a root — children, grandchildren, any depth —
  // flattened into one list (tree order) for the mega-menu's right panel.
  const descendantsOf = (id: string): typeof roots => {
    const out: typeof roots = [];
    for (const child of childrenOf(id)) {
      out.push(child);
      out.push(...descendantsOf(child.id));
    }
    return out;
  };
  const activeDescendants = activeRoot ? descendantsOf(activeRoot.id) : [];
  // Nav labels resolve to the matching real category when one exists, otherwise
  // to a search for the label (so nothing dead-ends).
  // The MIM store link is gated on the master toggle (admin MIM → Content tab).
  const visibleNavLabels = NAV_LABELS.filter((l) => l !== 'MIM Store' || context.mimEnabled);
  const inlineNav = [
    { label: 'Home', href: '/' },
    ...visibleNavLabels.map((label) => {
      const key = label.toLowerCase();
      if (key === 'mim store') return { label, href: '/mim' };
      if (key === 'lefe') return { label, href: '/lefe' };
      if (key === 'anko') return { label, href: '/anko' };
      if (key === 'gift card') return { label, href: '/gift-card' };
      if (key === 'balance') return { label, href: '/balance' };
      const match = context.categories.find((c) => c.name.toLowerCase() === key);
      return { label, href: match ? `/c/${match.slug}` : `/search?q=${encodeURIComponent(label)}` };
    }),
  ];

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length >= 2) router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-white">
        {/* Row 1 — logo · search pill · utilities */}
        <div className="mx-auto flex max-w-[1905px] flex-wrap items-center gap-x-4 gap-y-2 px-4 lg:px-[8rem] py-3">
          {/* Left zone — equal flex to keep the search centered */}
          <div className="flex flex-1 items-center gap-2">
            <button aria-label="Menu" className="-ml-2 p-2 md:hidden cursor-pointer" onClick={() => setMenuOpen(true)}>
              <Menu size={20} />
            </button>
            <Link href="/" className="font-display whitespace-nowrap text-[17px] font-bold uppercase tracking-[0.08em] sm:text-[24px] sm:tracking-[0.16em]">
              {context.store.name || 'Zahra'}
            </Link>
          </div>

          {/* Center — search, fixed width so it sits dead centre */}
          <form onSubmit={submitSearch} className="order-last w-full md:order-none md:w-[320px] md:shrink-0 lg:w-[560px] min-[1400px]:!w-[640px] 2xl:!w-[740px]">
            <div className="flex items-center rounded-full border border-stone-300 bg-white pl-5 pr-1.5 transition-colors focus-within:border-stone-900">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search lace, ankara, perfumes…"
                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-stone-400"
              />
              <button aria-label="Search" className="flex h-8 w-12 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white transition-colors hover:bg-stone-700 cursor-pointer">
                <Search size={16} />
              </button>
            </div>
          </form>

          {/* Right zone — equal flex; utilities grouped together at the right */}
          <div className="flex flex-1 items-center justify-end gap-10">
            <div
              ref={acctRef}
              className="relative hidden md:block"
              onMouseEnter={() => setAcctOpen(true)}
              onMouseLeave={() => setAcctOpen(false)}
            >
              <button type="button" onClick={() => setAcctOpen((v) => !v)} className="flex cursor-pointer items-center gap-2">
                <User size={22} strokeWidth={1.7} />
                <span className="text-[13px] font-semibold">{firstName ?? 'Sign in'}</span>
              </button>

              {acctOpen && (
                <div className="absolute left-1/2 top-full z-50 w-64 -translate-x-1/2 pt-2">
                  <div className="relative rounded-2xl border border-stone-100 bg-white p-4 shadow-2xl">
                    <span aria-hidden className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-stone-100 bg-white" />
                    {firstName ? (
                      <>
                        <p className="text-center text-sm font-bold text-stone-900">Hi, {firstName}</p>
                        <Link href="/account" onClick={() => setAcctOpen(false)} className="mt-2 block w-full rounded-full bg-stone-900 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-stone-700">
                          My account
                        </Link>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => { setAcctOpen(false); openAuthDrawer(); }} className="block w-full cursor-pointer rounded-full bg-stone-900 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-stone-700">
                          Sign in
                        </button>
                        <button type="button" onClick={() => { setAcctOpen(false); openAuthDrawer(); }} className="mt-2 block w-full cursor-pointer text-center text-sm text-stone-500 hover:text-stone-800">
                          Register
                        </button>
                      </>
                    )}

                    <hr className="my-3 border-stone-100" />

                    <div className="space-y-0.5">
                      {[
                        { icon: ClipboardList, label: 'My Orders', href: '/account/orders', auth: true },
                        { icon: Gift, label: 'Gift Card', href: '/gift-card', auth: false },
                        { icon: Ticket, label: 'Coupons', href: '/coming-soon/coupons', auth: false },
                        { icon: Heart, label: 'Wishlist', href: '/wishlist', auth: false },
                        { icon: Wallet, label: 'Balance', href: '/balance', auth: false },
                      ].map(({ icon: Icon, label, href, auth }) => {
                        const cls = 'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-stone-800 transition-colors hover:bg-stone-50';
                        const inner = <><Icon size={18} strokeWidth={1.7} className="text-stone-500" />{label}</>;
                        // Account-gated shortcuts open the sign-in slider in place
                        // for guests instead of navigating away.
                        return auth && !firstName ? (
                          <button key={label} type="button" onClick={() => { setAcctOpen(false); openAuthDrawer(); }} className={`${cls} cursor-pointer`}>{inner}</button>
                        ) : (
                          <Link key={label} href={href} onClick={() => setAcctOpen(false)} className={cls}>{inner}</Link>
                        );
                      })}
                    </div>

                    <hr className="my-3 border-stone-100" />

                    <div className="space-y-0.5">
                      {['Settings', 'Disputes'].map((label) => (
                        firstName ? (
                          <Link key={label} href="/account" onClick={() => setAcctOpen(false)} className="block rounded-lg px-2 py-1.5 text-sm text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-900">{label}</Link>
                        ) : (
                          <button key={label} type="button" onClick={() => { setAcctOpen(false); openAuthDrawer(); }} className="block w-full cursor-pointer rounded-lg px-2 py-1.5 text-left text-sm text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-900">{label}</button>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <Link aria-label="Wishlist" href="/wishlist" className="flex items-center gap-2">
              <span className="relative">
                <Heart size={22} strokeWidth={1.7} />
                {wishCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {wishCount}
                  </span>
                )}
              </span>
              <span className="hidden text-[13px] font-semibold md:block">Saved</span>
            </Link>
            <Link aria-label="Cart" href="/cart" className="flex items-center gap-2">
              <span className="relative">
                <ShoppingCart size={22} strokeWidth={1.7} />
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-stone-900 px-1 text-[10px] font-bold text-white">
                  {count}
                </span>
              </span>
              <span className="hidden text-[13px] font-semibold md:block">Cart</span>
            </Link>
          </div>
        </div>

        {/* Mobile category strip — the desktop category bar (Row 2) is hidden on
            phones, so surface the same nav here as a horizontal scroll so
            categories stay reachable without opening the menu. */}
        <div className="border-t border-stone-100 md:hidden">
          <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 py-2.5">
            {inlineNav.map((item) => {
              const itemPath = item.href.split('?')[0];
              const active = itemPath === '/' ? pathname === '/' : pathname === itemPath || pathname.startsWith(`${itemPath}/`);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                    active ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Row 2 — All Categories + inline category nav */}
        <div className="hidden md:block">
          <div className="mx-auto flex max-w-[1905px] items-center gap-1 px-4 lg:px-[8rem]">
            <div ref={catsRef} className="relative py-2">
              <button
                onClick={() => setCatsOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-stone-200 cursor-pointer"
              >
                <Menu size={16} /> All Categories
              </button>
              {catsOpen && (
                <div className="absolute left-0 top-full z-30 flex w-[min(1000px,calc(100vw-9rem))] overflow-hidden rounded-xl border border-stone-100 bg-white shadow-2xl">
                  {roots.length ? (
                    <>
                      {/* Left rail — top-level categories */}
                      <div className="max-h-[70vh] w-56 shrink-0 overflow-y-auto border-r border-stone-100 bg-stone-50/60 py-2">
                        {roots.map((root) => {
                          const isActive = activeRoot?.id === root.id;
                          return (
                            <Link
                              key={root.id}
                              href={`/c/${root.slug}`}
                              onMouseEnter={() => setActiveRootId(root.id)}
                              onClick={() => setCatsOpen(false)}
                              className={`flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-white text-stone-950' : 'text-stone-600 hover:bg-white hover:text-stone-950'}`}
                            >
                              {root.name}
                              <ChevronRight size={14} className="shrink-0 text-stone-300" />
                            </Link>
                          );
                        })}
                      </div>

                      {/* Right panel — active category detail */}
                      <div className="max-h-[70vh] flex-1 overflow-y-auto p-6">
                        {activeRoot && (
                          <>
                            <div className="mb-4 flex items-center justify-between">
                              <h3 className="font-display text-lg font-bold">{activeRoot.name}</h3>
                              <Link href={`/c/${activeRoot.slug}`} onClick={() => setCatsOpen(false)} className="text-sm font-medium text-[#8a6d1f] hover:underline">
                                View all →
                              </Link>
                            </div>

                            {activeDescendants.length ? (
                              /* Every category under this parent — any depth — as one flat list */
                              <div className="gap-x-8 [column-count:2] lg:[column-count:3]">
                                {activeDescendants.map((cat) => (
                                  <Link
                                    key={cat.id}
                                    href={`/c/${cat.slug}`}
                                    onClick={() => setCatsOpen(false)}
                                    className="block break-inside-avoid py-1.5 text-sm text-stone-600 transition-colors hover:text-[#8a6d1f]"
                                  >
                                    {cat.name}
                                  </Link>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-stone-400">Browse everything in {activeRoot.name}.</p>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="px-4 py-6 text-sm text-stone-400">No categories yet</p>
                  )}
                </div>
              )}
            </div>
            <nav className="flex flex-1 items-center justify-around overflow-x-auto">
              {inlineNav.map((item) => {
                const itemPath = item.href.split('?')[0];
                const active = itemPath === '/' ? pathname === '/' : pathname === itemPath || pathname.startsWith(`${itemPath}/`);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`relative whitespace-nowrap px-4 py-3.5 text-[16px] font-bold transition-colors ${
                      active
                        ? 'text-[#8a6d1f] after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#8a6d1f]'
                        : 'text-stone-700 hover:text-stone-950'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Sign-in / register slide-over */}
      <AuthDrawer />
      <WishlistSync />

      {/* Drawer menu (mobile) */}
      {menuOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-lg font-bold">{context.store.name || 'Zahra'}</span>
              <button aria-label="Close menu" className="cursor-pointer" onClick={() => setMenuOpen(false)}><X size={20} /></button>
            </div>
            <nav className="space-y-1">
              {roots.map((root) => (
                <div key={root.id}>
                  <Link href={`/c/${root.slug}`} className="block rounded-md px-2 py-2 font-medium hover:bg-stone-50" onClick={() => setMenuOpen(false)}>
                    {root.name}
                  </Link>
                  {descendantsOf(root.id).map((child) => (
                    <Link key={child.id} href={`/c/${child.slug}`} className="block rounded-md px-4 py-1.5 text-sm text-stone-500 hover:bg-stone-50" onClick={() => setMenuOpen(false)}>
                      {child.name}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
            <div className="mt-6 border-t border-stone-100 pt-4 text-sm text-stone-500">
              {firstName ? (
                <Link href="/account" className="block py-1.5" onClick={() => setMenuOpen(false)}>My account</Link>
              ) : (
                <button type="button" className="block w-full cursor-pointer py-1.5 text-left" onClick={() => { setMenuOpen(false); openAuthDrawer(); }}>Sign in</button>
              )}
              <Link href="/pages/faq" className="block py-1.5" onClick={() => setMenuOpen(false)}>FAQ</Link>
              <Link href="/pages/contact" className="block py-1.5" onClick={() => setMenuOpen(false)}>Contact</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Footer (§3.10) ────────────────────────────────────────────────────────────

/** Brand social glyphs — lucide removed brand icons, so these are inline SVGs. */
const socialIcon = {
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M16.6 5.8a4.3 4.3 0 0 1-1-2.8h-3v12.1a2.4 2.4 0 1 1-2.4-2.4c.2 0 .5 0 .7.1v-3a5.4 5.4 0 1 0 4.7 5.3V9.3a7.2 7.2 0 0 0 4 1.2v-3a4.3 4.3 0 0 1-3-1.7z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M18.9 2H22l-7.5 8.6L23 22h-6.9l-5.4-7-6.2 7H1.4l8-9.2L1 2h7l4.9 6.5L18.9 2zm-2.4 18h1.9L7.6 4H5.6l10.9 16z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.55-3.7 8.24-8.24 8.24zm4.52-6.17c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.79.98-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42l-.48-.01c-.16 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.16 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z" />
    </svg>
  ),
};

export function Footer({ context }: { context: StoreContext }) {
  const social = context.store.social ?? {};
  const email = context.store.email || 'hello@zahrahfashion.com';
  const ig = social.instagram?.replace(/^@/, '');
  const tk = social.tiktok?.replace(/^@/, '');
  const fb = social.facebook; // may be a full URL or a plain handle
  const wa = context.store.whatsapp
    ? whatsappLink(context.store.whatsapp, context.store.whatsappMessage || "Hi! I'm interested in your products 👋")
    : null;
  // Only the channels the brand actually has (no X — not in use).
  const socials: { name: string; href: string; icon: React.ReactNode }[] = [];
  if (ig) socials.push({ name: 'Instagram', href: `https://instagram.com/${ig}`, icon: socialIcon.instagram });
  if (fb) socials.push({ name: 'Facebook', href: fb.startsWith('http') ? fb : `https://facebook.com/${fb}`, icon: socialIcon.facebook });
  if (tk) socials.push({ name: 'TikTok', href: `https://tiktok.com/@${tk}`, icon: socialIcon.tiktok });
  if (wa) socials.push({ name: 'WhatsApp', href: wa, icon: socialIcon.whatsapp });
  return (
    <footer className="mt-16 bg-stone-950 text-stone-300">
      <div className="mx-auto max-w-[1905px] px-4 lg:px-[8rem] pt-12">
        <p className="font-display text-3xl font-bold uppercase tracking-[0.22em] text-white md:text-5xl">
          {context.store.name || 'Zahra'}
        </p>
        <p className="mt-2 max-w-md text-sm text-stone-400">
          Fabrics that drape, scents that linger — delivered across Nigeria.
        </p>
      </div>
      <div className="mx-auto grid max-w-[1905px] gap-8 px-4 lg:px-[8rem] py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-400">Help</p>
          <Link href="/pages/delivery-information" className="block py-1 text-sm text-stone-400 transition-colors hover:text-white">Delivery information</Link>
          <Link href="/pages/returns-policy" className="block py-1 text-sm text-stone-400 transition-colors hover:text-white">Returns &amp; refunds</Link>
          <Link href="/pages/faq" className="block py-1 text-sm text-stone-400 transition-colors hover:text-white">FAQ</Link>
          <Link href="/pages/contact" className="block py-1 text-sm text-stone-400 transition-colors hover:text-white">Contact us</Link>
        </div>
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-400">Company</p>
          <Link href="/shops" className="block py-1 text-sm text-stone-400 transition-colors hover:text-white">Shops</Link>
          <Link href="/pages/about-us" className="block py-1 text-sm text-stone-400 transition-colors hover:text-white">About us</Link>
          <Link href="/pages/privacy-policy" className="block py-1 text-sm text-stone-400 transition-colors hover:text-white">Privacy policy</Link>
          <Link href="/pages/terms-of-service" className="block py-1 text-sm text-stone-400 transition-colors hover:text-white">Terms of service</Link>
        </div>
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-400">Contact us</p>
          {context.store.phone && (
            <a href={`tel:${context.store.phone.replace(/\s+/g, '')}`} className="block py-1 text-sm text-stone-400 transition-colors hover:text-white">{context.store.phone}</a>
          )}
          <a href={`mailto:${email}`} className="block py-1 text-sm text-stone-400 transition-colors hover:text-white">{email}</a>
        </div>
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-400">Stay connected</p>
          <div className="flex items-center gap-2.5">
            {socials.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-700 text-stone-300 transition-colors hover:border-white hover:bg-white hover:text-stone-950"
              >
                {s.icon}
              </a>
            ))}
          </div>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#25d366] px-4 py-2.5 text-sm font-semibold text-stone-950 transition-colors hover:bg-[#20bd5a]"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
                <path d="M17.5 14.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.68-1.62-.93-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.9 1.22 3.1.15.2 2.1 3.2 5.1 4.49.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.58-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.28-.2-.58-.35zM12.05 21.6h-.01a9.6 9.6 0 0 1-4.89-1.34l-.35-.2-3.63.95.97-3.54-.23-.36a9.57 9.57 0 0 1-1.47-5.1c0-5.3 4.31-9.6 9.62-9.6a9.55 9.55 0 0 1 6.8 2.82 9.55 9.55 0 0 1 2.81 6.79c0 5.3-4.31 9.6-9.62 9.6zm8.18-17.77A11.5 11.5 0 0 0 12.05.4C5.66.4.46 5.6.46 11.99c0 2.04.53 4.03 1.55 5.79L.36 23.6l5.96-1.56a11.58 11.58 0 0 0 5.72 1.5h.01c6.39 0 11.59-5.2 11.59-11.59 0-3.1-1.2-6-3.41-8.12z" />
              </svg>
              Chat with us on WhatsApp
            </a>
          )}
        </div>
      </div>
      <p className="border-t border-stone-800 py-4 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} {context.store.name || 'Zahra Fashion'} — Style redefined
      </p>
    </footer>
  );
}

// ── WhatsApp float (★) ────────────────────────────────────────────────────────

export function WhatsAppFloat({ context, message }: { context: StoreContext; message?: string }) {
  const { lines, code } = useCart();
  const [pulsed, setPulsed] = useState(false);
  useEffect(() => {
    setPulsed(sessionStorage.getItem('zahrah_wa_pulsed') === '1');
    sessionStorage.setItem('zahrah_wa_pulsed', '1');
  }, []);
  if (!context.store.whatsapp) return null;

  async function open() {
    let text = message ?? context.store.whatsappMessage ?? "Hi ZahraFashion! I'm browsing your store";
    // S-BR-11: include a cart-restore reference when the cart has items.
    if (lines.length) {
      try {
        const { cartRef } = await api.post<{ cartRef: string }>('/store/cart-ref', {
          lines: lines.map((l) => ({ variantId: l.variantId, bundleProductId: l.bundleProductId, quantity: l.quantity })),
          code,
        });
        const items = lines.map((l) => `${l.quantity}× ${l.name}`).join(', ');
        text = `${text}\n\nMy cart: ${items}\nCart ref: ${cartRef}`;
      } catch { /* fall back to plain message */ }
    }
    window.open(whatsappLink(context.store.whatsapp, text), '_blank');
  }

  return (
    <button
      aria-label="Chat with us on WhatsApp"
      onClick={open}
      className={`fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg hover:scale-105 transition-transform cursor-pointer ${pulsed ? '' : 'wa-pulse'}`}
    >
      <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden>
        <path d="M17.5 14.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.68-1.62-.93-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.9 1.22 3.1.15.2 2.1 3.2 5.1 4.49.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.58-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.28-.2-.58-.35zM12.05 21.6h-.01a9.6 9.6 0 0 1-4.89-1.34l-.35-.2-3.63.95.97-3.54-.23-.36a9.57 9.57 0 0 1-1.47-5.1c0-5.3 4.31-9.6 9.62-9.6a9.55 9.55 0 0 1 6.8 2.82 9.55 9.55 0 0 1 2.81 6.79c0 5.3-4.31 9.6-9.62 9.6zm8.18-17.77A11.5 11.5 0 0 0 12.05.4C5.66.4.46 5.6.46 11.99c0 2.04.53 4.03 1.55 5.79L.36 23.6l5.96-1.56a11.58 11.58 0 0 0 5.72 1.5h.01c6.39 0 11.59-5.2 11.59-11.59 0-3.1-1.2-6-3.41-8.12z" />
      </svg>
    </button>
  );
}
