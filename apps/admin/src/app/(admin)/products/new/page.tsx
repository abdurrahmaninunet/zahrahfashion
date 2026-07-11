'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BackLink, Button, Card, ErrorNote, Field, Input, PageHeader, Select, Textarea } from '@/components/ui';

interface Category {
  id: string; name: string; parentId: string | null; status: string;
  attributes: { isRequired: boolean; attribute: { id: string; name: string; code: string; inputType: string; isVariantDefining: boolean; options: { label: string; value: string; status: string }[] } }[];
}

export default function NewProductPage() {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'standard' | 'bundle'>('standard');
  const [basePrice, setBasePrice] = useState('');
  const [tags, setTags] = useState('');
  const [attributeValues, setAttributeValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<unknown>(null);
  // Created from the MIM tab (?store=mim) → flag it as a MIM product on create.
  const [isMim, setIsMim] = useState(false);
  useEffect(() => { setIsMim(new URLSearchParams(window.location.search).get('store') === 'mim'); }, []);

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.get<Category[]>('/categories') });
  const category = categories?.find((c) => c.id === categoryId);

  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>('/products', {
      categoryId, name, brand: brand || undefined, description: description || undefined,
      type, basePrice: basePrice ? Math.round(Number(basePrice) * 100) : undefined,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      attributeValues,
      ...(isMim ? { flags: { mim: true } } : {}),
    }),
    onSuccess: (p) => router.push(`/products/${p.id}`),
    onError: setError,
  });

  return (
    <div className="mx-auto w-full max-w-4xl">
      <BackLink href={isMim ? '/mim' : '/products'} label={isMim ? 'Back to MIM Store' : 'Back to products'} />
      <PageHeader title={isMim ? 'Add MIM product' : 'Add product'} subtitle="Pick the category first — it defines the form" />
      {isMim && (
        <div className="mb-3 rounded-md border border-[#8a6d1f]/30 bg-[#faf5e6] px-3 py-2 text-sm text-[#6f571a]">
          This product will be added to the <b>MIM store</b> (custom printing) — it won&apos;t show in the main shop.
        </div>
      )}
      <Card>
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Category">
              <Select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setAttributeValues({}); }}>
                <option value="">Select a category…</option>
                {categories?.filter((c) => c.status === 'active').map((c) => (
                  <option key={c.id} value={c.id}>{c.parentId ? '— ' : ''}{c.name}</option>
                ))}
              </Select>
            </Field>
            {categoryId && <Field label="Product name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>}
          </div>
          {categoryId && (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <Field label="Brand (optional)"><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
                <Field label="Base price (₦)" hint="Used for the default variant; per-variant prices editable after creation">
                  <Input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
                </Field>
                <Field label="Tags (comma separated)"><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="new-arrival, eid" /></Field>
              </div>
              <Field label="Description"><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>

              {/* Variant-defining attributes (e.g. Colour, Volume) are chosen
                  per-variant after creation — never as a single product value. */}
              {category && category.attributes.some((ca) => ca.attribute.isVariantDefining) && (
                <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  <b>{category.attributes.filter((ca) => ca.attribute.isVariantDefining).map((ca) => ca.attribute.name).join(' and ')}</b>{' '}
                  {category.attributes.filter((ca) => ca.attribute.isVariantDefining).length === 1 ? 'is' : 'are'} chosen per variant —
                  after creating the draft, open the Variants tab and generate the combinations this product comes in.
                </p>
              )}
              {category && category.attributes.some((ca) => !ca.attribute.isVariantDefining) && (
                <div className="rounded-md border border-stone-100 bg-stone-50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-stone-400">{category.name} attributes</p>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {category.attributes.filter(({ attribute }) => !attribute.isVariantDefining).map(({ attribute, isRequired }) => (
                      <Field key={attribute.id} label={`${attribute.name}${isRequired ? ' *' : ''}`}>
                        {['select', 'color', 'image_option'].includes(attribute.inputType) ? (
                          <Select
                            value={(attributeValues[attribute.code] as string) ?? ''}
                            onChange={(e) => setAttributeValues({ ...attributeValues, [attribute.code]: e.target.value || undefined })}
                          >
                            <option value="">—</option>
                            {attribute.options.filter((o) => o.status === 'active').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </Select>
                        ) : attribute.inputType === 'number' ? (
                          <Input type="number" value={(attributeValues[attribute.code] as number) ?? ''}
                            onChange={(e) => setAttributeValues({ ...attributeValues, [attribute.code]: e.target.value === '' ? undefined : Number(e.target.value) })} />
                        ) : attribute.inputType === 'boolean' ? (
                          <Select value={String(attributeValues[attribute.code] ?? '')}
                            onChange={(e) => setAttributeValues({ ...attributeValues, [attribute.code]: e.target.value === '' ? undefined : e.target.value === 'true' })}>
                            <option value="">—</option><option value="true">Yes</option><option value="false">No</option>
                          </Select>
                        ) : (
                          <Input value={(attributeValues[attribute.code] as string) ?? ''}
                            onChange={(e) => setAttributeValues({ ...attributeValues, [attribute.code]: e.target.value || undefined })} />
                        )}
                      </Field>
                    ))}
                  </div>
                </div>
              )}
              <ErrorNote error={error} />
              <div className="flex justify-end">
                <Button className="min-w-52" loading={create.isPending} disabled={!name.trim()} onClick={() => create.mutate()}>
                  Create draft
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
