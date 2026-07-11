'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { naira } from '@/lib/format';

interface Zone { id: string; name: string; areasText: string; deliveryFee: number }
interface Method { key: string; label: string; promise: string }
interface Evaluation { subtotal: number; discountTotal: number; shippingFee: number; taxTotal: number; taxRate: number; grandTotal: number; appliedPromotions: { name: string; amount: number }[]; codeError: { message: string } | null }
interface PlaceResponse {
  orderId: string; orderNumber: string; total: number; trackingToken: string; trackingUrl: string;
  transfer?: { bankName: string; accountName: string; accountNumber: string; amount: number; reference: string; confirmationPromise: string; ttlHours: number };
  paystack?: { authorizationUrl?: string; reference?: string; simulated?: boolean };
}

/** Guest-first, mobile-first 3-step checkout (S-BR-08). */
export default function CheckoutPage() {
  const cart = useCart();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [contact, setContact] = useState({ phone: '', name: '', email: '' });
  const [delivery, setDelivery] = useState({ pickup: false, zoneId: '', addressLine: '', area: '', landmark: '' });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false); // D-15: unticked
  const [error, setError] = useState<string | null>(null);

  const payloadLines = cart.lines.map((l) => ({ variantId: l.variantId, bundleProductId: l.bundleProductId, formatId: l.formatId, personalization: l.personalization, anko: l.anko, quantity: l.quantity }));

  const { data: me } = useQuery({
    queryKey: ['store-me'],
    queryFn: () => api.get<{ customer: { fullName: string; phone: string; email: string | null } | null }>('/store/account/me'),
  });
  useEffect(() => {
    if (me?.customer && !contact.phone) {
      setContact({ phone: me.customer.phone, name: me.customer.fullName, email: me.customer.email ?? '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // Prefill the delivery address from the signed-in customer's saved addresses
  // (default first). The stored addressLine may carry a "(landmark: …)" suffix.
  const { data: savedAddresses } = useQuery({
    queryKey: ['store-addresses'],
    queryFn: () => api.get<{ addressLine: string; area: string | null; zoneId: string | null; isDefault: boolean }[]>('/store/account/addresses'),
    enabled: !!me?.customer,
  });
  useEffect(() => {
    if (!savedAddresses?.length) return;
    const a = savedAddresses.find((x) => x.isDefault) ?? savedAddresses[0];
    setDelivery((d) => {
      if (d.pickup || d.addressLine) return d; // don't clobber a typed/chosen address
      const m = a.addressLine.match(/^(.*?)\s*\(landmark:\s*(.*)\)\s*$/);
      return { ...d, zoneId: a.zoneId ?? '', addressLine: m ? m[1] : a.addressLine, area: a.area ?? '', landmark: m ? m[2] : '' };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAddresses]);

  const { data: zones } = useQuery({ queryKey: ['store-zones'], queryFn: () => api.get<Zone[]>('/store/zones') });

  const { data: evaluation } = useQuery({
    queryKey: ['checkout-evaluate', JSON.stringify(payloadLines), cart.code, delivery.zoneId, delivery.pickup, contact.phone],
    queryFn: () => api.post<Evaluation>('/store/cart/evaluate', {
      lines: payloadLines, code: cart.code, zoneId: delivery.pickup ? null : delivery.zoneId || null, phone: contact.phone || undefined,
    }),
    enabled: cart.lines.length > 0,
  });

  const { data: methods } = useQuery({
    queryKey: ['checkout-methods', delivery.zoneId, delivery.pickup, evaluation?.grandTotal, contact.phone],
    queryFn: () => api.get<Method[]>(`/store/checkout/methods?zoneId=${delivery.pickup ? '' : delivery.zoneId}&total=${evaluation?.grandTotal ?? 0}&phone=${encodeURIComponent(contact.phone)}`),
    enabled: step >= 3 && !!evaluation,
  });

  // Pre-select a payment method once the options load, so the Place-order button
  // isn't stuck disabled (especially when there's only one option to choose).
  useEffect(() => {
    if (methods && methods.length > 0 && !methods.some((m) => m.key === paymentMethod)) {
      setPaymentMethod(methods[0].key);
    }
  }, [methods, paymentMethod]);

  const place = useMutation({
    mutationFn: () => api.post<PlaceResponse>('/store/checkout/place', {
      contact: { phone: contact.phone, name: contact.name || undefined, email: contact.email || null },
      delivery: delivery.pickup
        ? { pickup: true }
        : { zoneId: delivery.zoneId, addressLine: delivery.addressLine, area: delivery.area || undefined, landmark: delivery.landmark || undefined },
      paymentMethod,
      lines: payloadLines,
      code: cart.code,
      marketingConsent,
      origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    }),
    onSuccess: (result) => {
      // Stash the delivery address too, so the confirmation page can offer to
      // save it to the (signed-in) customer's account for next-time autofill.
      const savedDelivery = delivery.pickup ? null : { addressLine: delivery.addressLine, area: delivery.area, landmark: delivery.landmark, zoneId: delivery.zoneId };
      sessionStorage.setItem('zahrah_last_order', JSON.stringify({ ...result, paymentMethod, delivery: savedDelivery }));
      // Real Paystack → redirect to the hosted checkout; the cart is cleared only
      // after the payment is verified on /checkout/done (so a cancel keeps it).
      if (result.paystack?.authorizationUrl) {
        window.location.href = result.paystack.authorizationUrl;
        return;
      }
      cart.clear();
      router.push('/checkout/done');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong — your cart is safe, please try again'),
  });

  if (!cart.lines.length) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-stone-500">Your cart is empty.</p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-[#8a6d1f] underline">Back to shopping</Link>
      </div>
    );
  }

  const contactValid = contact.phone.replace(/\D/g, '').length >= 10;
  const deliveryValid = delivery.pickup || (delivery.zoneId && delivery.addressLine.trim().length >= 5);

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="font-display text-2xl font-bold">Checkout</h1>
      <div className="mt-2 flex gap-1.5">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-[#8a6d1f]' : 'bg-stone-200'}`} />
        ))}
      </div>

      {/* Step 1 — Contact (phone-first, FR-SF-CHK-01) */}
      {step === 1 && (
        <section className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">Phone number *</label>
            <input inputMode="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })}
              placeholder="0803 123 4567"
              className="h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-base outline-none focus:border-[#8a6d1f]" />
            <p className="mt-1 text-xs text-stone-400">We use this to reach you about your delivery.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">Your name</label>
            <input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })}
              className="h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-base outline-none focus:border-[#8a6d1f]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">Email (for your invoice, optional)</label>
            <input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })}
              className="h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-base outline-none focus:border-[#8a6d1f]" />
          </div>
          <label className="flex items-start gap-2 text-xs text-stone-500">
            <input type="checkbox" className="mt-0.5" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} />
            Email me about new arrivals and offers (optional)
          </label>
          <button disabled={!contactValid} onClick={() => setStep(2)}
            className="h-12 w-full rounded-md bg-stone-900 text-sm font-semibold text-white disabled:bg-stone-300 cursor-pointer">
            Continue to delivery
          </button>
        </section>
      )}

      {/* Step 2 — Delivery (zone + landmark, FR-SF-CHK-02) */}
      {step === 2 && (
        <section className="mt-5 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setDelivery({ ...delivery, pickup: false })}
              className={`h-11 flex-1 rounded-md border text-sm font-medium cursor-pointer ${!delivery.pickup ? 'border-[#8a6d1f] bg-[#faf5e6] text-[#6f571a]' : 'border-stone-200 bg-white'}`}>
              Deliver to me
            </button>
            <button onClick={() => setDelivery({ ...delivery, pickup: true })}
              className={`h-11 flex-1 rounded-md border text-sm font-medium cursor-pointer ${delivery.pickup ? 'border-[#8a6d1f] bg-[#faf5e6] text-[#6f571a]' : 'border-stone-200 bg-white'}`}>
              Store pickup (free)
            </button>
          </div>
          {!delivery.pickup && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">Delivery state *</label>
                <select value={delivery.zoneId} onChange={(e) => setDelivery({ ...delivery, zoneId: e.target.value })}
                  className="h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-base outline-none focus:border-[#8a6d1f]">
                  <option value="">Choose your state…</option>
                  {zones?.map((z) => <option key={z.id} value={z.id}>{z.name} — {naira(z.deliveryFee)}</option>)}
                </select>
                {delivery.zoneId && (
                  <p className="mt-1 text-xs text-stone-400">{zones?.find((z) => z.id === delivery.zoneId)?.areasText}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">Address *</label>
                <input value={delivery.addressLine} onChange={(e) => setDelivery({ ...delivery, addressLine: e.target.value })}
                  placeholder="House number, street"
                  className="h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-base outline-none focus:border-[#8a6d1f]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">Area</label>
                  <input value={delivery.area} onChange={(e) => setDelivery({ ...delivery, area: e.target.value })}
                    className="h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-base outline-none focus:border-[#8a6d1f]" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">Nearest landmark</label>
                  <input value={delivery.landmark} onChange={(e) => setDelivery({ ...delivery, landmark: e.target.value })}
                    placeholder="e.g. opposite GTBank"
                    className="h-12 w-full rounded-md border border-stone-300 bg-white px-3 text-base outline-none focus:border-[#8a6d1f]" />
                </div>
              </div>
              <p className="text-xs text-stone-400">A good landmark helps our rider find you fast.</p>
            </>
          )}
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="h-12 rounded-md border border-stone-200 bg-white px-5 text-sm cursor-pointer">Back</button>
            <button disabled={!deliveryValid} onClick={() => setStep(3)}
              className="h-12 flex-1 rounded-md bg-stone-900 text-sm font-semibold text-white disabled:bg-stone-300 cursor-pointer">
              Continue to payment
            </button>
          </div>
        </section>
      )}

      {/* Step 3 — Payment (rules-driven methods, FR-SF-CHK-03) + review */}
      {step === 3 && (
        <section className="mt-5 space-y-4">
          <div className="space-y-2">
            {(methods ?? []).map((method) => (
              <button key={method.key} onClick={() => setPaymentMethod(method.key)}
                className={`w-full rounded-xl border p-4 text-left cursor-pointer ${paymentMethod === method.key ? 'border-[#8a6d1f] bg-[#faf5e6]' : 'border-stone-200 bg-white'}`}>
                <p className="text-sm font-semibold">{method.label}</p>
                <p className="text-xs text-stone-500">{method.promise}</p>
              </button>
            ))}
            {!methods && <p className="py-4 text-center text-sm text-stone-400">Loading payment options…</p>}
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-400">Order summary</p>
            {cart.lines.map((l) => (
              <p key={l.variantId ?? l.bundleProductId} className="flex justify-between py-0.5 text-stone-600">
                <span className="truncate pr-2">{l.quantity}× {l.name}</span>
              </p>
            ))}
            <div className="mt-2 space-y-1 border-t border-stone-100 pt-2">
              <p className="flex justify-between text-stone-500"><span>Subtotal</span><span className="tabular">{naira(evaluation?.subtotal ?? 0)}</span></p>
              {evaluation?.appliedPromotions.map((p, i) => (
                <p key={i} className="flex justify-between text-[#8a6d1f]"><span>{p.name}</span><span className="tabular">−{naira(p.amount)}</span></p>
              ))}
              <p className="flex justify-between text-stone-500"><span>Delivery</span><span className="tabular">{naira(evaluation?.shippingFee ?? 0)}</span></p>
              {(evaluation?.taxTotal ?? 0) > 0 && (
                <p className="flex justify-between text-stone-500"><span>Tax{evaluation?.taxRate ? ` (${evaluation.taxRate}%)` : ''}</span><span className="tabular">{naira(evaluation!.taxTotal)}</span></p>
              )}
              <p className="flex justify-between text-base font-bold"><span>Total</span><span className="tabular">{naira(evaluation?.grandTotal ?? 0)}</span></p>
            </div>
          </div>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="h-12 rounded-md border border-stone-200 bg-white px-5 text-sm cursor-pointer">Back</button>
            <button disabled={!paymentMethod || place.isPending} onClick={() => place.mutate()}
              className="h-12 flex-1 rounded-md bg-[#8a6d1f] text-sm font-semibold text-white hover:bg-[#6f571a] disabled:bg-stone-300 cursor-pointer">
              {place.isPending ? 'Placing your order…' : `Place order — ${naira(evaluation?.grandTotal ?? 0)}`}
            </button>
          </div>
          <p className="text-center text-[11px] text-stone-400">
            By placing this order you agree to our{' '}
            <Link href="/pages/returns-policy" className="underline">returns</Link> and{' '}
            <Link href="/pages/delivery-information" className="underline">delivery</Link> policies.
          </p>
        </section>
      )}
    </div>
  );
}
