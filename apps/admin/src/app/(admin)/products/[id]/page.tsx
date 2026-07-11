'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { naira, nairaInput, qty, toKobo } from '@/lib/format';
import { BackLink, Badge, Button, Card, Checkbox, Dialog, ErrorNote, Field, Input, Select, Spinner, Tabs, Textarea, statusColor } from '@/components/ui';

interface Variant { id: string; name: string | null; sku: string; barcode: string | null; optionValues: Record<string, string>; price: number; compareAtPrice: number | null; costPrice: number | null; status: string; stockLevels: { onHand: string; reserved: string }[] }
interface ProductDetail {
  id: string; name: string; slug: string; brand: string | null; description: string | null;
  type: string; status: string; visibility: string; tags: string[];
  attributeValues: Record<string, unknown>; flags: Record<string, boolean> | null;
  minOrderQty: string | null; qtyIncrement: string | null;
  category: {
    id: string; name: string;
    attributes: { isRequired: boolean; attribute: { id: string; name: string; code: string; inputType: string; isVariantDefining: boolean; options: { label: string; value: string; status: string }[] } }[];
  };
  variants: Variant[];
  media: { id: string; url: string; altText: string | null; sortOrder: number }[];
  bundleConfig: { pricingMode: string; fixedPrice: number | null; percentOff: string | null; maxSellable: number | null; soldCount: number; eligibleForPromotions: boolean; allowBelowCost: boolean; returnMode: string } | null;
  bundleComponents: { id: string; variantId: string; quantity: string; variant: { sku: string; price: number; product: { name: string } } }[];
}

export default function ProductEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasCap } = useAuth();
  const [tab, setTab] = useState('details');
  const [error, setError] = useState<unknown>(null);
  const [confirmingDraftDelete, setConfirmingDraftDelete] = useState(false);

  const deleteDraft = useMutation({
    mutationFn: () => api.del(`/products/${id}/permanent`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      router.push('/products');
    },
    onError: (err) => { setConfirmingDraftDelete(false); setError(err); },
  });

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get<ProductDetail>(`/products/${id}`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['product', id] });

  const act = useMutation({
    mutationFn: ({ method, path, body }: { method: 'post' | 'put' | 'del'; path: string; body?: unknown }) =>
      method === 'post' ? api.post(path, body) : method === 'put' ? api.put(path, body) : api.del(path),
    onSuccess: () => { setError(null); invalidate(); },
    onError: setError,
  });

  if (isLoading || !product) return <Spinner />;

  const isMim = !!product.flags?.mim;
  const tabs = [
    { key: 'details', label: 'Details' },
    { key: 'variants', label: `Variants (${product.variants.length})` },
    { key: 'media', label: `Media (${product.media.length})` },
    ...(isMim ? [{ key: 'mim', label: 'MIM' }] : []),
    ...(product.type !== 'standard' ? [{ key: 'bundle', label: 'Bundle' }] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <BackLink href="/products" label="Back to products" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{product.name}</h1>
            <Badge color={statusColor(product.status)}>{product.status}</Badge>
            {product.type !== 'standard' && <Badge color="purple">{product.type}</Badge>}
          </div>
          <p className="text-sm text-stone-500">{product.category.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {product.status === 'draft' && hasCap('products.create_edit') && (
            <Button size="sm" onClick={() => act.mutate({ method: 'post', path: `/products/${id}/activate` })} loading={act.isPending}>
              Activate
            </Button>
          )}
          {product.status === 'draft' && hasCap('products.archive') && (
            <button
              aria-label="Delete draft"
              title="Delete draft permanently"
              className="rounded p-2 text-stone-300 hover:bg-red-50 hover:text-red-600 cursor-pointer"
              onClick={() => setConfirmingDraftDelete(true)}
            >
              <Trash2 size={16} />
            </button>
          )}
          {product.status === 'active' && hasCap('products.archive') && (
            <Button size="sm" variant="outline" onClick={() => act.mutate({ method: 'del', path: `/products/${id}` })}>Archive</Button>
          )}
          {product.status === 'archived' && hasCap('products.archive') && (
            <Button size="sm" onClick={() => act.mutate({ method: 'post', path: `/products/${id}/restore` })} loading={act.isPending}>
              Restore
            </Button>
          )}
        </div>
      </div>
      <ErrorNote error={error} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {confirmingDraftDelete && (
        <Dialog open onClose={() => setConfirmingDraftDelete(false)} title="Delete draft">
          <div className="space-y-4">
            <p className="text-sm text-stone-600">
              Permanently delete the draft <b>{product.name}</b>? This cannot be undone.
            </p>
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Drafts that already have stock or order history can't be deleted — you'll be asked to archive instead.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmingDraftDelete(false)}>Cancel</Button>
              <Button variant="danger" loading={deleteDraft.isPending} onClick={() => deleteDraft.mutate()}>Delete draft</Button>
            </div>
          </div>
        </Dialog>
      )}

      {tab === 'details' && <DetailsTab product={product} onSave={(body) => act.mutate({ method: 'put', path: `/products/${id}`, body })} saving={act.isPending} onGoToVariants={() => setTab('variants')} />}
      {tab === 'variants' && <VariantsTab product={product} act={act} canPrice={hasCap('products.set_prices')} canCosts={hasCap('products.view_costs')} onRefresh={invalidate} />}
      {tab === 'media' && <MediaTab product={product} onSaved={invalidate} setError={setError} />}
      {tab === 'mim' && <MimTab product={product} onSave={(body) => act.mutate({ method: 'put', path: `/products/${id}`, body })} saving={act.isPending} />}
      {tab === 'bundle' && <BundleTab product={product} act={act} />}
    </div>
  );
}

type ActM = { mutate: (args: { method: 'post' | 'put' | 'del'; path: string; body?: unknown }) => void; isPending: boolean };

