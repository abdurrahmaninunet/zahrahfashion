'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { api } from '@/lib/api';
import { naira, qty, formatDate } from '@/lib/format';

interface Tracking {
  orderNumber: string; firstName: string; placedAt: string;
  status: string; step: number; paymentMethod: string | null; awaitingPayment: boolean;
  total: number; zone: string | null;
  items: { name: string; quantity: number; unit: string }[];
  shipment: { method: string; riderFirstName: string | null; trackingRef: string | null; status: string } | null;
}

const STEPS = ['Placed', 'Payment confirmed', 'Being prepared', 'Out for delivery', 'Delivered'];

/** Guest order tracking — tokenized, customer language (S-BR-14). */
function TrackPageInner() {
  const { orderId } = useParams<{ orderId: string }>();
  const params = useSearchParams();
  const token = params.get('t') ?? '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['track', orderId, token],
    queryFn: () => api.get<Tracking>(`/store/track/${orderId}?t=${token}`),
    refetchInterval: 30_000,
  });

  if (isLoading) return <p className="py-20 text-center text-sm text-stone-400">Loading your order…</p>;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="font-display text-xl font-bold">We couldn't find that order</p>
        <p className="mt-2 text-sm text-stone-500">Check the link from your confirmation, or chat with us on WhatsApp.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <p className="text-sm text-stone-500">Hi {data.firstName} 👋 here's your order</p>
      <h1 className="font-display text-2xl font-bold">{data.orderNumber}</h1>
      <p className="text-xs text-stone-400">Placed {formatDate(data.placedAt)}{data.zone ? ` · ${data.zone}` : ''}</p>

      {data.step >= 0 ? (
        <ol className="mt-6 space-y-0">
          {STEPS.map((label, i) => {
            const done = i <= data.step;
            const current = i === data.step;
            return (
              <li key={label} className="relative flex gap-3 pb-6 last:pb-0">
                {i < STEPS.length - 1 && (
                  <span className={`absolute left-[11px] top-6 h-full w-0.5 ${i < data.step ? 'bg-emerald-500' : 'bg-stone-200'}`} />
                )}
                <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${done ? 'bg-emerald-500' : 'bg-stone-200'}`}>
                  {done ? <Check size={13} /> : null}
                </span>
                <div>
                  <p className={`text-sm ${current ? 'font-bold' : done ? 'font-medium' : 'text-stone-400'}`}>
                    {current ? data.status : label}
                  </p>
                  {current && data.shipment?.riderFirstName && data.step === 3 && (
                    <p className="text-xs text-stone-500">Your rider: {data.shipment.riderFirstName}</p>
                  )}
                  {current && data.shipment?.trackingRef && (
                    <p className="text-xs text-stone-500">Tracking ref: {data.shipment.trackingRef}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-6 rounded-md bg-stone-100 px-4 py-3 text-sm font-medium">{data.status}</p>
      )}

      {data.awaitingPayment && data.paymentMethod === 'transfer' && (
        <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Awaiting your payment</p>
          <p className="mt-1">We confirm bank transfers within a few hours during business hours. Sent it already? Give us a nudge on WhatsApp with your order number.</p>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-stone-200 bg-white p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-400">Items</p>
        <ul className="space-y-1 text-sm">
          {data.items.map((item, i) => (
            <li key={i}>{qty(item.quantity)}{item.unit !== 'piece' ? ` ${item.unit}` : '×'} {item.name}</li>
          ))}
        </ul>
        <p className="mt-3 border-t border-stone-100 pt-2 text-sm font-bold">Total: <span className="tabular">{naira(data.total)}</span></p>
      </div>
      <p className="mt-4 text-center text-xs text-stone-400">Questions? The WhatsApp button is right there — mention {data.orderNumber}.</p>
    </div>
  );
}

export default function TrackPage() {
  return <Suspense fallback={<p className="py-20 text-center text-sm text-stone-400">Loading…</p>}><TrackPageInner /></Suspense>;
}
