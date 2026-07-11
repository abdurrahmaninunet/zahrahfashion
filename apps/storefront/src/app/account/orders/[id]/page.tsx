'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { naira, qty, formatDate } from '@/lib/format';

interface OrderDetail {
  id: string; orderNumber: string; placedAt: string; status: string; step: number;
  awaitingPayment: boolean; paymentMethod: string | null;
  subtotal: number; discountTotal: number; shippingFee: number; taxTotal: number; total: number;
  zone: string | null; address: { line?: string; addressLine?: string; area?: string } | null;
  lines: { id: string; name: string; quantity: number; unit: string; unitPrice: number; lineTotal: number; eligibleQty: number; returnable: boolean; nonReturnableReason: string | null }[];
  payments: { method: string; amount: number; createdAt: string }[];
  returns: { id: string; status: string; reasonCode: string; requestedAt: string }[];
  trackingUrl: string;
  deliveredAt: string | null;
  returnWindowDays: number;
}

const RETURN_STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Return requested — we\'ll review shortly',
  APPROVED: 'Return approved — send the item back or await pickup',
  RECEIVED: 'Item received — resolving now',
  RESOLVED: 'Return resolved',
  REJECTED: 'Return request declined',
};

export default function AccountOrderPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [returning, setReturning] = useState(false);

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['store-order', id],
    queryFn: () => api.get<OrderDetail>(`/store/account/orders/${id}`),
  });

  if (isLoading) return <p className="py-20 text-center text-sm text-stone-400">Loading…</p>;
  if (error || !order) {
    return (
      <div className="py-20 text-center text-sm text-stone-500">
        <p>Sign in to see this order.</p>
        <Link href="/account" className="mt-2 inline-block text-[#8a6d1f] underline">Go to sign in</Link>
      </div>
    );
  }

  const canReturn = order.lines.some((l) => l.returnable);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/account" className="text-xs text-stone-400 hover:underline">← My orders</Link>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl font-bold">{order.orderNumber}</h1>
        <span className="text-sm font-medium text-[#6f571a]">{order.status}</span>
      </div>
      <p className="text-xs text-stone-400">Placed {formatDate(order.placedAt)}{order.zone ? ` · ${order.zone}` : ''}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={order.trackingUrl} className="rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700">Track order</Link>
        {canReturn && (
          <button onClick={() => setReturning(true)} className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium hover:border-stone-500 cursor-pointer">
            Request a return
          </button>
        )}
      </div>

      {order.returns.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {order.returns.map((r) => (
            <p key={r.id} className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
              {RETURN_STATUS_LABEL[r.status] ?? r.status} · {formatDate(r.requestedAt)}
            </p>
          ))}
        </div>
      )}

      <div className="mt-5 rounded-xl border border-stone-200 bg-white p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-400">Items</p>
        <div className="divide-y divide-stone-100">
          {order.lines.map((line) => (
            <div key={line.id} className="flex items-start justify-between py-2 text-sm">
              <div>
                <p>{qty(line.quantity)}{line.unit !== 'piece' ? ` ${line.unit}` : '×'} {line.name}</p>
                {line.nonReturnableReason && <p className="text-[11px] text-stone-400">Not returnable: {line.nonReturnableReason}</p>}
              </div>
              <span className="tabular font-medium">{naira(line.lineTotal)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-1 border-t border-stone-100 pt-2 text-sm">
          <p className="flex justify-between text-stone-500"><span>Subtotal</span><span className="tabular">{naira(order.subtotal)}</span></p>
          {order.discountTotal > 0 && <p className="flex justify-between text-[#8a6d1f]"><span>Discounts</span><span className="tabular">−{naira(order.discountTotal)}</span></p>}
          <p className="flex justify-between text-stone-500"><span>Delivery</span><span className="tabular">{naira(order.shippingFee)}</span></p>
          {order.taxTotal > 0 && <p className="flex justify-between text-stone-500"><span>Tax</span><span className="tabular">{naira(order.taxTotal)}</span></p>}
          <p className="flex justify-between text-base font-bold"><span>Total</span><span className="tabular">{naira(order.total)}</span></p>
        </div>
      </div>

      {order.payments.length > 0 && (
        <div className="mt-3 rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-stone-400">Payments</p>
          {order.payments.map((p, i) => (
            <p key={i} className="flex justify-between py-0.5 text-stone-600">
              <span>{p.method.replace('_', ' ')} · {formatDate(p.createdAt)}</span>
              <span className="tabular">{naira(p.amount)}</span>
            </p>
          ))}
        </div>
      )}

      {returning && (
        <ReturnDialog
          order={order}
          onClose={() => setReturning(false)}
          onDone={() => { setReturning(false); queryClient.invalidateQueries({ queryKey: ['store-order', id] }); }}
        />
      )}
    </div>
  );
}

/** Return request (S-BR-13): line/qty selection, reason, inline eligibility. */
function ReturnDialog({ order, onClose, onDone }: { order: OrderDetail; onClose: () => void; onDone: () => void }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reasonCode, setReasonCode] = useState('changed_mind');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () => api.post(`/store/account/orders/${order.id}/return`, {
      reasonCode,
      lines: Object.entries(quantities).filter(([, q]) => q > 0).map(([orderLineId, quantity]) => ({ orderLineId, quantity })),
    }),
    onSuccess: onDone,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not submit the return'),
  });

  const returnable = order.lines.filter((l) => l.returnable);
  const anySelected = Object.values(quantities).some((q) => q > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-lg font-bold">Request a return</h2>
        <p className="mt-0.5 text-xs text-stone-400">Within {order.returnWindowDays} days of delivery. Select what you're returning:</p>
        <div className="mt-3 space-y-2">
          {returnable.map((line) => (
            <div key={line.id} className="flex items-center justify-between rounded-md border border-stone-200 px-3 py-2 text-sm">
              <span className="truncate pr-2">{line.name} <span className="text-xs text-stone-400">(up to {qty(line.eligibleQty)})</span></span>
              <input
                type="number" min={0} max={line.eligibleQty} step={line.unit === 'piece' ? 1 : 0.5}
                value={quantities[line.id] ?? ''}
                placeholder="0"
                onChange={(e) => setQuantities({ ...quantities, [line.id]: Number(e.target.value) })}
                className="h-9 w-20 rounded-md border border-stone-200 px-2 text-center outline-none focus:border-[#8a6d1f]"
              />
            </div>
          ))}
        </div>
        <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}
          className="mt-3 h-11 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#8a6d1f]">
          <option value="changed_mind">Changed my mind</option>
          <option value="wrong_item">Wrong item delivered</option>
          <option value="damaged_item">Arrived damaged</option>
          <option value="quality_issue">Quality not as expected</option>
          <option value="size_issue">Size issue</option>
        </select>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button disabled={!anySelected || submit.isPending} onClick={() => submit.mutate()}
          className="mt-4 h-12 w-full rounded-md bg-stone-900 text-sm font-semibold text-white disabled:bg-stone-300 cursor-pointer">
          {submit.isPending ? 'Submitting…' : 'Submit return request'}
        </button>
      </div>
    </div>
  );
}
