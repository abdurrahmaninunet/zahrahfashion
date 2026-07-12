'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, ImageIcon, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, Dialog, ErrorNote, Field, Input, PageHeader, Spinner, Table, Tabs, Td, Textarea, statusColor } from '@/components/ui';

interface ContentItem {
  id: string; type: string; sectionKey: string | null; title: string; status: string;
  slug: string | null; systemKey: string | null; fields: Record<string, unknown>; updatedAt: string;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Ensure a section item is part of the homepage composition (appends if absent). */
async function ensureInComposition(id: string) {
  const comp = await api.get<{ sections: { contentItem: { id: string }; sortOrder: number }[] }>('/content/composition/homepage');
  const ids = [...comp.sections].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.contentItem.id);
  if (!ids.includes(id)) await api.put('/content/composition/homepage', { contentItemIds: [...ids, id] });
}

/** Create-or-update the single section for a given key, publish it, and add to the homepage. */
async function saveSection(existing: ContentItem | undefined, sectionKey: string, title: string, fields: Record<string, unknown>) {
  let id = existing?.id;
  if (id) {
    await api.put(`/content/items/${id}`, { title: existing!.title || title, fields, startsAt: null, endsAt: null });
  } else {
    const created = await api.post<{ id: string }>('/content/items', { type: 'section', sectionKey, title, fields, startsAt: null, endsAt: null });
    id = created.id;
  }
  await ensureInComposition(id); // wire into the homepage first…
  await api.post(`/content/items/${id}/publish`); // …then publish (surfaces validation errors)
}

function useSectionItem(sectionKey: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['content-items', 'section'],
    queryFn: () => api.get<ContentItem[]>('/content/items?type=section'),
  });
  const { data: comp } = useQuery({
    queryKey: ['content-composition'],
    queryFn: () => api.get<{ sections: { contentItem: ContentItem }[] }>('/content/composition/homepage'),
  });
  // Prefer the item actually wired into the homepage — that's what the storefront
  // serves — so edits always land on the live section, not a stray draft/duplicate.
  const served = comp?.sections
    .map((s) => s.contentItem)
    .find((ci) => ci && ci.sectionKey === sectionKey && ci.status !== 'archived');
  const item = served ?? data?.find((i) => i.sectionKey === sectionKey && i.status !== 'archived');
  return { item, isLoading, ready: !!data && !!comp };
}

// ── Page shell ────────────────────────────────────────────────────────────────

function ContentPageInner() {
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') ?? 'hero');
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Content" subtitle="The homepage as your shoppers see it — hero, deals, pages and media" />
      <Tabs
        tabs={[
          { key: 'hero', label: 'Hero slider' },
          { key: 'deals', label: "Today's Deals" },
          { key: 'pages', label: 'Pages' },
          { key: 'media', label: 'Media library' },
        ]}
        active={tab}
        onChange={setTab}
      />
      <div className="mt-4">
        {tab === 'hero' && <HeroSliderTab />}
        {tab === 'deals' && <TodaysDealsTab />}
        {tab === 'pages' && <PagesTab />}
        {tab === 'media' && <MediaTab />}
      </div>
    </div>
  );
}

export default function ContentPage() {
  return <Suspense fallback={<Spinner />}><ContentPageInner /></Suspense>;
}

// ── Hero slider editor ────────────────────────────────────────────────────────

interface Slide { image: string; headline: string; subtext: string; ctaLabel: string; link: string }
const EMPTY_SLIDE: Slide = { image: '', headline: '', subtext: '', ctaLabel: '', link: '' };

/** The stored hero schema uses a "link" field ({ url }); the editor uses a plain
 *  string, so convert on load/save (and tolerate legacy string links). */
function fromStoredSlide(s: Record<string, unknown>): Slide {
  const link = s.link;
  const url = typeof link === 'string' ? link : link && typeof link === 'object' ? String((link as { url?: unknown }).url ?? '') : '';
  return {
    image: String(s.image ?? ''), headline: String(s.headline ?? ''),
    subtext: String(s.subtext ?? ''), ctaLabel: String(s.ctaLabel ?? ''), link: url,
  };
}
function toSlidePayload(s: Slide) {
  return {
    image: s.image, headline: s.headline, subtext: s.subtext, ctaLabel: s.ctaLabel,
    ...(s.link.trim() ? { link: { url: s.link.trim() } } : {}),
  };
}

