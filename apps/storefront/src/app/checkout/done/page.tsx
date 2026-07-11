'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { naira } from '@/lib/format';

interface LastOrder {
  orderId: string; orderNumber: string; total: number; trackingToken: string; trackingUrl: string;
  paymentMethod: string;
  delivery?: { addressLine: string; area?: string; landmark?: string; zoneId?: string } | null;
  paystack?: { authorizationUrl?: string; reference?: string; simulated?: boolean };
}

/** Confirmation per method (S-BR-12): transfer instructions, gateway status, POD note. */
export default function CheckoutDonePage() {
  const router = useRouter();
  const cart = useCart();
  const [order, setOrder] = useState<LastOrder | null>(null);
  const [paid, setPaid] = useState(false);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('zahrah_last_order');
    if (!raw) { router.replace('/'); return; }
    setOrder(JSON.parse(raw));
  }, [router]);

  // Gateway path: verify the Paystack transaction server-side on return.
  useEffect(() => {
    if (!order || order.paymentMethod !== 'gateway' || paid || failed) return;
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (!reference) return; // no callback ref (dev simulate path) — leave the button
    setVerifying(true);
    api.post<{ status: string }>('/store/checkout/paystack/verify', { reference })
      .then((r) => {
        if (r.status === 'success') { setPaid(true); cart.clear(); }
        else setFailed(true);
      })
      .catch(() => setFailed(true))
      .finally(() => setVerifying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, paid, failed]);

  if (!order) return null;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check size={28} />
        </div>
        <h1 className="font-display mt-3 text-2xl font-bold">Order placed!</h1>
        <p className="mt-1 text-sm text-stone-500">
          Order <span className="font-mono font-semibold text-stone-800">{order.orderNumber}</span> · {naira(order.total)}
        </p>
      </div>

      {/* Gateway — Paystack */}
      {order.paymentMethod === 'gateway' && (
        <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5 text-center">
          {paid ? (
            <p className="font-semibold text-emerald-700">Payment confirmed ✓ — we&apos;re preparing your order</p>
          ) : verifying ? (
            <p className="font-semibold text-stone-700">Confirming your payment…</p>
          ) : failed ? (
            <>
              <p className="font-semibold text-red-600">Payment not completed</p>
              <p className="mt-1 text-sm text-stone-500">Your order is saved — you can try paying again.</p>
              <Link href="/checkout" className="mt-4 inline-block rounded-md bg-[#0aa5db] px-6 py-3 text-sm font-semibold text-white hover:opacity-90">
                Retry payment
              </Link>
            </>
          ) : order.paystack?.simulated ? (
            <>
              <p className="font-semibold">Pay securely with Paystack</p>
              <p className="mt-1 text-sm text-stone-500">Card, bank or USSD — confirmation is instant.</p>
              <button
                disabled={paying}
                onClick={async () => {
                  setPaying(true);
                  try {
                    await api.post(`/store/checkout/${order.orderId}/pay-simulate`, { token: order.trackingToken });
                    setPaid(true);
                    cart.clear();
                  } finally {
                    setPaying(false);
                  }
                }}
                className="mt-4 h-12 w-full rounded-md bg-[#0aa5db] text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {paying ? 'Processing…' : `Pay ${naira(order.total)} now`}
              </button>
              <p className="mt-2 text-[11px] text-stone-400">(Development mode — Paystack key not set; this simulates the webhook)</p>
            </>
          ) : (
            <p className="font-semibold text-stone-700">Waiting for payment confirmation…</p>
          )}
        </div>
      )}

      {/* POD */}
      {order.paymentMethod === 'pod' && (
        <div className="mt-6 rounded-xl border border-stone-200 bg-white p-5">
          <p className="font-semibold">Pay when it arrives</p>
          <p className="mt-1 text-sm text-stone-500">
            Our team will call to confirm your order shortly, then your rider brings it — pay cash or transfer at the door.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-2">
        <Link href={order.trackingUrl} className="block rounded-md bg-stone-900 py-3 text-center text-sm font-semibold text-white hover:bg-stone-700">
          Track this order
        </Link>
        <SaveDetails order={order} />
        <Link href="/" className="block py-2 text-center text-sm text-stone-500 hover:underline">Continue shopping</Link>
      </div>
    </div>
  );
}

/** Branches on auth: a signed-in shopper saves their delivery address to the
 *  account (auto-fills next time); a guest gets the one-tap account claim. */
function SaveDetails({ order }: { order: LastOrder }) {
  const { data: me, isLoading } = useQuery({
    queryKey: ['store-me'],
    queryFn: () => api.get<{ customer: { id: string } | null }>('/store/account/me'),
  });
  if (isLoading) return null; // avoid flashing the wrong CTA
  if (me?.customer) return <SaveAddress order={order} />;
  return <ClaimAccount orderNumber={order.orderNumber} />;
}

/** Signed-in shopper: save this order's delivery address for next-time autofill. */
function SaveAddress({ order }: { order: LastOrder }) {
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!order.delivery?.addressLine) return null; // pickup / nothing to save

  if (done) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-md bg-emerald-50 py-3 text-center text-sm font-medium text-emerald-700">
        <Check size={15} /> Address saved — it&apos;ll auto-fill next time
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      <button
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          setError(null);
          try {
            await api.post('/store/account/addresses', {
              label: order.delivery!.area || 'Delivery address',
              addressLine: order.delivery!.addressLine,
              area: order.delivery!.area || undefined,
              landmark: order.delivery!.landmark || undefined,
              zoneId: order.delivery!.zoneId || undefined,
              isDefault: true,
            });
            setDone(true);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setSaving(false);
          }
        }}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-stone-200 bg-white py-3 text-sm font-medium hover:border-stone-400 disabled:opacity-50 cursor-pointer"
      >
        <MapPin size={15} /> {saving ? 'Saving…' : 'Save delivery address for next time'}
      </button>
      {error && <p className="text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** One-tap account claim (S-D-07 / FR-SF-CHK-08) — guests only. */
function ClaimAccount({ orderNumber }: { orderNumber: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ phone: '', email: '', password: '' });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) return <p className="rounded-md bg-emerald-50 py-3 text-center text-sm font-medium text-emerald-700">Account created — your orders live in one place now ✓</p>;
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-md border border-stone-200 bg-white py-3 text-sm font-medium hover:border-stone-400 cursor-pointer">
        Save my details for next time
      </button>
    );
  }
  return (
    <form
      className="space-y-2 rounded-xl border border-stone-200 bg-white p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await api.post('/store/account/register', { phone: form.phone, email: form.email, password: form.password });
          setDone(true);
        } catch (err) {
          setError((err as Error).message);
        }
      }}
    >
      <p className="text-xs text-stone-500">Use the same phone number from order {orderNumber} — your history attaches automatically.</p>
      <input required placeholder="Phone (same as your order)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
        className="h-11 w-full rounded-md border border-stone-200 px-3 text-sm outline-none focus:border-[#8a6d1f]" />
      <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="h-11 w-full rounded-md border border-stone-200 px-3 text-sm outline-none focus:border-[#8a6d1f]" />
      <input required type="password" minLength={8} placeholder="Choose a password (8+ characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
        className="h-11 w-full rounded-md border border-stone-200 px-3 text-sm outline-none focus:border-[#8a6d1f]" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button className="h-11 w-full rounded-md bg-stone-900 text-sm font-semibold text-white cursor-pointer">Create account</button>
    </form>
  );
}
