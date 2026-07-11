'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BackLink, Button, Card, Checkbox, ErrorNote, Field, Input, PageHeader, Select, Textarea } from '@/components/ui';

interface Category { id: string; name: string; parentId: string | null }

export default function NewPromotionPage() {
  const router = useRouter();
  const { hasCap } = useAuth();
  const [form, setForm] = useState({
    name: '', internalNote: '', mechanism: 'code', valueType: 'percent', valueAmount: '',
    scope: 'order', code: '', minSpend: '', minQty: '', firstOrderOnly: false,
    startsAt: '', endsAt: '', totalUses: '', perCustomerUses: '',
    exclusive: false, withProduct: true, allowBelowCost: false,
  });
  const [scopeItems, setScopeItems] = useState<{ kind: string; refId: string; label: string }[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<unknown>(null);

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories') });
  const { data: existingTags } = useQuery({ queryKey: ['customer-tags'], queryFn: () => api.get<{ tag: string; count: number }[]>('/customers/tags') });
  const { data: productResults } = useQuery({
    queryKey: ['promo-product-search', productSearch],
    queryFn: () => api.get<{ rows: { id: string; name: string }[] }>(`/products?q=${encodeURIComponent(productSearch)}`),
    enabled: productSearch.trim().length >= 2 && form.scope === 'products',
  });

  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>('/promotions', {
      name: form.name,
      internalNote: form.internalNote || undefined,
      mechanism: form.mechanism,
      valueType: form.valueType,
      valueAmount: form.valueType === 'percent' ? Number(form.valueAmount)
        : form.valueType === 'fixed' ? Math.round(Number(form.valueAmount) * 100)
        : null,
      scope: form.valueType === 'free_shipping' ? 'shipping' : form.scope,
      code: form.mechanism === 'code' ? form.code : undefined,
      conditions: {
        ...(form.startsAt || form.endsAt ? { schedule: {
          ...(form.startsAt ? { startsAt: new Date(form.startsAt).toISOString() } : {}),
          ...(form.endsAt ? { endsAt: new Date(form.endsAt).toISOString() } : {}),
        } } : {}),
        ...(form.minSpend ? { minSpend: Math.round(Number(form.minSpend) * 100) } : {}),
        ...(form.minQty ? { minQty: Number(form.minQty) } : {}),
        ...(form.firstOrderOnly ? { firstOrderOnly: true } : {}),
        ...(tags.length ? { tags } : {}),
      },
      limits: {
        ...(form.totalUses ? { totalUses: Number(form.totalUses) } : {}),
        ...(form.perCustomerUses ? { perCustomerUses: Number(form.perCustomerUses) } : {}),
      },
      combination: { exclusive: form.exclusive, withProduct: form.withProduct },
      allowBelowCost: form.allowBelowCost,
      scopeItems: scopeItems.map(({ kind, refId }) => ({ kind, refId })),
    }),
    onSuccess: (p) => router.push(`/discounts/${p.id}`),
    onError: setError,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <BackLink href="/discounts" label="Back to discounts" />
      <PageHeader title="New promotion" subtitle="Draft first — activate when ready" />
      <Card title="Mechanics">
        <div className="space-y-3">
          <Field label="Name (shown to customers on their order)"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Eid Fabric Flash — 20% off" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Mechanism">
              <Select value={form.mechanism} onChange={(e) => setForm({ ...form, mechanism: e.target.value })}>
                <option value="code">Coupon code</option>
                <option value="automatic">Automatic</option>
              </Select>
            </Field>
            <Field label="Value type">
              <Select value={form.valueType} onChange={(e) => setForm({ ...form, valueType: e.target.value })}>
                <option value="percent">Percent off</option>
                <option value="fixed">Fixed ₦ off</option>
                <option value="free_shipping">Free shipping</option>
              </Select>
            </Field>
            {form.valueType !== 'free_shipping' && (
              <Field label={form.valueType === 'percent' ? 'Percent (1–100)' : 'Amount (₦)'}>
                <Input type="number" value={form.valueAmount} onChange={(e) => setForm({ ...form, valueAmount: e.target.value })} />
              </Field>
            )}
          </div>
          {form.mechanism === 'code' && (
            <Field label="Code (3–20 chars, letters/digits/dash)"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="EID20" /></Field>
          )}
          {form.valueType !== 'free_shipping' && (
            <Field label="Scope">
              <Select value={form.scope} onChange={(e) => { setForm({ ...form, scope: e.target.value }); setScopeItems([]); }}>
                <option value="order">Whole order</option>
                <option value="categories">Specific categories</option>
                <option value="products">Specific products</option>
              </Select>
            </Field>
          )}
          {form.scope === 'categories' && (
            <div className="rounded-md border border-stone-100 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-stone-400">Included categories (children included)</p>
              <div className="flex flex-wrap gap-2">
                {categories?.map((c) => {
                  const selected = scopeItems.some((s) => s.refId === c.id && s.kind === 'category');
                  return (
                    <button key={c.id}
                      className={`rounded-md border px-2.5 py-1 text-sm cursor-pointer ${selected ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-stone-200'}`}
                      onClick={() => setScopeItems(selected
                        ? scopeItems.filter((s) => !(s.refId === c.id && s.kind === 'category'))
                        : [...scopeItems, { kind: 'category', refId: c.id, label: c.name }])}>
                      {c.parentId ? '— ' : ''}{c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {form.scope === 'products' && (
            <div className="rounded-md border border-stone-100 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-stone-400">Included products</p>
              <div className="relative">
                <Input placeholder="Search products…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
                {productResults && productSearch.trim().length >= 2 && (
                  <div className="absolute top-full z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white shadow-lg">
                    {productResults.rows.map((p) => (
                      <button key={p.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-stone-50 cursor-pointer"
                        onClick={() => {
                          if (!scopeItems.some((s) => s.refId === p.id)) setScopeItems([...scopeItems, { kind: 'product', refId: p.id, label: p.name }]);
                          setProductSearch('');
                        }}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {scopeItems.map((s) => (
                  <span key={s.refId} className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                    {s.label}
                    <button className="cursor-pointer" onClick={() => setScopeItems(scopeItems.filter((x) => x.refId !== s.refId))}>×</button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card title="Conditions, schedule & limits">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min spend (₦)"><Input type="number" value={form.minSpend} onChange={(e) => setForm({ ...form, minSpend: e.target.value })} /></Field>
          <Field label="Min quantity"><Input type="number" value={form.minQty} onChange={(e) => setForm({ ...form, minQty: e.target.value })} /></Field>
          <Field label="Starts"><Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></Field>
          <Field label="Ends"><Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></Field>
          <Field label="Total uses cap"><Input type="number" value={form.totalUses} onChange={(e) => setForm({ ...form, totalUses: e.target.value })} placeholder="unlimited" /></Field>
          <Field label="Uses per customer"><Input type="number" value={form.perCustomerUses} onChange={(e) => setForm({ ...form, perCustomerUses: e.target.value })} placeholder="unlimited" /></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-5">
          <Checkbox label="First order only" checked={form.firstOrderOnly} onChange={(e) => setForm({ ...form, firstOrderOnly: e.target.checked })} />
          <Checkbox label="Exclusive (combines with nothing)" checked={form.exclusive} onChange={(e) => setForm({ ...form, exclusive: e.target.checked })} />
          {hasCap('discounts.allow_below_cost') && (
            <Checkbox label="Allow below-cost pricing" checked={form.allowBelowCost} onChange={(e) => setForm({ ...form, allowBelowCost: e.target.checked })} />
          )}
        </div>
        <div className="mt-4 rounded-md border border-stone-100 p-3">
          <p className="mb-1 text-xs font-semibold uppercase text-stone-400">Customer targeting</p>
          <p className="mb-2 text-xs text-stone-400">Only customers carrying one of these tags can use the promotion. Leave empty to allow everyone. Tags are set on customer profiles (Customers → profile → Notes).</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((t) => (
              <span key={t} className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                {t}
                <button className="cursor-pointer" onClick={() => setTags(tags.filter((x) => x !== t))}>×</button>
              </span>
            ))}
            {existingTags?.filter((t) => !tags.includes(t.tag)).map((t) => (
              <button key={t.tag} className="rounded-full border border-stone-200 px-2 py-0.5 text-xs text-stone-500 hover:border-brand-400 hover:text-brand-700 cursor-pointer"
                onClick={() => setTags([...tags, t.tag])}>
                + {t.tag} ({t.count})
              </button>
            ))}
            <Input className="h-8 w-40 text-xs" placeholder="Add tag + Enter" value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const t = tagInput.trim().toLowerCase();
                  if (t && !tags.includes(t)) setTags([...tags, t]);
                  setTagInput('');
                }
              }} />
          </div>
        </div>
        <Textarea className="mt-3" rows={2} placeholder="Internal note (optional)" value={form.internalNote} onChange={(e) => setForm({ ...form, internalNote: e.target.value })} />
        <ErrorNote error={error} />
        <Button className="mt-3 w-full" loading={create.isPending} disabled={!form.name.trim()} onClick={() => create.mutate()}>
          Create draft promotion
        </Button>
      </Card>
    </div>
  );
}
