'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Clock, Info, PackagePlus,
  PlusCircle, Receipt, Search as SearchIcon, ClipboardList, Megaphone, ListChecks,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { naira, timeAgo } from '@/lib/format';
import { Badge, Card, Select, Spinner, cn } from '@/components/ui';

interface FeedEntry { key: string; label: string; count: number; oldestAt: string | null; link: string }
interface DashboardData {
  widgets: {
    kpi_row?: { kpis: Record<string, { value: number; delta: number | null; definition: string }>; asOf: string };
    revenue_trend?: { granularity: string; series: { bucket: string; revenue: number; orders: number }[]; asOf: string };
    action_feed?: { groups: { class: string; label: string; entries: FeedEntry[] }[]; asOf: string };
    quick_actions?: { actions: string[] };
    orders_status_strip?: { byStatus: Record<string, number>; showAmounts: boolean; asOf: string };
    shipments_today?: { out: number; delivered: number; failed: number; asOf: string };
    stock_alerts?: { counts: Record<string, number>; asOf: string };
    top_products?: { products: { name: string; sku: string; revenue: number; units: number }[]; asOf: string };
    channel_split?: { channels: { channel: string; revenue: number; orders: number }[]; asOf: string };
    active_promotions?: { promotions: { id: string; name: string; scope: string; endsAt: string | null }[]; asOf: string };
    content_attention?: { attention: number; goingLiveToday: number; asOf: string };
  };
}

const KPI_LABELS: Record<string, string> = {
  gross_revenue: 'Gross revenue',
  orders: 'Orders',
  aov: 'Average Order Value',
  net_sales: 'Net sales',
  gross_margin: 'Gross margin',
};

const CHANNEL_LABELS: Record<string, string> = {
  web: 'Website', whatsapp: 'WhatsApp', instagram: 'Instagram', phone: 'Phone', in_store: 'In store',
};
const channelLabel = (c: string) => CHANNEL_LABELS[c] ?? c.replace(/_/g, ' ');

const QUICK_ACTIONS: Record<string, { label: string; href: string; icon: React.ComponentType<{ size?: number }> }> = {
  create_order: { label: 'Create order', href: '/orders/new', icon: PlusCircle },
  confirm_transfers: { label: 'Confirm transfers', href: '/orders?queue=awaiting_transfer', icon: Receipt },
  add_product: { label: 'Add product', href: '/products/new', icon: PackagePlus },
  receive_stock: { label: 'Receive stock', href: '/inventory/receive', icon: PackagePlus },
  find_customer: { label: 'Find customer', href: '/customers', icon: SearchIcon },
  packing_queue: { label: 'Packing queue', href: '/orders?queue=ready_to_process', icon: ClipboardList },
  record_delivery: { label: 'Record delivery', href: '/orders?queue=out_today', icon: ClipboardList },
  // Stocktakes feature temporarily disabled — re-enable by uncommenting here
  // and the Stocktakes button in inventory/page.tsx.
  // start_stocktake: { label: 'Start stocktake', href: '/inventory/stocktakes', icon: ListChecks },
  new_banner: { label: 'New banner', href: '/content?new=section', icon: Megaphone },
  content_queue: { label: 'Content queue', href: '/content', icon: ListChecks },
};

const PIE_COLORS = ['#9a5224', '#b4632c', '#d4a017', '#046a38', '#1e3a8a'];

