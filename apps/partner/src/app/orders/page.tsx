'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { clearCart } from '@/lib/cart';
import { PortalHeader } from '@/components/portal-header';

interface StyleBreak { label: string | null; image: string | null; qty: number }
interface Line { productName: string; unitPrice: number; quantity: number; lineTotal: number; styleMode: string | null; styles: StyleBreak[] | null }
interface Order { id: string; orderNumber: string; status: string; total: number; note: string | null; createdAt: string; lines: Line[] }

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString('en-NG')}`;
const formatDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const summarise = (lines: Line[]) => lines.map((l) => `${l.quantity}× ${l.productName}`).join(', ');

function OrdersInner() {
  const router = useRouter();
  const params = useSearchParams();
  const ref = params.get('ref');
  const [orders, setOrders] = useState<Order[] | null | undefined>(undefined);
  const [banner, setBanner] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(Boolean(ref));

  const load = () => api.get<Order[]>('/partnership/orders').then(setOrders).catch(() => router.replace('/'));

  // On return from Paystack we carry ?ref=… — confirm the payment, then reload.
  useEffect(() => {
    if (!ref) { load(); return; }
    api.post<{ status: string }>('/partnership/orders/verify', { reference: ref })
      .then((r) => {
        if (r.status === 'paid') { clearCart(); setBanner('Payment confirmed — your order is placed.'); }
        else setBanner('Payment is still pending. If you completed it, refresh in a moment — your cart is kept in case you need to retry.');
      })
      .catch(() => setBanner('We could not confirm that payment.'))
      .finally(() => { setVerifying(false); router.replace('/orders'); load(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  if (orders === undefined) {
    return <main className="flex min-h-screen items-center justify-center text-stone-400"><Loader2 className="animate-spin" /></main>;
  }

  return (
    <main className="min-h-screen bg-canvas">
      <PortalHeader active="orders" />

      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold">My orders</h1>

        {(banner || verifying) && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {verifying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            <span>{verifying ? 'Confirming your payment…' : banner}</span>
          </div>
        )}

        {orders && orders.length ? (
          <div className="mt-6 space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold">{o.orderNumber}</span>
                  <span className="tabular text-sm font-bold">{naira(o.total)}</span>
                </div>
                <p className="mt-1 truncate text-xs text-stone-500">{summarise(o.lines)}</p>
                <p className="mt-1 text-xs"><span className="font-medium capitalize text-[#6f571a]">{o.status}</span> · {formatDate(o.createdAt)}</p>

                {o.lines.some((l) => l.styles && l.styles.length > 0) && (
                  <div className="mt-3 space-y-1 border-t border-stone-100 pt-2">
                    {o.lines.filter((l) => l.styles && l.styles.length > 0).map((l, i) => (
                      <p key={i} className="text-xs text-stone-400">
                        <span className="text-stone-500">{l.productName}</span>{' — '}
                        {l.styleMode === 'auto' ? 'Combined: ' : 'Styles: '}
                        {l.styles!.map((s) => `${s.qty}× ${s.label || 'Style'}`).join(', ')}
                      </p>
                    ))}
                  </div>
                )}
                {o.note && <p className="mt-2 text-xs text-stone-500">Note: {o.note}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-10 rounded-xl border border-dashed border-stone-300 bg-white py-16 text-center text-sm text-stone-400">
            No orders yet — <Link href="/catalog" className="font-medium text-accent-600 underline">browse the catalogue</Link>.
          </p>
        )}
      </div>
    </main>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center text-stone-400"><Loader2 className="animate-spin" /></main>}>
      <OrdersInner />
    </Suspense>
  );
}
