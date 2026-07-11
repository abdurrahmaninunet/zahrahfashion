'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { BackLink, Badge, Button, Checkbox, Dialog, ErrorNote, Field, PageHeader, Select, Spinner, Table, Td, statusColor } from '@/components/ui';

interface Stocktake { id: string; scopeCategoryId: string | null; blind: boolean; status: string; createdAt: string; approvedAt: string | null; _count: { lines: number } }

export default function StocktakesPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [scopeCategoryId, setScopeCategoryId] = useState('');
  const [blind, setBlind] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const { data: stocktakes, isLoading } = useQuery({ queryKey: ['stocktakes'], queryFn: () => api.get<Stocktake[]>('/inventory/stocktakes') });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: () => api.get<{ id: string; name: string }[]>('/categories') });

  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>('/inventory/stocktakes', { scopeCategoryId: scopeCategoryId || null, blind }),
    onSuccess: (s) => router.push(`/inventory/stocktakes/${s.id}`),
    onError: setError,
  });

  const catName = (id: string | null) => (id ? categories?.find((c) => c.id === id)?.name ?? id : 'Full store');

  return (
    <div className="mx-auto w-full max-w-6xl">
      <BackLink href="/inventory" label="Back to inventory" />
      <PageHeader title="Stocktakes" action={<Button onClick={() => setCreating(true)}><Plus size={15} /> Start stocktake</Button>} />
      {isLoading ? <Spinner /> : (
        <Table headers={['Started', 'Scope', 'Lines', 'Blind', 'Status']} empty="No stocktakes yet">
          {stocktakes?.map((s) => (
            <tr key={s.id} className="cursor-pointer hover:bg-stone-50" onClick={() => router.push(`/inventory/stocktakes/${s.id}`)}>
              <Td className="text-stone-500">{formatDateTime(s.createdAt)}</Td>
              <Td>{catName(s.scopeCategoryId)}</Td>
              <Td>{s._count.lines}</Td>
              <Td>{s.blind ? 'Yes' : 'No'}</Td>
              <Td><Badge color={statusColor(s.status)}>{s.status}</Badge></Td>
            </tr>
          ))}
        </Table>
      )}
      <Dialog open={creating} onClose={() => setCreating(false)} title="Start a stocktake">
        <div className="space-y-3">
          <Field label="Scope">
            <Select value={scopeCategoryId} onChange={(e) => setScopeCategoryId(e.target.value)}>
              <option value="">Full store</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Checkbox label="Blind count — hide system quantities while counting" checked={blind} onChange={(e) => setBlind(e.target.checked)} />
          <ErrorNote error={error} />
          <Button className="w-full" loading={create.isPending} onClick={() => create.mutate()}>Generate count sheet</Button>
        </div>
      </Dialog>
    </div>
  );
}
