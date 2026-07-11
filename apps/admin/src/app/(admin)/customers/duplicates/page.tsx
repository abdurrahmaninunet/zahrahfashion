'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { naira, formatDate } from '@/lib/format';
import { BackLink, Badge, Button, Card, ErrorNote, PageHeader, Spinner } from '@/components/ui';

interface Candidate {
  reason: string;
  customers: { id: string; fullName: string; primaryPhone: string; email: string | null; metrics: { orders?: number; spend?: number } | null; createdAt: string }[];
}

export default function DuplicatesPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const { data: candidates, isLoading } = useQuery({
    queryKey: ['duplicates'],
    queryFn: () => api.get<Candidate[]>('/customers/duplicates'),
  });

  const merge = useMutation({
    mutationFn: ({ survivorId, mergedId }: { survivorId: string; mergedId: string }) =>
      api.post('/customers/merge', { survivorId, mergedId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['duplicates'] }),
    onError: setError,
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <BackLink href="/customers" label="Back to customers" />
      <PageHeader title="Duplicate candidates" subtitle="Merging is irreversible — orders, addresses, notes and tags consolidate onto the survivor" />
      <ErrorNote error={error} />
      <div className="space-y-4">
        {candidates?.map((candidate, ci) => (
          <Card key={ci} title={<span>Match reason: <Badge color="amber">{candidate.reason.replace('_', ' ')}</Badge></span>}>
            <div className="space-y-2">
              {candidate.customers.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-100 p-3 text-sm">
                  <div>
                    <p className="font-medium">{c.fullName}</p>
                    <p className="text-xs text-stone-400">{c.primaryPhone} {c.email ? `· ${c.email}` : ''} · created {formatDate(c.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-stone-500">{c.metrics?.orders ?? 0} orders · {naira(c.metrics?.spend ?? 0)}</span>
                    <Button size="sm" variant="outline" loading={merge.isPending}
                      onClick={() => {
                        const other = candidate.customers.find((x) => x.id !== c.id);
                        if (other && confirm(`Merge "${other.fullName}" INTO "${c.fullName}"? This cannot be undone.`)) {
                          merge.mutate({ survivorId: c.id, mergedId: other.id });
                        }
                      }}>
                      Keep this one
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
        {!candidates?.length && <p className="py-10 text-center text-sm text-stone-400">No duplicate candidates found 🎉</p>}
      </div>
    </div>
  );
}
