'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, Plus, Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, ErrorNote, Field, Input, PageHeader, Spinner, statusColor } from '@/components/ui';
import { naira, nairaInput, toKobo } from '@/lib/format';

interface LefeRow { id: string; name: string; slug: string; status: string; priceMin: number | null; cover: string | null }
interface LefeDetail {
  id: string; name: string;
  attributeValues: Record<string, unknown>;
  bundleConfig: { fixedPrice: number | null } | null;
  bundleComponents: { variantId: string; quantity: string; variant: { price: number; product: { name: string } } }[];
  media: { url: string; sortOrder: number }[];
}
interface Component { variantId: string; quantity: number; label: string; price: number }

/** Lefe — bridal gift packages (a bundle of products sold as one). Each Lefe is a
 *  Lefe-flagged bundle in the "Lefe" category, shown on the /lefe storefront. */
export default function LefeAdminPage() {
  const [editing, setEditing] = useState<{ id: string | null } | null>(null); // null=list · {id:null}=new · {id}=edit
  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <PageHeader title="Lefe" subtitle="Bridal gift packages — bundle products into one, shown on the /lefe store" />
      {editing ? (
        <LefeForm id={editing.id} onClose={() => setEditing(null)} />
      ) : (
        <LefeList onNew={() => setEditing({ id: null })} onEdit={(id) => setEditing({ id })} />
      )}
    </div>
  );
}

