'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { naira, formatDateTime } from '@/lib/format';
import { BackLink, Badge, Button, Card, Dialog, ErrorNote, Field, Input, Spinner, statusColor } from '@/components/ui';

interface PromotionDetail {
  id: string; name: string; internalNote: string | null; mechanism: string; valueType: string;
  valueAmount: string | null; scope: string; status: string; usesCount: number; allowBelowCost: boolean;
  conditions: { schedule?: { startsAt?: string; endsAt?: string }; minSpend?: number; firstOrderOnly?: boolean; tags?: string[] };
  limits: { totalUses?: number | null; perCustomerUses?: number | null };
  combination: { exclusive?: boolean };
  codes: { id: string; code: string; kind: string; usesCount: number; maxUses: number | null; status: string }[];
  redemptions: { id: string; orderId: string; amount: number; status: string; createdAt: string }[];
  events: { id: string; type: string; createdAt: string; payload: unknown }[];
  stats: { redemptions: number; discountCost: number };
}

export default function PromotionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { hasCap } = useAuth();
  const [error, setError] = useState<unknown>(null);
  const [batchOpen, setBatchOpen] = useState(false);

  const { data: promo, isLoading } = useQuery({
    queryKey: ['promotion', id],
    queryFn: () => api.get<PromotionDetail>(`/promotions/${id}`),
  });

  const transition = useMutation({
    mutationFn: (action: string) => api.post(`/promotions/${id}/${action}`),
    onSuccess: () => { setError(null); queryClient.invalidateQueries({ queryKey: ['promotion', id] }); },
    onError: setError,
  });

  if (isLoading || !promo) return <Spinner />;

  const canActivate = hasCap('discounts.activate') || hasCap('discounts.activate_own');
  const actions: { action: string; label: string; show: boolean; variant?: 'primary' | 'outline' | 'danger' }[] = [
    { action: 'activate', label: 'Activate now', show: ['draft', 'scheduled', 'paused'].includes(promo.status) && canActivate },
    { action: 'schedule', label: 'Schedule', show: promo.status === 'draft' && !!promo.conditions.schedule?.startsAt && canActivate, variant: 'outline' },
    { action: 'pause', label: 'Pause', show: promo.status === 'active' && canActivate, variant: 'outline' },
    { action: 'end', label: 'End', show: ['active', 'paused', 'scheduled'].includes(promo.status) && canActivate, variant: 'danger' },
    // Archive removed — restore to allow archiving ended/draft promotions:
    // { action: 'archive', label: 'Archive', show: ['ended', 'draft'].includes(promo.status), variant: 'outline' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <BackLink href="/discounts" label="Back to discounts" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{promo.name}</h1>
            <Badge color={statusColor(promo.status)}>{promo.status}</Badge>
            {promo.allowBelowCost && <Badge color="red">below-cost allowed</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-stone-500">
            {promo.mechanism} · {promo.valueType === 'percent' ? `${Number(promo.valueAmount)}% off` : promo.valueType === 'fixed' ? `${naira(Number(promo.valueAmount))} off` : promo.valueType} · scope: {promo.scope}
            {promo.conditions.firstOrderOnly ? ' · first order only' : ''}
            {promo.conditions.minSpend ? ` · min spend ${naira(promo.conditions.minSpend)}` : ''}
          </p>
          {promo.conditions.tags?.length ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-500">
              Targeted at customers tagged:
              {promo.conditions.tags.map((t) => <Badge key={t} color="purple">{t}</Badge>)}
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          {actions.filter((a) => a.show).map((a) => (
            <Button key={a.action} size="sm" variant={a.variant ?? 'primary'} loading={transition.isPending} onClick={() => transition.mutate(a.action)}>
              {a.label}
            </Button>
          ))}
        </div>
      </div>
      <ErrorNote error={error} />
      {promo.status === 'active' && <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">Active promotion mechanics are locked — end &amp; clone to change value or scope.</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Redemptions', `${promo.stats.redemptions}${promo.limits.totalUses ? ` / ${promo.limits.totalUses}` : ''}`],
          ['Discount cost', naira(promo.stats.discountCost)],
          ['Starts', promo.conditions.schedule?.startsAt ? formatDateTime(promo.conditions.schedule.startsAt) : '—'],
          ['Ends', promo.conditions.schedule?.endsAt ? formatDateTime(promo.conditions.schedule.endsAt) : '—'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-stone-200 bg-white p-3">
            <p className="text-xs text-stone-400">{label}</p>
            <p className="mt-0.5 font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          title={`Codes (${promo.codes.length})`}
          action={promo.mechanism === 'code' && hasCap('discounts.generate_codes') ? (
            <Button size="sm" variant="outline" onClick={() => setBatchOpen(true)}>Generate batch</Button>
          ) : undefined}
        >
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {promo.codes.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded border border-stone-100 px-2.5 py-1.5 text-sm">
                <span className="font-mono">{c.code}</span>
                <span className="text-xs text-stone-400">{c.kind} · {c.usesCount}{c.maxUses ? `/${c.maxUses}` : ''} uses</span>
              </div>
            ))}
            {!promo.codes.length && <p className="py-4 text-center text-sm text-stone-400">Automatic promotion — no codes</p>}
          </div>
        </Card>
        <Card title="Recent redemptions">
          <div className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {promo.redemptions.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-b border-stone-50 py-1.5">
                <a href={`/orders/${r.orderId}`} className="text-brand-700 hover:underline">order …{r.orderId.slice(-6)}</a>
                <span>{naira(r.amount)}</span>
                <Badge color={r.status === 'confirmed' ? 'green' : r.status === 'released' ? 'gray' : 'amber'}>{r.status}</Badge>
                <span className="text-xs text-stone-400">{formatDateTime(r.createdAt)}</span>
              </div>
            ))}
            {!promo.redemptions.length && <p className="py-4 text-center text-stone-400">No redemptions yet</p>}
          </div>
        </Card>
      </div>

      <Card title="History">
        <div className="space-y-1 text-sm">
          {promo.events.map((e) => (
            <p key={e.id} className="text-stone-600">
              <span className="font-medium">{e.type.replace(/_/g, ' ')}</span>
              <span className="text-xs text-stone-400"> · {formatDateTime(e.createdAt)}</span>
            </p>
          ))}
        </div>
      </Card>

      <BatchDialog open={batchOpen} onClose={() => setBatchOpen(false)} promotionId={id}
        onDone={() => { setBatchOpen(false); queryClient.invalidateQueries({ queryKey: ['promotion', id] }); }} />
    </div>
  );
}

function BatchDialog({ open, onClose, promotionId, onDone }: { open: boolean; onClose: () => void; promotionId: string; onDone: () => void }) {
  const [prefix, setPrefix] = useState('');
  const [quantity, setQuantity] = useState('50');
  const [result, setResult] = useState<string[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const generate = useMutation({
    mutationFn: () => api.post<{ codes: string[] }>(`/promotions/${promotionId}/codes/batch`, { prefix, quantity: Number(quantity) }),
    onSuccess: (r) => setResult(r.codes),
    onError: setError,
  });
  return (
    <Dialog open={open} onClose={() => { setResult(null); onClose(); }} title="Generate unique codes">
      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-stone-500">{result.length} single-use codes generated:</p>
          <Textarea readOnly rows={8} value={result.join('\n')} />
          <Button className="w-full" onClick={onDone}>Done</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prefix"><Input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="GLAM" /></Field>
            <Field label="Quantity (≤ 10,000)"><Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
          </div>
          <ErrorNote error={error} />
          <Button className="w-full" loading={generate.isPending} disabled={!prefix} onClick={() => generate.mutate()}>Generate</Button>
        </div>
      )}
    </Dialog>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-xs" {...props} />;
}
