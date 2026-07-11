'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { naira, formatDateTime, qty } from '@/lib/format';
import { BackLink, Badge, Input, PageHeader, Pagination, Select, Spinner, Table, Td } from '@/components/ui';

interface Movement {
  id: string; type: string; quantity: string; unitCost: number | null; reasonCode: string | null;
  note: string | null; referenceType: string | null; referenceId: string | null; createdAt: string;
  variant: { sku: string; product: { name: string } };
}

const TYPE_COLORS: Record<string, 'green' | 'red' | 'blue' | 'amber' | 'gray' | 'purple'> = {
  RECEIPT: 'green', RESERVE: 'blue', RELEASE: 'gray', DEDUCT: 'purple',
  RETURN_RESTOCK: 'green', WRITE_OFF: 'red', ADJUST_RECOUNT: 'amber',
  ADJUST_DAMAGE: 'red', ADJUST_THEFT: 'red', ADJUST_CORRECTION: 'amber', STOCKTAKE_VARIANCE: 'amber',
};

export default function MovementsPage() {
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ ...(type ? { type } : {}), page: String(page) });
  const { data, isLoading } = useQuery({
    queryKey: ['movements', query.toString()],
    queryFn: () => api.get<{ total: number; page: number; rows: Movement[] }>(`/inventory/movements?${query}`),
  });

  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <BackLink href="/inventory" label="Back to inventory" />
      <PageHeader title="Stock ledger" subtitle="Append-only movement history" />
      <div className="mb-3">
        <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="w-56">
          <option value="">All movement types</option>
          {Object.keys(TYPE_COLORS).map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </div>
      {isLoading ? <Spinner /> : (
        <>
          <Table headers={['When', 'Product', 'Type', 'Qty', 'Unit cost', 'Reason', 'Reference']} empty="No movements">
            {data?.rows.map((m) => (
              <tr key={m.id}>
                <Td className="whitespace-nowrap text-stone-500">{formatDateTime(m.createdAt)}</Td>
                <Td>{m.variant.product.name}</Td>
                <Td><Badge color={TYPE_COLORS[m.type]}>{m.type}</Badge></Td>
                <Td className={Number(m.quantity) < 0 ? 'text-red-600' : 'text-emerald-700'}>{Number(m.quantity) > 0 ? '+' : ''}{qty(m.quantity)}</Td>
                <Td>{m.unitCost != null ? naira(m.unitCost) : '—'}</Td>
                <Td className="text-stone-500">{m.reasonCode ?? '—'}{m.note ? ` · ${m.note}` : ''}</Td>
                <Td className="text-xs text-stone-400">{m.referenceType ? `${m.referenceType}:${m.referenceId?.slice(-6)}` : '—'}</Td>
              </tr>
            ))}
          </Table>
          {data && <Pagination page={data.page} total={data.total} pageSize={50} onPage={setPage} />}
        </>
      )}
    </div>
  );
}
