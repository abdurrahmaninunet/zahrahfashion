'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { KeyRound, Loader2, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { naira } from '@/lib/format';
import { useCart, setCartQty, setCartItem, clearCart, type CartItem } from '@/lib/cart';
import { PortalHeader } from '@/components/portal-header';

export default function CartPage() {
  const router = useRouter();
  const { items, count, total } = useCart();
  const [ready, setReady] = useState(false);

  const [note, setNote] = useState('');
  const [stage, setStage] = useState<'cart' | 'code'>('cart');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<string | null>(null);

  // Gate the page behind a partner session.
  useEffect(() => {
    api.get<{ partner: unknown | null }>('/partnership/me')
      .then((r) => { if (!r.partner) router.replace('/'); else setReady(true); })
      .catch(() => router.replace('/'));
  }, [router]);

  const orderItems = () => items.map((i) =>
    i.styleMode === 'manual'
      ? { productId: i.productId, styleMode: 'manual', styleQtys: i.styleQtys }
      : i.styleMode === 'auto'
        ? { productId: i.productId, styleMode: 'auto', quantity: i.qty }
        : { productId: i.productId, quantity: i.qty },
  );

  async function requestCode() {
    setBusy(true); setError(null);
    try {
      const res = await api.post<{ devCode?: string }>('/partnership/orders/otp', {});
      setDevCode(res.devCode ?? null);
      setStage('code');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start checkout — please try again.');
    } finally { setBusy(false); }
  }

  async function confirmAndPay() {
    setBusy(true); setError(null);
    try {
      const res = await api.post<{ orderNumber: string; reference: string; authorizationUrl?: string }>('/partnership/orders', {
        items: orderItems(), note: note || undefined, origin: window.location.origin, code,
      });
      if (res.authorizationUrl) {
        // Order is created but unpaid — keep the cart intact and only clear it on
        // the /orders return once Paystack confirms, so an abandoned or failed
        // payment doesn't lose the basket.
        window.location.href = res.authorizationUrl;
        return;
      }
      // Dev (no gateway): confirm immediately, then clear.
      await api.post('/partnership/orders/simulate', { reference: res.reference });
      clearCart();
      setNote(''); setCode(''); setDevCode(null);
      setPlaced(res.orderNumber);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not confirm the order — please try again.');
    } finally { setBusy(false); }
  }

  function styleSummary(i: CartItem) {
    if (i.styleMode === 'auto') return `${i.qty} units · combined across styles`;
    if (i.styleMode === 'manual') {
      const n = Object.values(i.styleQtys ?? {}).filter((q) => q > 0).length;
      return `${i.qty} units · ${n} style${n === 1 ? '' : 's'} selected`;
    }
    return null;
  }

  if (!ready) {
    return <main className="flex min-h-screen items-center justify-center text-stone-400"><Loader2 className="animate-spin" /></main>;
  }

  return (
    <main className="min-h-screen bg-canvas">
      <PortalHeader active="cart" />

      {placed ? (
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <p className="font-display text-xl font-bold text-emerald-800">Order {placed} placed 🎉</p>
          <p className="mt-2 text-sm text-stone-500">Payment confirmed — we&apos;ll process it shortly.</p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/orders" className="inline-block rounded-md bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-stone-700">View my orders</Link>
            <Link href="/catalog" className="inline-block rounded-md border border-stone-300 px-6 py-2.5 text-sm font-semibold text-stone-700 hover:border-stone-400">Keep shopping</Link>
          </div>
        </div>
      ) : count === 0 ? (
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <p className="font-display text-xl font-bold">Your cart is empty</p>
          <p className="mt-2 text-sm text-stone-500">Partner pricing on every item — add a few to get started.</p>
          <Link href="/catalog" className="mt-5 inline-block rounded-md bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-stone-700">Browse the catalogue</Link>
        </div>
      ) : (
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="font-display text-2xl font-bold">Your cart</h1>

          <div className="mt-4 grid gap-6 md:grid-cols-[1fr_300px]">
            {/* Line items */}
            <div className="space-y-3">
              {items.map((i) => {
                const summary = styleSummary(i);
                return (
                  <div key={i.productId} className="flex gap-3 rounded-xl border border-stone-200 bg-white p-3">
                    <Link href={`/catalog/${i.productId}`} className="media-box aspect-square w-20 shrink-0 rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {i.image && <img src={i.image} alt="" />}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Link href={`/catalog/${i.productId}`} className="text-sm font-medium leading-snug hover:underline">{i.name}</Link>
                        <button aria-label="Remove" className="text-stone-300 hover:text-red-500 cursor-pointer" onClick={() => setCartItem({ ...i, qty: 0 })}>
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {summary && (
                        <div className="mt-1.5 flex items-center justify-between gap-2 rounded-md bg-stone-50 px-2.5 py-1.5 text-xs">
                          <span className="text-stone-600">{summary}</span>
                          <Link href={`/catalog/${i.productId}`} className="shrink-0 font-medium text-[#8a6d1f] underline underline-offset-2 hover:text-[#6f571a]">Edit styles</Link>
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        {summary ? (
                          <span className="rounded-md bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-600">{i.qty} units</span>
                        ) : (
                          <div className="flex items-center rounded-md border border-stone-200">
                            <button className="h-8 w-8 cursor-pointer" onClick={() => setCartQty({ productId: i.productId, name: i.name, price: i.price, image: i.image, stock: i.stock }, i.qty - 1)}>−</button>
                            <span className="tabular w-14 border-x border-stone-100 text-center text-sm">{i.qty}</span>
                            <button className="h-8 w-8 cursor-pointer disabled:cursor-not-allowed disabled:text-stone-300" disabled={i.qty >= i.stock} title={i.qty >= i.stock ? 'No more in stock' : undefined} onClick={() => setCartQty({ productId: i.productId, name: i.name, price: i.price, image: i.image, stock: i.stock }, i.qty + 1)}>+</button>
                          </div>
                        )}
                        <div className="text-right">
                          <p className="tabular text-sm font-semibold">{naira(i.price * i.qty)}</p>
                          <p className="text-[11px] text-stone-400">{i.qty} × {naira(i.price)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-between px-1">
                <button onClick={clearCart} className="text-xs font-medium text-stone-400 hover:text-red-500 cursor-pointer">Clear cart</button>
                <Link href="/catalog" className="text-xs font-semibold text-[#8a6d1f] hover:underline">+ Add more items</Link>
              </div>
            </div>

            {/* Summary / checkout */}
            <div className="h-fit rounded-xl border border-stone-200 bg-white p-4">
              {stage === 'cart' ? (
                <>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between text-stone-500"><span>Subtotal ({count} item{count === 1 ? '' : 's'})</span><span className="tabular">{naira(total)}</span></div>
                    <div className="flex justify-between text-stone-500"><span>Delivery</span><span className="text-xs">arranged after order</span></div>
                    <div className="flex justify-between border-t border-stone-100 pt-2 text-base font-bold">
                      <span>Total</span><span className="tabular">{naira(total)}</span>
                    </div>
                  </div>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Order note (optional)" rows={2} className="mt-3 w-full rounded-md border border-stone-200 px-2.5 py-2 text-sm outline-none focus:border-[#8a6d1f]" />
                  {error && <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>}
                  <button onClick={requestCode} disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-stone-900 py-3 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-60">
                    {busy ? <Loader2 size={16} className="animate-spin" /> : 'Proceed to checkout'}
                  </button>
                  <p className="mt-2 text-center text-[11px] text-stone-400">We&apos;ll email a code to confirm, then take you to secure payment.</p>
                </>
              ) : (
                <>
                  <div className="flex justify-between border-b border-stone-100 pb-3 text-base font-bold">
                    <span>Total</span><span className="tabular">{naira(total)}</span>
                  </div>
                  <p className="mt-3 text-xs text-stone-500">Enter the 6-digit code we emailed you to authorise this order.</p>
                  {devCode && <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">Dev code: <span className="font-mono font-bold tracking-widest">{devCode}</span></p>}
                  <div className="mt-3 flex items-center gap-2 rounded-md border border-stone-200 px-2.5 focus-within:border-[#8a6d1f]">
                    <KeyRound size={16} className="text-stone-400" />
                    <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" autoComplete="one-time-code" className="h-10 w-full bg-transparent text-sm tracking-[0.3em] outline-none placeholder:tracking-normal placeholder:text-stone-400" />
                  </div>
                  {error && <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>}
                  <button onClick={confirmAndPay} disabled={busy || code.length < 6} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-stone-900 py-3 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-60">
                    {busy ? <Loader2 size={16} className="animate-spin" /> : `Confirm & pay ${naira(total)}`}
                  </button>
                  <button onClick={() => { setStage('cart'); setError(null); }} className="mt-2 w-full text-center text-xs text-stone-500 hover:text-stone-800 cursor-pointer">Back to cart</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