function HeroSliderTab() {
  const queryClient = useQueryClient();
  const { item, isLoading, ready } = useSectionItem('hero_slider');
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pickFor, setPickFor] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!ready || loaded) return;
    setSlides(((item?.fields.slides as Record<string, unknown>[]) ?? []).map(fromStoredSlide));
    setLoaded(true);
  }, [ready, loaded, item]);

  const save = useMutation({
    mutationFn: () => saveSection(item, 'hero_slider', 'Hero slider', { slides: slides.map(toSlidePayload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-items', 'section'] });
      queryClient.invalidateQueries({ queryKey: ['content-composition'] });
    },
    onError: setError,
  });

  const update = (i: number, patch: Partial<Slide>) => setSlides((s) => s.map((sl, idx) => (idx === i ? { ...sl, ...patch } : sl)));
  const move = (i: number, dir: -1 | 1) => setSlides((s) => {
    const next = [...s]; const t = i + dir;
    if (t < 0 || t >= next.length) return s;
    [next[i], next[t]] = [next[t], next[i]];
    return next;
  });

  if (isLoading) return <Spinner />;

  const invalid = slides.some((s) => !s.image || !s.headline.trim());

  return (
    <div className="space-y-4">
      <Card
        title="Hero slides (top of the homepage)"
        action={<Button size="sm" variant="outline" onClick={() => setSlides((s) => [...s, { ...EMPTY_SLIDE }])}><Plus size={14} /> Add slide</Button>}
      >
        <p className="mb-3 text-xs text-stone-400">Each slide rotates full-width. Image and headline are required.</p>
        <div className="space-y-4">
          {slides.map((slide, i) => (
            <div key={i} className="grid gap-3 rounded-lg border border-stone-200 p-3 sm:grid-cols-[140px_1fr]">
              {/* Image */}
              <div>
                <button
                  type="button"
                  onClick={() => setPickFor(i)}
                  className="media-thumb group relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-stone-300 bg-stone-50 text-stone-400 hover:border-brand-500"
                >
                  {slide.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={slide.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-xs"><ImageIcon size={20} /> Choose image</span>
                  )}
                </button>
              </div>
              {/* Fields */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <Input placeholder="Headline" value={slide.headline} onChange={(e) => update(i, { headline: e.target.value })} />
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button className="rounded p-1.5 text-stone-400 hover:bg-stone-100 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
                    <button className="rounded p-1.5 text-stone-400 hover:bg-stone-100 disabled:opacity-30" disabled={i === slides.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
                    <button className="rounded p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600" onClick={() => setSlides((s) => s.filter((_, idx) => idx !== i))}><Trash2 size={15} /></button>
                  </div>
                </div>
                <Input placeholder="Subtext (optional)" value={slide.subtext} onChange={(e) => update(i, { subtext: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Button label (e.g. Shop now)" value={slide.ctaLabel} onChange={(e) => update(i, { ctaLabel: e.target.value })} />
                  <Input placeholder="Link (e.g. /c/laces)" value={slide.link} onChange={(e) => update(i, { link: e.target.value })} />
                </div>
              </div>
            </div>
          ))}
          {!slides.length && <p className="py-8 text-center text-sm text-stone-400">No slides yet — add one to build your hero.</p>}
        </div>
      </Card>

      <ErrorNote error={error} />
      <div className="flex items-center gap-3">
        <Button loading={save.isPending} disabled={invalid} onClick={() => save.mutate()}>Save &amp; publish</Button>
        {item && <Badge color={statusColor(item.status)}>{item.status}</Badge>}
        {invalid && <span className="text-xs text-amber-600">Every slide needs an image and a headline.</span>}
        {save.isSuccess && !save.isPending && <span className="text-xs text-emerald-600">Saved ✓</span>}
      </div>

      {pickFor !== null && (
        <MediaPickerDialog
          onClose={() => setPickFor(null)}
          onPick={(url) => { update(pickFor, { image: url }); setPickFor(null); }}
        />
      )}
    </div>
  );
}

// ── Today's Deals editor ──────────────────────────────────────────────────────

interface ProductRef { id: string; name: string }

function TodaysDealsTab() {
  const queryClient = useQueryClient();
  const { item, isLoading, ready } = useSectionItem('todays_deals');
  const [menTitle, setMenTitle] = useState('Men');
  const [womenTitle, setWomenTitle] = useState('Women');
  const [men, setMen] = useState<ProductRef[]>([]);
  const [women, setWomen] = useState<ProductRef[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Load existing config + resolve product ids → names.
  useEffect(() => {
    if (!ready || loaded) return;
    const f = (item?.fields ?? {}) as { menTitle?: string; womenTitle?: string; menProducts?: string[]; womenProducts?: string[] };
    setMenTitle(f.menTitle ?? 'Men');
    setWomenTitle(f.womenTitle ?? 'Women');
    (async () => {
      const resolve = async (ids?: string[]): Promise<ProductRef[]> => {
        const out: ProductRef[] = [];
        for (const id of (ids ?? []).slice(0, 3)) {
          try {
            const p = await api.get<{ name: string }>(`/products/${id}`);
            out.push({ id, name: p.name });
          } catch { out.push({ id, name: '(missing product)' }); }
        }
        return out;
      };
      setMen(await resolve(f.menProducts));
      setWomen(await resolve(f.womenProducts));
      setLoaded(true);
    })();
  }, [ready, loaded, item]);

  const save = useMutation({
    mutationFn: () => saveSection(item, 'todays_deals', "Today's Deals", {
      menTitle, womenTitle,
      menProducts: men.map((p) => p.id),
      womenProducts: women.map((p) => p.id),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['content-items', 'section'] }),
    onError: setError,
  });

  if (isLoading || !loaded) return <Spinner />;

  const bothEmpty = men.length === 0 && women.length === 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <DealPanelEditor label="Left panel" title={menTitle} setTitle={setMenTitle} products={men} setProducts={setMen} />
        <DealPanelEditor label="Right panel" title={womenTitle} setTitle={setWomenTitle} products={women} setProducts={setWomen} />
      </div>
      <ErrorNote error={error} />
      <div className="flex items-center gap-3">
        <Button loading={save.isPending} onClick={() => save.mutate()}>Save &amp; publish</Button>
        {item && <Badge color={statusColor(item.status)}>{item.status}</Badge>}
        {bothEmpty && <span className="text-xs text-stone-500">No products — Today&apos;s Deals will be hidden on the storefront.</span>}
        {save.isSuccess && !save.isPending && <span className="text-xs text-emerald-600">Saved ✓</span>}
      </div>
    </div>
  );
}

function DealPanelEditor({ label, title, setTitle, products, setProducts }: {
  label: string; title: string; setTitle: (v: string) => void; products: ProductRef[]; setProducts: (v: ProductRef[]) => void;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <Card title={label}>
      <Field label="Panel title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Men" /></Field>
      <p className="mb-2 mt-3 text-xs font-medium text-stone-500">Products (up to 3)</p>
      <div className="space-y-2">
        {products.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-2 text-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-stone-100 text-xs font-semibold text-stone-500">{i + 1}</span>
            <span className="flex-1 truncate">{p.name}</span>
            <button className="text-stone-400 hover:text-red-600" onClick={() => setProducts(products.filter((x) => x.id !== p.id))}><X size={15} /></button>
          </div>
        ))}
        {products.length < 3 && (
          <Button size="sm" variant="outline" onClick={() => setPicking(true)}><Plus size={14} /> Add product</Button>
        )}
      </div>
      {picking && (
        <ProductPickerDialog
          onClose={() => setPicking(false)}
          exclude={products.map((p) => p.id)}
          onPick={(p) => { setProducts([...products, p]); setPicking(false); }}
        />
      )}
    </Card>
  );
}

// ── Pickers ───────────────────────────────────────────────────────────────────

function ProductPickerDialog({ onPick, onClose, exclude }: { onPick: (p: ProductRef) => void; onClose: () => void; exclude: string[] }) {
  const [q, setQ] = useState('');
  const { data, isFetching } = useQuery({
    queryKey: ['product-picker', q],
    queryFn: () => api.get<{ rows: { id: string; name: string }[] }>(`/products?q=${encodeURIComponent(q)}&status=active`),
  });
  return (
    <Dialog open onClose={onClose} title="Add a product">
      <div className="flex items-center gap-2 rounded-md border border-stone-300 px-3">
        <Search size={16} className="text-stone-400" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="h-10 w-full bg-transparent text-sm outline-none" />
      </div>
      <div className="mt-2 max-h-72 overflow-y-auto">
        {isFetching && <p className="py-6 text-center text-sm text-stone-400">Searching…</p>}
        {data?.rows.map((p) => (
          <button
            key={p.id}
            disabled={exclude.includes(p.id)}
            onClick={() => onPick({ id: p.id, name: p.name })}
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-stone-50 disabled:opacity-40"
          >
            <span className="truncate">{p.name}</span>
            {exclude.includes(p.id) ? <Check size={15} className="text-emerald-500" /> : <Plus size={15} className="text-stone-400" />}
          </button>
        ))}
        {data && !data.rows.length && <p className="py-6 text-center text-sm text-stone-400">No products found.</p>}
      </div>
    </Dialog>
  );
}

function MediaPickerDialog({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [error, setError] = useState<unknown>(null);
  const { data, isFetching } = useQuery({
    queryKey: ['media', q],
    queryFn: () => api.get<{ rows: { id: string; url: string; filename: string }[] }>(`/content/media?q=${encodeURIComponent(q)}`),
  });
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        await api.postForm('/content/media', form);
      }
      queryClient.invalidateQueries({ queryKey: ['media'] });
    } catch (e) { setError(e); }
  }
  return (
    <Dialog open onClose={onClose} title="Choose an image" wide>
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search filename…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Upload size={15} /> Upload
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        </label>
      </div>
      <ErrorNote error={error} />
      <div className="mt-3 grid max-h-80 grid-cols-3 gap-2 overflow-y-auto md:grid-cols-5">
        {isFetching && <p className="col-span-full py-6 text-center text-sm text-stone-400">Loading…</p>}
        {data?.rows.map((asset) => (
          <button key={asset.id} onClick={() => onPick(asset.url)} className="group overflow-hidden rounded-md border border-stone-200 hover:border-brand-500">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset.url} alt={asset.filename} className="aspect-square w-full object-cover" />
          </button>
        ))}
        {data && !data.rows.length && <p className="col-span-full py-6 text-center text-sm text-stone-400">No media yet — upload an image.</p>}
      </div>
    </Dialog>
  );
}

// ── Pages ─────────────────────────────────────────────────────────────────────

function PagesTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ContentItem | 'new' | null>(null);
  const { data: items, isLoading } = useQuery({
    queryKey: ['content-items', 'page'],
    queryFn: () => api.get<ContentItem[]>('/content/items?type=page'),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['content-items', 'page'] });

  if (isLoading) return <Spinner />;
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setEditing('new')}><Plus size={14} /> New page</Button></div>
      <Table headers={['Title', 'Slug', 'Status']} empty="No pages yet">
        {items?.filter((i) => i.status !== 'archived').map((item) => (
          <tr key={item.id} className="cursor-pointer hover:bg-stone-50" onClick={() => setEditing(item)}>
            <Td className="font-medium">{item.title}{item.systemKey ? <Badge color="blue">system</Badge> : null}</Td>
            <Td className="text-stone-500">/{item.slug}</Td>
            <Td><Badge color={statusColor(item.status)}>{item.status}</Badge></Td>
          </tr>
        ))}
      </Table>
      {editing && <PageEditor item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); invalidate(); }} />}
    </div>
  );
}

