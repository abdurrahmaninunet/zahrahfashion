'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Phone } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Card, PageHeader, Spinner } from '@/components/ui';
import { formatDate } from '@/lib/format';

interface MessageRow {
  id: string; name: string | null; email: string; phone: string | null;
  subject: string | null; body: string; status: 'new' | 'read'; createdAt: string;
}

const TABS = [
  { key: 'new', label: 'New' },
  { key: 'all', label: 'All' },
  { key: 'read', label: 'Read' },
] as const;

/** Contact — the storefront contact-form inbox (one-way). Read messages and
 *  mark them as handled. Replies happen over email/phone, not here. */
export default function ContactAdminPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('new');

  const { data, isLoading } = useQuery({
    queryKey: ['contact', tab],
    queryFn: () => api.get<{ rows: MessageRow[]; total: number; unread: number }>(`/contact${tab === 'all' ? '' : `?status=${tab}`}`),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'new' | 'read' }) => api.put(`/contact/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact'] }),
  });

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader title="Contact" subtitle="Messages sent from the storefront contact form" />

      <nav className="mb-4 flex gap-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${tab === t.key ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
            {t.label}
            {t.key === 'new' && data && data.unread > 0 && (
              <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${tab === 'new' ? 'bg-white text-brand-700' : 'bg-brand-600 text-white'}`}>{data.unread}</span>
            )}
          </button>
        ))}
      </nav>

      {isLoading ? (
        <Spinner />
      ) : data?.rows.length ? (
        <div className="space-y-3">
          {data.rows.map((m) => (
            <div key={m.id} className={`rounded-xl border bg-white p-4 shadow-sm ${m.status === 'new' ? 'border-brand-300' : 'border-stone-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-stone-800">{m.name || 'Someone'}</span>
                    {m.status === 'new' && <Badge color="blue">New</Badge>}
                    <span className="text-xs text-stone-400">{formatDate(m.createdAt)}</span>
                  </div>
                  {m.subject && <p className="mt-1 text-sm font-medium text-stone-700">{m.subject}</p>}
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{m.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
                    <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1 hover:text-brand-700 hover:underline"><Mail size={12} /> {m.email}</a>
                    {m.phone && <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1 hover:text-brand-700 hover:underline"><Phone size={12} /> {m.phone}</a>}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={setStatus.isPending}
                  onClick={() => setStatus.mutate({ id: m.id, status: m.status === 'new' ? 'read' : 'new' })}
                  className="shrink-0 rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-stone-500 disabled:opacity-50 cursor-pointer"
                >
                  {m.status === 'new' ? 'Mark read' : 'Mark unread'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <div className="py-14 text-center">
            <Mail size={28} className="mx-auto text-stone-300" />
            <p className="mt-3 font-medium text-stone-700">No messages{tab !== 'all' ? ` (${tab})` : ''}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">Messages customers send from the storefront contact form will land here.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
