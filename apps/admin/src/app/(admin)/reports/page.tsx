'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { naira, formatDate, qty } from '@/lib/format';
import { Button, Card, PageHeader, Select, Spinner, Table, Tabs, Td } from '@/components/ui';

const KPI_LABELS: Record<string, string> = {
  gross_revenue: 'Gross revenue',
  orders: 'Orders',
  aov: 'Average order value',
  net_sales: 'Net sales',
  gross_margin: 'Gross margin',
  units: 'Units sold',
};

const CHANNEL_LABELS: Record<string, string> = {
  web: 'Website', whatsapp: 'WhatsApp', instagram: 'Instagram', phone: 'Phone', in_store: 'In store',
};
const channelLabel = (c: string) => CHANNEL_LABELS[c] ?? c.replace(/_/g, ' ');

export default function ReportsPage() {
  const { hasCap } = useAuth();
  const [tab, setTab] = useState('sales');
  const [period, setPeriod] = useState('last30');

  const tabs = [
    ...(hasCap('reports.view_sales') ? [{ key: 'sales', label: 'Sales' }] : []),
    ...(hasCap('reports.view_margin') ? [{ key: 'financial', label: 'Financial summary' }] : []),
    ...(hasCap('reports.view_products') ? [{ key: 'deadstock', label: 'Dead stock' }] : []),
    ...(hasCap('reports.view_margin') ? [{ key: 'shrinkage', label: 'Shrinkage' }] : []),
    ...(hasCap('reports.view_customers') || hasCap('reports.view_customers_aggregate') ? [{ key: 'customers', label: 'Customers' }] : []),
    ...(hasCap('reports.view_ops') ? [{ key: 'operations', label: 'Operations' }] : []),
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Reports"
        action={
          <div className="flex gap-2">
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-36">
              <option value="today">Today</option>
              <option value="last7">Last 7 days</option>
              <option value="last30">Last 30 days</option>
              <option value="this_month">This month</option>
            </Select>
            {hasCap('reports.export') && (
              <a href={`/api/reports/export?report=${tab === 'deadstock' ? 'stock' : 'sales'}&period=${period}`} target="_blank">
                <Button variant="outline"><Download size={15} /> Export to spreadsheet</Button>
              </a>
            )}
          </div>
        }
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === 'sales' && <SalesReport period={period} />}
        {tab === 'financial' && <FinancialReport period={period} />}
        {tab === 'deadstock' && <DeadStockReport />}
        {tab === 'shrinkage' && <ShrinkageReport period={period} />}
        {tab === 'customers' && <CustomersReport period={period} />}
        {tab === 'operations' && <OperationsReport period={period} />}
      </div>
    </div>
  );
}

function SalesReport({ period }: { period: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-sales', period],
    queryFn: () => api.get<{
      kpis: Record<string, { value: number; delta: number | null; definition: string }>;
      trend: { granularity: string; series: { bucket: string; channel: string; revenue: number; orders: number }[] };
      channels: { channel: string; revenue: number; orders: number }[];
      topProducts: { name: string; sku: string; revenue: number; units: number }[];
    }>(`/reports/sales?period=${period}`),
  });
  if (isLoading || !data) return <Spinner />;

  const merged = new Map<string, number>();
  for (const s of data.trend.series) {
    merged.set(s.bucket, (merged.get(s.bucket) ?? 0) + s.revenue);
  }
  const series = Array.from(merged.entries()).map(([bucket, revenue]) => ({
    label: data.trend.granularity === 'hour' ? new Date(bucket).toLocaleTimeString('en-NG', { hour: 'numeric' }) : formatDate(bucket),
    revenue: revenue / 100,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.entries(data.kpis).map(([key, kpi]) => (
          <div key={key} className="rounded-lg border border-stone-200 bg-white p-3" title={kpi.definition}>
            <p className="text-xs text-stone-400">{KPI_LABELS[key] ?? key.replace(/_/g, ' ')}</p>
            <p className="mt-0.5 text-lg font-bold">{key === 'orders' ? kpi.value.toLocaleString('en-NG') : naira(kpi.value)}</p>
          </div>
        ))}
      </div>
      <Card title="Revenue over time">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={series} margin={{ left: 12 }}>
            <XAxis dataKey="label" fontSize={11} />
            <YAxis fontSize={11} width={90} tickFormatter={(v) => `₦${Number(v).toLocaleString('en-NG')}`} />
            <Tooltip formatter={(v) => `₦${Number(v).toLocaleString('en-NG')}`} />
            <Bar dataKey="revenue" fill="#9a5224" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Top products">
          <Table headers={['Product', 'Units', 'Revenue']} empty="No sales">
            {data.topProducts.map((p) => (
              <tr key={p.sku}><Td>{p.name}</Td><Td>{qty(p.units)}</Td><Td className="font-medium">{naira(p.revenue)}</Td></tr>
            ))}
          </Table>
        </Card>
        <Card title="By channel">
          <Table headers={['Channel', 'Orders', 'Revenue']} empty="No sales">
            {data.channels.map((c) => (
              <tr key={c.channel}><Td>{channelLabel(c.channel)}</Td><Td>{c.orders}</Td><Td className="font-medium">{naira(c.revenue)}</Td></tr>
            ))}
          </Table>
        </Card>
      </div>
    </div>
  );
}

