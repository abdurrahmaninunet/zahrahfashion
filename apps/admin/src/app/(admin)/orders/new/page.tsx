'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Check, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { naira, qty } from '@/lib/format';
import { BackLink, Badge, Button, Card, ErrorNote, Field, Input, PageHeader, Select, Textarea } from '@/components/ui';

interface ProductRow { id: string; name: string; type: string; priceMin: number | null; totalStock: number }
interface StockLevel { onHand: string; reserved: string }
interface Variant { id: string; sku: string; price: number; optionValues: Record<string, string>; status: string; stockLevels?: StockLevel[] }
interface ProductDetail { id: string; name: string; type: string; variants: Variant[] }
interface Zone { id: string; name: string; deliveryFee: number; status: string }
interface CustomerRow { id: string; fullName: string; primaryPhone: string; email: string | null }
interface Address { id: string; label: string | null; addressLine: string; area: string | null; city: string | null; zoneId: string | null; isDefault: boolean; status: string }

interface Line { key: number; variantId?: string; bundleProductId?: string; label: string; unitPrice: number; quantity: number; stock: number | null }

const CHANNELS = [
  ['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['phone', 'Phone'], ['in_store', 'In store'],
] as const;

const phoneKey = (p: string) => p.replace(/\D/g, '').slice(-10);
const availableStock = (v: Variant) => (v.stockLevels ?? []).reduce((s, l) => s + (Number(l.onHand) - Number(l.reserved)), 0);

export default function NewOrderPage() {
  const router = useRouter();
  const { hasCap } = useAuth();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [lines, setLines] = useState<Line[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);
  const [zoneId, setZoneId] = useState('');
  const [addressId, setAddressId] = useState('');           // saved address chosen
  const [addressLine, setAddressLine] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'rider' | '3pl' | 'pickup'>('rider');
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'gateway'>('transfer');
  const [code, setCode] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountReason, setDiscountReason] = useState('');
  const [noteInternal, setNoteInternal] = useState('');
  const [error, setError] = useState<unknown>(null);

  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: () => api.get<Zone[]>('/zones') });

  // ── Customer matching by phone ────────────────────────────────────────────
  const digits = phone.replace(/\D/g, '');
  const { data: lookup } = useQuery({
    queryKey: ['order-customer-lookup', digits],
    queryFn: () => api.get<{ rows: CustomerRow[] }>(`/customers?q=${encodeURIComponent(phone)}`),
    enabled: digits.length >= 10,
  });
  const matched = digits.length >= 10
    ? lookup?.rows.find((r) => phoneKey(r.primaryPhone) === phoneKey(phone)) ?? null
    : null;

  const { data: profile } = useQuery({
    queryKey: ['order-customer-profile', matched?.id],
    queryFn: () => api.get<{ addresses: Address[] }>(`/customers/${matched!.id}`),
    enabled: !!matched,
  });
  const savedAddresses = (profile?.addresses ?? []).filter((a) => a.status === 'active');

  // When a customer is matched, prefill their default saved address + zone once.
  useEffect(() => {
    if (matched && savedAddresses.length && !addressId && !addressLine) {
      const def = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
      setAddressId(def.id);
      if (def.zoneId) setZoneId(def.zoneId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched?.id, savedAddresses.length]);

  const { data: searchResults } = useQuery({
    queryKey: ['product-search', productSearch],
    queryFn: () => api.get<{ rows: ProductRow[] }>(`/products?q=${encodeURIComponent(productSearch)}&status=active`),
    enabled: productSearch.trim().length >= 2,
  });

  const subtotal = lines.reduce((s, l) => s + Math.round(l.unitPrice * l.quantity), 0);
  const zone = zones?.find((z) => z.id === zoneId);
  const shipping = deliveryMethod === 'pickup' ? 0 : zone?.deliveryFee ?? 0;
  const manualDiscount = discountValue && discountReason
    ? discountType === 'percent'
      ? Math.round((subtotal * Number(discountValue)) / 100)
      : Math.round(Number(discountValue) * 100)
    : 0;
  const estTotal = Math.max(0, subtotal - manualDiscount) + shipping;

  const needsAddress = deliveryMethod !== 'pickup';
  const hasAddress = !!addressId || !!addressLine.trim();
  const canSubmit = phone.trim().length >= 7 && lines.length > 0 && (!needsAddress || (!!zoneId && hasAddress));

  const create = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>('/orders', {
        ...(matched ? { customerId: matched.id } : { customer: { phone, name: name || undefined, email: email || undefined } }),
        channel,
        lines: lines.map((l) => ({ variantId: l.variantId, bundleProductId: l.bundleProductId, quantity: l.quantity })),
        zoneId: zoneId || undefined,
        ...(addressId ? { addressId } : addressLine ? { address: { addressLine, area: area || undefined, city: city || undefined } } : {}),
        deliveryMethod,
        paymentMethod,
        code: code || undefined,
        manualDiscount: discountValue && discountReason
          ? { valueType: discountType, value: discountType === 'fixed' ? Math.round(Number(discountValue) * 100) : Number(discountValue), reason: discountReason }
          : undefined,
        noteInternal: noteInternal || undefined,
      }),
    onSuccess: (order) => router.push(`/orders/${order.id}`),
    onError: setError,
  });

  async function pickProduct(row: ProductRow) {
    const detail = await api.get<ProductDetail>(`/products/${row.id}`);
    if (detail.type !== 'standard') {
      setLines((prev) => [...prev, { key: Date.now(), bundleProductId: detail.id, label: `${detail.name} (bundle)`, unitPrice: row.priceMin ?? 0, quantity: 1, stock: null }]);
      setProductSearch('');
      return;
    }
    const active = detail.variants.filter((v) => v.status === 'active');
    if (active.length === 1) addVariant(detail, active[0]);
    else setSelectedProduct(detail);
    setProductSearch('');
  }

  function addVariant(product: ProductDetail, variant: Variant) {
    const optionLabel = Object.values(variant.optionValues ?? {}).join(' / ');
    const existing = lines.find((l) => l.variantId === variant.id);
    if (existing) {
      setLines(lines.map((l) => (l.variantId === variant.id ? { ...l, quantity: l.quantity + 1 } : l)));
    } else {
      setLines((prev) => [...prev, {
        key: Date.now(), variantId: variant.id,
        label: `${product.name}${optionLabel ? ` — ${optionLabel}` : ''} (${variant.sku})`,
        unitPrice: variant.price, quantity: 1, stock: availableStock(variant),
      }]);
    }
    setSelectedProduct(null);
  }

  function useNewAddress() {
    setAddressId('');
    setAddressLine('');
    setArea('');
    setCity('');
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <BackLink href="/orders" label="Back to orders" />
      <PageHeader title="Create manual order" subtitle="WhatsApp, Instagram, phone or walk-in sale" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Customer">
          <div className="space-y-3">
            <Field label="Phone" hint="Any Nigerian format — 0803…, +234803…">
              <Input value={phone} onChange={(e) => { setPhone(e.target.value); setAddressId(''); }} placeholder="0803 123 4567" />
            </Field>
            {digits.length >= 10 && (
              matched ? (
                <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-sm">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="font-medium text-emerald-800">Existing customer — {matched.fullName}</p>
                    <p className="text-xs text-emerald-700">{matched.email ?? 'no email on file'} · order will attach to their history</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm">
                  <UserPlus size={16} className="mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-amber-800">New customer — a profile will be created.</p>
                </div>
              )
            )}
            {!matched && (
              <>
                <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" /></Field>
                <Field label="Email (optional)"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="for Paystack link / invoice" /></Field>
              </>
            )}
            <Field label="Channel">
              <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
                {CHANNELS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </Select>
            </Field>
          </div>
        </Card>
        <Card title="Delivery & payment">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Delivery method">
                <Select value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value as never)}>
                  <option value="rider">Rider</option><option value="3pl">3PL</option><option value="pickup">Pickup</option>
                </Select>
              </Field>
              <Field label="Payment method">
                <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as never)}>
                  <option value="transfer">Bank transfer</option>
                  {/* POD disabled — restore to re-enable pay on delivery
                  <option value="pod">Pay on delivery</option> */}
                  <option value="gateway">Paystack link</option>
                </Select>
              </Field>
            </div>
            {needsAddress && (
              <>
                <Field label="State" hint="Sets the delivery fee">
                  <Select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                    <option value="">Select state…</option>
                    {zones?.filter((z) => z.status === 'active').map((z) => (
                      <option key={z.id} value={z.id}>{z.name} — {naira(z.deliveryFee)}</option>
                    ))}
                  </Select>
                </Field>
                {savedAddresses.length > 0 && (
                  <Field label="Saved address">
                    <Select value={addressId} onChange={(e) => {
                      setAddressId(e.target.value);
                      const a = savedAddresses.find((x) => x.id === e.target.value);
                      if (a?.zoneId) setZoneId(a.zoneId);
                      if (e.target.value) { setAddressLine(''); setArea(''); setCity(''); }
                    }}>
                      <option value="">Enter a new address…</option>
                      {savedAddresses.map((a) => (
                        <option key={a.id} value={a.id}>{a.label ? `${a.label}: ` : ''}{a.addressLine}{a.area ? `, ${a.area}` : ''}</option>
                      ))}
                    </Select>
                  </Field>
                )}
                {!addressId && (
                  <>
                    <Field label="Address"><Input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} placeholder="Street address" /></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Area"><Input value={area} onChange={(e) => setArea(e.target.value)} /></Field>
                      <Field label="City"><Input value={city} onChange={(e) => setCity(e.target.value)} /></Field>
                    </div>
                    {matched && savedAddresses.length > 0 && (
                      <button className="text-xs text-brand-600 hover:underline cursor-pointer" onClick={() => setAddressId(savedAddresses[0].id)}>Use a saved address instead</button>
                    )}
                  </>
                )}
                {addressId && (
                  <button className="text-xs text-brand-600 hover:underline cursor-pointer" onClick={useNewAddress}>Enter a different address</button>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      <Card title="Items">
        <div className="relative mb-3">
          <Input placeholder="Search products by name or SKU…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
          {searchResults && productSearch.trim().length >= 2 && (
            <div className="absolute top-full z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg">
              {searchResults.rows.map((p) => (
                <button key={p.id} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-stone-50 cursor-pointer" onClick={() => pickProduct(p)}>
                  <span>{p.name} {p.type !== 'standard' && <span className="text-purple-600">(bundle)</span>}</span>
                  <span className="text-stone-400">{p.priceMin != null ? naira(p.priceMin) : ''} · stock {qty(p.totalStock)}</span>
                </button>
              ))}
              {!searchResults.rows.length && <p className="px-3 py-3 text-sm text-stone-400">No products found</p>}
            </div>
          )}
        </div>

        {selectedProduct && (
          <div className="mb-3 rounded-md border border-brand-200 bg-brand-50 p-3">
            <p className="mb-2 text-sm font-medium">Pick a variant of {selectedProduct.name}:</p>
            <div className="flex flex-wrap gap-2">
              {selectedProduct.variants.filter((v) => v.status === 'active').map((v) => {
                const s = availableStock(v);
                return (
                  <Button key={v.id} size="sm" variant="outline" onClick={() => addVariant(selectedProduct, v)}>
                    {Object.values(v.optionValues ?? {}).join(' / ') || v.sku} · {naira(v.price)} · {s > 0 ? `${qty(s)} in stock` : 'out of stock'}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {lines.length ? (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-stone-400"><th>Item</th><th className="w-28">Qty</th><th className="text-right">Unit</th><th className="text-right">Total</th><th className="w-10" /></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {lines.map((line) => {
                const over = line.stock != null && line.quantity > line.stock;
                return (
                  <tr key={line.key}>
                    <td className="py-2">
                      {line.label}
                      {over && <p className="text-xs text-red-600">Only {qty(line.stock!)} in stock</p>}
                    </td>
                    <td><Input type="number" step="1" min="1" value={line.quantity} onChange={(e) => setLines(lines.map((l) => (l.key === line.key ? { ...l, quantity: Number(e.target.value) } : l)))} /></td>
                    <td className="text-right">{naira(line.unitPrice)}</td>
                    <td className="text-right font-medium">{naira(Math.round(line.unitPrice * line.quantity))}</td>
                    <td className="text-right">
                      <button className="text-stone-400 hover:text-red-600 cursor-pointer" onClick={() => setLines(lines.filter((l) => l.key !== line.key))}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="py-6 text-center text-sm text-stone-400"><Plus size={14} className="mr-1 inline" />Search above to add items</p>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Discounts">
          <div className="space-y-3">
            <Field label="Promo code"><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. WELCOME10" /></Field>
            {(hasCap('discounts.manual_capped') || hasCap('discounts.manual_uncapped')) && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Staff discount">
                    <Input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0" />
                  </Field>
                  <Field label="Type">
                    <Select value={discountType} onChange={(e) => setDiscountType(e.target.value as never)}>
                      <option value="percent">% of order</option>
                      <option value="fixed">₦ amount</option>
                    </Select>
                  </Field>
                </div>
                {discountValue && <Field label="Reason (required)"><Input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} /></Field>}
                {!hasCap('discounts.manual_uncapped') && <p className="text-xs text-stone-400">Your discounts are capped per policy.</p>}
              </>
            )}
          </div>
        </Card>
        <Card title="Summary">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-stone-500"><span>Subtotal</span><span>{naira(subtotal)}</span></div>
            {manualDiscount > 0 && <div className="flex justify-between text-red-600"><span>Staff discount</span><span>−{naira(manualDiscount)}</span></div>}
            <div className="flex justify-between text-stone-500"><span>Delivery ({zone?.name ?? '—'})</span><span>{naira(shipping)}</span></div>
            <div className="flex justify-between border-t border-stone-100 pt-2 text-base font-bold"><span>Estimated total</span><span>{naira(estTotal)}</span></div>
            {code && <p className="text-xs text-stone-400">Promo code “{code}” and caps are validated server-side on save.</p>}
          </div>
          <Textarea className="mt-3" rows={2} placeholder="Internal note (optional)…" value={noteInternal} onChange={(e) => setNoteInternal(e.target.value)} />
          {needsAddress && !hasAddress && <p className="mt-2 text-xs text-amber-600">Add a delivery address, or switch delivery to Pickup.</p>}
          {needsAddress && hasAddress && !zoneId && <p className="mt-2 text-xs text-amber-600">Select a delivery state to set the fee.</p>}
          <ErrorNote error={error} />
          <Button className="mt-3 w-full" loading={create.isPending} disabled={!canSubmit} onClick={() => create.mutate()}>
            Create draft order
          </Button>
        </Card>
      </div>
    </div>
  );
}
