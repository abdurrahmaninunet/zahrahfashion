'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Dialog, ErrorNote, Field, Input, PageHeader, Pagination, Spinner, Table, Td } from '@/components/ui';

interface CustomerRow {
  id: string; fullName: string; primaryPhone: string; email: string | null; type: string; status: string;
  addresses: { addressLine: string; area: string | null; city: string | null }[];
  createdAt: string;
}

export default function CustomersPage() {
  const router = useRouter();
  const { hasCap } = useAuth();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const query = new URLSearchParams({ ...(q ? { q } : {}), page: String(page) });
  const { data, isLoading } = useQuery({
    queryKey: ['customers', query.toString()],
    queryFn: () => api.get<{ total: number; page: number; pageSize: number; rows: CustomerRow[] }>(`/customers?${query}`),
  });

  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <PageHeader
        title="Customers"
        subtitle="Customer details are auto-populated from the storefront"
        /* Manual creation & duplicate-merge disabled — customers come from the
           storefront (checkout / registration). Uncomment to restore:
        action={
          <div className="flex gap-2">
            {hasCap('customers.merge') && (
              <Button variant="outline" onClick={() => router.push('/customers/duplicates')}><Users size={15} /> Duplicates</Button>
            )}
            {hasCap('customers.create_edit') && <Button onClick={() => setCreating(true)}><Plus size={15} /> Add customer</Button>}
          </div>
        }
        */
      />
      <div className="mb-3">
        <Input placeholder="Search name, phone (any format), email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="max-w-sm" />
      </div>
      {isLoading ? <Spinner /> : (
        <>
          {/* Live data — updated whenever the customer edits their storefront profile. */}
          <Table headers={['Customer name', 'Phone', 'Email', 'Address']} empty="No customers found">
            {data?.rows.map((c) => {
              const address = c.addresses?.[0];
              return (
                <tr key={c.id} className="cursor-pointer hover:bg-stone-50" onClick={() => router.push(`/customers/${c.id}`)}>
                  <Td className="font-medium">{c.fullName}</Td>
                  <Td>{c.primaryPhone}</Td>
                  <Td className="text-stone-500">{c.email ?? '—'}</Td>
                  <Td className="text-stone-500">
                    {address ? [address.addressLine, address.area, address.city].filter(Boolean).join(', ') : '—'}
                  </Td>
                </tr>
              );
            })}
          </Table>
          {data && <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
        </>
      )}
      {creating && <CreateCustomerDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateCustomerDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', tags: '' });
  const [error, setError] = useState<unknown>(null);
  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>('/customers', {
      fullName: form.fullName,
      phone: form.phone,
      email: form.email || null,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    }),
    onSuccess: (c) => router.push(`/customers/${c.id}`),
    onError: setError,
  });
  return (
    <Dialog open onClose={onClose} title="Add customer">
      <div className="space-y-3">
        <Field label="Full name"><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0803 123 4567" /></Field>
        <Field label="Email (optional)"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Tags">
          <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        </Field>
        <ErrorNote error={error} />
        <Button className="w-full" loading={create.isPending} disabled={!form.fullName.trim() || !form.phone.trim()} onClick={() => create.mutate()}>
          Create customer
        </Button>
      </div>
    </Dialog>
  );
}
