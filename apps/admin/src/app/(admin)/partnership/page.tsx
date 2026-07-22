'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ImagePlus, Mail, Package, Phone, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge, Button, Card, Dialog, ErrorNote, Field, Input, PageHeader, Select, Spinner, Textarea } from '@/components/ui';
import { naira, nairaInput, toKobo, formatDate } from '@/lib/format';

interface PartnerStyle { id?: string; image: string | null; label: string | null; stock: number }
interface PartnerProduct {
  id: string; name: string; slug: string; description: string | null;
  wholesalePrice: number; stock: number; image: string | null; status: string;
  styles?: PartnerStyle[]; hasStyles?: boolean;
}
interface Application {
  id: string; name: string | null; businessName: string | null; email: string; phone: string | null;
  address: string | null; note: string | null; status: 'pending' | 'approved' | 'rejected'; createdAt: string;
  partnerId: string | null; partnerStatus: 'active' | 'suspended' | null;
}

const TABS = [
  { key: 'products', label: 'Products' },
  { key: 'orders', label: 'Orders' },
  { key: 'applications', label: 'Applications' },
] as const;

interface PartnerOrder {
  id: string; orderNumber: string; status: string; total: number; note: string | null; createdAt: string;
  partner: { businessName: string | null; name: string | null; email: string } | null;
  lines: { productName: string; unitPrice: number; quantity: number; lineTotal: number; styleMode: string | null; styles: { label: string | null; qty: number }[] | null }[];
}

/** Partnership — the wholesale/reseller area. Its products, applications and
 *  (soon) partner accounts are isolated from the storefront catalogue. */
export default function PartnershipPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('products');
  const { data: apps } = useQuery({ queryKey: ['partner-apps', 'pending'], queryFn: () => api.get<{ pending: number }>('/partnership/applications?status=pending') });

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader title="Partnership" subtitle="Wholesale catalogue and reseller applications — kept separate from the storefront." />

      <nav className="mb-5 flex gap-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${tab === t.key ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
            {t.label}
            {t.key === 'applications' && apps && apps.pending > 0 && (
              <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${tab === 'applications' ? 'bg-white text-brand-700' : 'bg-brand-600 text-white'}`}>{apps.pending}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'products' ? <ProductsTab /> : tab === 'orders' ? <OrdersTab /> : <ApplicationsTab />}
    </div>
  );
}

// ── Products ──────────────────────────────────────────────────────────────────

function ProductsTab() {
  const { hasCap } = useAuth();
  const canEdit = hasCap('products.create_edit');
  const [editing, setEditing] = useState<PartnerProduct | 'new' | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['partner-products'], queryFn: () => api.get<PartnerProduct[]>('/partnership/products') });

  if (isLoading) return <Spinner />;
  const products = data ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-stone-500">{products.length} wholesale product{products.length === 1 ? '' : 's'}</p>
        {canEdit && <Button onClick={() => setEditing('new')}><Plus size={15} /> Add product</Button>}
      </div>

      {products.length ? (
        <Card>
          <div className="divide-y divide-stone-100">
            {products.map((p) => (
              <button key={p.id} disabled={!canEdit} onClick={() => setEditing(p)} className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-stone-50 disabled:cursor-default">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-stone-100 text-stone-300">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                  ) : <Package size={20} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-stone-800">{p.name}</p>
                  <p className="text-xs text-stone-400">{naira(p.wholesalePrice)} wholesale · {p.stock} in stock</p>
                </div>
                {p.status === 'hidden' && <Badge color="gray">Hidden</Badge>}
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-200 py-16 text-center text-sm text-stone-400">
          No wholesale products yet — add your first partner product.
        </p>
      )}

      {editing && <ProductDialog product={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ProductDialog({ product, onClose }: { product: PartnerProduct | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: product?.name ?? '',
    price: product ? nairaInput(product.wholesalePrice) : '',
    stock: String(product?.stock ?? 0),
    description: product?.description ?? '',
    status: product?.status ?? 'active',
  });
  const [styles, setStyles] = useState<{ image: string | null; label: string; stock: string }[]>(
    (product?.styles ?? []).map((s) => ({ image: s.image, label: s.label ?? '', stock: String(s.stock) })),
  );
  const [styleUploading, setStyleUploading] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const done = () => { qc.invalidateQueries({ queryKey: ['partner-products'] }); onClose(); };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        wholesalePrice: toKobo(form.price || 0),
        stock: Math.max(0, Math.round(Number(form.stock) || 0)),
        description: form.description.trim() || undefined,
        status: form.status,
        styles: styles.map((s) => ({ image: s.image, label: s.label.trim() || undefined, stock: Math.max(0, Math.round(Number(s.stock) || 0)) })),
      };
      return product ? api.put(`/partnership/products/${product.id}`, body) : api.post('/partnership/products', body);
    },
    onSuccess: done,
    onError: setError,
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/partnership/products/${product!.id}`),
    onSuccess: done,
    onError: setError,
  });

  const addStyle = () => setStyles((s) => [...s, { image: null, label: '', stock: '0' }]);
  const updateStyle = (i: number, patch: Partial<{ image: string | null; label: string; stock: string }>) =>
    setStyles((s) => s.map((st, j) => (j === i ? { ...st, ...patch } : st)));
  const removeStyle = (i: number) => setStyles((s) => s.filter((_, j) => j !== i));
  async function uploadStyle(i: number, files: FileList | null) {
    if (!files?.length) return;
    setStyleUploading(i);
    try {
      const fd = new FormData();
      fd.append('file', files[0]);
      const asset = await api.postForm<{ url: string }>('/content/media', fd);
      updateStyle(i, { image: asset.url });
    } catch (e) { setError(e); } finally { setStyleUploading(null); }
  }

  return (
    <Dialog open onClose={onClose} title={product ? 'Edit wholesale product' : 'Add wholesale product'}>
      <div className="space-y-3">
        <Field label="Product name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Swiss Voile Lace (5 yards)" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Wholesale price (₦)"><Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" /></Field>
          <Field label="Stock"><Input type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></Field>
        </div>
        <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional details for partners" /></Field>

        {/* Styles — every image/look is a style with its own stock (even a single one). */}
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-stone-700">Styles &amp; images</p>
            <button type="button" onClick={addStyle} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 cursor-pointer"><Plus size={14} /> Add style</button>
          </div>
          <p className="mt-0.5 text-xs text-stone-400">
            Add a style for each look/colour — image + how many you have. Add just one for a single-style product; add several and partners can combine them or pick per style. Availability is the sum of the styles&apos; stock.
          </p>
          {styles.length > 0 && (
            <div className="mt-3 space-y-2">
              {styles.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border border-stone-200 bg-white p-2">
                  <label className="relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-stone-200 bg-stone-50 text-stone-300">
                    {s.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image} alt="" className="h-full w-full object-cover" />
                    ) : styleUploading === i ? <span className="text-[10px]">…</span> : <ImagePlus size={16} />}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { uploadStyle(i, e.target.files); e.target.value = ''; }} />
                  </label>
                  <Input value={s.label} onChange={(e) => updateStyle(i, { label: e.target.value })} placeholder="Style name (optional)" className="flex-1" />
                  <Input type="number" min={0} value={s.stock} onChange={(e) => updateStyle(i, { stock: e.target.value })} className="w-20" placeholder="Qty" />
                  <button type="button" onClick={() => removeStyle(i)} className="shrink-0 rounded p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Field label="Status">
          <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active (visible to partners)</option>
            <option value="hidden">Hidden</option>
          </Select>
        </Field>

        <ErrorNote error={error} />
        <div className="flex gap-2 pt-1">
          <Button className="flex-1" loading={save.isPending} disabled={!form.name.trim()} onClick={() => save.mutate()}>
            {product ? 'Save changes' : 'Add product'}
          </Button>
          {product && <Button variant="outline" loading={remove.isPending} onClick={() => remove.mutate()}><Trash2 size={15} /> Delete</Button>}
        </div>
      </div>
    </Dialog>
  );
}