function LefeList({ onNew, onEdit }: { onNew: () => void; onEdit: (id: string) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['lefe-list'],
    queryFn: () => api.get<{ rows: LefeRow[] }>('/products?store=lefe'),
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-500">Each Lefe appears as one product on the <b>/lefe</b> store — shoppers see what&apos;s inside and buy the set.</p>
        <Button onClick={onNew}><Plus size={15} /> Create Lefe</Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : data?.rows.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data.rows.map((p) => (
            <button key={p.id} onClick={() => onEdit(p.id)}
              className="group overflow-hidden rounded-lg border border-stone-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md cursor-pointer">
              <div className="relative aspect-square overflow-hidden bg-stone-100">
                {p.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.cover} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-stone-200"><Gift size={40} /></div>
                )}
                {p.status !== 'active' && <span className="absolute left-1.5 top-1.5"><Badge color={statusColor(p.status)}>{p.status}</Badge></span>}
              </div>
              <div className="p-2.5">
                <p className="truncate text-sm font-medium" title={p.name}>{p.name}</p>
                <p className="text-sm font-semibold">{p.priceMin == null ? '—' : naira(p.priceMin)}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Card>
          <div className="py-14 text-center">
            <Gift size={28} className="mx-auto text-stone-300" />
            <p className="mt-3 font-medium text-stone-700">No Lefe yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">Create a Lefe — pick the products that go inside, set a package price, and it&apos;ll appear on the /lefe store.</p>
            <Button className="mt-4" onClick={onNew}><Plus size={15} /> Create Lefe</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function LefeForm({ id, onClose }: { id: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [compareAt, setCompareAt] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(id === null);

  // Prefill when editing.
  useQuery({
    queryKey: ['lefe-detail', id],
    queryFn: async () => {
      const d = await api.get<LefeDetail>(`/products/${id}`);
      setName(d.name);
      setPrice(nairaInput(d.bundleConfig?.fixedPrice ?? null));
      setCompareAt(nairaInput((d.attributeValues?._lefeCompareAt as number) || null));
      setCoverUrl([...d.media].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.url ?? null);
      setComponents(d.bundleComponents.map((c) => ({ variantId: c.variantId, quantity: Number(c.quantity), label: c.variant.product.name, price: c.variant.price })));
      setLoaded(true);
      return d;
    },
    enabled: id !== null,
  });

  const { data: searchResults } = useQuery({
    queryKey: ['lefe-search', search],
    queryFn: () => api.get<{ rows: { id: string; name: string }[] }>(`/products?q=${encodeURIComponent(search)}&status=active&type=standard`),
    enabled: search.trim().length >= 2,
  });

  async function addProduct(productId: string) {
    setSearch('');
    const detail = await api.get<{ name: string; variants: { id: string; price: number; status: string }[] }>(`/products/${productId}`);
    const variant = detail.variants.find((v) => v.status === 'active');
    if (variant && !components.some((c) => c.variantId === variant.id)) {
      setComponents([...components, { variantId: variant.id, quantity: 1, label: detail.name, price: variant.price }]);
    }
  }

  async function uploadCover(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('baseAlt', name || 'Lefe');
      const asset = await api.postForm<{ url: string }>('/content/media', form);
      setCoverUrl(asset.url);
    } catch (e) { setError(e); } finally { setUploading(false); }
  }

  const componentSum = components.reduce((s, c) => s + Math.round(c.price * c.quantity), 0);
  const priceKobo = toKobo(price || 0);
  const compareKobo = toKobo(compareAt || 0);

  const save = useMutation({
    mutationFn: () => api.post<{ id: string }>('/products/lefe', {
      ...(id ? { id } : {}),
      name,
      price: priceKobo,
      compareAt: compareKobo > 0 ? compareKobo : null,
      coverUrl: coverUrl ?? null,
      components: components.map((c) => ({ variantId: c.variantId, quantity: c.quantity })),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lefe-list'] });
      onClose();
    },
    onError: setError,
  });

  const canSave = name.trim().length > 0 && components.length >= 2 && priceKobo > 0;

  if (!loaded) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <button onClick={onClose} className="text-sm font-medium text-brand-700 hover:underline cursor-pointer">← Back to Lefe</button>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Package">
          <div className="space-y-3">
            <Field label="Lefe name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bridal Lefe — Deluxe" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Package price (₦)" hint="What the shopper pays"><Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
              <Field label="Compare-at (₦)" hint="Optional — shown struck-through"><Input type="number" min="0" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} /></Field>
            </div>
            {compareKobo > 0 && compareKobo <= priceKobo && <p className="text-xs text-amber-600">Compare-at should be higher than the price to show a discount.</p>}

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">Cover image</p>
              <div className="flex items-center gap-3">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                  {coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : <div className="flex h-full w-full items-center justify-center text-stone-300"><Gift size={26} /></div>}
                </div>
                <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:border-stone-500">
                  <Upload size={15} /> {uploading ? 'Uploading…' : coverUrl ? 'Replace' : 'Upload cover'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { uploadCover(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
              </div>
            </div>
          </div>
        </Card>

        <Card title={`What's inside (${components.length})`}>
          <div className="relative mb-3">
            <Input placeholder="Search products to add…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {searchResults && search.trim().length >= 2 && (
              <div className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg">
                {searchResults.rows.length ? searchResults.rows.map((p) => (
                  <button key={p.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-stone-50 cursor-pointer" onClick={() => addProduct(p.id)}>{p.name}</button>
                )) : <p className="px-3 py-2 text-sm text-stone-400">No products found</p>}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {components.map((c, i) => (
              <div key={c.variantId} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{c.label}</span>
                <Input type="number" min="1" className="w-16" value={c.quantity}
                  onChange={(e) => setComponents(components.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x)))} />
                <span className="w-20 text-right text-stone-500">{naira(Math.round(c.price * c.quantity))}</span>
                <button className="text-stone-400 hover:text-red-600 cursor-pointer" onClick={() => setComponents(components.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
              </div>
            ))}
            {components.length < 2 && <p className="py-3 text-center text-sm text-stone-400">Add at least 2 products</p>}
          </div>
          {components.length > 0 && (
            <div className="mt-3 border-t border-stone-100 pt-2 text-sm">
              <div className="flex justify-between text-stone-500"><span>Items worth</span><span>{naira(componentSum)}</span></div>
              {priceKobo > 0 && <div className="flex justify-between font-medium"><span>Package price</span><span>{naira(priceKobo)}</span></div>}
            </div>
          )}
        </Card>
      </div>

      <ErrorNote error={error} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button className="min-w-40" loading={save.isPending} disabled={!canSave} onClick={() => save.mutate()}>
          {id ? 'Save Lefe' : 'Create Lefe'}
        </Button>
      </div>
    </div>
  );
}
