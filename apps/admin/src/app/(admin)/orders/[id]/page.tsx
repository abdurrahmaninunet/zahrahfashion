'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { naira, formatDateTime, qty, toKobo } from '@/lib/format';
import { BackLink, Badge, Button, Card, Checkbox, Dialog, ErrorNote, Field, Input, Select, Spinner, Textarea, statusColor } from '@/components/ui';

interface OrderDetail {
  id: string; orderNumber: string; status: string; paymentStatus: string; channel: string;
  paymentMethod: string | null; deliveryMethod: string | null;
  subtotal: number; discountTotal: number; shippingFee: number; taxTotal: number; grandTotal: number;
  address: { label?: string; line?: string; addressLine?: string; area?: string; city?: string; zoneName?: string } | null;
  customer: { id: string; fullName: string; primaryPhone: string; email: string | null; status: string } | null;
  deliveryZone: { id: string; name: string } | null;
  promoBreakdown: { applied?: { name: string; amount: number }[]; manualDiscount?: { amount: number; reason: string } | null } | null;
  createdAt: string; confirmedAt: string | null; deliveredAt: string | null;
  cancellationReason: string | null; flags: Record<string, unknown> | null;
  lines: { id: string; variantId: string | null; productNameSnapshot: string; skuSnapshot: string; unitSnapshot: string; unitPriceSnapshot: number; quantity: string; lineTotal: number; discountAmount: number; qtyShipped: string; qtyReturned: string; lineKind: string; bundleComponentsSnapshot?: unknown }[];
  payments: { id: string; method: string; amount: number; status: string; payerName: string | null; reference: string | null; createdAt: string; recordedBy: string | null }[];
  shipments: { id: string; method: string; status: string; riderName: string | null; trackingRef: string | null; shippedAt: string | null; deliveredAt: string | null; failureReason: string | null; codExpected: number | null; lines: { orderLineId: string; quantity: string }[] }[];
  refunds: { id: string; amount: number; status: string; reasonCode: string; method: string; createdAt: string }[];
  returns: { id: string; status: string; reasonCode: string; requestedAt: string; lines: { id: string; orderLineId: string; quantity: string; condition: string }[] }[];
  notes: { id: string; note: string; userId: string; createdAt: string }[];
  events: { id: string; type: string; payload: Record<string, unknown> | null; actorType: string; createdAt: string }[];
  manualDiscounts: { id: string; amount: number; reason: string }[];
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  created: { label: 'Order created', color: 'bg-stone-400' },
  status_changed: { label: 'Status changed', color: 'bg-brand-500' },
  payment_recorded: { label: 'Payment recorded', color: 'bg-emerald-500' },
  stock_reserved: { label: 'Stock reserved', color: 'bg-amber-500' },
  shipment_created: { label: 'Shipment created', color: 'bg-indigo-500' },
  edited: { label: 'Delivery updated', color: 'bg-blue-500' },
  items_edited: { label: 'Items updated', color: 'bg-blue-500' },
  cancelled: { label: 'Order cancelled', color: 'bg-red-500' },
  auto_cancelled: { label: 'Auto-cancelled', color: 'bg-red-500' },
  auto_completed: { label: 'Auto-completed', color: 'bg-emerald-500' },
  delivery_failed: { label: 'Delivery failed', color: 'bg-red-500' },
  refund_requested: { label: 'Refund requested', color: 'bg-amber-500' },
  refund_processed: { label: 'Refund processed', color: 'bg-emerald-600' },
  refund_needed: { label: 'Refund needed', color: 'bg-amber-500' },
  return_requested: { label: 'Return requested', color: 'bg-amber-500' },
  return_received: { label: 'Return received', color: 'bg-indigo-500' },
  return_resolved: { label: 'Return resolved', color: 'bg-emerald-600' },
  promo_cap_exceeded: { label: 'Promo cap exceeded', color: 'bg-red-500' },
};

const STATUS_PHRASE: Record<string, string> = {
  DRAFT: 'Draft', PENDING_PAYMENT: 'Awaiting payment', CONFIRMED: 'Confirmed', PROCESSING: 'Being prepared',
  PARTIALLY_SHIPPED: 'Partially shipped', SHIPPED: 'Out for delivery', DELIVERED: 'Delivered',
  COMPLETED: 'Completed', CANCELLED: 'Cancelled', DELIVERY_FAILED: 'Delivery failed', REFUNDED: 'Refunded',
};