// ── Orders ────────────────────────────────────────────────────────────────────

const ORDER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'fulfilled', label: 'Fulfilled' },
  { key: 'cancelled', label: 'Cancelled' },
] as const;
const ORDER_COLOR: Record<string, 'amber' | 'blue' | 'green' | 'gray'> = { pending: 'amber', confirmed: 'blue', fulfilled: 'green', cancelled: 'gray' };

function OrdersTab() {
  const qc = useQueryClient();
  const { hasCap } = useAuth();
  const canEdit = hasCap('products.create_edit');
  const [filter, setFilter] = useState<(typeof ORDER_TABS)[number]['key']>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['partner-orders-admin', filter],
    queryFn: () => api.get<PartnerOrder[]>(`/partnership/orders/all${filter === 'all' ? '' : `?status=${filter}`}`),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/partnership/orders/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner-orders-admin'] }),
  });

  return (
    <div>
      <nav className="mb-4 flex flex-wrap gap-1">
        {ORDER_TABS.map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${filter === t.key ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
            {t.label}
          </button>
        ))}
      </nav>

      {isLoading ? <Spinner /> : data?.length ? (
        <div className="space-y-3">
          {data.map((o) => (
            <div key={o.id} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{o.orderNumber}</span>
                  <Badge color={ORDER_COLOR[o.status] ?? 'gray'}><span className="capitalize">{o.status}</span></Badge>
                </div>
                <span className="text-base font-bold text-stone-900">{naira(o.total)}</span>
              </div>
              <p className="mt-0.5 text-xs text-stone-400">
                {o.partner?.businessName || o.partner?.name || o.partner?.email || 'Partner'} · {formatDate(o.createdAt)}
              </p>
              <div className="mt-3 divide-y divide-stone-100 border-t border-stone-100 pt-2 text-sm">
                {o.lines.map((l, i) => (
                  <div key={i} className="py-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-700">{l.quantity}× {l.productName}</span>
                      <span className="text-stone-500">{naira(l.lineTotal)}</span>
                    </div>
                    {l.styles && l.styles.length > 0 && (
                      <p className="mt-0.5 text-xs text-stone-400">
                        {l.styleMode === 'auto' ? 'Auto-combined: ' : 'Per style: '}
                        {l.styles.map((s) => `${s.qty}× ${s.label || 'Style'}`).join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {o.note && <p className="mt-2 text-xs text-stone-500">Note: {o.note}</p>}
              {canEdit && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs font-medium text-stone-500">Status</span>
                  <Select value={o.status} onChange={(e) => setStatus.mutate({ id: o.id, status: e.target.value })} className="h-9 w-44">
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="fulfilled">Fulfilled</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-200 py-16 text-center text-sm text-stone-400">
          No {filter === 'all' ? '' : filter} orders yet.
        </p>
      )}
    </div>
  );
}

// ── Applications ──────────────────────────────────────────────────────────────

const APP_TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'all', label: 'All' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
] as const;

function ApplicationsTab() {
  const qc = useQueryClient();
  const { hasCap } = useAuth();
  const canEdit = hasCap('products.create_edit');
  const [filter, setFilter] = useState<(typeof APP_TABS)[number]['key']>('pending');

  const { data, isLoading } = useQuery({
    queryKey: ['partner-apps', filter],
    queryFn: () => api.get<{ pending: number; rows: Application[] }>(`/partnership/applications${filter === 'all' ? '' : `?status=${filter}`}`),
  });
  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) => api.put(`/partnership/applications/${id}`, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner-apps'] }),
  });
  const partnerAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'suspend' | 'activate' }) => api.put(`/partnership/partners/${id}`, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner-apps'] }),
  });
  const removePartner = useMutation({
    mutationFn: (id: string) => api.del(`/partnership/partners/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partner-apps'] }),
  });

  return (
    <div>
      <nav className="mb-4 flex flex-wrap gap-1">
        {APP_TABS.map((t) => (
          <button key={t.key} onClick={() => setFilter(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${filter === t.key ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
            {t.label}
          </button>
        ))}
      </nav>

      {isLoading ? <Spinner /> : data?.rows.length ? (
        <div className="space-y-3">
          {data.rows.map((a) => (
            <div key={a.id} className={`rounded-xl border bg-white p-4 ${a.status === 'pending' ? 'border-brand-300' : 'border-stone-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-stone-800">{a.businessName || a.name || 'Applicant'}</span>
                    {a.status === 'pending' && <Badge color="blue">Pending</Badge>}
                    {a.status === 'approved' && a.partnerStatus === 'active' && <Badge color="green">Active partner</Badge>}
                    {a.status === 'approved' && a.partnerStatus === 'suspended' && <Badge color="amber">Suspended</Badge>}
                    {a.status === 'approved' && !a.partnerId && <Badge color="gray">Removed</Badge>}
                    {a.status === 'rejected' && <Badge color="gray">Rejected</Badge>}
                    <span className="text-xs text-stone-400">{formatDate(a.createdAt)}</span>
                  </div>
                  {a.name && a.businessName && <p className="mt-0.5 text-sm text-stone-500">Contact: {a.name}</p>}
                  {a.note && <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600">{a.note}</p>}
                  {a.address && <p className="mt-1 text-xs text-stone-500">{a.address}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
                    <a href={`mailto:${a.email}`} className="inline-flex items-center gap-1 hover:text-brand-700 hover:underline"><Mail size={12} /> {a.email}</a>
                    {a.phone && <a href={`tel:${a.phone}`} className="inline-flex items-center gap-1 hover:text-brand-700 hover:underline"><Phone size={12} /> {a.phone}</a>}
                  </div>
                </div>
                {canEdit && a.status === 'pending' && (
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button size="sm" loading={review.isPending} onClick={() => review.mutate({ id: a.id, action: 'approve' })}><Check size={14} /> Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => review.mutate({ id: a.id, action: 'reject' })}>Reject</Button>
                  </div>
                )}
                {canEdit && a.status === 'approved' && a.partnerId && (
                  <div className="flex shrink-0 flex-col gap-2">
                    {a.partnerStatus === 'suspended' ? (
                      <Button size="sm" loading={partnerAction.isPending} onClick={() => partnerAction.mutate({ id: a.partnerId!, action: 'activate' })}>Reactivate</Button>
                    ) : (
                      <Button size="sm" variant="outline" loading={partnerAction.isPending} onClick={() => partnerAction.mutate({ id: a.partnerId!, action: 'suspend' })}>Suspend</Button>
                    )}
                    <Button size="sm" variant="danger" onClick={() => { if (confirm(`Remove ${a.businessName || a.email}'s partner account? They will lose portal access.`)) removePartner.mutate(a.partnerId!); }}>
                      <Trash2 size={13} /> Remove
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-200 py-16 text-center text-sm text-stone-400">
          No {filter === 'all' ? '' : filter} applications{filter === 'pending' ? ' right now' : ''}.
        </p>
      )}
    </div>
  );
}
