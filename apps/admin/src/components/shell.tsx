'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, Boxes, FileText, Gift, LayoutDashboard, Lock, LogOut, Mail, Menu, MessageSquare, Package, Percent,
  Search, Settings, ShoppingBag, Users, BarChart3, Bike, X, Shirt,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge, Button, ErrorNote, Field, Input, cn, statusColor } from './ui';
import { naira, timeAgo } from '@/lib/format';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, capPrefix: 'reports.view_dashboard', exact: true },
  { href: '/orders', label: 'Orders', icon: ShoppingBag, capPrefix: 'orders.' },
  { href: '/products', label: 'Products', icon: Package, capPrefix: 'products.' },
  { href: '/inventory', label: 'Inventory', icon: Boxes, capPrefix: 'inventory.' },
  { href: '/customers', label: 'Customers', icon: Users, capPrefix: 'customers.' },
  { href: '/discounts', label: 'Discounts', icon: Percent, capPrefix: 'discounts.' },
  { href: '/content', label: 'Content', icon: FileText, capPrefix: 'content.' },
  { href: '/contact', label: 'Contact', icon: Mail, capPrefix: 'customers.' },
  { href: '/reviews', label: 'Comments', icon: MessageSquare, capPrefix: 'products.' },
  { href: '/mim', label: 'MIM Store', icon: Shirt, capPrefix: 'products.' },
  { href: '/lefe', label: 'Lefe', icon: Gift, capPrefix: 'products.' },
  { href: '/anko', label: 'Anko', icon: Lock, capPrefix: 'products.' },
  { href: '/reports', label: 'Reports', icon: BarChart3, capPrefix: 'reports.view_sales' },
  { href: '/staff', label: 'Riders', icon: Bike, capPrefix: 'staff.' },
  { href: '/settings', label: 'Settings & Roles', icon: Settings, capPrefix: 'settings.' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { me, loading, hasAnyCap, hasCap } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    if (!loading && !me) router.replace('/login');
    // Riders only see /rider (A2 FR-STF-02).
    if (!loading && me && me.capabilities.length === 1 && me.capabilities[0] === 'rider.workspace' && !pathname.startsWith('/rider')) {
      router.replace('/rider');
    }
  }, [loading, me, router, pathname]);

  if (loading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-stone-200 border-t-brand-600" />
      </div>
    );
  }

  // First sign-in: block the whole app until they set their own password.
  if (me.mustChangePassword) {
    return <ForcePasswordChange />;
  }

  const nav = NAV.filter((item) =>
    item.capPrefix.endsWith('.') ? hasAnyCap(item.capPrefix) : hasCap(item.capPrefix),
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 w-60 transform border-r border-stone-200 bg-white transition-transform lg:static lg:translate-x-0',
        mobileNav ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex h-14 items-center gap-2 border-b border-stone-100 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">Z</div>
          <span className="font-semibold">Zahrah Admin</span>
          <button className="ml-auto lg:hidden cursor-pointer" onClick={() => setMobileNav(false)}><X size={18} /></button>
        </div>
        <nav className="space-y-0.5 p-2">
          {nav.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNav(false)}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium',
                  active ? 'bg-brand-50 text-brand-700' : 'text-stone-600 hover:bg-stone-50',
                )}
              >
                <item.icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      {mobileNav && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileNav(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Test-mode banner (Settings Business Rule 4) */}
        {me.testMode && (
          <div className="bg-amber-400 px-4 py-1 text-center text-xs font-semibold text-amber-950">
            TEST MODE — payments are in Paystack test mode; no real money moves
          </div>
        )}
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-stone-200 bg-white/95 px-4 backdrop-blur">
          <button className="lg:hidden cursor-pointer" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2">
            <NotificationsBell />
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

// ── First-login forced password change (blocking) ────────────────────────────

function ForcePasswordChange() {
  const { refresh } = useAuth();
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const tooShort = pw.length > 0 && pw.length < 10;
  const mismatch = confirm.length > 0 && pw !== confirm;
  const canSubmit = pw.length >= 10 && pw === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/password/initial', { newPassword: pw });
      await refresh(); // clears mustChangePassword → app unblocks
    } catch (err) {
      setError(err instanceof ApiError ? err : { message: 'Could not set password' });
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-stone-100 to-brand-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-xl">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white"><Lock size={22} /></div>
          <h1 className="text-lg font-bold">Set your password</h1>
          <p className="mt-1 text-sm text-stone-500">Choose a new password to finish setting up your account. You can&apos;t continue until this is done.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password">
            <Input type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 10 characters" />
            {tooShort && <p className="mt-1 text-xs text-red-600">Must be at least 10 characters.</p>}
          </Field>
          <Field label="Confirm new password">
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {mismatch && <p className="mt-1 text-xs text-red-600">Passwords don&apos;t match.</p>}
          </Field>
          <ErrorNote error={error} />
          <Button type="submit" loading={loading} disabled={!canSubmit} className="w-full">Set password &amp; continue</Button>
          <button
            type="button"
            className="w-full text-center text-xs text-stone-400 hover:underline cursor-pointer"
            onClick={async () => { await api.post('/auth/logout'); router.push('/login'); }}
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Global search (FR-SRC) ────────────────────────────────────────────────────

interface SearchResults {
  orders: { id: string; orderNumber: string; status: string; grandTotal: number; customer?: { fullName: string } }[];
  products: { id: string; name: string; status: string; type: string }[];
  customers: { id: string; fullName: string; primaryPhone: string; status: string }[];
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const { data } = useQuery({
    queryKey: ['global-search', q],
    queryFn: () => api.get<SearchResults>(`/dashboard/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
  });

  const go = (href: string) => {
    setOpen(false);
    setQ('');
    router.push(href);
  };

  return (
    <div className="relative w-full max-w-md">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search orders, products, customers…  ( / )"
        className="w-full rounded-md border border-stone-200 bg-stone-50 py-1.5 pl-9 pr-3 text-sm focus:border-brand-500 focus:bg-white focus:outline-none"
      />
      {open && q.trim().length >= 2 && data && (
        <div className="absolute top-full z-50 mt-1 max-h-96 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-xl">
          {(['orders', 'products', 'customers'] as const).map((group) =>
            data[group].length ? (
              <div key={group}>
                <p className="bg-stone-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">{group}</p>
                {group === 'orders' && data.orders.map((o) => (
                  <button key={o.id} onMouseDown={() => go(`/orders/${o.id}`)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-stone-50 cursor-pointer">
                    <span>{o.orderNumber} <span className="text-stone-400">· {o.customer?.fullName}</span></span>
                    <Badge color={statusColor(o.status)}>{o.status}</Badge>
                  </button>
                ))}
                {group === 'products' && data.products.map((p) => (
                  <button key={p.id} onMouseDown={() => go(`/products/${p.id}`)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-stone-50 cursor-pointer">
                    <span>{p.name}</span>
                    <Badge color={statusColor(p.status)}>{p.status}</Badge>
                  </button>
                ))}
                {group === 'customers' && data.customers.map((c) => (
                  <button key={c.id} onMouseDown={() => go(`/customers/${c.id}`)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-stone-50 cursor-pointer">
                    <span>{c.fullName} <span className="text-stone-400">· {c.primaryPhone}</span></span>
                    {/* status badge only when it's a warning — "active" is noise */}
                    {c.status !== 'active' && <Badge color={statusColor(c.status)}>{c.status.replace('_', ' ')}</Badge>}
                  </button>
                ))}
              </div>
            ) : null,
          )}
          {!data.orders.length && !data.products.length && !data.customers.length && (
            <p className="px-3 py-4 text-center text-sm text-stone-400">No matches</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Notifications bell (FR-NTF) ───────────────────────────────────────────────

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ items: { id: string; type: string; payload: Record<string, unknown> | null; link: string | null; createdAt: string; readAt: string | null }[]; unread: number }>('/dashboard/notifications'),
    refetchInterval: 60_000,
  });
  const router = useRouter();

  const label = (n: { type: string; payload: Record<string, unknown> | null }) => {
    switch (n.type) {
      case 'large_order': return `Large order ${n.payload?.orderNumber}: ${naira(Number(n.payload?.total))}`;
      case 'refund_approval_needed': return `Refund approval needed — ${n.payload?.orderNumber} (${naira(Number(n.payload?.amount))})`;
      case 'refund_outcome': return `Your refund request was ${n.payload?.decision}d`;
      case 'reconciliation_drift': return `Inventory reconciliation drift on ${n.payload?.count} SKU(s)`;
      case 'transfer_at_door': return `${n.payload?.rider}: customer paying by transfer at the door (${n.payload?.orderNumber})`;
      default: return n.type.replace(/_/g, ' ');
    }
  };

  return (
    <div className="relative">
      <button className="relative rounded-md p-2 text-stone-500 hover:bg-stone-100 cursor-pointer" onClick={() => setOpen(!open)}>
        <Bell size={18} />
        {data && data.unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {data.unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-1 w-80 rounded-lg border border-stone-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
              <span className="text-sm font-semibold">Notifications</span>
              <button
                className="text-xs text-brand-600 hover:underline cursor-pointer"
                onClick={async () => {
                  await api.post('/dashboard/notifications/read-all');
                  queryClient.invalidateQueries({ queryKey: ['notifications'] });
                }}
              >
                Mark all read
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {data?.items.length ? data.items.map((n) => (
                <button
                  key={n.id}
                  onClick={async () => {
                    await api.post(`/dashboard/notifications/${n.id}/read`);
                    queryClient.invalidateQueries({ queryKey: ['notifications'] });
                    setOpen(false);
                    if (n.link) router.push(n.link);
                  }}
                  className={cn('block w-full px-3 py-2.5 text-left text-sm hover:bg-stone-50 cursor-pointer', !n.readAt && 'bg-brand-50/50')}
                >
                  <p className={cn(!n.readAt && 'font-medium')}>{label(n)}</p>
                  <p className="mt-0.5 text-xs text-stone-400">{timeAgo(n.createdAt)}</p>
                </button>
              )) : (
                <p className="px-3 py-8 text-center text-sm text-stone-400">No notifications</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── User menu ─────────────────────────────────────────────────────────────────

function UserMenu() {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  if (!me) return null;
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-stone-100 cursor-pointer">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-800 text-xs font-bold text-white">
          {me.user.name.slice(0, 1).toUpperCase()}
        </div>
        <span className="hidden text-sm font-medium sm:block">{me.user.name}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-lg border border-stone-200 bg-white py-1 shadow-xl">
            <div className="border-b border-stone-100 px-3 py-2">
              <p className="text-sm font-medium">{me.user.name}</p>
              <p className="text-xs text-stone-400">{me.user.email} · {me.user.roleKey}</p>
            </div>
            <Link href="/security" className="block px-3 py-2 text-sm hover:bg-stone-50" onClick={() => setOpen(false)}>
              Security
            </Link>
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 cursor-pointer"
              onClick={async () => {
                await api.post('/auth/logout');
                router.push('/login');
              }}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