function FinancialReport({ period }: { period: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-financial', period],
    queryFn: () => api.get<{ lines: Record<string, number | null> }>(`/reports/financial-summary?period=${period}`),
  });
  if (isLoading || !data) return <Spinner />;
  const LABELS: Record<string, string> = {
    productRevenue: 'Product revenue (net of discounts)',
    discounts: 'Promotion discounts',
    manualDiscounts: 'Staff manual discounts',
    shippingCollected: 'Shipping collected (separate line)',
    refunds: 'Refunds processed',
    cogs: 'Cost of goods sold',
    grossMargin: 'Gross margin',
    vat: 'Value Added Tax (off — pending registration confirmation)',
  };
  return (
    <Card title="Financial summary">
      <table className="w-full max-w-xl text-sm">
        <tbody className="divide-y divide-stone-100">
          {Object.entries(data.lines).map(([key, value]) => (
            <tr key={key}>
              <td className="py-2.5 text-stone-600">{LABELS[key] ?? key}</td>
              <td className={`py-2.5 text-right font-medium ${key === 'grossMargin' ? 'text-emerald-700' : ''}`}>
                {value == null ? '—' : naira(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function DeadStockReport() {
  const { data, isLoading } = useQuery({
    queryKey: ['report-deadstock'],
    queryFn: () => api.get<{ sku: string; name: string; category: string; onHand: number; costValue: number; lastSale: string | null; threshold: number }[]>('/reports/dead-stock'),
  });
  if (isLoading) return <Spinner />;
  return (
    <Table headers={['Product', 'Category', 'On hand', 'Cost value', 'Last sale', 'No sale for']} empty="No dead stock 🎉">
      {data?.map((row) => (
        <tr key={row.sku}>
          <Td>{row.name}</Td>
          <Td className="text-stone-500">{row.category}</Td>
          <Td>{qty(row.onHand)}</Td>
          <Td>{naira(row.costValue)}</Td>
          <Td className="text-stone-500">{row.lastSale ? formatDate(row.lastSale) : 'never'}</Td>
          <Td className="text-xs text-stone-400">{row.threshold} days</Td>
        </tr>
      ))}
    </Table>
  );
}

function ShrinkageReport({ period }: { period: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-shrinkage', period],
    queryFn: () => api.get<{ reason: string; quantity: number; costValue: number }[]>(`/reports/shrinkage?period=${period}`),
  });
  if (isLoading) return <Spinner />;
  return (
    <Table headers={['Write-off reason', 'Quantity', 'Cost value']} empty="No write-offs in this period">
      {data?.map((row) => (
        <tr key={row.reason}>
          <Td>{row.reason.replace(/_/g, ' ')}</Td>
          <Td>{qty(row.quantity)}</Td>
          <Td className="font-medium text-red-600">{naira(row.costValue)}</Td>
        </tr>
      ))}
    </Table>
  );
}

function CustomersReport({ period }: { period: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-customers', period],
    queryFn: () => api.get<{
      newVsReturning: Record<string, number>;
      byZone: { zone: string | null; orders: number }[];
      topCustomers?: { id: string; name: string; spend: number; orders: number }[];
    }>(`/reports/customers?period=${period}`),
  });
  if (isLoading || !data) return <Spinner />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="New versus returning customers">
        <div className="flex justify-around py-4 text-center">
          <div><p className="text-2xl font-bold text-brand-700">{data.newVsReturning.new ?? 0}</p><p className="text-xs text-stone-500">New customers' orders</p></div>
          <div><p className="text-2xl font-bold">{data.newVsReturning.returning ?? 0}</p><p className="text-xs text-stone-500">Returning customers' orders</p></div>
        </div>
      </Card>
      <Card title="Orders by state">
        <Table headers={['State', 'Orders']} empty="No orders">
          {data.byZone.map((z, i) => <tr key={i}><Td>{z.zone ?? 'No state'}</Td><Td>{z.orders}</Td></tr>)}
        </Table>
      </Card>
      {data.topCustomers && (
        <Card title="Top customers" className="md:col-span-2">
          <Table headers={['Customer', 'Orders', 'Spend']} empty="No data">
            {data.topCustomers.map((c) => (
              <tr key={c.id}>
                <Td><a href={`/customers/${c.id}`} className="text-brand-700 hover:underline">{c.name}</a></Td>
                <Td>{c.orders}</Td>
                <Td className="font-medium">{naira(c.spend)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}

function OperationsReport({ period }: { period: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-ops', period],
    queryFn: () => api.get<{
      agingConfirmed: number;
      pod: Record<string, number | null> & { successRate: number | null };
      avgConfirmToShipHours: number | null;
    }>(`/reports/operations?period=${period}`),
  });
  if (isLoading || !data) return <Spinner />;
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        ['Confirmed orders not yet shipped (aging)', String(data.agingConfirmed)],
        // POD disabled — restore to re-enable pay on delivery
        // ['Pay-on-delivery success rate', data.pod.successRate != null ? `${data.pod.successRate}%` : '—'],
        // ['Pay-on-delivery delivered / failed', `${data.pod.delivered ?? 0} / ${data.pod.failed ?? 0}`],
        ['Average time from confirmation to shipment', data.avgConfirmToShipHours != null ? `${data.avgConfirmToShipHours} hours` : '—'],
      ].map(([label, value]) => (
        <div key={label} className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-400">{label}</p>
          <p className="mt-1 text-xl font-bold">{value}</p>
        </div>
      ))}
    </div>
  );
}