/** Turn an event payload into a human sentence — never raw JSON. */
function eventDetail(type: string, payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const p = payload as Record<string, never> & Record<string, unknown>;
  const str = (v: unknown) => (v == null ? '' : String(v));
  switch (type) {
    case 'created':
      return p.channel ? `${p.manual ? 'Manual order' : 'Order'} via ${str(p.channel)}` : null;
    case 'status_changed':
      return p.from && p.to ? `${STATUS_PHRASE[str(p.from)] ?? str(p.from)} → ${STATUS_PHRASE[str(p.to)] ?? str(p.to)}` : null;
    case 'payment_recorded':
      return [str(p.method).replace('_', ' '), str(p.payerName), p.amount != null ? naira(p.amount as number) : ''].filter(Boolean).join(' · ') || null;
    case 'stock_reserved':
      return p.reason ? str(p.reason).replace(/_/g, ' ') : 'Reserved for this order';
    case 'shipment_created': {
      const lc = Array.isArray(p.lines) ? (p.lines as unknown[]).length : 0;
      return [str(p.method), lc ? `${lc} line(s)` : ''].filter(Boolean).join(' · ') || null;
    }
    case 'edited': {
      const after = p.after as { grandTotal?: number } | undefined;
      return after?.grandTotal != null ? `Delivery changed · new total ${naira(after.grandTotal)}` : 'Delivery details changed';
    }
    case 'items_edited':
      return `${str(p.lineCount)} item(s)${p.grandTotal != null ? ` · new total ${naira(p.grandTotal as number)}` : ''}`.trim();
    case 'delivery_failed':
    case 'cancelled':
    case 'auto_cancelled':
      return p.reason ? str(p.reason) : null;
    default:
      return null;
  }
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { hasCap } = useAuth();
  const [dialog, setDialog] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get<OrderDetail>(`/orders/${id}`),
  });

  const act = useMutation({
    mutationFn: async ({ path, body }: { path: string; body?: unknown }) => api.post(path, body),
    onSuccess: () => {
      setDialog(null);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
    onError: setError,
  });

  if (isLoading || !order) return <Spinner />;

  const actions: { label: string; dialog?: string; run?: () => void; variant?: 'primary' | 'outline' | 'danger'; show: boolean }[] = [
    { label: 'Confirm draft', run: () => act.mutate({ path: `/orders/${id}/confirm-draft` }), show: order.status === 'DRAFT' && hasCap('orders.create_manual') },
    { label: 'Confirm transfer', dialog: 'transfer', show: order.status === 'PENDING_PAYMENT' && order.paymentMethod === 'transfer' && hasCap('orders.confirm_transfer') },
    { label: 'Confirm POD order', run: () => act.mutate({ path: `/orders/${id}/confirm-pod` }), show: ['DRAFT', 'PENDING_PAYMENT'].includes(order.status) && order.paymentMethod === 'pod' && hasCap('orders.confirm_pod') },
    { label: 'Start processing', run: () => act.mutate({ path: `/orders/${id}/process` }), show: order.status === 'CONFIRMED' && hasCap('orders.fulfil') },
    { label: 'Ship items', dialog: 'ship', show: ['PROCESSING', 'PARTIALLY_SHIPPED'].includes(order.status) && hasCap('orders.fulfil') },
    { label: 'Record delivery', dialog: 'deliver', show: ['SHIPPED', 'PARTIALLY_SHIPPED'].includes(order.status) && hasCap('orders.record_delivery') },
    { label: 'Delivery failed', dialog: 'fail', variant: 'outline', show: ['SHIPPED', 'PARTIALLY_SHIPPED'].includes(order.status) && hasCap('orders.record_delivery') },
    { label: 'Reattempt delivery', run: () => act.mutate({ path: `/orders/${id}/reattempt` }), show: order.status === 'DELIVERY_FAILED' && hasCap('orders.fulfil') },
    { label: 'Issue refund', dialog: 'refund', variant: 'outline', show: ['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(order.status) && order.paymentStatus !== 'UNPAID' && hasCap('orders.refund_request') },
    { label: 'Request return', dialog: 'return', variant: 'outline', show: !!order.deliveredAt && hasCap('orders.refund_request') },
    { label: 'Edit items', dialog: 'edititems', variant: 'outline', show: order.status === 'DRAFT' && order.lines.every((l) => l.lineKind !== 'bundle') && (hasCap('orders.edit') || hasCap('orders.edit_limited')) },
    { label: 'Edit delivery', dialog: 'editdelivery', variant: 'outline', show: ['DRAFT', 'PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING'].includes(order.status) && (hasCap('orders.edit') || hasCap('orders.edit_limited')) },
    { label: 'Cancel order', dialog: 'cancel', variant: 'danger', show: ['DRAFT', 'PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'DELIVERY_FAILED'].includes(order.status) && (hasCap('orders.cancel') || hasCap('orders.cancel_prepayment')) },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <BackLink href="/orders" label="Back to orders" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{order.orderNumber}</h1>
            <Badge color={statusColor(order.status)}>{order.status.replace(/_/g, ' ')}</Badge>
            <Badge color={statusColor(order.paymentStatus)}>{order.paymentStatus.replace(/_/g, ' ')}</Badge>
            {order.flags && (order.flags as { repricingReview?: boolean }).repricingReview ? <Badge color="red">repricing review</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-stone-500">
            {order.channel} · {formatDateTime(order.createdAt)} · {order.paymentMethod ?? 'no payment method'} · {order.deliveryMethod ?? '—'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.filter((a) => a.show).map((a) => (
            <Button key={a.label} size="sm" variant={a.variant ?? 'primary'}
              onClick={() => (a.dialog ? setDialog(a.dialog) : a.run?.())} loading={act.isPending && !dialog}>
              {a.label}
            </Button>
          ))}
          <Link href={`/orders/${id}/invoice`} target="_blank"><Button size="sm" variant="outline">Invoice</Button></Link>
        </div>
      </div>
      <ErrorNote error={error} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Lines">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-stone-400">
                <th className="pb-2">Item</th><th className="pb-2">Qty</th><th className="pb-2">Unit price</th><th className="pb-2">Discount</th><th className="pb-2 text-right">Total</th><th className="pb-2 text-right">Shipped</th>
              </tr></thead>
              <tbody className="divide-y divide-stone-100">
                {order.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="py-2">
                      {line.productNameSnapshot} {line.lineKind === 'bundle' && <Badge color="purple">bundle</Badge>}
                      <p className="text-xs text-stone-400">{line.skuSnapshot}</p>
                      <PrintDetails snapshot={line.bundleComponentsSnapshot} />
                    </td>
                    <td>{qty(line.quantity)} {line.unitSnapshot}</td>
                    <td>{naira(line.unitPriceSnapshot)}</td>
                    <td className="text-red-600">{line.discountAmount ? `−${naira(line.discountAmount)}` : '—'}</td>
                    <td className="text-right font-medium">{naira(line.lineTotal)}</td>
                    <td className="text-right text-stone-500">{qty(line.qtyShipped)}/{qty(line.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-sm">
              <div className="flex justify-between text-stone-500"><span>Subtotal</span><span>{naira(order.subtotal)}</span></div>
              {order.discountTotal > 0 && <div className="flex justify-between text-red-600"><span>Discounts</span><span>−{naira(order.discountTotal)}</span></div>}
              {order.promoBreakdown?.applied?.map((p, i) => (
                <div key={i} className="flex justify-between pl-3 text-xs text-stone-400"><span>{p.name}</span><span>−{naira(p.amount)}</span></div>
              ))}
              {order.promoBreakdown?.manualDiscount && (
                <div className="flex justify-between pl-3 text-xs text-stone-400">
                  <span>Staff discount ({order.promoBreakdown.manualDiscount.reason})</span>
                  <span>−{naira(order.promoBreakdown.manualDiscount.amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-stone-500"><span>Delivery</span><span>{naira(order.shippingFee)}</span></div>
              {order.taxTotal > 0 && <div className="flex justify-between text-stone-500"><span>Tax</span><span>{naira(order.taxTotal)}</span></div>}
              <div className="flex justify-between text-base font-bold"><span>Total</span><span>{naira(order.grandTotal)}</span></div>
            </div>
          </Card>

          {order.shipments.length > 0 && (
            <Card title="Shipments">
              <div className="space-y-2">
                {order.shipments.map((s) => (
                  <div key={s.id} className="rounded-md border border-stone-100 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{s.method}{s.riderName ? ` · ${s.riderName}` : ''}{s.trackingRef ? ` · ${s.trackingRef}` : ''}</span>
                      <Badge color={statusColor(s.status)}>{s.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-stone-400">
                      {s.shippedAt ? `Shipped ${formatDateTime(s.shippedAt)}` : ''}
                      {s.deliveredAt ? ` · Delivered ${formatDateTime(s.deliveredAt)}` : ''}
                      {s.failureReason ? ` · Failed: ${s.failureReason}` : ''}
                      {s.codExpected ? ` · COD due ${naira(s.codExpected)}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {(order.refunds.length > 0 || order.returns.length > 0) && (
            <Card title="Refunds & returns">
              <div className="space-y-2 text-sm">
                {order.refunds.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-md border border-stone-100 p-3">
                    <span>Refund {naira(r.amount)} · {r.reasonCode} · {r.method}</span>
                    <span className="flex gap-2">
                      <Badge color={statusColor(r.status)}>{r.status}</Badge>
                      {r.status === 'pending' && hasCap('orders.refund_approve') && (
                        <>
                          <Button size="sm" onClick={() => act.mutate({ path: `/orders/refunds/${r.id}/approve` })}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => act.mutate({ path: `/orders/refunds/${r.id}/reject` })}>Reject</Button>
                        </>
                      )}
                      {r.status === 'approved' && hasCap('orders.refund_request') && (
                        <Button size="sm" onClick={() => act.mutate({ path: `/orders/refunds/${r.id}/process` })}>Mark processed</Button>
                      )}
                    </span>
                  </div>
                ))}
                {order.returns.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-md border border-stone-100 p-3">
                    <span>Return · {r.reasonCode} · {r.lines.length} line(s)</span>
                    <span className="flex gap-2">
                      <Badge color={statusColor(r.status)}>{r.status}</Badge>
                      {r.status === 'REQUESTED' && hasCap('orders.refund_approve') && (
                        <>
                          <Button size="sm" onClick={() => act.mutate({ path: `/orders/returns/${r.id}/approve` })}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => act.mutate({ path: `/orders/returns/${r.id}/reject` })}>Reject</Button>
                        </>
                      )}
                      {r.status === 'APPROVED' && hasCap('inventory.return_restock') && (
                        <Button size="sm" onClick={() => act.mutate({
                          path: `/orders/returns/${r.id}/receive`,
                          body: { conditions: r.lines.map((l) => ({ returnLineId: l.id, condition: 'restockable' })) },
                        })}>Receive & restock</Button>
                      )}
                      {r.status === 'RECEIVED' && (
                        <Button size="sm" onClick={() => act.mutate({ path: `/orders/returns/${r.id}/resolve`, body: { resolution: 'refund' } })}>Resolve as refund</Button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title="Timeline">
            <ol className="space-y-3 text-sm">
              {order.events.map((e) => {
                const ev = EVENT_LABELS[e.type] ?? { label: e.type.replace(/_/g, ' '), color: 'bg-stone-300' };
                const detail = eventDetail(e.type, e.payload);
                return (
                  <li key={e.id} className="flex gap-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ev.color}`} />
                    <div className="min-w-0">
                      <p className="font-medium capitalize">{ev.label}</p>
                      {detail && <p className="text-xs text-stone-500">{detail}</p>}
                      <p className="text-xs text-stone-400">{formatDateTime(e.createdAt)} · {e.actorType === 'user' ? 'staff' : e.actorType}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Customer">
            {order.customer ? (
              <div className="text-sm">
                <Link href={`/customers/${order.customer.id}`} className="font-medium text-brand-700 hover:underline">{order.customer.fullName}</Link>
                <p className="text-stone-500">{order.customer.primaryPhone}</p>
                {order.customer.email && <p className="text-stone-500">{order.customer.email}</p>}
                {order.customer.status !== 'active' && <Badge color={statusColor(order.customer.status)}>{order.customer.status}</Badge>}
              </div>
            ) : <p className="text-sm text-stone-400">No customer linked</p>}
          </Card>
          <Card title="Delivery">
            <div className="text-sm text-stone-600">
              <p>{order.address?.line ?? order.address?.addressLine ?? 'No address'}</p>
              <p>{[order.address?.area, order.address?.city].filter(Boolean).join(', ')}</p>
              <p className="mt-1 text-xs text-stone-400">State: {order.deliveryZone?.name ?? order.address?.zoneName ?? '—'}</p>
            </div>
          </Card>
          <Card title="Payments">
            {order.payments.length ? (
              <ul className="space-y-2 text-sm">
                {order.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <span>
                      {p.method.replace('_', ' ')} {p.payerName ? `· ${p.payerName}` : ''}
                      <p className="text-xs text-stone-400">{p.reference ?? ''} {formatDateTime(p.createdAt)}</p>
                    </span>
                    <span className="font-medium">{naira(p.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-stone-400">No payments recorded</p>}
          </Card>
          <Card title="Internal notes">
            <NoteBox orderId={id} notes={order.notes} onSaved={() => queryClient.invalidateQueries({ queryKey: ['order', id] })} />
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <TransferDialog open={dialog === 'transfer'} onClose={() => setDialog(null)} order={order} act={act} error={error} />
      <ShipDialog open={dialog === 'ship'} onClose={() => setDialog(null)} order={order} act={act} error={error} />
      <DeliverDialog open={dialog === 'deliver'} onClose={() => setDialog(null)} order={order} act={act} error={error} />
      <FailDialog open={dialog === 'fail'} onClose={() => setDialog(null)} order={order} act={act} error={error} />
      <CancelDialog open={dialog === 'cancel'} onClose={() => setDialog(null)} order={order} act={act} error={error} />
      <RefundDialog open={dialog === 'refund'} onClose={() => setDialog(null)} order={order} act={act} error={error} />
      <ReturnDialog open={dialog === 'return'} onClose={() => setDialog(null)} order={order} act={act} error={error} />
      <EditDeliveryDialog open={dialog === 'editdelivery'} onClose={() => setDialog(null)} order={order}
        onSaved={() => { setDialog(null); queryClient.invalidateQueries({ queryKey: ['order', id] }); }} />
      <EditItemsDialog open={dialog === 'edititems'} onClose={() => setDialog(null)} order={order}
        onSaved={() => { setDialog(null); queryClient.invalidateQueries({ queryKey: ['order', id] }); }} />
    </div>
  );
}

function EditDeliveryDialog({ open, onClose, order, onSaved }: { open: boolean; onClose: () => void; order: OrderDetail; onSaved: () => void }) {
  const [method, setMethod] = useState<'rider' | '3pl' | 'pickup'>((order.deliveryMethod as never) ?? 'rider');
  const [zoneId, setZoneId] = useState(order.deliveryZone?.id ?? '');
  const [addressLine, setAddressLine] = useState(order.address?.line ?? order.address?.addressLine ?? '');
  const [area, setArea] = useState(order.address?.area ?? '');
  const [city, setCity] = useState(order.address?.city ?? '');
  const [error, setError] = useState<unknown>(null);
  const { data: zones } = useQuery({ queryKey: ['zones'], queryFn: () => api.get<{ id: string; name: string; deliveryFee: number; status: string }[]>('/zones') });

  const save = useMutation({
    mutationFn: () => api.put(`/orders/${order.id}`, {
      deliveryMethod: method,
      zoneId: method === 'pickup' ? null : (zoneId || null),
      ...(method === 'pickup' ? {} : addressLine.trim() ? { address: { addressLine, area: area || undefined, city: city || undefined } } : {}),
    }),
    onSuccess: onSaved,
    onError: setError,
  });

  return (
    <Dialog open={open} onClose={onClose} title="Edit delivery">
      <div className="space-y-3">
        <p className="text-sm text-stone-500">Change the delivery method, state or address. Allowed until the order ships; the change is logged to the timeline.</p>
        <Field label="Delivery method">
          <Select value={method} onChange={(e) => setMethod(e.target.value as never)}>
            <option value="rider">Rider</option><option value="3pl">3PL</option><option value="pickup">Pickup</option>
          </Select>
        </Field>
        {method !== 'pickup' && (
          <>
            <Field label="State">
              <Select value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                <option value="">Select state…</option>
                {zones?.filter((z) => z.status === 'active').map((z) => (
                  <option key={z.id} value={z.id}>{z.name} — {naira(z.deliveryFee)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Address"><Input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Area"><Input value={area} onChange={(e) => setArea(e.target.value)} /></Field>
              <Field label="City"><Input value={city} onChange={(e) => setCity(e.target.value)} /></Field>
            </div>
          </>
        )}
        <ErrorNote error={error} />
        <Button className="w-full" loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button>
      </div>
    </Dialog>
  );
}

interface EditVariant { id: string; sku: string; price: number; optionValues: Record<string, string>; status: string; stockLevels?: { onHand: string; reserved: string }[] }
interface EditProductDetail { id: string; name: string; variants: EditVariant[] }
type EditRow = { key: number; variantId: string; label: string; unitPrice: number; quantity: number };
const editStock = (v: EditVariant) => (v.stockLevels ?? []).reduce((s, l) => s + (Number(l.onHand) - Number(l.reserved)), 0);

function EditItemsDialog({ open, onClose, order, onSaved }: { open: boolean; onClose: () => void; order: OrderDetail; onSaved: () => void }) {
  const [rows, setRows] = useState<EditRow[]>([]);
  const [search, setSearch] = useState('');
  const [chooser, setChooser] = useState<EditProductDetail | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      setRows(order.lines.map((l, i) => ({ key: i, variantId: l.variantId ?? '', label: `${l.productNameSnapshot} (${l.skuSnapshot})`, unitPrice: l.unitPriceSnapshot, quantity: Number(l.quantity) })));
      setSearch(''); setChooser(null); setError(null);
    }
  }, [open, order]);

  const { data: results } = useQuery({
    queryKey: ['order-edit-search', search],
    queryFn: () => api.get<{ rows: { id: string; name: string; type: string; priceMin: number | null; totalStock: number }[] }>(`/products?q=${encodeURIComponent(search)}&status=active`),
    enabled: open && search.trim().length >= 2,
  });

  const save = useMutation({
    mutationFn: () => api.put(`/orders/${order.id}/lines`, { lines: rows.map((r) => ({ variantId: r.variantId, quantity: r.quantity })) }),
    onSuccess: onSaved,
    onError: setError,
  });

  async function pick(row: { id: string }) {
    const detail = await api.get<EditProductDetail>(`/products/${row.id}`);
    const active = detail.variants.filter((v) => v.status === 'active');
    if (active.length === 1) addVar(detail.name, active[0]);
    else setChooser(detail);
    setSearch('');
  }
  function addVar(productName: string, v: EditVariant) {
    setRows((prev) => {
      const ex = prev.find((r) => r.variantId === v.id);
      if (ex) return prev.map((r) => (r.variantId === v.id ? { ...r, quantity: r.quantity + 1 } : r));
      const opt = Object.values(v.optionValues ?? {}).join(' / ');
      return [...prev, { key: Date.now(), variantId: v.id, label: `${productName}${opt ? ` — ${opt}` : ''} (${v.sku})`, unitPrice: v.price, quantity: 1 }];
    });
    setChooser(null);
  }

  const subtotal = rows.reduce((s, r) => s + Math.round(r.unitPrice * r.quantity), 0);

  return (
    <Dialog open={open} onClose={onClose} title="Edit items" wide>
      <div className="space-y-3">
        <p className="text-sm text-stone-500">Add, remove or re-quantity items on this draft. Totals, promos and any staff discount recalculate when you save.</p>
        <div className="relative">
          <Input placeholder="Search products to add…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {results && search.trim().length >= 2 && (
            <div className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg">
              {results.rows.filter((p) => p.type === 'standard').map((p) => (
                <button key={p.id} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-stone-50 cursor-pointer" onClick={() => pick(p)}>
                  <span>{p.name}</span>
                  <span className="text-stone-400">{p.priceMin != null ? naira(p.priceMin) : ''} · stock {qty(p.totalStock)}</span>
                </button>
              ))}
              {!results.rows.some((p) => p.type === 'standard') && <p className="px-3 py-3 text-sm text-stone-400">No products found</p>}
            </div>
          )}
        </div>

        {chooser && (
          <div className="rounded-md border border-brand-200 bg-brand-50 p-3">
            <p className="mb-2 text-sm font-medium">Pick a variant of {chooser.name}:</p>
            <div className="flex flex-wrap gap-2">
              {chooser.variants.filter((v) => v.status === 'active').map((v) => {
                const s = editStock(v);
                return (
                  <Button key={v.id} size="sm" variant="outline" onClick={() => addVar(chooser.name, v)}>
                    {Object.values(v.optionValues ?? {}).join(' / ') || v.sku} · {naira(v.price)} · {s > 0 ? `${qty(s)} in stock` : 'out of stock'}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {rows.length ? (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-stone-400"><th>Item</th><th className="w-24">Qty</th><th className="text-right">Unit</th><th className="text-right">Total</th><th className="w-10" /></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="py-2">{r.label}</td>
                  <td><Input type="number" min="1" step="1" value={r.quantity} onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, quantity: Number(e.target.value) } : x)))} /></td>
                  <td className="text-right">{naira(r.unitPrice)}</td>
                  <td className="text-right font-medium">{naira(Math.round(r.unitPrice * r.quantity))}</td>
                  <td className="text-right"><button className="text-stone-400 hover:text-red-600 cursor-pointer" onClick={() => setRows(rows.filter((x) => x.key !== r.key))}><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="py-4 text-center text-sm text-stone-400">No items — search above to add.</p>}

        <div className="flex justify-between border-t border-stone-100 pt-2 text-sm font-medium"><span>Items subtotal</span><span>{naira(subtotal)}</span></div>
        <ErrorNote error={error} />
        <Button className="w-full" loading={save.isPending} disabled={!rows.length || rows.some((r) => !r.variantId || r.quantity < 1)} onClick={() => save.mutate()}>Save items</Button>
      </div>
    </Dialog>
  );
}

type Act = { mutate: (args: { path: string; body?: unknown }) => void; isPending: boolean };
type DialogProps = { open: boolean; onClose: () => void; order: OrderDetail; act: Act; error: unknown };

function NoteBox({ orderId, notes, onSaved }: { orderId: string; notes: OrderDetail['notes']; onSaved: () => void }) {
  const [note, setNote] = useState('');
  return (
    <div className="space-y-2 text-sm">
      <div className="flex gap-2">
        <Input placeholder="Add internal note…" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button size="sm" variant="secondary" onClick={async () => { if (!note.trim()) return; await api.post(`/orders/${orderId}/notes`, { note }); setNote(''); onSaved(); }}>Add</Button>
      </div>
      {notes.map((n) => (
        <div key={n.id} className="rounded-md bg-stone-50 p-2">
          <p>{n.note}</p>
          <p className="mt-0.5 text-xs text-stone-400">{formatDateTime(n.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}

function TransferDialog({ open, onClose, order, act, error }: DialogProps) {
  const [payerName, setPayerName] = useState('');
  const [reference, setReference] = useState('');
  return (
    <Dialog open={open} onClose={onClose} title="Confirm bank transfer">
      <div className="space-y-3">
        <p className="text-sm text-stone-500">Verify the bank alert of {naira(order.grandTotal)} before confirming. This is logged to you.</p>
        <Field label="Payer name (as on the alert)"><Input value={payerName} onChange={(e) => setPayerName(e.target.value)} /></Field>
        <Field label="Reference (optional)"><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        <ErrorNote error={error} />
        <Button className="w-full" loading={act.isPending} disabled={!payerName.trim()}
          onClick={() => act.mutate({ path: `/orders/${order.id}/confirm-transfer`, body: { payerName, reference: reference || undefined } })}>
          Confirm payment received
        </Button>
      </div>
    </Dialog>
  );
}

function ShipDialog({ open, onClose, order, act, error }: DialogProps) {
  const [method, setMethod] = useState<'rider' | '3pl' | 'pickup'>('rider');
  const [carrier, setCarrier] = useState('');
  const [trackingRef, setTrackingRef] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const shippable = order.lines.filter((l) => Number(l.quantity) - Number(l.qtyShipped) > 0);
  return (
    <Dialog open={open} onClose={onClose} title="Ship items" wide>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Method">
            <Select value={method} onChange={(e) => setMethod(e.target.value as never)}>
              <option value="rider">Rider (assign on dispatch board)</option>
              <option value="3pl">3PL courier</option>
              <option value="pickup">Customer pickup</option>
            </Select>
          </Field>
          {method === '3pl' && (
            <>
              <Field label="Carrier"><Input value={carrier} onChange={(e) => setCarrier(e.target.value)} /></Field>
              <Field label="Tracking ref"><Input value={trackingRef} onChange={(e) => setTrackingRef(e.target.value)} /></Field>
            </>
          )}
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-stone-400"><th>Item</th><th>Outstanding</th><th className="w-32">Ship qty</th></tr></thead>
          <tbody>
            {shippable.map((l) => {
              const outstanding = Number(l.quantity) - Number(l.qtyShipped);
              return (
                <tr key={l.id} className="border-t border-stone-100">
                  <td className="py-2">{l.productNameSnapshot}</td>
                  <td>{qty(outstanding)} {l.unitSnapshot}</td>
                  <td><Input type="number" step="0.5" min={0} max={outstanding} value={quantities[l.id] ?? String(outstanding)} onChange={(e) => setQuantities({ ...quantities, [l.id]: e.target.value })} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <ErrorNote error={error} />
        <Button className="w-full" loading={act.isPending} onClick={() => {
          const lines = shippable
            .map((l) => ({ orderLineId: l.id, quantity: Number(quantities[l.id] ?? (Number(l.quantity) - Number(l.qtyShipped))) }))
            .filter((l) => l.quantity > 0);
          act.mutate({ path: `/orders/${order.id}/ship`, body: { method, carrier: carrier || undefined, trackingRef: trackingRef || undefined, lines } });
        }}>
          Create shipment & deduct stock
        </Button>
      </div>
    </Dialog>
  );
}

function DeliverDialog({ open, onClose, order, act, error }: DialogProps) {
  const shipment = order.shipments.find((s) => s.status === 'out') ?? order.shipments[order.shipments.length - 1];
  const isPod = order.paymentMethod === 'pod' && order.paymentStatus !== 'PAID';
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'pod_cash' | 'pod_transfer'>('pod_cash');
  const [collector, setCollector] = useState('');
  if (!shipment) return null;
  return (
    <Dialog open={open} onClose={onClose} title="Record delivery">
      <div className="space-y-3">
        {isPod && (
          <>
            <p className="text-sm text-stone-500">POD order — record the payment collected ({naira(order.grandTotal)} due).</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Payment method">
                <Select value={method} onChange={(e) => setMethod(e.target.value as never)}>
                  <option value="pod_cash">Cash</option>
                  <option value="pod_transfer">Transfer on delivery</option>
                </Select>
              </Field>
              <Field label="Amount collected (₦)"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(order.grandTotal / 100)} /></Field>
            </div>
            <Field label="Collector / rider"><Input value={collector} onChange={(e) => setCollector(e.target.value)} /></Field>
          </>
        )}
        <ErrorNote error={error} />
        <Button className="w-full" loading={act.isPending} onClick={() =>
          act.mutate({
            path: `/orders/${order.id}/shipments/${shipment.id}/delivered`,
            body: isPod ? { pod: { method, amount: toKobo(amount || order.grandTotal / 100), collector: collector || undefined } } : {},
          })
        }>
          Mark delivered{isPod ? ' + record payment' : ''}
        </Button>
      </div>
    </Dialog>
  );
}

function FailDialog({ open, onClose, order, act, error }: DialogProps) {
  const shipment = order.shipments.find((s) => s.status === 'out') ?? order.shipments[order.shipments.length - 1];
  const [reason, setReason] = useState('customer unreachable');
  const [customerCaused, setCustomerCaused] = useState(true);
  if (!shipment) return null;
  return (
    <Dialog open={open} onClose={onClose} title="Delivery failed">
      <div className="space-y-3">
        <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {/* POD disabled — label was "Customer-caused (counts toward POD auto-block)" */}
        <Checkbox label="Customer-caused failure" checked={customerCaused} onChange={(e) => setCustomerCaused(e.target.checked)} />
        <ErrorNote error={error} />
        <Button className="w-full" variant="danger" loading={act.isPending}
          onClick={() => act.mutate({ path: `/orders/${order.id}/shipments/${shipment.id}/failed`, body: { reason, customerCaused } })}>
          Record failure
        </Button>
      </div>
    </Dialog>
  );
}

function CancelDialog({ open, onClose, order, act, error }: DialogProps) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open={open} onClose={onClose} title="Cancel order">
      <div className="space-y-3">
        <p className="text-sm text-stone-500">Reserved stock will be released{order.paymentStatus !== 'UNPAID' ? ' and a refund flow will be flagged' : ''}.</p>
        <Field label="Reason"><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <ErrorNote error={error} />
        <Button className="w-full" variant="danger" loading={act.isPending} disabled={!reason.trim()}
          onClick={() => act.mutate({ path: `/orders/${order.id}/cancel`, body: { reason } })}>
          Cancel order
        </Button>
      </div>
    </Dialog>
  );
}

function RefundDialog({ open, onClose, order, act, error }: DialogProps) {
  const [amount, setAmount] = useState(String(order.grandTotal / 100));
  const [reasonCode, setReasonCode] = useState('customer_request');
  const [method, setMethod] = useState<'gateway_reversal' | 'manual_transfer'>('manual_transfer');
  const [note, setNote] = useState('');
  return (
    <Dialog open={open} onClose={onClose} title="Issue refund">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₦)"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Method">
            <Select value={method} onChange={(e) => setMethod(e.target.value as never)}>
              <option value="manual_transfer">Manual bank transfer</option>
              <option value="gateway_reversal">Gateway reversal</option>
            </Select>
          </Field>
        </div>
        <Field label="Reason">
          <Select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
            {['customer_request', 'wrong_item', 'damaged_item', 'late_delivery', 'order_cancelled', 'goodwill'].map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
          </Select>
        </Field>
        <Field label="Note (optional)"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <p className="text-xs text-stone-400">Refunds above the approval threshold go to a Manager/Owner for approval.</p>
        <ErrorNote error={error} />
        <Button className="w-full" loading={act.isPending}
          onClick={() => act.mutate({ path: `/orders/${order.id}/refunds`, body: { scope: Number(amount) * 100 >= order.grandTotal ? 'full' : 'partial', amount: toKobo(amount), reasonCode, method, note: note || undefined } })}>
          Submit refund
        </Button>
      </div>
    </Dialog>
  );
}

function ReturnDialog({ open, onClose, order, act, error }: DialogProps) {
  const [reasonCode, setReasonCode] = useState('changed_mind');
  const [storeError, setStoreError] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const returnable = order.lines.filter((l) => Number(l.qtyShipped) - Number(l.qtyReturned) > 0);
  return (
    <Dialog open={open} onClose={onClose} title="Request return" wide>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reason">
            <Select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
              {['changed_mind', 'wrong_item', 'damaged_item', 'quality_issue', 'size_issue'].map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </Select>
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox label="Store error (overrides window & category exclusions)" checked={storeError} onChange={(e) => setStoreError(e.target.checked)} />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-stone-400"><th>Item</th><th>Eligible</th><th className="w-32">Return qty</th></tr></thead>
          <tbody>
            {returnable.map((l) => {
              const eligible = Number(l.qtyShipped) - Number(l.qtyReturned);
              return (
                <tr key={l.id} className="border-t border-stone-100">
                  <td className="py-2">{l.productNameSnapshot}</td>
                  <td>{qty(eligible)} {l.unitSnapshot}</td>
                  <td><Input type="number" step="0.5" min={0} max={eligible} value={quantities[l.id] ?? ''} onChange={(e) => setQuantities({ ...quantities, [l.id]: e.target.value })} placeholder="0" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <ErrorNote error={error} />
        <Button className="w-full" loading={act.isPending} onClick={() => {
          const lines = returnable.map((l) => ({ orderLineId: l.id, quantity: Number(quantities[l.id] ?? 0) })).filter((l) => l.quantity > 0);
          act.mutate({ path: `/orders/${order.id}/returns`, body: { reasonCode, storeError, lines } });
        }}>
          Submit return request
        </Button>
      </div>
    </Dialog>
  );
}

/** MIM custom-printing details for an order line — what to print, per piece. */
function PrintDetails({ snapshot }: { snapshot?: unknown }) {
  type DesignEl = { type?: string; text?: string; fontFamily?: string; fontSize?: number; fill?: string; curve?: number };
  type Side = { id?: string; label?: string; previewUrl?: string; elements?: DesignEl[] };
  const per = (snapshot as {
    personalization?: {
      mode?: string; text?: string; names?: string[]; previewUrl?: string;
      spec?: { people?: { name?: string; previewUrl?: string; sides?: Side[] }[]; sides?: Side[]; elements?: DesignEl[] };
    };
  } | null | undefined)?.personalization;
  if (!per) return null;

  const FONT_NAMES: Record<string, string> = {
    'Arial, sans-serif': 'Sans', 'Georgia, serif': 'Serif',
    '"Brush Script MT", "Segoe Script", cursive': 'Script',
    'Impact, Haettenschweiler, sans-serif': 'Display',
    '"Trebuchet MS", "Comic Sans MS", sans-serif': 'Rounded',
  };
  // New shape carries per-side previews; fall back to the legacy single-side shape.
  const sides = per.spec?.sides ?? (per.spec?.elements || per.previewUrl
    ? [{ label: 'Design', previewUrl: per.previewUrl, elements: per.spec?.elements ?? [] }]
    : []);

  const renderSide = (side: Side, key: number) => {
    const textEls = (side.elements ?? []).filter((e) => e.type === 'text');
    const imageCount = (side.elements ?? []).filter((e) => e.type === 'image').length;
    return (
      <div key={key} className="flex flex-wrap gap-3">
        {side.previewUrl && (
          <a href={side.previewUrl} target="_blank" rel="noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={side.previewUrl} alt={`${side.label} preview`} className="w-36 rounded border border-stone-200 bg-white" />
            <span className="mt-0.5 block text-center text-[11px] text-[#8a6d1f] underline">Open / download</span>
          </a>
        )}
        <div className="min-w-0 space-y-1 text-stone-700">
          {side.label && <p className="font-semibold text-[#6f571a]">{side.label}</p>}
          {textEls.length > 0 ? textEls.map((e, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-stone-300" style={{ background: e.fill }} />
              <span className="font-medium text-stone-800">&ldquo;{e.text}&rdquo;</span>
              <span className="text-stone-500">· {FONT_NAMES[e.fontFamily ?? ''] ?? 'Font'} {Math.round(e.fontSize ?? 0)}px{(e.curve ?? 0) !== 0 ? ' · curved' : ''}</span>
            </div>
          )) : <p className="text-stone-500">Custom design</p>}
          {imageCount > 0 && <p className="text-stone-500">+ {imageCount} uploaded image{imageCount > 1 ? 's' : ''}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-1.5 rounded-md border border-[#8a6d1f]/30 bg-[#faf5e6] px-2.5 py-1.5 text-xs">
      <p className="font-semibold text-[#6f571a]">To print:</p>
      {per.mode === 'names' ? (
        <ol className="mt-0.5 list-decimal pl-4 text-stone-700">
          {(per.names ?? []).map((n, i) => <li key={i}>{n}</li>)}
        </ol>
      ) : per.mode === 'design' && Array.isArray(per.spec?.people) && per.spec.people.length ? (
        <div className="mt-1 space-y-3">
          {per.spec.people.map((person, pi) => (
            <div key={pi} className="rounded border border-[#8a6d1f]/20 bg-white/60 p-2">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#6f571a]">Piece {pi + 1}{person.name ? ` — ${person.name}` : ''}</p>
              <div className="space-y-2">
                {(person.sides?.length ? person.sides : [{ label: 'Design', previewUrl: person.previewUrl, elements: [] }]).map(renderSide)}
              </div>
            </div>
          ))}
        </div>
      ) : per.mode === 'design' ? (
        <div className="mt-1 space-y-3">
          {sides.length ? sides.map(renderSide) : <p className="text-stone-500">Custom design</p>}
        </div>
      ) : (
        <p className="mt-0.5 font-medium text-stone-800">&ldquo;{per.text}&rdquo;</p>
      )}
    </div>
  );
}