function PageEditor({ item, onClose, onSaved }: { item: ContentItem | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [body, setBody] = useState((item?.fields?.body as string) ?? '');
  const [error, setError] = useState<unknown>(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { title, fields: { body }, startsAt: null, endsAt: null };
      const id = item ? item.id : (await api.post<{ id: string }>('/content/items', { type: 'page', ...payload })).id;
      if (item) await api.put(`/content/items/${id}`, payload);
      await api.post(`/content/items/${id}/publish`).catch(() => {});
    },
    onSuccess: onSaved,
    onError: setError,
  });

  return (
    <Dialog open onClose={onClose} title={item ? `Edit: ${item.title}` : 'New page'} wide>
      <div className="space-y-3">
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Body (rich text, sanitized server-side)">
          <Textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} placeholder="<h2>Heading</h2><p>Your content…</p>" />
        </Field>
        <ErrorNote error={error} />
        <Button loading={save.isPending} disabled={!title.trim()} onClick={() => save.mutate()}>Save &amp; publish</Button>
        {item?.systemKey && ['returns-policy', 'privacy-policy', 'terms-of-service', 'delivery-information'].includes(item.systemKey) && (
          <p className="text-xs text-amber-600">Policy page — publishing requires Manager/Owner.</p>
        )}
      </div>
    </Dialog>
  );
}

