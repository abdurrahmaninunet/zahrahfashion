'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { naira, toKobo } from '@/lib/format';
import { BackLink, Button, Card, ErrorNote, Input, PageHeader, Textarea } from '@/components/ui';

interface Line { key: number; variantId: string; label: string; quantity: string; unitCost: string }

export default function ReceiveStockPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>(null);

  const { data: results } = useQuery({
    queryKey: ['receive-search', search],
    queryFn: () => api.get<{ rows: { id: string; name: string }[] }>(`/products?q=${encodeURIComponent(search)}`),
    enabled: search.trim().length >= 2,
  });

  const post = useMutation({
    mutationFn: () => api.post('/inventory/receipts', {
      note: note || undefined,
      lines: lines.map((l) => ({
        variantId: l.variantId,
        quantity: Number(l.quantity),
        unitCost: l.unitCost ? toKobo(l.unitCost) : null,
      })),
    }),
    onSuccess: () => router.push('/inventory'),
    onError: setError,
  });

  async function addProduct(productId: string) {
    const detail = await api.get<{ name: string; variants: { id: string; sku: string; costPrice: number | null; optionValues: Record<string, string>; status: string }[] }>(`/products/${productId}`);
    for (const v of detail.variants.filter((x) => x.status === 'active')) {
      if (!lines.some((l) => l.variantId === v.id)) {
        const optionLabel = Object.values(v.optionValues ?? {}).join(' / ');
        setLines((prev) => [...prev, {
          key: Date.now() + Math.random(),
          variantId: v.id,
          label: `${detail.name}${optionLabel ? ` — ${optionLabel}` : ''} (${v.sku})`,
          quantity: '',
          unitCost: v.costPrice != null ? String(v.costPrice / 100) : '',
        }]);
      }
    }
    setSearch('');
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <BackLink href="/inventory" label="Back to inventory" />
      <PageHeader title="Receive stock" subtitle="Posts RECEIPT movements and updates last cost" />
      <Card>
        <div className="relative mb-3">
          <Input placeholder="Search product to add its variants…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {results && search.trim().length >= 2 && (
            <div className="absolute top-full z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white shadow-lg">
              {results.rows.map((p) => (
                <button key={p.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-stone-50 cursor-pointer" onClick={() => addProduct(p.id)}>{p.name}</button>
              ))}
            </div>
          )}
        </div>
        {lines.length > 0 && (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-stone-400"><th>Variant</th><th className="w-28">Qty received</th><th className="w-32">Unit cost (₦)</th><th className="w-10" /></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {lines.map((line) => (
                <tr key={line.key}>
                  <td className="py-2 pr-2">{line.label}</td>
                  <td><Input type="number" step="0.5" min="0" value={line.quantity} onChange={(e) => setLines(lines.map((l) => (l.key === line.key ? { ...l, quantity: e.target.value } : l)))} /></td>
                  <td><Input type="number" value={line.unitCost} onChange={(e) => setLines(lines.map((l) => (l.key === line.key ? { ...l, unitCost: e.target.value } : l)))} /></td>
                  <td><button className="text-stone-400 hover:text-red-600 cursor-pointer" onClick={() => setLines(lines.filter((l) => l.key !== line.key))}><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Textarea className="mt-3" rows={2} placeholder="Note / supplier invoice ref (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="mt-2 text-xs text-stone-400">
          Total cost value: {naira(lines.reduce((s, l) => s + (l.unitCost && l.quantity ? Math.round(Number(l.unitCost) * 100 * Number(l.quantity)) : 0), 0))}
        </p>
        <ErrorNote error={error} />
        <Button className="mt-3 w-full" loading={post.isPending}
          disabled={!lines.length || lines.some((l) => !l.quantity || Number(l.quantity) <= 0)}
          onClick={() => post.mutate()}>
          Post receipt
        </Button>
      </Card>
    </div>
  );
}
