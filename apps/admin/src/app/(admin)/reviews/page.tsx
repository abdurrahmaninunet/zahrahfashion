'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Mail, Phone, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Card, PageHeader, Spinner } from '@/components/ui';
import { formatDate } from '@/lib/format';

interface ReviewRow {
  id: string; rating: number; body: string | null; status: 'visible' | 'hidden'; flagged: boolean; createdAt: string;
  product: { name: string; slug: string } | null;
  customer: { name: string; email: string | null; phone: string } | null;
}

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'visible', label: 'Visible' },
  { key: 'hidden', label: 'Hidden' },
] as const;

/** Comments — product reviews with manual moderation. Read them; toggle off any
 *  with cursing or harassment. Auto-flagged (profane) reviews arrive hidden. */
export default function ReviewsAdminPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reviews', tab],
    queryFn: () => api.get<{ rows: ReviewRow[]; total: number }>(`/reviews${tab === 'all' ? '' : `?status=${tab}`}`),
  });
  const toggle = useMutation({
    mutationFn: ({ id, next }: { id: string; next: 'visible' | 'hidden' }) => api.put(`/reviews/${id}`, { status: next }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reviews'] }),
  });

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader title="Comments" subtitle="Product reviews — read them and toggle off anything with cursing or harassment" />

      <nav className="mb-4 flex gap-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${tab === t.key ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
            {t.label}
          </button>
        ))}
      </nav>

      {isLoading ? (
        <Spinner />
      ) : data?.rows.length ? (
        <div className="space-y-3">
          {data.rows.map((r) => (
            <div key={r.id} className={`rounded-xl border bg-white p-4 shadow-sm ${r.status === 'hidden' ? 'border-stone-200 opacity-80' : 'border-stone-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-0.5">
                      {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={14} className={i < r.rating ? 'fill-amber-400 text-amber-400' : 'fill-stone-200 text-stone-200'} />)}
                    </span>
                    {r.product && <span className="text-sm font-medium text-stone-800">{r.product.name}</span>}
                    {r.flagged && <Badge color="red"><AlertTriangle size={11} /> Flagged</Badge>}
                    <span className="text-xs text-stone-400">{formatDate(r.createdAt)}</span>
                  </div>
                  {r.body ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{r.body}</p>
                  ) : (
                    <p className="mt-2 text-sm italic text-stone-400">(rating only — no comment)</p>
                  )}
                  {/* Reviewer contact — under the comment */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
                    <span className="font-medium text-stone-600">{r.customer?.name ?? 'Unknown'}</span>
                    {r.customer?.email && <span className="inline-flex items-center gap-1"><Mail size={12} /> {r.customer.email}</span>}
                    {r.customer?.phone && <span className="inline-flex items-center gap-1"><Phone size={12} /> {r.customer.phone}</span>}
                  </div>
                </div>

                {/* Visible/hidden toggle */}
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <button
                    type="button"
                    aria-label={r.status === 'visible' ? 'Hide review' : 'Show review'}
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ id: r.id, next: r.status === 'visible' ? 'hidden' : 'visible' })}
                    className={`relative h-6 w-11 rounded-full transition-colors cursor-pointer disabled:opacity-50 ${r.status === 'visible' ? 'bg-emerald-500' : 'bg-stone-300'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${r.status === 'visible' ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                  <span className={`text-[11px] font-medium ${r.status === 'visible' ? 'text-emerald-600' : 'text-stone-400'}`}>{r.status === 'visible' ? 'Visible' : 'Hidden'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <div className="py-14 text-center">
            <p className="font-medium text-stone-700">No comments{tab !== 'all' ? ` (${tab})` : ''} yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">Customer reviews will appear here as shoppers rate products they&apos;ve bought.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