// ── Media library ─────────────────────────────────────────────────────────────

function MediaTab() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [error, setError] = useState<unknown>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['media', q],
    queryFn: () => api.get<{ rows: { id: string; url: string; filename: string; width: number | null; height: number | null; _count: { usages: number }; renditions: { width: number }[] }[] }>(`/content/media?q=${encodeURIComponent(q)}`),
  });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        await api.postForm('/content/media', form);
      }
      queryClient.invalidateQueries({ queryKey: ['media'] });
    } catch (e) { setError(e); }
  }

  if (isLoading) return <Spinner />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Search filename…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Upload size={15} /> Upload
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        </label>
      </div>
      <ErrorNote error={error} />
      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {data?.rows.map((asset) => (
          <div key={asset.id} className="group relative overflow-hidden rounded-lg border border-stone-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset.url} alt={asset.filename} className="aspect-square w-full object-cover" />
            <div className="p-1.5">
              <p className="truncate text-xs">{asset.filename}</p>
              <p className="text-[10px] text-stone-400">{asset.width}×{asset.height} · used {asset._count.usages}×</p>
            </div>
            <button
              className="absolute right-1 top-1 hidden cursor-pointer rounded bg-red-600 p-1 text-white group-hover:block"
              onClick={async () => {
                try { await api.del(`/content/media/${asset.id}`); queryClient.invalidateQueries({ queryKey: ['media'] }); } catch (e) { setError(e); }
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
      {!data?.rows.length && <p className="py-10 text-center text-sm text-stone-400">No media yet — upload product and banner images here</p>}
    </div>
  );
}
