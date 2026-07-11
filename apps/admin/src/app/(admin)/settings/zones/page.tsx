'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { naira, toKobo, nairaInput } from '@/lib/format';
import { Badge, Button, Checkbox, Dialog, ErrorNote, Field, Input, PageHeader, Spinner, Table, Td, Textarea, statusColor } from '@/components/ui';

interface Zone {
  id: string; name: string; areasText: string; deliveryFee: number;
  podAllowed: boolean; podMaxValue: number | null; sortOrder: number; status: string;
}

export default function ZonesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Zone | 'new' | null>(null);
  const { data: zones, isLoading } = useQuery({ queryKey: ['zones'], queryFn: () => api.get<Zone[]>('/zones') });

  if (isLoading) return <Spinner />;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Delivery states" subtitle="Fees per state; orders snapshot their fee"
        action={<Button onClick={() => setEditing('new')}><Plus size={15} /> New state</Button>} />
      {/* POD disabled — restore 'POD' header + podAllowed cell to re-enable pay on delivery */}
      <Table headers={['State', 'Areas', 'Delivery fee', 'Status']} empty="No states">
        {zones?.map((zone) => (
          <tr key={zone.id} className="cursor-pointer hover:bg-stone-50" onClick={() => setEditing(zone)}>
            <Td className="font-medium">{zone.name}</Td>
            <Td className="max-w-64 truncate text-stone-500">{zone.areasText}</Td>
            <Td>{naira(zone.deliveryFee)}</Td>
            {/* <Td>{zone.podAllowed ? <Badge color="green">up to {naira(zone.podMaxValue)}</Badge> : <Badge>prepaid only</Badge>}</Td> */}
            <Td><Badge color={statusColor(zone.status)}>{zone.status}</Badge></Td>
          </tr>
        ))}
      </Table>
      {editing && (
        <ZoneDialog zone={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); queryClient.invalidateQueries({ queryKey: ['zones'] }); }} />
      )}
    </div>
  );
}

function ZoneDialog({ zone, onClose, onSaved }: { zone: Zone | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: zone?.name ?? '',
    areasText: zone?.areasText ?? '',
    deliveryFee: nairaInput(zone?.deliveryFee ?? 0),
    podAllowed: zone?.podAllowed ?? false,
    podMaxValue: nairaInput(zone?.podMaxValue ?? null),
  });
  const [error, setError] = useState<unknown>(null);
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        areasText: form.areasText,
        deliveryFee: toKobo(form.deliveryFee || 0),
        podAllowed: form.podAllowed,
        podMaxValue: form.podAllowed && form.podMaxValue ? toKobo(form.podMaxValue) : null,
      };
      return zone ? api.put(`/zones/${zone.id}`, body) : api.post('/zones', body);
    },
    onSuccess: onSaved,
    onError: setError,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const del = useMutation({
    mutationFn: () => api.del(`/zones/${zone!.id}`),
    onSuccess: onSaved,
    onError: setError,
  });

  return (
    <Dialog open onClose={onClose} title={zone ? `Edit ${zone.name}` : 'New state'}>
      <div className="space-y-3">
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Areas covered"><Textarea rows={2} value={form.areasText} onChange={(e) => setForm({ ...form, areasText: e.target.value })} /></Field>
        <Field label="Delivery fee (₦)"><Input type="number" value={form.deliveryFee} onChange={(e) => setForm({ ...form, deliveryFee: e.target.value })} /></Field>
        {/* POD disabled — restore to re-enable pay on delivery
        <Checkbox label="Pay-on-delivery allowed (policy: Lagos zones only at launch)" checked={form.podAllowed} onChange={(e) => setForm({ ...form, podAllowed: e.target.checked })} />
        {form.podAllowed && (
          <Field label="POD max order value (₦)"><Input type="number" value={form.podMaxValue} onChange={(e) => setForm({ ...form, podMaxValue: e.target.value })} /></Field>
        )} */}
        <ErrorNote error={error} />
        <div className="flex gap-2">
          <Button className="flex-1" loading={save.isPending} disabled={!form.name.trim()} onClick={() => save.mutate()}>Save state</Button>
          {zone && <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>}
        </div>
        {confirmDelete && zone && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm">
            <p className="text-red-700">Delete <b>{zone.name}</b>? Past orders keep the fee they were charged but lose the state label. This cannot be undone.</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="danger" loading={del.isPending} onClick={() => del.mutate()}>Yes, delete</Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
