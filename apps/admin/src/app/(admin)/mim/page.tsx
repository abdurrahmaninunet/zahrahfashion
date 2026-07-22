'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, FileText, Plus, Shirt, ShoppingBag } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, Field, Input, PageHeader, Spinner, Table, Td, Textarea, statusColor } from '@/components/ui';
import { formatDate, naira, qty } from '@/lib/format';

interface ProductRow {
  id: string; name: string; slug: string; status: string;
  category: { id: string; name: string };
  priceMin: number | null; priceMax: number | null; totalStock: number; cover: string | null;
}
interface OrderRow {
  id: string; orderNumber: string; createdAt: string;
  customer: { fullName: string; primaryPhone: string } | null;
  itemsSummary: string; grandTotal: number | null; paymentStatus: string; status: string;
}

const TABS = [
  { key: 'products', label: 'Products', icon: Shirt },
  { key: 'content', label: 'Content', icon: FileText },
  { key: 'orders', label: 'Orders', icon: ShoppingBag },
] as const;

/** MIM back-office — the custom-printing store (a facet of the shared catalogue,
 *  marked flags.mim). Products tab is live; Content & Orders land next phase. */
export default function MimAdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('products');
  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <PageHeader title="MIM Store" subtitle="Custom printing — a separate storefront at /mim, same cart, email & Paystack" />
      <div className="flex flex-col gap-6 md:flex-row">
        <nav className="flex gap-1 overflow-x-auto md:w-48 md:shrink-0 md:flex-col">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                tab === t.key ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          {tab === 'products' && <MimProducts />}
          {tab === 'content' && <MimContent />}
          {tab === 'orders' && <MimOrders />}
        </div>
      </div>
    </div>
  );
}