function DetailsTab({ product, onSave, saving, onGoToVariants }: { product: ProductDetail; onSave: (body: Record<string, unknown>) => void; saving: boolean; onGoToVariants: () => void }) {
  const [form, setForm] = useState({
    name: product.name,
    brand: product.brand ?? '',
    description: product.description ?? '',
    visibility: product.visibility,
    tags: product.tags.join(', '),
    minOrderQty: product.minOrderQty ?? '1',
    qtyIncrement: product.qtyIncrement ?? '1',
  });
  const [attributeValues, setAttributeValues] = useState(product.attributeValues);
  const [flags, setFlags] = useState<Record<string, boolean>>((product.flags as Record<string, boolean>) ?? {});
  const [newDetail, setNewDetail] = useState({ name: '', value: '' });

  // Free-form custom details (name/value) stored under the reserved "_custom" key.
  const customDetails = (Array.isArray(attributeValues._custom) ? attributeValues._custom : []) as { name: string; value: unknown }[];

  function addCustomDetail() {
    const name = newDetail.name.trim();
    const value = newDetail.value.trim();
    if (!name || !value) return;
    setAttributeValues({ ...attributeValues, _custom: [...customDetails, { name, value }] });
    setNewDetail({ name: '', value: '' });
  }
  function removeCustomDetail(index: number) {
    const next = customDetails.filter((_, i) => i !== index);
    setAttributeValues({ ...attributeValues, _custom: next.length ? next : undefined });
  }

  // Wholesale config (reserved "_wholesale" key). Price edited in naira. The
  // increment is the quantity step shoppers buy wholesale in (also the minimum).
  const initialWholesale = (attributeValues._wholesale ?? null) as { enabled?: boolean; increment?: number; unitPrice?: number; note?: string } | null;
  const [wholesaleEnabled, setWholesaleEnabled] = useState(!!initialWholesale?.enabled);
  const [wholesaleIncrement, setWholesaleIncrement] = useState(initialWholesale?.increment ? String(initialWholesale.increment) : '');
  const [wholesalePrice, setWholesalePrice] = useState(nairaInput(initialWholesale?.unitPrice));
  const [wholesaleNote, setWholesaleNote] = useState(initialWholesale?.note ?? '');

  function buildWholesale() {
    const increment = Math.round(Number(wholesaleIncrement));
    const unitPrice = toKobo(wholesalePrice);
    const valid = increment > 0 && unitPrice > 0;
    return {
      enabled: wholesaleEnabled && valid,
      increment: valid ? increment : 0,
      unitPrice: valid ? unitPrice : 0,
      ...(wholesaleNote.trim() ? { note: wholesaleNote.trim() } : {}),
    };
  }

  // Anko config (reserved "_anko") — cheapest bulk tier for group/event buys +
  // an exclusivity period (days) that locks the fabric's bulk to the buyer.
  const initialAnko = (attributeValues._anko ?? null) as { enabled?: boolean; increment?: number; unitPrice?: number; exclusivityDays?: number; note?: string } | null;
  const [ankoEnabled, setAnkoEnabled] = useState(!!initialAnko?.enabled);
  const [ankoIncrement, setAnkoIncrement] = useState(initialAnko?.increment ? String(initialAnko.increment) : '');
  const [ankoPrice, setAnkoPrice] = useState(nairaInput(initialAnko?.unitPrice));
  const [ankoDays, setAnkoDays] = useState(initialAnko?.exclusivityDays ? String(initialAnko.exclusivityDays) : '60');
  const [ankoNote, setAnkoNote] = useState(initialAnko?.note ?? '');

  function buildAnko() {
    const increment = Math.round(Number(ankoIncrement));
    const unitPrice = toKobo(ankoPrice);
    const days = Math.round(Number(ankoDays));
    const valid = increment > 0 && unitPrice > 0;
    return {
      enabled: ankoEnabled && valid,
      increment: valid ? increment : 0,
      unitPrice: valid ? unitPrice : 0,
      exclusivityDays: days > 0 ? days : 60,
      ...(ankoNote.trim() ? { note: ankoNote.trim() } : {}),
    };
  }

  // Sell formats (reserved "_sellFormats" + "_baseUnit"). Configurable ways to
  // buy the product; prices edited in naira, baseQty draws from the base-unit stock.
  type FmtRow = { label: string; price: string; baseQty: string; minQty: string; increment: string; fractional: boolean; default: boolean };
  const initialFormats = (Array.isArray(attributeValues._sellFormats) ? attributeValues._sellFormats : []) as { label?: string; price?: number; baseQty?: number; minQty?: number; increment?: number; fractional?: boolean; default?: boolean }[];
  const [baseUnit, setBaseUnit] = useState((attributeValues._baseUnit as string) ?? '');
  const [formats, setFormats] = useState<FmtRow[]>(
    initialFormats.map((f) => ({
      label: f.label ?? '',
      price: nairaInput(f.price),
      baseQty: String(f.baseQty ?? 1),
      minQty: String(f.minQty ?? 1),
      increment: String(f.increment ?? 1),
      fractional: !!f.fractional,
      default: !!f.default,
    })),
  );

  const patchFormat = (i: number, patch: Partial<FmtRow>) => setFormats(formats.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const setDefaultFormat = (i: number) => setFormats(formats.map((f, j) => ({ ...f, default: j === i })));

  function buildSellFormats() {
    const rows = formats
      .filter((f) => f.label.trim() && Number(f.price) > 0)
      .map((f) => ({
        label: f.label.trim(),
        price: toKobo(f.price),
        baseQty: Number(f.baseQty) > 0 ? Number(f.baseQty) : 1,
        minQty: Number(f.minQty) > 0 ? Number(f.minQty) : 1,
        increment: Number(f.increment) > 0 ? Number(f.increment) : 1,
        fractional: f.fractional,
        default: f.default,
      }));
    if (rows.length && !rows.some((r) => r.default)) rows[0].default = true;
    return rows;
  }

  // Single save path — persists basics, attributes, custom details, wholesale, formats.
  function save() {
    onSave({
      ...form,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      minOrderQty: Number(form.minOrderQty),
      qtyIncrement: Number(form.qtyIncrement),
      attributeValues: {
        ...attributeValues,
        _wholesale: buildWholesale(),
        _anko: buildAnko(),
        _sellFormats: buildSellFormats(),
        _baseUnit: baseUnit.trim() || undefined,
      },
      flags,
    });
  }

  return (
    <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Basics">
        <div className="space-y-3">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Brand"><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
          <Field label="Description"><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Visibility">
              <Select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
                <option value="visible">Visible online</option>
                <option value="hidden">Hidden (link only)</option>
              </Select>
            </Field>
            <Field label="Tags"><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min order qty"><Input type="number" step="0.5" value={form.minOrderQty} onChange={(e) => setForm({ ...form, minOrderQty: e.target.value })} /></Field>
            <Field label="Qty increment"><Input type="number" step="0.5" value={form.qtyIncrement} onChange={(e) => setForm({ ...form, qtyIncrement: e.target.value })} /></Field>
          </div>
          <div className="flex gap-4">
            {([['featured', 'Featured'], ['new_arrival', 'New Arrival'], ['best_seller', 'Best Seller']] as const).map(([flag, label]) => (
              <Checkbox key={flag} label={label} checked={!!flags[flag]} onChange={(e) => setFlags({ ...flags, [flag]: e.target.checked })} />
            ))}
          </div>
          {/* Store assignment: MIM (custom printing) vs the main Zahrah store. */}
          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2.5">
            <Checkbox
              label="MIM product (custom printing) — shows on the /mim store, not the main shop"
              checked={!!flags.mim}
              onChange={(e) => setFlags({ ...flags, mim: e.target.checked })}
            />
          </div>
          <div className="border-t border-stone-200 pt-3">
            <Checkbox
              label="Sell as a whole item (override category measurement)"
              checked={!!flags.wholeItem}
              onChange={(e) => setFlags({ ...flags, wholeItem: e.target.checked })}
            />
            <p className="mt-1 text-xs text-stone-400">
              On: sold as a complete item — whole quantities, one-click add, no per-unit / measurement UI on the
              storefront. Ignored when sell formats are configured.
            </p>
          </div>
        </div>
      </Card>
      <Card title={`${product.category.name} attributes`}>
        <div className="space-y-3">
          {/* Variant-defining attributes (e.g. Colour) live on the Variants tab, not here. */}
          {product.category.attributes.filter(({ attribute }) => !attribute.isVariantDefining).map(({ attribute, isRequired }) => (
            <Field key={attribute.id} label={`${attribute.name}${isRequired ? ' *' : ''}`}>
              {['select', 'color', 'image_option'].includes(attribute.inputType) ? (
                <Select value={(attributeValues[attribute.code] as string) ?? ''}
                  onChange={(e) => setAttributeValues({ ...attributeValues, [attribute.code]: e.target.value || undefined })}>
                  <option value="">—</option>
                  {attribute.options.filter((o) => o.status === 'active').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              ) : attribute.inputType === 'number' ? (
                <Input type="number" value={(attributeValues[attribute.code] as number) ?? ''}
                  onChange={(e) => setAttributeValues({ ...attributeValues, [attribute.code]: e.target.value === '' ? undefined : Number(e.target.value) })} />
              ) : (
                <Input value={(attributeValues[attribute.code] as string) ?? ''}
                  onChange={(e) => setAttributeValues({ ...attributeValues, [attribute.code]: e.target.value || undefined })} />
              )}
            </Field>
          ))}

          {/* Variant-defining attributes are shown for clarity, with their
              per-variant values, and edited on the Variants tab. */}
          {product.category.attributes.filter(({ attribute }) => attribute.isVariantDefining).map(({ attribute }) => {
            const valuesInUse = Array.from(new Set(
              product.variants
                .map((v) => (v.optionValues as Record<string, string>)[attribute.code])
                .filter(Boolean)
                .map((value) => attribute.options.find((o) => o.value === value)?.label ?? value),
            ));
            return (
              <div key={attribute.id} className="flex items-center justify-between rounded-md border border-dashed border-stone-200 bg-stone-50 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{attribute.name}</p>
                  <p className="text-xs text-stone-500">
                    {valuesInUse.length ? `This product: ${valuesInUse.join(', ')}` : 'Not set on any variant yet'}
                  </p>
                </div>
                <button onClick={onGoToVariants} className="shrink-0 text-xs font-medium text-brand-700 hover:underline cursor-pointer">
                  Set per variant →
                </button>
              </div>
            );
          })}
          {!product.category.attributes.length && <p className="text-sm text-stone-400">This category defines no attributes.</p>}

          {/* Custom details — free-form key/value specs shown on the storefront
              product page, no taxonomy change required. */}
          <div className="border-t border-stone-200 pt-3">
            <p className="mb-2 text-sm font-medium text-stone-700">Custom details</p>
            {customDetails.length > 0 && (
              <div className="mb-3 space-y-2">
                {customDetails.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                    <span className="text-sm font-medium text-stone-700">{d.name}</span>
                    <span className="text-stone-300">·</span>
                    <span className="flex-1 truncate text-sm text-stone-600">{String(d.value)}</span>
                    <button type="button" onClick={() => removeCustomDetail(i)} aria-label={`Remove ${d.name}`}
                      className="shrink-0 text-stone-400 hover:text-red-600 cursor-pointer">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field label="Detail">
                  <Input value={newDetail.name} placeholder="e.g. Material"
                    onChange={(e) => setNewDetail({ ...newDetail, name: e.target.value })} />
                </Field>
              </div>
              <div className="flex-1">
                <Field label="Value">
                  <Input value={newDetail.value} placeholder="e.g. 100% cotton"
                    onChange={(e) => setNewDetail({ ...newDetail, value: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomDetail(); } }} />
                </Field>
              </div>
              <Button type="button" variant="secondary" className="shrink-0" disabled={!newDetail.name.trim() || !newDetail.value.trim()} onClick={addCustomDetail}>
                <Plus size={15} /> Add
              </Button>
            </div>
          </div>
        </div>
        <Button className="mt-4 w-full" loading={saving} onClick={save}>
          Save changes
        </Button>
      </Card>
    </div>

      <Card title="Wholesale">
        <div className="space-y-3">
          <Checkbox
            label="Offer wholesale / bulk pricing for this product"
            checked={wholesaleEnabled}
            onChange={(e) => setWholesaleEnabled(e.target.checked)}
          />

          {wholesaleEnabled && (
            <>
              <p className="text-xs text-stone-500">
                Shoppers buy wholesale in multiples of the increment. Enter the total price for one lot of that
                increment — e.g. increment 12 and price ₦4,680,000 means 12 units cost ₦4,680,000 (24 → ₦9,360,000).
              </p>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Increment" hint="Quantity step / minimum">
                  <Input type="number" min="1" placeholder="e.g. 12" value={wholesaleIncrement}
                    onChange={(e) => setWholesaleIncrement(e.target.value)} />
                </Field>
                <Field label="Price per lot (₦)" hint={`Total for ${wholesaleIncrement || 'the increment'} units`}>
                  <Input type="number" min="0" step="0.01" placeholder="e.g. 4680000" value={wholesalePrice}
                    onChange={(e) => setWholesalePrice(e.target.value)} />
                </Field>
              </div>

              <Field label="Note (optional)">
                <Textarea rows={2} value={wholesaleNote} placeholder="e.g. Wholesale orders ship in 3–5 days. Prices exclude delivery."
                  onChange={(e) => setWholesaleNote(e.target.value)} />
              </Field>
            </>
          )}
        </div>
        <Button className="mt-4 w-full" loading={saving} onClick={save}>
          Save changes
        </Button>
      </Card>

      <Card title="Anko (group / event)">
        <div className="space-y-3">
          <Checkbox
            label="Offer this fabric for anko (aso-ebi) group buys"
            checked={ankoEnabled}
            onChange={(e) => setAnkoEnabled(e.target.checked)}
          />
          {ankoEnabled && (
            <>
              <p className="text-xs text-stone-500">
                Anko is the <b>lowest bulk price</b> (typically below wholesale) for outfitting a whole group. When someone
                buys the anko, this fabric is <b>locked exclusively to them</b> for the exclusivity period below — no one else
                can buy it in bulk (anko or wholesale) until then. It shows on the <b>/anko</b> store.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Increment" hint="Min / step (yards)">
                  <Input type="number" min="1" placeholder="e.g. 20" value={ankoIncrement} onChange={(e) => setAnkoIncrement(e.target.value)} />
                </Field>
                <Field label="Price per lot (₦)" hint={`Total for ${ankoIncrement || 'the increment'} yards`}>
                  <Input type="number" min="0" step="0.01" placeholder="e.g. 3600000" value={ankoPrice} onChange={(e) => setAnkoPrice(e.target.value)} />
                </Field>
                <Field label="Exclusivity (days)" hint="Lock length">
                  <Input type="number" min="1" max="365" value={ankoDays} onChange={(e) => setAnkoDays(e.target.value)} />
                </Field>
              </div>
              <Field label="Note (optional)">
                <Textarea rows={2} value={ankoNote} placeholder="e.g. Minimum 20 yards. Exclusive to your group for the period." onChange={(e) => setAnkoNote(e.target.value)} />
              </Field>
            </>
          )}
        </div>
        <Button className="mt-4 w-full" loading={saving} onClick={save}>
          Save changes
        </Button>
      </Card>

      <Card title="Sell formats">
        <div className="space-y-3">
          <p className="text-xs text-stone-500">
            Offer the product in multiple formats (e.g. full piece, per yard). Each is priced on its own and draws from
            one shared stock pool via <b>= base units</b>. Leave empty to sell by the product&apos;s normal unit.
          </p>

          <div className="w-1/2">
            <Field label="Base unit" hint="What stock is counted in (e.g. yard)">
              <Input placeholder="e.g. yard" value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)} />
            </Field>
          </div>

          {formats.map((f, i) => (
            <div key={i} className="space-y-2 rounded-md border border-stone-200 p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1"><Field label="Label"><Input placeholder="e.g. Full piece" value={f.label} onChange={(e) => patchFormat(i, { label: e.target.value })} /></Field></div>
                <div className="w-32"><Field label="Price (₦)"><Input type="number" min="0" step="0.01" placeholder="400000" value={f.price} onChange={(e) => patchFormat(i, { price: e.target.value })} /></Field></div>
                <button type="button" aria-label="Remove format" onClick={() => setFormats(formats.filter((_, j) => j !== i))}
                  className="mt-6 flex h-9 w-8 shrink-0 items-center justify-center text-stone-400 hover:text-red-600 cursor-pointer">
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label={`= ${baseUnit.trim() || 'base'} units`}>
                  <Input type="number" min="0" step="0.01" placeholder="5" value={f.baseQty} onChange={(e) => patchFormat(i, { baseQty: e.target.value })} />
                </Field>
                <Field label="Min qty"><Input type="number" min="0" step="0.01" value={f.minQty} onChange={(e) => patchFormat(i, { minQty: e.target.value })} /></Field>
                <Field label="Increment"><Input type="number" min="0" step="0.01" value={f.increment} onChange={(e) => patchFormat(i, { increment: e.target.value })} /></Field>
              </div>
              <div className="flex items-center gap-5">
                <Checkbox label="Allow fractional quantity" checked={f.fractional} onChange={(e) => patchFormat(i, { fractional: e.target.checked })} />
                <label className="flex items-center gap-1.5 text-sm text-stone-600 cursor-pointer">
                  <input type="radio" name="defaultFormat" checked={f.default} onChange={() => setDefaultFormat(i)} /> Default
                </label>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm"
            onClick={() => setFormats([...formats, { label: '', price: '', baseQty: '1', minQty: '1', increment: '1', fractional: false, default: formats.length === 0 }])}>
            <Plus size={14} /> Add format
          </Button>
        </div>
        <Button className="mt-4 w-full" loading={saving} onClick={save}>
          Save changes
        </Button>
      </Card>
    </div>
  );
}

function VariantsTab({ product, act, canPrice, canCosts, onRefresh }: { product: ProductDetail; act: ActM; canPrice: boolean; canCosts: boolean; onRefresh: () => void }) {
  const [genOpen, setGenOpen] = useState(false);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [basePrice, setBasePrice] = useState('');
  const variantDefining = product.category.attributes.filter((a) => a.attribute.isVariantDefining);

  return (
    <div className="space-y-3">
      {variantDefining.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setGenOpen(true)}>Generate variants</Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-stone-50 text-left text-xs uppercase text-stone-500">
            {variantDefining.length > 0 && <th className="px-3 py-2">Options</th>}<th className="px-3 py-2">Price (₦)</th>
            <th className="px-3 py-2">Compare-at</th>{canCosts && <th className="px-3 py-2">Cost</th>}<th className="px-3 py-2">Stock</th><th className="px-3 py-2">Status</th><th className="px-3 py-2" />
          </tr></thead>
          <tbody className="divide-y divide-stone-100">
            {/* Single-SKU products: no options column, no delete bin — the one
                variant IS the product. */}
            {product.variants.map((v) => (
              <VariantRow key={v.id} variant={v} act={act} canPrice={canPrice} canCosts={canCosts} canDelete={variantDefining.length > 0} showOptions={variantDefining.length > 0} />
            ))}
          </tbody>
        </table>
        {product.variants.length === 0 && (
          <div className="p-6 text-center text-sm text-stone-500">
            {variantDefining.length > 0 ? (
              <p>No variants yet — use <b>Generate variants</b> to create the combinations this product comes in.</p>
            ) : (
              <div className="space-y-3">
                <p>This product has no sellable variant.</p>
                <Button size="sm" loading={act.isPending} onClick={() => act.mutate({ method: 'post', path: `/products/${product.id}/variants/default`, body: { price: 0 } })}>
                  Create default variant
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={genOpen} onClose={() => setGenOpen(false)} title="Generate variants">
        <div className="space-y-3">
          {variantDefining.map(({ attribute }) => (
            <Field key={attribute.id} label={attribute.name}>
              <div className="flex flex-wrap items-center gap-2">
                {attribute.options.filter((o) => o.status === 'active').map((o) => {
                  const selected = selections[attribute.code]?.includes(o.value);
                  return (
                    <button key={o.value}
                      className={`rounded-md border px-2.5 py-1 text-sm cursor-pointer ${selected ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-stone-200'}`}
                      onClick={() => {
                        const current = selections[attribute.code] ?? [];
                        setSelections({ ...selections, [attribute.code]: selected ? current.filter((x) => x !== o.value) : [...current, o.value] });
                      }}>
                      {o.label}
                    </button>
                  );
                })}
                <InlineAddOption
                  attribute={attribute}
                  onAdded={(value) => {
                    // New option is available everywhere AND ticked here immediately.
                    onRefresh();
                    setSelections((prev) => ({ ...prev, [attribute.code]: [...(prev[attribute.code] ?? []), value] }));
                  }}
                />
              </div>
            </Field>
          ))}
          <Field label="Base price for new variants (₦)"><Input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} /></Field>
          <Button className="w-full" onClick={() => {
            act.mutate({ method: 'post', path: `/products/${product.id}/variants/generate`, body: { selections, basePrice: toKobo(basePrice || 0) } });
            setGenOpen(false);
          }}>
            Generate new combinations
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

/** Add a new option (e.g. an unusual size like 749ml) without leaving the product. */
function InlineAddOption({ attribute, onAdded }: {
  attribute: { id: string; name: string; inputType: string };
  onAdded: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [hexCode, setHexCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: () => {
      const value = label.trim().toLowerCase().replace(/[^a-z0-9.]+/g, '-');
      return api.post(`/attributes/${attribute.id}/options`, {
        label: label.trim(),
        value,
        hexCode: attribute.inputType === 'color' ? hexCode || null : null,
      }).then(() => value);
    },
    onSuccess: (value) => { onAdded(value as string); setLabel(''); setHexCode(''); setOpen(false); setError(null); },
    onError: (e) => setError((e as Error).message),
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-dashed border-stone-300 px-2.5 py-1 text-sm text-stone-500 hover:border-brand-500 hover:text-brand-700 cursor-pointer"
      >
        + new {attribute.name.toLowerCase()}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <Input
        autoFocus
        placeholder={attribute.inputType === 'color' ? 'e.g. Burnt Orange' : 'e.g. 749ml'}
        className="h-8 w-32 text-sm"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && label.trim()) add.mutate();
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {attribute.inputType === 'color' && (
        <Input placeholder="#hex" className="h-8 w-20 text-sm" value={hexCode} onChange={(e) => setHexCode(e.target.value)} />
      )}
      <Button size="sm" variant="outline" loading={add.isPending} disabled={!label.trim()} onClick={() => add.mutate()}>Add</Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

function VariantRow({ variant, act, canPrice, canCosts, canDelete, showOptions }: { variant: Variant; act: ActM; canPrice: boolean; canCosts: boolean; canDelete: boolean; showOptions: boolean }) {
  const [price, setPrice] = useState(nairaInput(variant.price));
  const [compareAt, setCompareAt] = useState(nairaInput(variant.compareAtPrice));
  const [cost, setCost] = useState(nairaInput(variant.costPrice));
  const [name, setName] = useState(variant.name ?? '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const stock = variant.stockLevels.reduce((s, l) => s + Number(l.onHand) - Number(l.reserved), 0);
  const optionLabel = Object.values(variant.optionValues ?? {}).join(' / ');
  const dirty =
    price !== nairaInput(variant.price) ||
    compareAt !== nairaInput(variant.compareAtPrice) ||
    cost !== nairaInput(variant.costPrice) ||
    name !== (variant.name ?? '');

  return (
    <tr>
      {showOptions && (
        <td className="px-3 py-2">
          <Input
            className="w-40"
            value={name}
            placeholder={optionLabel || 'e.g. Standard'}
            onChange={(e) => setName(e.target.value)}
          />
        </td>
      )}
      <td className="px-3 py-2"><Input type="number" className="w-24" disabled={!canPrice} value={price} onChange={(e) => setPrice(e.target.value)} /></td>
      <td className="px-3 py-2"><Input type="number" className="w-24" disabled={!canPrice} value={compareAt} onChange={(e) => setCompareAt(e.target.value)} /></td>
      {canCosts && <td className="px-3 py-2"><Input type="number" className="w-24" disabled={!canPrice} value={cost} onChange={(e) => setCost(e.target.value)} /></td>}
      <td className="px-3 py-2">{qty(stock)}</td>
      <td className="px-3 py-2"><Badge color={statusColor(variant.status)}>{variant.status}</Badge></td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1">
          {variant.status === 'archived' ? (
            <Button size="sm" variant="outline" onClick={() => act.mutate({
              method: 'put', path: `/products/variants/${variant.id}`, body: { status: 'active' },
            })}>
              Restore
            </Button>
          ) : (
            <>
              {dirty && canPrice && (
                <Button size="sm" onClick={() => act.mutate({
                  method: 'put', path: `/products/variants/${variant.id}`,
                  body: {
                    name: name.trim() || null,
                    price: toKobo(price || 0),
                    compareAtPrice: compareAt ? toKobo(compareAt) : null,
                    costPrice: cost ? toKobo(cost) : null,
                  },
                })}>Save</Button>
              )}
              {canDelete && (
                <button
                  aria-label="Delete variant"
                  title="Delete variant"
                  className="rounded p-1.5 text-stone-300 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
        </div>
        {confirmingDelete && (
          <Dialog open onClose={() => setConfirmingDelete(false)} title="Delete variant">
            <div className="space-y-4">
              <p className="text-sm text-stone-600">
                Delete the <b>{variant.name || optionLabel || 'only'}</b> variant?
              </p>
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                If this variant appears in past orders, stock history or a bundle, it will be archived
                instead of deleted so those records stay intact.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
                <Button variant="danger" onClick={() => {
                  act.mutate({ method: 'del', path: `/products/variants/${variant.id}` });
                  setConfirmingDelete(false);
                }}>
                  Delete variant
                </Button>
              </div>
            </div>
          </Dialog>
        )}
      </td>
    </tr>
  );
}

function MediaTab({ product, onSaved, setError }: { product: ProductDetail; onSaved: () => void; setError: (e: unknown) => void }) {
  const [uploading, setUploading] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const current = product.media.map((m) => ({ url: m.url, altText: m.altText, sortOrder: m.sortOrder }));
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        form.append('baseAlt', product.name);
        const asset = await api.postForm<{ url: string }>('/content/media', form);
        current.push({ url: asset.url, altText: product.name, sortOrder: current.length });
      }
      await api.put(`/products/${product.id}/media`, { media: current });
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setUploading(false);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const list = [...product.media].sort((a, b) => a.sortOrder - b.sortOrder);
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    await api.put(`/products/${product.id}/media`, { media: list.map((m, i) => ({ url: m.url, altText: m.altText, sortOrder: i })) });
    onSaved();
  }

  async function remove(mediaId: string) {
    const list = product.media.filter((m) => m.id !== mediaId);
    await api.put(`/products/${product.id}/media`, { media: list.map((m, i) => ({ url: m.url, altText: m.altText, sortOrder: i })) });
    onSaved();
  }

  async function makeCover(mediaId: string) {
    const sorted = [...product.media].sort((a, b) => a.sortOrder - b.sortOrder);
    const chosen = sorted.find((m) => m.id === mediaId);
    if (!chosen) return;
    const list = [chosen, ...sorted.filter((m) => m.id !== mediaId)];
    await api.put(`/products/${product.id}/media`, { media: list.map((m, i) => ({ url: m.url, altText: m.altText, sortOrder: i })) });
    onSaved();
  }

  const sorted = [...product.media].sort((a, b) => a.sortOrder - b.sortOrder);
  const cover = sorted[0];
  const rest = sorted.slice(1);

  const uploadInput = (
    <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
  );

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-4">
        {/* Cover — the big box */}
        {cover ? (
          <div className="group relative w-64 shrink-0 overflow-hidden rounded-xl border border-stone-200 md:w-80">
            <img src={cover.url} alt={cover.altText ?? ''} className="aspect-square w-full object-cover" />
            <span className="absolute left-2 top-2 rounded bg-brand-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">COVER</span>
            <button
              aria-label="Remove cover image"
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-600 cursor-pointer"
              onClick={() => remove(cover.id)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <label className="flex w-64 shrink-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50/50 text-stone-400 transition-colors hover:border-brand-400 hover:text-brand-600 md:w-80" style={{ aspectRatio: '1' }}>
            {uploading ? <span className="text-sm">Uploading…</span> : (
              <>
                <Upload size={28} />
                <span className="text-sm font-medium">Add the cover image</span>
                <span className="text-xs">JPG · PNG · WebP</span>
              </>
            )}
            {uploadInput}
          </label>
        )}

        {/* Thumbnails + the "+" box, growing to the right */}
        {cover && (
          <div className="flex flex-wrap items-start gap-3">
            {rest.map((m) => (
              <div key={m.id} className="group relative w-28 overflow-hidden rounded-lg border border-stone-200">
                <img src={m.url} alt={m.altText ?? ''} className="aspect-square w-full object-cover" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 opacity-0 transition group-hover:opacity-100">
                  <button className="rounded bg-white/90 px-2 py-0.5 text-[11px] font-medium text-stone-800 hover:bg-white cursor-pointer" onClick={() => makeCover(m.id)}>
                    Make cover
                  </button>
                  <button className="rounded bg-red-500/90 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-600 cursor-pointer" onClick={() => remove(m.id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <label className="flex aspect-square w-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-stone-50/50 text-stone-300 transition-colors hover:border-brand-400 hover:text-brand-500">
              {uploading ? <span className="text-xs text-stone-400">…</span> : <Plus size={32} strokeWidth={1.5} />}
              {uploadInput}
            </label>
          </div>
        )}
      </div>
      {cover && <p className="mt-3 text-xs text-stone-400">The big image is the storefront cover — hover a thumbnail to promote or remove it.</p>}
    </Card>
  );
}

interface PrintArea { x: number; y: number; width: number; height: number }
interface AdminSide { label: string; image: string | null; printArea: PrintArea }

/** Draggable/resizable print-area box over the product image. Emits fractions. */
function PrintAreaEditor({ imageUrl, value, onChange }: { imageUrl: string | null; value: PrintArea; onChange: (a: PrintArea) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; orig: PrintArea } | null>(null);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  function begin(e: React.PointerEvent, mode: 'move' | 'resize') {
    e.preventDefault();
    drag.current = { mode, startX: e.clientX, startY: e.clientY, orig: value };
    const move = (ev: PointerEvent) => {
      const d = drag.current; const rect = boxRef.current?.getBoundingClientRect();
      if (!d || !rect) return;
      const dx = (ev.clientX - d.startX) / rect.width;
      const dy = (ev.clientY - d.startY) / rect.height;
      if (d.mode === 'move') {
        onChange({ ...d.orig, x: clamp(d.orig.x + dx, 0, 1 - d.orig.width), y: clamp(d.orig.y + dy, 0, 1 - d.orig.height) });
      } else {
        onChange({ ...d.orig, width: clamp(d.orig.width + dx, 0.05, 1 - d.orig.x), height: clamp(d.orig.height + dy, 0.05, 1 - d.orig.y) });
      }
    };
    const up = () => { drag.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  return (
    <div ref={boxRef} className="relative mx-auto w-full max-w-xs touch-none select-none overflow-hidden rounded-lg border border-stone-200 bg-stone-100" style={{ aspectRatio: '1' }}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" draggable={false} className="pointer-events-none h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-stone-400">Add a product image to preview the print area</div>
      )}
      <div
        onPointerDown={(e) => begin(e, 'move')}
        className="absolute cursor-move border-2 border-dashed border-[#8a6d1f] bg-[#8a6d1f]/10"
        style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%`, width: `${value.width * 100}%`, height: `${value.height * 100}%` }}
      >
        <span
          onPointerDown={(e) => { e.stopPropagation(); begin(e, 'resize'); }}
          className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-se-resize rounded-full border-2 border-white bg-[#8a6d1f]"
        />
      </div>
    </div>
  );
}

/** MIM tab — custom-printing settings for a /mim product. The "customizable"
 *  toggle decides whether the personalise-one / team cards appear on the MIM
 *  storefront product page (flags.mimCustomizable). */
function MimTab({ product, onSave, saving }: { product: ProductDetail; onSave: (body: Record<string, unknown>) => void; saving: boolean }) {
  const existing = (product.flags as Record<string, boolean>) ?? {};
  const existingAttrs = (product.attributeValues ?? {}) as Record<string, unknown>;
  const [customizable, setCustomizable] = useState(!!existing.mimCustomizable);
  const [printPrice, setPrintPrice] = useState(nairaInput((existingAttrs._mimPrintPrice as number) ?? null));
  const DEFAULT_AREA = { x: 0.24, y: 0.2, width: 0.52, height: 0.52 };
  const sortedMedia = [...product.media].sort((a, b) => a.sortOrder - b.sortOrder);
  const cover = sortedMedia[0]?.url ?? null;
  const [sides, setSides] = useState<AdminSide[]>(() => {
    const raw = existingAttrs._mimSides as { label: string; image: string; printArea: PrintArea }[] | undefined;
    if (Array.isArray(raw) && raw.length) return raw.map((s) => ({ label: s.label, image: s.image || cover, printArea: s.printArea ?? DEFAULT_AREA }));
    return [{ label: 'Front', image: cover, printArea: (existingAttrs._mimPrintArea as PrintArea) ?? DEFAULT_AREA }];
  });
  const productPrice = product.variants[0]?.price ?? 0;
  const printKobo = toKobo(printPrice || 0);
  const combined = productPrice + printKobo; // what the shopper pays per personalised piece
  const updateSide = (i: number, patch: Partial<AdminSide>) => setSides((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const addSide = () => setSides((ss) => [...ss, { label: ss.length === 1 ? 'Back' : `Side ${ss.length + 1}`, image: cover, printArea: DEFAULT_AREA }]);

  function save() {
    onSave({
      flags: { ...existing, mim: true, mimCustomizable: customizable },
      // Printing surcharge (kobo) + sides (front/back… each with image + print
      // area) — reserved keys used by the design editor. Price cleared when off.
      attributeValues: {
        ...existingAttrs,
        _mimPrintPrice: customizable ? printKobo : 0,
        _mimSides: sides.map((s) => ({ label: s.label, image: s.image ?? '', printArea: s.printArea })),
        _mimPrintArea: sides[0]?.printArea ?? DEFAULT_AREA, // legacy fallback
      },
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Card title="Custom printing">
        <div className="space-y-3">
          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2.5">
            <Checkbox
              label="This product is customizable (personalisation)"
              checked={customizable}
              onChange={(e) => setCustomizable(e.target.checked)}
            />
            <p className="mt-1 text-xs text-stone-400">
              On: the storefront shows the <b>Personalise one</b> and <b>Personalise many</b> options below the buy box.
              Off: it&apos;s sold as a plain item with no personalisation.
            </p>
          </div>

          {customizable && (
            <>
              {/* Printing price — surcharge added to the product price per piece. */}
              <div className="rounded-md border border-stone-200 p-3">
                <div className="w-1/2">
                  <Field label="Printing price (₦)" hint="Charged per personalised piece, on top of the item price">
                    <Input type="number" min="0" step="0.01" placeholder="e.g. 5000" value={printPrice} onChange={(e) => setPrintPrice(e.target.value)} />
                  </Field>
                </div>
                <p className="mt-2 text-sm text-stone-600">
                  Shopper pays <b>{naira(productPrice)}</b> item + <b>{naira(printKobo)}</b> printing ={' '}
                  <b className="text-stone-900">{naira(combined)}</b> per personalised piece.
                </p>
              </div>

              {/* Sides — front/back/… each with its own image + print area. */}
              <div className="space-y-3 rounded-md border border-stone-200 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stone-700">Sides &amp; print areas</p>
                    <p className="text-xs text-stone-400">Add a side per printable face (Front, Back…). Pick its image and drag the box to set where designs can go.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addSide}><Plus size={14} /> Add side</Button>
                </div>
                {sides.map((side, i) => (
                  <div key={i} className="space-y-2 rounded-lg border border-stone-200 bg-stone-50/50 p-3">
                    <div className="flex items-center gap-2">
                      <Input className="h-9 flex-1" value={side.label} placeholder="Front / Back" onChange={(e) => updateSide(i, { label: e.target.value })} />
                      {sides.length > 1 && (
                        <button type="button" aria-label="Remove side" onClick={() => setSides((ss) => ss.filter((_, j) => j !== i))}
                          className="flex h-9 w-8 shrink-0 items-center justify-center text-stone-400 hover:text-red-600 cursor-pointer"><Trash2 size={15} /></button>
                      )}
                    </div>
                    {sortedMedia.length > 0 && (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Image for this side</p>
                        <div className="flex flex-wrap gap-1.5">
                          {sortedMedia.map((m) => (
                            <button key={m.id} type="button" onClick={() => updateSide(i, { image: m.url })}
                              className={`h-12 w-12 overflow-hidden rounded border-2 ${side.image === m.url ? 'border-brand-600' : 'border-transparent hover:border-stone-300'}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={m.url} alt="" className="h-full w-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <PrintAreaEditor imageUrl={side.image} value={side.printArea} onChange={(pa) => updateSide(i, { printArea: pa })} />
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-lg border border-stone-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Storefront preview</p>

                {/* Personalise one */}
                <div className="rounded-xl border border-stone-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Personalise one</p>
                  <h3 className="mt-0.5 text-lg font-bold">Make it yours</h3>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">
                    Type the name or message you want printed, choose your size and colour — and it&apos;s made just for you.
                  </p>
                  {printKobo > 0 && (
                    <p className="mt-2 text-xs text-stone-500">{naira(productPrice)} item + {naira(printKobo)} printing = <b className="text-stone-800">{naira(combined)}</b> each</p>
                  )}
                  <div className="mt-3 flex h-11 w-full items-center justify-center rounded-full border border-stone-300 bg-white text-sm font-semibold text-stone-800">Configure</div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-stone-500">Quantity</span>
                    <div className="flex items-center rounded-full border border-stone-300 bg-white text-sm">
                      <span className="px-3 py-1 text-stone-400">−</span><span className="border-x border-stone-200 px-3 py-1 font-semibold">1</span><span className="px-3 py-1 text-stone-400">+</span>
                    </div>
                  </div>
                  <div className="mt-3 flex h-11 w-full items-center justify-center rounded-full bg-amber-400 text-sm font-semibold text-stone-900 opacity-50">Add personalised — {naira(combined)}</div>
                  <p className="mt-1.5 text-center text-[11px] text-stone-400">The modal only asks for the text to print. Quantity is chosen here; the add button stays disabled until the shopper configures the text.</p>
                </div>

                {/* Personalise many */}
                <div className="rounded-xl border border-stone-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Personalise many</p>
                  <h3 className="mt-0.5 text-lg font-bold">One order, every name</h3>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">
                    Ordering for a team, an event or an aso-ebi crew? Set the quantity and type a name for each piece — every shirt printed individually.
                  </p>
                  <div className="mt-3 flex h-11 w-full items-center justify-center rounded-full bg-stone-950 text-sm font-semibold text-white">
                    Start a team order
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        <Button className="mt-4 w-full" loading={saving} onClick={save}>Save changes</Button>
      </Card>
    </div>
  );
}

function BundleTab({ product, act }: { product: ProductDetail; act: ActM }) {
  const [components, setComponents] = useState(product.bundleComponents.map((c) => ({ variantId: c.variantId, quantity: Number(c.quantity), label: `${c.variant.product.name} (${c.variant.sku})`, price: c.variant.price })));
  const [pricingMode, setPricingMode] = useState(product.bundleConfig?.pricingMode ?? 'fixed');
  const [fixedPrice, setFixedPrice] = useState(nairaInput(product.bundleConfig?.fixedPrice ?? null));
  const [percentOff, setPercentOff] = useState(product.bundleConfig?.percentOff ?? '');
  const [maxSellable, setMaxSellable] = useState(product.bundleConfig?.maxSellable != null ? String(product.bundleConfig.maxSellable) : '');
  const [eligiblePromos, setEligiblePromos] = useState(product.bundleConfig?.eligibleForPromotions ?? false);
  const [search, setSearch] = useState('');

  const { data: availability } = useQuery({
    queryKey: ['bundle-availability', product.id],
    queryFn: () => api.get<{ availability: number; constrainedBy: string | null; componentSum: number; price: number; savings: number; belowCost: boolean; soldCount: number }>(`/products/${product.id}/bundle/availability`),
    enabled: !!product.bundleConfig,
  });
  const { data: searchResults } = useQuery({
    queryKey: ['bundle-search', search],
    queryFn: () => api.get<{ rows: { id: string; name: string }[] }>(`/products?q=${encodeURIComponent(search)}&status=active&type=standard`),
    enabled: search.trim().length >= 2,
  });

  const componentSum = components.reduce((s, c) => s + Math.round(c.price * c.quantity), 0);
  const preview = pricingMode === 'fixed' ? toKobo(fixedPrice || 0) : Math.round(componentSum * (1 - Number(percentOff || 0) / 100));

  async function addComponentFromProduct(productId: string) {
    const detail = await api.get<{ name: string; variants: { id: string; sku: string; price: number; status: string }[] }>(`/products/${productId}`);
    const variant = detail.variants.find((v) => v.status === 'active');
    if (variant && !components.some((c) => c.variantId === variant.id)) {
      setComponents([...components, { variantId: variant.id, quantity: 1, label: `${detail.name} (${variant.sku})`, price: variant.price }]);
    }
    setSearch('');
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Components (2–15)">
        <div className="relative mb-3">
          <Input placeholder="Search products to add…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {searchResults && search.trim().length >= 2 && (
            <div className="absolute top-full z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white shadow-lg">
              {searchResults.rows.map((p) => (
                <button key={p.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-stone-50 cursor-pointer" onClick={() => addComponentFromProduct(p.id)}>{p.name}</button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          {components.map((c, i) => (
            <div key={c.variantId} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate">{c.label}</span>
              <Input type="number" step="0.5" min="0.5" className="w-20" value={c.quantity}
                onChange={(e) => setComponents(components.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))} />
              <span className="w-20 text-right text-stone-500">{naira(Math.round(c.price * c.quantity))}</span>
              <button className="text-stone-400 hover:text-red-600 cursor-pointer" onClick={() => setComponents(components.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
            </div>
          ))}
          {!components.length && <p className="py-4 text-center text-sm text-stone-400">Add at least 2 components</p>}
        </div>
      </Card>
      <Card title="Pricing & caps">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pricing mode">
              <Select value={pricingMode} onChange={(e) => setPricingMode(e.target.value)}>
                <option value="fixed">Fixed package price</option>
                <option value="percent_off_sum">% off component sum</option>
              </Select>
            </Field>
            {pricingMode === 'fixed'
              ? <Field label="Package price (₦)"><Input type="number" value={fixedPrice} onChange={(e) => setFixedPrice(e.target.value)} /></Field>
              : <Field label="% off"><Input type="number" value={String(percentOff)} onChange={(e) => setPercentOff(e.target.value)} /></Field>}
          </div>
          <Field label="Max sellable (optional cap)" hint={availability ? `Sold so far: ${availability.soldCount}` : undefined}>
            <Input type="number" value={maxSellable} onChange={(e) => setMaxSellable(e.target.value)} placeholder="e.g. 50" />
          </Field>
          <Checkbox label="Eligible for promotions (default: off)" checked={eligiblePromos} onChange={(e) => setEligiblePromos(e.target.checked)} />
          <div className="rounded-md bg-stone-50 p-3 text-sm">
            <div className="flex justify-between"><span className="text-stone-500">Component sum ("worth")</span><span>{naira(componentSum)}</span></div>
            <div className="flex justify-between font-medium"><span>Package price</span><span>{naira(preview)}</span></div>
            <div className="flex justify-between text-emerald-600"><span>Customer saves</span><span>{naira(Math.max(0, componentSum - preview))}</span></div>
            {availability && (
              <p className="mt-2 border-t border-stone-200 pt-2 text-xs text-stone-500">
                Derived availability: <b>{availability.availability}</b>{availability.constrainedBy ? ` — limited by ${availability.constrainedBy}` : ''}
              </p>
            )}
          </div>
          <Button className="w-full" loading={act.isPending} disabled={components.length < 2} onClick={() =>
            act.mutate({
              method: 'put', path: `/products/${product.id}/bundle`,
              body: {
                components: components.map((c, i) => ({ variantId: c.variantId, quantity: c.quantity, sortOrder: i })),
                config: {
                  pricingMode,
                  fixedPrice: pricingMode === 'fixed' ? toKobo(fixedPrice || 0) : null,
                  percentOff: pricingMode === 'percent_off_sum' ? Number(percentOff) : null,
                  maxSellable: maxSellable ? Number(maxSellable) : null,
                  eligibleForPromotions: eligiblePromos,
                },
              },
            })
          }>
            Save bundle
          </Button>
        </div>
      </Card>
    </div>
  );
}
