'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { naira, formatDateTime } from '@/lib/format';
import { Badge, Button, Input, PageHeader, Pagination, Select, Spinner, Table, Tabs, Td, statusColor } from '@/components/ui';

interface OrderRow {
  id: string; orderNumber: string; createdAt: string;
  customer: { fullName: string; primaryPhone: string } | null;
  channel: string; itemsSummary: string; lineCount: number;
  grandTotal: number | null; paymentStatus: string; paymentMethod: string | null;
  status: string; zone: string | null;
}

const QUEUES = [
  { key: '', label: 'All orders' },
  { key: 'awaiting_transfer', label: 'Awaiting transfer' },
  // POD disabled — restore to re-enable pay on delivery
  // { key: 'pod_to_confirm', label: 'POD to confirm' },
  { key: 'ready_to_process', label: 'Ready to process' },
  { key: 'ready_to_ship', label: 'Ready to ship' },
  { key: 'out_today', label: 'Out for delivery' },
  { key: 'delivery_failed', label: 'Delivery failed' },
  { key: 'aging', label: 'Aging' },
  { key: 'drafts', label: 'Drafts' },
];

function OrdersPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { hasCap } = useAuth();
  const queue = params.get('queue') ?? '';
  const status = params.get('status') ?? '';
  const [q, setQ] = useState('');
  const [channel, setChannel] = useState('');
  const [page, setPage] = useState(1);

  const query = new URLSearchParams({
    ...(queue ? { queue } : {}),
    ...(status ? { status } : {}),
    ...(q ? { q } : {}),
    ...(channel ? { channel } : {}),
    page: String(page),
  });
  const { data, isLoading } = useQuery({
    queryKey: ['orders', query.toString()],
    queryFn: () => api.get<{ total: number; page: number; pageSize: number; rows: OrderRow[] }>(`/orders?${query}`),
    refetchInterval: 30_000,
  });

  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <PageHeader
        title="Orders"
        action={hasCap('orders.create_manual') ? (
          <Link href="/orders/new"><Button><Plus size={15} /> Create order</Button></Link>
        ) : undefined}
      />
      <Tabs
        tabs={QUEUES.map((qd) => ({ key: qd.key, label: qd.label }))}
        active={queue}
        onChange={(key) => { setPage(1); router.push(key ? `/orders?queue=${key}` : '/orders'); }}
      />
      <div className="my-3 flex flex-wrap gap-2">
        <Input placeholder="Search order no., customer, phone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="max-w-xs" />
        <Select value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} className="w-36">
          <option value="">All channels</option>
          <option value="web">Web</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="phone">Phone</option>
          <option value="in_store">In store</option>
        </Select>
      </div>

      {isLoading ? <Spinner /> : (
        <>
          <Table headers={['Order', 'Date', 'Customer', 'Channel', 'Items', 'Total', 'Payment', 'Status', 'State']} empty="No orders match">
            {data?.rows.map((o) => (
              <tr key={o.id} className="cursor-pointer hover:bg-stone-50" onClick={() => router.push(`/orders/${o.id}`)}>
                <Td className="font-medium text-brand-700">{o.orderNumber}</Td>
                <Td className="whitespace-nowrap text-stone-500">{formatDateTime(o.createdAt)}</Td>
                <Td>{o.customer?.fullName ?? '—'}<p className="text-xs text-stone-400">{o.customer?.primaryPhone}</p></Td>
                <Td><Badge>{o.channel}</Badge></Td>
                <Td className="max-w-52 truncate text-stone-500">{o.itemsSummary}{o.lineCount > 3 ? '…' : ''}</Td>
                <Td className="font-medium">{o.grandTotal != null ? naira(o.grandTotal) : '•••'}</Td>
                <Td><Badge color={statusColor(o.paymentStatus)}>{o.paymentStatus.replace(/_/g, ' ')}</Badge></Td>
                <Td><Badge color={statusColor(o.status)}>{o.status.replace(/_/g, ' ')}</Badge></Td>
                <Td className="text-stone-500">{o.zone ?? '—'}</Td>
              </tr>
            ))}
          </Table>
          {data && <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
        </>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return <Suspense fallback={<Spinner />}><OrdersPageInner /></Suspense>;
}