function MimProducts() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['mim-products'],
    queryFn: () => api.get<{ rows: ProductRow[] }>('/products?store=mim'),
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-500">Products shown on the <b>/mim</b> store (marked &ldquo;MIM product&rdquo;).</p>
        <Link href="/products/new?store=mim"><Button><Plus size={15} /> Add product</Button></Link>
      </div>

      {isLoading ? (
        <Spinner />
      ) : data?.rows.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data.rows.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/products/${p.id}`)}
              className="group overflow-hidden rounded-lg border border-stone-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md cursor-pointer"
            >
              <div className="relative aspect-square overflow-hidden bg-stone-100">
                {p.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.cover} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-stone-200">{p.name.slice(0, 1).toUpperCase()}</div>
                )}
                {p.status !== 'active' && <span className="absolute left-1.5 top-1.5"><Badge color={statusColor(p.status)}>{p.status}</Badge></span>}
              </div>
              <div className="p-2.5">
                <p className="truncate text-sm font-medium" title={p.name}>{p.name}</p>
                <p className="truncate text-[11px] text-stone-400">{p.category.name}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm font-semibold">{p.priceMin == null ? '—' : naira(p.priceMin)}</span>
                  <span className={`text-xs ${p.totalStock <= 0 ? 'font-bold text-red-600' : 'text-stone-500'}`}>{qty(p.totalStock)} in stock</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Card>
          <div className="py-14 text-center">
            <Shirt size={28} className="mx-auto text-stone-300" />
            <p className="mt-3 font-medium text-stone-700">No MIM products yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
              Create a product (or open an existing one), then tick <b>&ldquo;MIM product&rdquo;</b> in its Details tab —
              it&apos;ll move to the /mim store and appear here.
            </p>
            <Link href="/products/new?store=mim" className="mt-4 inline-block"><Button><Plus size={15} /> Add product</Button></Link>
          </div>
        </Card>
      )}
    </div>
  );
}

function MimOrders() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['mim-orders'],
    queryFn: () => api.get<{ rows: OrderRow[] }>('/orders?store=mim'),
  });

  if (isLoading) return <Spinner />;
  if (!data?.rows.length) {
    return (
      <Card>
        <div className="py-14 text-center">
          <p className="font-medium text-stone-700">No MIM orders yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">Orders that include a MIM (printed) item will appear here — open one to see exactly what to print per piece.</p>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-stone-500">Orders containing MIM items — open one for the per-piece print details.</p>
      <Table headers={['Order', 'Customer', 'Items', 'Total', 'Payment', 'Status']}>
        {data.rows.map((o) => (
          <tr key={o.id} onClick={() => router.push(`/orders/${o.id}`)} className="cursor-pointer hover:bg-stone-50">
            <Td className="font-medium text-brand-700">{o.orderNumber}<span className="block text-[11px] font-normal text-stone-400">{formatDate(o.createdAt)}</span></Td>
            <Td>{o.customer?.fullName ?? '—'}<span className="block text-[11px] text-stone-400">{o.customer?.primaryPhone ?? ''}</span></Td>
            <Td className="max-w-xs truncate text-stone-500">{o.itemsSummary}</Td>
            <Td className="font-medium">{o.grandTotal == null ? '—' : naira(o.grandTotal)}</Td>
            <Td><Badge color={statusColor(o.paymentStatus)}>{o.paymentStatus.replace(/_/g, ' ')}</Badge></Td>
            <Td><Badge color={statusColor(o.status)}>{o.status.replace(/_/g, ' ')}</Badge></Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

interface MimContentData {
  enabled: boolean;
  ready: { title: string; subtitle: string; productIds: string[] };
  products: { id: string; name: string; image: string | null; price: number | null }[];
}

/** Content tab — master on/off switch for the MIM store + the homepage
 *  "ready to personalise" section (heading, subtitle, up to 3 featured products). */
function MimContent() {
  const { data, isLoading } = useQuery({ queryKey: ['mim-content'], queryFn: () => api.get<MimContentData>('/mim/content') });
  if (isLoading) return <Spinner />;
  if (!data) return null;
  return <MimContentForm initial={data} />;
}

function MimContentForm({ initial }: { initial: MimContentData }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [title, setTitle] = useState(initial.ready.title);
  const [subtitle, setSubtitle] = useState(initial.ready.subtitle);
  // Drop any stale ids that no longer resolve to a live MIM product.
  const [ids, setIds] = useState<string[]>(initial.ready.productIds.filter((id) => initial.products.some((p) => p.id === id)));

  const save = useMutation({
    mutationFn: () => api.put('/mim/content', { enabled, ready: { title, subtitle, productIds: ids } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mim-content'] }),
  });

  // Up to 3 featured products (shown on the homepage MIM band).
  const toggleProduct = (id: string) =>
    setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 3 ? cur : [...cur, id]));

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-stone-800">MIM store {enabled ? <Badge color="green">On</Badge> : <Badge color="gray">Off</Badge>}</p>
            <p className="mt-1 text-sm text-stone-500">
              When off, the <b>MIM</b> link is hidden from the storefront header, the homepage MIM section is hidden, and <b>/mim</b> shows an &ldquo;unavailable&rdquo; message.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${enabled ? 'bg-brand-600' : 'bg-stone-300'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </Card>

      <Card title="Homepage “ready to personalise” section">
        <div className="space-y-4">
          <Field label="Section heading"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ready to personalise" maxLength={120} /></Field>
          <Field label="Subtitle"><Textarea value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Add your name, your team, or your own design." rows={2} maxLength={240} /></Field>
          <div>
            <p className="mb-2 text-sm font-medium text-stone-700">
              Featured products <span className="font-normal text-stone-400">— pick up to 3 (shown on the homepage MIM band)</span>
            </p>
            {initial.products.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {initial.products.map((p) => {
                  const idx = ids.indexOf(p.id);
                  const selected = idx >= 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProduct(p.id)}
                      className={`group relative overflow-hidden rounded-lg border text-left transition-all cursor-pointer ${selected ? 'border-brand-500 ring-2 ring-brand-500' : 'border-stone-200 hover:border-brand-300'}`}
                    >
                      <div className="relative aspect-square bg-stone-100">
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-stone-200">{p.name.slice(0, 1).toUpperCase()}</div>
                        )}
                        {selected && <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{idx + 1}</span>}
                      </div>
                      <div className="p-2">
                        <p className="truncate text-xs font-medium" title={p.name}>{p.name}</p>
                        <p className="text-[11px] text-stone-400">{p.price == null ? '—' : naira(p.price)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-stone-200 py-8 text-center text-sm text-stone-400">
                No MIM products yet — add products and tick <b>&ldquo;MIM product&rdquo;</b> first.
              </p>
            )}
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save changes'}</Button>
        {save.isSuccess && <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600"><Check size={15} /> Saved</span>}
        {save.isError && <span className="text-sm text-red-600">Could not save — try again</span>}
      </div>
    </div>
  );
}
