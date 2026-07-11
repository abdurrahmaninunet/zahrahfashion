'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { naira, formatDate } from '@/lib/format';
import { Badge, Button, Input, PageHeader, Select, Spinner, Table, Td, statusColor } from '@/components/ui';

interface PromotionRow {
  id: string; name: string; mechanism: string; valueType: string; valueAmount: string | null;
  scope: string; status: string; usesCount: number;
  limits: { totalUses?: number | null };
  conditions: { schedule?: { startsAt?: string; endsAt?: string } };
  codes: { code: string }[];
  discountCost: number;
  createdAt: string;
}

export default function DiscountsPage() {
  const router = useRouter();
  const { hasCap } = useAuth();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const query = new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}) });
  const { data: promotions, isLoading } = useQuery({
    queryKey: ['promotions', query.toString()],
    queryFn: () => api.get<PromotionRow[]>(`/promotions?${query}`),
  });

  const valueLabel = (p: PromotionRow) =>
    p.valueType === 'percent' ? `${Number(p.valueAmount)}% off`
    : p.valueType === 'fixed' ? `${naira(Number(p.valueAmount))} off`
    : p.valueType.replace('_', ' ');

  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <PageHeader
        title="Discounts & promotions"
        action={hasCap('discounts.create_edit') ? <Link href="/discounts/new"><Button><Plus size={15} /> New promotion</Button></Link> : undefined}
      />
      <div className="mb-3 flex gap-2">
        <Input placeholder="Search name or code…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="ended">Ended</option>
        </Select>
      </div>
      {isLoading ? <Spinner /> : (
        <Table headers={['Promotion', 'Mechanism', 'Value', 'Scope', 'Uses', 'Discount cost', 'Schedule', 'Status']} empty="No promotions">
          {promotions?.map((p) => (
            <tr key={p.id} className="cursor-pointer hover:bg-stone-50" onClick={() => router.push(`/discounts/${p.id}`)}>
              <Td>
                <p className="font-medium">{p.name}</p>
                {p.codes.length > 0 && <p className="font-mono text-xs text-brand-600">{p.codes.slice(0, 2).map((c) => c.code).join(', ')}{p.codes.length > 2 ? ` +${p.codes.length - 2}` : ''}</p>}
              </Td>
              <Td><Badge>{p.mechanism}</Badge></Td>
              <Td>{valueLabel(p)}</Td>
              <Td className="text-stone-500">{p.scope}</Td>
              <Td>{p.usesCount}{p.limits.totalUses ? ` / ${p.limits.totalUses}` : ''}</Td>
              <Td>{naira(p.discountCost)}</Td>
              <Td className="text-xs text-stone-500">
                {p.conditions.schedule?.startsAt ? formatDate(p.conditions.schedule.startsAt) : '—'}
                {p.conditions.schedule?.endsAt ? ` → ${formatDate(p.conditions.schedule.endsAt)}` : ''}
              </Td>
              <Td><Badge color={statusColor(p.status)}>{p.status}</Badge></Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