const STATUS_ORDER = ['DRAFT', 'PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'DELIVERY_FAILED'];

export default function DashboardPage() {
  const { me } = useAuth();
  const [period, setPeriod] = useState('today');
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => api.get<DashboardData>(`/dashboard?period=${period}`),
    refetchInterval: 60_000, // FR-ACT-05
  });

  if (isLoading || !data) return <Spinner />;
  const w = data.widgets;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {me?.user.name.split(' ')[0]}</h1>
          <p className="text-sm text-stone-500">Here’s how the store is doing.</p>
        </div>
        {w.kpi_row && (
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-44">
            <option value="today">Today vs last {new Date().toLocaleDateString('en-NG', { weekday: 'long' })}</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7">Last 7 days</option>
            <option value="last30">Last 30 days</option>
            <option value="this_month">This month</option>
          </Select>
        )}
      </div>

      {/* Phone-first order: action feed → KPI → quick actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:order-2 lg:col-span-1">
          {w.action_feed && <ActionFeed groups={w.action_feed.groups} asOf={w.action_feed.asOf} />}
          {w.quick_actions && w.quick_actions.actions.length > 0 && (
            <Card title="Quick actions">
              <div className="grid grid-cols-2 gap-2">
                {w.quick_actions.actions.map((key) => {
                  const action = QUICK_ACTIONS[key];
                  if (!action) return null;
                  return (
                    <Link key={key} href={action.href} className="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-2.5 text-sm font-medium hover:border-brand-500 hover:bg-brand-50">
                      <action.icon size={16} />
                      {action.label}
                    </Link>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4 lg:order-1 lg:col-span-2">
          {w.kpi_row && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
              {Object.entries(w.kpi_row.kpis).map(([key, kpi]) => (
                <div key={key} className="group relative rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-1 text-xs text-stone-500">
                    {KPI_LABELS[key] ?? key}
                    <span title={kpi.definition}><Info size={11} className="text-stone-300" /></span>
                  </div>
                  <p className="mt-1 text-lg font-bold">
                    {key === 'orders' ? kpi.value.toLocaleString('en-NG') : naira(kpi.value)}
                  </p>
                  {kpi.delta != null && (
                    <p className={cn('mt-0.5 flex items-center gap-0.5 text-xs font-medium', kpi.delta >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {kpi.delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {Math.abs(kpi.delta)}%
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {w.revenue_trend && (
            <Card title="Revenue trend" action={<FreshnessTag asOf={w.revenue_trend.asOf} />}>
              {w.revenue_trend.series.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={w.revenue_trend.series.map((s) => ({
                    label: w.revenue_trend!.granularity === 'hour'
                      ? new Date(s.bucket).toLocaleTimeString('en-NG', { hour: 'numeric' })
                      : new Date(s.bucket).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
                    revenue: s.revenue / 100,
                  }))}>
                    <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} width={90} tickLine={false} axisLine={false} tickFormatter={(v) => `₦${Number(v).toLocaleString('en-NG')}`} />
                    <Tooltip formatter={(v) => [`₦${Number(v).toLocaleString('en-NG')}`, 'Revenue']} />
                    <Bar dataKey="revenue" fill="#9a5224" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-10 text-center text-sm text-stone-400">No confirmed sales in this period yet</p>
              )}
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {w.top_products && (
              <Card title="Top products" action={<Link href="/reports" className="text-xs text-brand-600 hover:underline">Reports →</Link>}>
                {w.top_products.products.length ? (
                  <ul className="space-y-2">
                    {w.top_products.products.map((p, i) => (
                      <li key={p.sku} className="flex items-center justify-between text-sm">
                        <span className="truncate"><span className="mr-2 text-stone-400">{i + 1}.</span>{p.name}</span>
                        <span className="font-medium">{naira(p.revenue)}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="py-6 text-center text-sm text-stone-400">No sales yet</p>}
              </Card>
            )}
            {w.channel_split && (
              <Card title="Channel split">
                {w.channel_split.channels.length ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={w.channel_split.channels.map((c) => ({ name: channelLabel(c.channel), value: c.revenue / 100 }))} dataKey="value" innerRadius={40} outerRadius={65}>
                        {w.channel_split.channels.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Legend fontSize={11} />
                      <Tooltip formatter={(v) => `₦${Number(v).toLocaleString('en-NG')}`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="py-6 text-center text-sm text-stone-400">No sales yet</p>}
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Operational snapshots */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {w.orders_status_strip && (
          <Card title="Orders by status" className="xl:col-span-2">
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.filter((s) => w.orders_status_strip!.byStatus[s]).map((status) => (
                <Link key={status} href={`/orders?status=${status}`} className="rounded-md border border-stone-200 px-3 py-1.5 text-xs hover:border-brand-500">
                  <span className="font-bold">{w.orders_status_strip!.byStatus[status]}</span>{' '}
                  <span className="text-stone-500">{status.replace(/_/g, ' ').toLowerCase()}</span>
                </Link>
              ))}
              {!Object.keys(w.orders_status_strip.byStatus).length && <p className="text-sm text-stone-400">No open orders</p>}
            </div>
          </Card>
        )}
        {w.shipments_today && (
          <Card title="Shipments today">
            <div className="flex justify-around text-center">
              <div><p className="text-xl font-bold">{w.shipments_today.out}</p><p className="text-xs text-stone-500">Out</p></div>
              <div><p className="text-xl font-bold text-emerald-600">{w.shipments_today.delivered}</p><p className="text-xs text-stone-500">Delivered</p></div>
              <div><p className="text-xl font-bold text-red-600">{w.shipments_today.failed}</p><p className="text-xs text-stone-500">Failed</p></div>
            </div>
          </Card>
        )}
        {w.stock_alerts && (
          <Card title="Stock alerts">
            <div className="flex justify-around text-center">
              <Link href="/inventory?filter=out" className="hover:underline">
                <p className="text-xl font-bold text-red-600">{w.stock_alerts.counts.out_of_stock ?? 0}</p>
                <p className="text-xs text-stone-500">Out of stock</p>
              </Link>
              <Link href="/inventory?filter=low" className="hover:underline">
                <p className="text-xl font-bold text-amber-600">{(w.stock_alerts.counts.low_stock ?? 0) + (w.stock_alerts.counts.bundle_low ?? 0)}</p>
                <p className="text-xs text-stone-500">Low stock</p>
              </Link>
            </div>
          </Card>
        )}
        {w.active_promotions && (
          <Card title="Active promotions" className={w.orders_status_strip ? '' : 'xl:col-span-2'}>
            {w.active_promotions.promotions.length ? (
              <ul className="space-y-1.5">
                {w.active_promotions.promotions.map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    <Link href={`/discounts/${p.id}`} className="truncate hover:underline">{p.name}</Link>
                    <span className="text-xs text-stone-400">
                      {p.endsAt ? `ends ${timeAgo(p.endsAt).replace(' ago', '')}` : 'no end date'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="py-2 text-center text-sm text-stone-400">None live</p>}
          </Card>
        )}
        {w.content_attention && (
          <Card title="Content">
            <div className="flex justify-around text-center">
              <Link href="/content?tab=attention" className="hover:underline">
                <p className="text-xl font-bold text-amber-600">{w.content_attention.attention}</p>
                <p className="text-xs text-stone-500">Needs attention</p>
              </Link>
              <div>
                <p className="text-xl font-bold">{w.content_attention.goingLiveToday}</p>
                <p className="text-xs text-stone-500">Going live today</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function FreshnessTag({ asOf }: { asOf: string }) {
  const stale = Date.now() - new Date(asOf).getTime() > 15 * 60_000; // FR-RSP-02
  return (
    <span className={cn('flex items-center gap-1 text-xs', stale ? 'font-medium text-amber-600' : 'text-stone-400')}>
      <Clock size={11} /> {stale ? `stale — as of ${new Date(asOf).toLocaleTimeString()}` : timeAgo(asOf)}
    </span>
  );
}

function ActionFeed({ groups, asOf }: { groups: { class: string; label: string; entries: FeedEntry[] }[]; asOf: string }) {
  const classStyle: Record<string, { badge: 'red' | 'amber' | 'blue' }> = {
    critical: { badge: 'red' },
    customer_waiting: { badge: 'amber' },
    housekeeping: { badge: 'blue' },
  };
  return (
    <Card title="Needs your attention" action={<FreshnessTag asOf={asOf} />}>
      {groups.length ? (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.class}>
              <p className={cn('mb-1 text-[10px] font-bold uppercase tracking-wider', group.class === 'critical' ? 'text-red-600' : group.class === 'customer_waiting' ? 'text-amber-600' : 'text-stone-400')}>
                {group.label}
              </p>
              <div className="space-y-1">
                {group.entries.map((entry) => (
                  <Link key={entry.key} href={entry.link} className="flex items-center justify-between rounded-md border border-stone-100 px-3 py-2 text-sm hover:border-brand-400 hover:bg-brand-50/50">
                    <span className="flex items-center gap-2">
                      {group.class === 'critical' && <AlertTriangle size={14} className="text-red-500" />}
                      {entry.label}
                    </span>
                    <span className="flex items-center gap-2">
                      {entry.oldestAt && <span className="text-[11px] text-stone-400">oldest {timeAgo(entry.oldestAt)}</span>}
                      <Badge color={classStyle[group.class]?.badge ?? 'gray'}>{entry.count}</Badge>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-stone-400">All clear — nothing waiting on you 🎉</p>
      )}
    </Card>
  );
}
