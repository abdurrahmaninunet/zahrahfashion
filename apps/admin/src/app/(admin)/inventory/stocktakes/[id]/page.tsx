'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { naira, qty } from '@/lib/format';
import { BackLink, Badge, Button, ErrorNote, Input, PageHeader, Spinner, Table, Td, statusColor } from '@/components/ui';

interface StocktakeDetail {
  id: string; status: string; blind: boolean;
  lines: { id: string; variantId: string; sku?: string; product?: string; systemQty: string | null; countedQty: string | null; variance: string | null; varianceCost: number | null }[];
}

export default function StocktakeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { hasCap } = useAuth();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);

  const { data: stocktake, isLoading } = useQuery({
    queryKey: ['stocktake', id],
    queryFn: () => api.get<StocktakeDetail>(`/inventory/stocktakes/${id}`),
  });

  const submitCounts = useMutation({
    mutationFn: () => api.post(`/inventory/stocktakes/${id}/counts`, {
      counts: Object.entries(counts).filter(([, v]) => v !== '').map(([lineId, v]) => ({ lineId, countedQty: Number(v) })),
    }),
    onSuccess: () => { setCounts({}); queryClient.invalidateQueries({ queryKey: ['stocktake', id] }); },
    onError: setError,
  });

  const approve = useMutation({
    mutationFn: () => api.post(`/inventory/stocktakes/${id}/approve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stocktake', id] }),
    onError: setError,
  });

  if (isLoading || !stocktake) return <Spinner />;
  const counting = ['counting', 'review'].includes(stocktake.status);
  const totalVarianceCost = stocktake.lines.reduce((s, l) => s + (l.varianceCost ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <BackLink href="/inventory/stocktakes" label="Back to stocktakes" />
      <PageHeader
        title="Stocktake"
        subtitle={stocktake.blind ? 'Blind count — system quantities hidden until review' : undefined}
        action={
          <div className="flex items-center gap-2">
            <Badge color={statusColor(stocktake.status)}>{stocktake.status}</Badge>
            {counting && Object.keys(counts).length > 0 && (
              <Button size="sm" loading={submitCounts.isPending} onClick={() => submitCounts.mutate()}>Save counts</Button>
            )}
            {stocktake.status === 'review' && hasCap('inventory.approve') && (
              <Button size="sm" variant="secondary" loading={approve.isPending} onClick={() => approve.mutate()}>
                Approve & post variances
              </Button>
            )}
          </div>
        }
      />
      <ErrorNote error={error} />
      {stocktake.status === 'review' && (
        <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Variance cost impact: <b>{naira(totalVarianceCost)}</b> — approval posts adjustment movements referencing this stocktake.
        </p>
      )}
      <Table headers={['Product', 'System qty', 'Counted', 'Variance', 'Variance cost']}>
        {stocktake.lines.map((line) => (
          <tr key={line.id}>
            <Td>{line.product}</Td>
            <Td>{line.systemQty == null ? <span className="text-stone-300">hidden</span> : qty(line.systemQty)}</Td>
            <Td>
              {counting ? (
                <Input type="number" step="0.5" min="0" className="w-24"
                  value={counts[line.id] ?? (line.countedQty != null ? qty(line.countedQty) : '')}
                  onChange={(e) => setCounts({ ...counts, [line.id]: e.target.value })} />
              ) : line.countedQty != null ? qty(line.countedQty) : '—'}
            </Td>
            <Td className={line.variance && Number(line.variance) !== 0 ? 'font-bold text-amber-600' : ''}>
              {line.variance != null ? `${Number(line.variance) > 0 ? '+' : ''}${qty(line.variance)}` : '—'}
            </Td>
            <Td>{line.varianceCost != null ? naira(line.varianceCost, { signed: true }) : '—'}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
