'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Mail, Phone, Unlock } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Card, PageHeader, Spinner } from '@/components/ui';
import { formatDate } from '@/lib/format';

interface LockRow {
  productId: string; lockedUntil: string;
  product: { name: string; slug: string } | null;
  customer: { name: string; email: string | null; phone: string } | null;
}

/** Live anko exclusivity locks — which fabric is reserved to which buyer, until
 *  when. Release one early to put it back on the anko market. Per-fabric anko
 *  pricing is set on each product (Details tab → Anko). */
export default function AnkoAdminPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['anko-locks'],
    queryFn: () => api.get<{ rows: LockRow[] }>('/anko/locks'),
  });
  const release = useMutation({
    mutationFn: (productId: string) => api.del(`/anko/locks/${productId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['anko-locks'] }),
  });

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader title="Anko locks" subtitle="Fabrics currently reserved exclusively to a buyer — set anko pricing on each product's Details tab" />

      {isLoading ? (
        <Spinner />
      ) : data?.rows.length ? (
        <div className="space-y-3">
          {data.rows.map((r) => (
            <div key={r.productId} className="flex items-start justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Lock size={14} className="text-[#8a6d1f]" />
                  <span className="text-sm font-medium text-stone-800">{r.product?.name ?? 'Unknown product'}</span>
                  <Badge color="amber">Exclusive until {formatDate(r.lockedUntil)}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
                  <span className="font-medium text-stone-600">{r.customer?.name ?? 'Unknown buyer'}</span>
                  {r.customer?.email && <span className="inline-flex items-center gap-1"><Mail size={12} /> {r.customer.email}</span>}
                  {r.customer?.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {r.customer.phone}</span>}
                </div>
              </div>
              <Button size="sm" variant="outline" loading={release.isPending} onClick={() => release.mutate(r.productId)}>
                <Unlock size={14} /> Release
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <div className="py-14 text-center">
            <Lock size={28} className="mx-auto text-stone-300" />
            <p className="mt-3 font-medium text-stone-700">No active anko locks</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">When a customer buys an anko fabric, it&apos;s reserved to them here for its exclusivity period. Enable anko on a fabric&apos;s Details tab.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
