'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, Checkbox, Dialog, ErrorNote, Field, Input, PageHeader, Select, Spinner, Tabs, statusColor } from '@/components/ui';

interface Unit { id: string; name: string; abbreviation: string; measurementType: string; fractionalAllowed: boolean; status: string }
interface AttributeOption { id: string; label: string; value: string; hexCode: string | null; status: string }
interface Attribute { id: string; name: string; code: string; inputType: string; isFilterable: boolean; isVariantDefining: boolean; status: string; options: AttributeOption[] }
interface Category {
  id: string; name: string; slug: string; parentId: string | null; status: string;
  fractionalAllowed: boolean; minOrderQty: string; qtyIncrement: string; returnEligible: boolean;
  defaultUnitId: string | null; deadStockDays: number | null;
  attributes: { attributeId: string; isRequired: boolean; attribute: Attribute }[];
  _count: { products: number };
}

export default function TaxonomyPage() {
  const [tab, setTab] = useState('categories');
  return (
    <div className="mx-auto w-full max-w-6xl">
      <Link href="/products" className="mb-2 inline-flex items-center gap-1.5 text-sm text-stone-500 transition-colors hover:text-stone-900">
        <ArrowLeft size={15} /> Back to products
      </Link>
      <PageHeader title="Categories, attributes & units" subtitle="The category defines the schema; the product supplies the values" />
      <Tabs tabs={[{ key: 'categories', label: 'Categories' }, { key: 'attributes', label: 'Attributes' }, { key: 'units', label: 'Units' }]} active={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === 'categories' && <CategoriesTab />}
        {tab === 'attributes' && <AttributesTab />}
        {tab === 'units' && <UnitsTab />}
      </div>
    </div>
  );
}

function CategoriesTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [error, setError] = useState<unknown>(null);
  const { data: categories, isLoading } = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories') });
  const { data: units } = useQuery({ queryKey: ['units'], queryFn: () => api.get<Unit[]>('/units') });
  const { data: attributes } = useQuery({ queryKey: ['attributes'], queryFn: () => api.get<Attribute[]>('/attributes') });

  if (isLoading || !categories) return <Spinner />;
  const roots = categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setEditing('new')}><Plus size={14} /> New category</Button></div>
      <div className="space-y-3">
        {roots.map((root) => {
          const children = childrenOf(root.id);
          return (
            <div key={root.id}>
              <CategoryRow category={root} onEdit={setEditing} isRoot />
              {children.length > 0 && (
                <div className="relative ml-5 mt-1 space-y-1 border-l border-stone-300 pl-9">
                  {children.map((child, i) => (
                    <div key={child.id} className="relative">
                      {/* elbow connector */}
                      <span aria-hidden className="absolute -left-9 top-1/2 w-9 border-t border-stone-300" />
                      {/* mask the trunk below the last child so the line ends at its elbow */}
                      {i === children.length - 1 && (
                        <span aria-hidden className="absolute -left-[37px] top-1/2 bottom-0 w-[2px] bg-stone-50" style={{ height: 'calc(50% + 0.25rem)' }} />
                      )}
                      <CategoryRow category={child} onEdit={setEditing} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {editing && (
        <CategoryDialog
          category={editing === 'new' ? null : editing}
          categories={categories}
          units={units ?? []}
          attributes={attributes ?? []}
          error={error}
          onClose={() => { setEditing(null); setError(null); }}
          onSaved={() => { setEditing(null); setError(null); queryClient.invalidateQueries({ queryKey: ['categories'] }); }}
          onError={setError}
        />
      )}
    </div>
  );
}

function CategoryRow({ category, onEdit, isRoot }: { category: Category; onEdit: (c: Category) => void; isRoot?: boolean }) {
  return (
    <button
      onClick={() => onEdit(category)}
      className={`inline-flex w-fit items-center gap-2.5 rounded-md border bg-white px-3.5 text-left text-sm transition-colors hover:border-brand-400 hover:bg-brand-50/40 cursor-pointer ${
        isRoot ? 'border-stone-300 py-2.5 shadow-sm' : 'border-stone-200 py-2'
      }`}
    >
      {isRoot && <FolderOpen size={15} className="shrink-0 text-brand-600" />}
      <span className={isRoot ? 'font-semibold' : 'font-medium'}>{category.name}</span>
      {!category.returnEligible && <Badge color="amber">non-returnable</Badge>}
      {category.status !== 'active' && <Badge color={statusColor(category.status)}>{category.status}</Badge>}
    </button>
  );
}

function CategoryDialog({ category, categories, units, attributes, error, onClose, onSaved, onError }: {
  category: Category | null; categories: Category[]; units: Unit[]; attributes: Attribute[];
  error: unknown; onClose: () => void; onSaved: () => void; onError: (e: unknown) => void;
}) {
  const [form, setForm] = useState({
    name: category?.name ?? '',
    parentId: category?.parentId ?? '',
    defaultUnitId: category?.defaultUnitId ?? '',
    fractionalAllowed: category?.fractionalAllowed ?? false,
    minOrderQty: category?.minOrderQty ?? '1',
    qtyIncrement: category?.qtyIncrement ?? '1',
    returnEligible: category?.returnEligible ?? true,
    deadStockDays: category?.deadStockDays != null ? String(category.deadStockDays) : '',
  });
  const [attrs, setAttrs] = useState<{ attributeId: string; isRequired: boolean }[]>(
    category?.attributes.map((a) => ({ attributeId: a.attributeId, isRequired: a.isRequired })) ?? [],
  );

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        parentId: form.parentId || null,
        defaultUnitId: form.defaultUnitId || null,
        fractionalAllowed: form.fractionalAllowed,
        minOrderQty: Number(form.minOrderQty),
        qtyIncrement: Number(form.qtyIncrement),
        returnEligible: form.returnEligible,
        deadStockDays: form.deadStockDays ? Number(form.deadStockDays) : null,
      };
      const saved = category
        ? await api.put<Category>(`/categories/${category.id}`, body)
        : await api.post<Category>('/categories', body);
      await api.put(`/categories/${saved.id}/attributes`, {
        attributes: attrs.map((a, i) => ({ ...a, sortOrder: i })),
      });
    },
    onSuccess: onSaved,
    onError,
  });

  return (
    <Dialog open onClose={onClose} title={category ? `Edit ${category.name}` : 'New category'} wide>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Parent">
          <Select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
            <option value="">(top level)</option>
            {categories.filter((c) => c.id !== category?.id && !c.parentId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Default unit">
          <Select value={form.defaultUnitId} onChange={(e) => setForm({ ...form, defaultUnitId: e.target.value })}>
            <option value="">—</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
          </Select>
        </Field>
        <Field label="Dead-stock window override (days)"><Input type="number" value={form.deadStockDays} onChange={(e) => setForm({ ...form, deadStockDays: e.target.value })} placeholder="default" /></Field>
        <Field label="Min order qty"><Input type="number" step="0.5" value={form.minOrderQty} onChange={(e) => setForm({ ...form, minOrderQty: e.target.value })} /></Field>
        <Field label="Qty increment"><Input type="number" step="0.5" value={form.qtyIncrement} onChange={(e) => setForm({ ...form, qtyIncrement: e.target.value })} /></Field>
      </div>
      <div className="mt-3 flex gap-6">
        <Checkbox label="Fractional quantities (e.g. 4.5 yards)" checked={form.fractionalAllowed} onChange={(e) => setForm({ ...form, fractionalAllowed: e.target.checked })} />
        <Checkbox label="Returns allowed" checked={form.returnEligible} onChange={(e) => setForm({ ...form, returnEligible: e.target.checked })} />
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase text-stone-400">Attribute set</p>
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-stone-100 p-2">
          {attributes.map((attr) => {
            const assigned = attrs.find((a) => a.attributeId === attr.id);
            return (
              <div key={attr.id} className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-stone-50">
                <Checkbox
                  label={attr.name}
                  checked={!!assigned}
                  onChange={(e) => setAttrs(e.target.checked ? [...attrs, { attributeId: attr.id, isRequired: false }] : attrs.filter((a) => a.attributeId !== attr.id))}
                />
                {assigned && (
                  <Checkbox label="required" checked={assigned.isRequired}
                    onChange={(e) => setAttrs(attrs.map((a) => (a.attributeId === attr.id ? { ...a, isRequired: e.target.checked } : a)))} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <ErrorNote error={error} />
      <Button className="mt-4 w-full" loading={save.isPending} disabled={!form.name.trim()} onClick={() => save.mutate()}>Save category</Button>
    </Dialog>
  );
}

function AttributesTab() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [removing, setRemoving] = useState<Attribute | null>(null);
  const [error, setError] = useState<unknown>(null);
  const { data: attributes, isLoading } = useQuery({ queryKey: ['attributes'], queryFn: () => api.get<Attribute[]>('/attributes') });

  const removeAttribute = useMutation({
    mutationFn: (id: string) => api.del<{ archived?: boolean; deleted?: boolean }>(`/attributes/${id}`),
    onSuccess: () => { setRemoving(null); queryClient.invalidateQueries({ queryKey: ['attributes'] }); },
    onError: (err) => { setRemoving(null); setError(err); },
  });

  if (isLoading || !attributes) return <Spinner />;

  // The dialog always renders the FRESH attribute from the query cache, so
  // added options appear immediately without closing the modal.
  const editingAttribute = editingId && editingId !== 'new' ? attributes.find((a) => a.id === editingId) ?? null : null;

  return (
    <div className="space-y-3">
      <ErrorNote error={error} />
      <div className="flex justify-end"><Button size="sm" onClick={() => setEditingId('new')}><Plus size={14} /> New attribute</Button></div>
      <div className="grid gap-2 md:grid-cols-2">
        {attributes.filter((a) => a.status === 'active').map((attr) => (
          <div key={attr.id} className="group relative">
            <button onClick={() => setEditingId(attr.id)} className="w-full rounded-md border border-stone-200 bg-white p-3 text-left hover:border-brand-400 cursor-pointer">
              <span className="font-medium">{attr.name}</span>
            </button>
            <button
              aria-label={`Delete ${attr.name}`}
              title="Delete attribute"
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded p-1.5 text-stone-300 hover:bg-red-50 hover:text-red-600 group-hover:block cursor-pointer"
              onClick={() => setRemoving(attr)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {removing && (
        <Dialog open onClose={() => setRemoving(null)} title="Delete attribute">
          <div className="space-y-4">
            <p className="text-sm text-stone-600">
              Delete the attribute <b>{removing.name}</b>{removing.options.length ? ` and its ${removing.options.length} option(s)` : ''}?
            </p>
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              If it's assigned to any category it will be archived instead of deleted,
              so existing products keep their data.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
              <Button variant="danger" loading={removeAttribute.isPending} onClick={() => removeAttribute.mutate(removing.id)}>
                Delete attribute
              </Button>
            </div>
          </div>
        </Dialog>
      )}
      {editingId && (
        <AttributeDialog
          key={editingId}
          attribute={editingAttribute}
          error={error}
          onClose={() => { setEditingId(null); setError(null); }}
          onChanged={() => { setError(null); queryClient.invalidateQueries({ queryKey: ['attributes'] }); }}
          onCreated={(created) => {
            setError(null);
            // Seed the cache so the dialog can switch to edit mode instantly,
            // letting options be added right after creation.
            queryClient.setQueryData<Attribute[]>(['attributes'], (old) => [...(old ?? []), { ...created, options: created.options ?? [] }]);
            queryClient.invalidateQueries({ queryKey: ['attributes'] });
            setEditingId(created.id);
          }}
          onDone={() => { setEditingId(null); setError(null); queryClient.invalidateQueries({ queryKey: ['attributes'] }); }}
          onError={setError}
        />
      )}
    </div>
  );
}

function AttributeDialog({ attribute, error, onClose, onChanged, onCreated, onDone, onError }: {
  attribute: Attribute | null;
  error: unknown;
  onClose: () => void;
  onChanged: () => void; // refresh, keep the dialog open
  onCreated: (created: Attribute) => void; // switch to edit mode
  onDone: () => void; // save & close
  onError: (e: unknown) => void;
}) {
  const [form, setForm] = useState({
    name: attribute?.name ?? '',
    inputType: attribute?.inputType ?? 'select',
    isFilterable: attribute?.isFilterable ?? false,
    isVariantDefining: attribute?.isVariantDefining ?? false,
  });
  const [newOption, setNewOption] = useState({ label: '', hexCode: '' });

  const save = useMutation({
    mutationFn: async () => {
      if (attribute) {
        await api.put(`/attributes/${attribute.id}`, { name: form.name, inputType: form.inputType, isFilterable: form.isFilterable, isVariantDefining: form.isVariantDefining });
        return null;
      }
      // code is internal — derived from the name automatically
      return api.post<Attribute>('/attributes', { ...form, code: form.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') });
    },
    onSuccess: (created) => (created ? onCreated(created) : onDone()),
    onError,
  });

  const addOption = useMutation({
    mutationFn: () => api.post(`/attributes/${attribute!.id}/options`, {
      label: newOption.label,
      value: newOption.label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      hexCode: newOption.hexCode || null,
    }),
    onSuccess: () => { setNewOption({ label: '', hexCode: '' }); onChanged(); },
    onError,
  });

  const archiveOption = useMutation({
    mutationFn: (optionId: string) => api.put(`/attributes/${attribute!.id}/options/${optionId}`, { status: 'archived' }),
    onSuccess: onChanged,
    onError,
  });

  const OPTION_TYPES = ['select', 'multiselect', 'color', 'image_option'];
  const optionBased = attribute && OPTION_TYPES.includes(attribute.inputType);
  // Variants are generated from option lists — free-form types can't define them.
  const canDefineVariants = OPTION_TYPES.includes(attribute ? attribute.inputType : form.inputType);
  const activeOptions = attribute?.options.filter((o) => o.status === 'active') ?? [];

  return (
    <Dialog open onClose={onClose} title={attribute ? `Edit ${attribute.name}` : 'New attribute'}>
      <div className="space-y-3">
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Colour, Size, Material" /></Field>
        {/* Input type is fixed once an attribute exists — only shown when creating */}
        {!attribute && (
          <Field label="Input type">
            <Select value={form.inputType} onChange={(e) => setForm({ ...form, inputType: e.target.value })}>
              {['short_text', 'long_text', 'number', 'select', 'multiselect', 'boolean', 'color', 'date'].map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
        )}
        <div className="flex gap-6">
          <Checkbox label="Filterable on storefront" checked={form.isFilterable} onChange={(e) => setForm({ ...form, isFilterable: e.target.checked })} />
          <span title={canDefineVariants ? undefined : 'Only choice-based attributes (select, colour) can define variants'} className={canDefineVariants ? '' : 'opacity-40'}>
            <Checkbox
              label="Variant-defining"
              disabled={!canDefineVariants}
              checked={canDefineVariants && form.isVariantDefining}
              onChange={(e) => setForm({ ...form, isVariantDefining: e.target.checked })}
            />
          </span>
        </div>

        {optionBased && (
          <div className="rounded-md border border-stone-100 bg-stone-50 p-3">
            {activeOptions.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {activeOptions.map((option) => (
                  <span key={option.id} className="group flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs">
                    {option.hexCode && <span className="h-2.5 w-2.5 rounded-full border border-stone-200" style={{ background: option.hexCode }} />}
                    {option.label}
                    <button
                      aria-label={`Remove ${option.label}`}
                      title="Remove option (existing products keep it)"
                      className="text-stone-300 hover:text-red-500 cursor-pointer"
                      onClick={() => archiveOption.mutate(option.id)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mb-2 text-xs text-stone-400">No options yet — add the first one below.</p>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="New option label"
                value={newOption.label}
                onChange={(e) => setNewOption({ ...newOption, label: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter' && newOption.label.trim()) addOption.mutate(); }}
              />
              {attribute.inputType === 'color' && (
                <Input placeholder="#hex" className="w-24" value={newOption.hexCode} onChange={(e) => setNewOption({ ...newOption, hexCode: e.target.value })} />
              )}
              <Button size="sm" variant="outline" loading={addOption.isPending} disabled={!newOption.label.trim()} onClick={() => addOption.mutate()}>Add</Button>
            </div>
          </div>
        )}
        <ErrorNote error={error} />
        <Button className="w-full" loading={save.isPending} disabled={!form.name.trim()} onClick={() => save.mutate()}>
          {attribute ? 'Save & close' : 'Create attribute'}
        </Button>
      </div>
    </Dialog>
  );
}

const EMPTY_UNIT_FORM = { name: '', abbreviation: '', measurementType: 'count', fractionalAllowed: false };

function UnitsTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_UNIT_FORM);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [removing, setRemoving] = useState<Unit | null>(null);
  const [error, setError] = useState<unknown>(null);
  const { data: units, isLoading } = useQuery({ queryKey: ['units'], queryFn: () => api.get<Unit[]>('/units') });

  const reset = () => { setEditing(null); setForm(EMPTY_UNIT_FORM); setError(null); };

  const save = useMutation({
    mutationFn: () => (editing ? api.put(`/units/${editing.id}`, form) : api.post('/units', form)),
    onSuccess: () => { reset(); queryClient.invalidateQueries({ queryKey: ['units'] }); },
    onError: setError,
  });

  const removeUnit = useMutation({
    mutationFn: (id: string) => api.del<{ archived?: boolean; deleted?: boolean }>(`/units/${id}`),
    onSuccess: (_r, id) => {
      setRemoving(null);
      if (editing?.id === id) reset();
      queryClient.invalidateQueries({ queryKey: ['units'] });
    },
    onError: (err) => { setRemoving(null); setError(err); },
  });

  // Escape anywhere clears the editor back to add-mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') reset(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading || !units) return <Spinner />;

  return (
    // Clicking anywhere outside a unit card / the editor clears the form.
    <div className="grid gap-4 md:grid-cols-2" onClick={reset}>
      <Card title="Units of measure">
        <div className="grid grid-cols-2 gap-2">
          {units.filter((u) => u.status === 'active').map((u) => (
            <div
              key={u.id}
              onClick={(e) => {
                e.stopPropagation();
                setEditing(u);
                setForm({ name: u.name, abbreviation: u.abbreviation, measurementType: u.measurementType, fractionalAllowed: u.fractionalAllowed });
                setError(null);
              }}
              className={`group relative cursor-pointer rounded-md border px-3 py-2 text-sm transition-colors ${
                editing?.id === u.id ? 'border-brand-500 bg-brand-50/50' : 'border-stone-100 hover:border-brand-300'
              }`}
            >
              <p className="font-medium">{u.name} ({u.abbreviation})</p>
              <p className="text-xs text-stone-400">{u.measurementType}{u.fractionalAllowed ? ' · fractional' : ''}</p>
              <button
                aria-label={`Remove ${u.name}`}
                title="Remove unit"
                className="absolute right-1.5 top-1.5 hidden rounded p-1 text-stone-300 hover:bg-red-50 hover:text-red-600 group-hover:block cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setRemoving(u); }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </Card>
      <Card title={editing ? `Edit ${editing.name}` : 'Unit editor'}>
        <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
          {!editing && <p className="-mt-1 text-xs text-stone-400">Fill the fields to add a unit — or click a unit on the left to edit it.</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Abbreviation"><Input value={form.abbreviation} onChange={(e) => setForm({ ...form, abbreviation: e.target.value })} /></Field>
          </div>
          <Field label="Measurement type">
            <Select value={form.measurementType} onChange={(e) => setForm({ ...form, measurementType: e.target.value })}>
              {['length', 'volume', 'weight', 'count'].map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Checkbox label="Fractional quantities allowed" checked={form.fractionalAllowed} onChange={(e) => setForm({ ...form, fractionalAllowed: e.target.checked })} />
          <ErrorNote error={error} />
          <div className="flex gap-2">
            {editing && <Button variant="outline" className="flex-1" onClick={reset}>Cancel</Button>}
            <Button className="flex-1" loading={save.isPending} disabled={!form.name.trim() || !form.abbreviation.trim()} onClick={() => save.mutate()}>
              {editing ? 'Save changes' : 'Add unit'}
            </Button>
          </div>
        </div>
      </Card>

      {removing && (
        <Dialog open onClose={() => setRemoving(null)} title="Remove unit">
          <div className="space-y-4">
            <p className="text-sm text-stone-600">
              Remove the unit <b>{removing.name} ({removing.abbreviation})</b>?
            </p>
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              If this unit is in use by products or categories it will be archived instead of deleted,
              so existing products keep working.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
              <Button variant="danger" loading={removeUnit.isPending} onClick={() => removeUnit.mutate(removing.id)}>
                Remove unit
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
