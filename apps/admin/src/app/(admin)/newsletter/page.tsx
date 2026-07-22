'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Check, Mail, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, Input, PageHeader, Spinner } from '@/components/ui';
import { formatDate } from '@/lib/format';

interface SubscriberRow { id: string; email: string; source: string | null; createdAt: string }

/** Newsletter — email addresses captured by the storefront footer sign-up. */
export default function NewsletterAdminPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['newsletter', q],
    queryFn: () => api.get<{ rows: SubscriberRow[]; total: number }>(`/newsletter${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/newsletter/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['newsletter'] }),
  });

  const rows = data?.rows ?? [];

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(rows.map((r) => r.email).join(', '));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader title="Newsletter" subtitle="Email addresses collected from the storefront footer sign-up" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <Mail size={16} className="text-stone-400" />
          <span className="font-semibold text-stone-800">{data?.total ?? 0}</span> subscriber{data?.total === 1 ? '' : 's'}
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Search email…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-56" />
          <Button variant="outline" onClick={copyAll} disabled={!rows.length}>
            {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy all</>}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : rows.length ? (
        <Card>
          <div className="divide-y divide-stone-100">
            {rows.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <a href={`mailto:${s.email}`} className="text-sm font-medium text-stone-800 hover:text-brand-700 hover:underline">{s.email}</a>
                  <p className="mt-0.5 text-xs text-stone-400">
                    {formatDate(s.createdAt)}{s.source ? ` · via ${s.source}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => remove.mutate(s.id)}
                  title="Remove subscriber"
                  className="shrink-0 rounded-md p-1.5 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-200 py-16 text-center text-sm text-stone-400">
          No sign-ups yet — emails from the storefront footer will appear here.
        </p>
      )}
    </div>
  );
}
