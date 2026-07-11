'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDateTime, formatDate } from '@/lib/format';
import { Badge, Button, Card, Dialog, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui';

const TOPICS = ['order_status', 'payment', 'delivery', 'return_refund', 'complaint', 'pre_sales', 'wholesale_asoebi', 'account_privacy', 'other'];
const CHANNELS = ['whatsapp', 'phone', 'instagram', 'email', 'in_store'];

interface Interaction {
  id: string; channel: string; topic: string; summary: string; outcome: string;
  followUpAt: string | null; followUpStatus: string; orderId: string | null;
  staffName: string; createdAt: string; detail: { yardage?: number; fabric?: string; eventDate?: string } | null;
}

/** A4 Interactions Log — profile tab + log dialog (≤3 required inputs). */
export function InteractionsTab({ customerId, orderId }: { customerId: string; orderId?: string }) {
  const queryClient = useQueryClient();
  const [logging, setLogging] = useState(false);
  const { data } = useQuery({
    queryKey: ['interactions', customerId],
    queryFn: () => api.get<{ lastContact: { at: string; topic: string } | null; interactions: Interaction[] }>(`/support/interactions/customer/${customerId}`),
  });

  return (
    <Card
      title={data?.lastContact ? `Interactions — last contact ${formatDate(data.lastContact.at)} (${data.lastContact.topic.replace(/_/g, ' ')})` : 'Interactions'}
      action={<Button size="sm" onClick={() => setLogging(true)}>Log interaction</Button>}
    >
      <div className="space-y-2">
        {data?.interactions.map((i) => (
          <div key={i.id} className="rounded-md border border-stone-100 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge color="blue">{i.channel}</Badge>
              <Badge>{i.topic.replace(/_/g, ' ')}</Badge>
              <Badge color={i.outcome === 'resolved' ? 'green' : i.outcome === 'promised_action' ? 'amber' : i.outcome === 'escalated' ? 'red' : 'gray'}>
                {i.outcome.replace(/_/g, ' ')}
              </Badge>
              {i.followUpStatus === 'due' && i.followUpAt && (
                <Badge color={new Date(i.followUpAt) <= new Date() ? 'red' : 'amber'}>follow up {formatDate(i.followUpAt)}</Badge>
              )}
              {i.followUpStatus === 'done' && <Badge color="green">followed up ✓</Badge>}
            </div>
            <p className="mt-1.5">{i.summary}</p>
            {i.detail && (i.detail.yardage || i.detail.fabric) && (
              <p className="mt-1 text-xs text-purple-700">
                Wholesale lead: {i.detail.yardage ? `${i.detail.yardage} yards` : ''} {i.detail.fabric ?? ''} {i.detail.eventDate ? `· event ${i.detail.eventDate}` : ''}
              </p>
            )}
            <p className="mt-1 text-xs text-stone-400">{i.staffName} · {formatDateTime(i.createdAt)}{i.orderId ? ' · linked to order' : ''}</p>
          </div>
        ))}
        {!data?.interactions.length && <p className="py-6 text-center text-sm text-stone-400">No support contacts logged yet</p>}
      </div>
      {logging && (
        <LogInteractionDialog
          customerId={customerId}
          orderId={orderId}
          onClose={() => setLogging(false)}
          onSaved={() => { setLogging(false); queryClient.invalidateQueries({ queryKey: ['interactions', customerId] }); }}
        />
      )}
    </Card>
  );
}

export function LogInteractionDialog({ customerId, orderId, parentId, onClose, onSaved }: {
  customerId: string; orderId?: string; parentId?: string; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ channel: 'whatsapp', topic: 'order_status', summary: '', outcome: 'resolved', followUpAt: '' });
  const [wholesale, setWholesale] = useState({ yardage: '', fabric: '', eventDate: '' });
  const [error, setError] = useState<unknown>(null);

  const save = useMutation({
    mutationFn: () => api.post('/support/interactions', {
      customerId,
      orderId: orderId ?? null,
      parentId: parentId ?? null,
      channel: form.channel,
      topic: form.topic,
      summary: form.summary,
      outcome: form.outcome,
      followUpAt: form.followUpAt ? new Date(form.followUpAt).toISOString() : null,
      detail: form.topic === 'wholesale_asoebi'
        ? { yardage: wholesale.yardage ? Number(wholesale.yardage) : undefined, fabric: wholesale.fabric || undefined, eventDate: wholesale.eventDate || undefined }
        : undefined,
    }),
    onSuccess: onSaved,
    onError: setError,
  });

  return (
    <Dialog open onClose={onClose} title="Log interaction (≤20 seconds)">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Channel">
            <Select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              {CHANNELS.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </Select>
          </Field>
          <Field label="Topic">
            <Select value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
              {TOPICS.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={`Summary (${form.summary.length}/280) — outcome-focused, one line`}>
          <Textarea rows={2} maxLength={280} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })}
            placeholder="Promised replacement scarf ships Wednesday" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Outcome">
            <Select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })}>
              <option value="resolved">Resolved</option>
              <option value="promised_action">Promised action</option>
              <option value="escalated">Escalated</option>
              <option value="no_action_needed">No action needed</option>
            </Select>
          </Field>
          <Field label={`Follow-up date${form.outcome === 'promised_action' ? ' (required)' : ''}`}>
            <Input type="date" value={form.followUpAt} onChange={(e) => setForm({ ...form, followUpAt: e.target.value })} />
          </Field>
        </div>
        {form.topic === 'wholesale_asoebi' && (
          <div className="grid grid-cols-3 gap-3 rounded-md bg-purple-50 p-3">
            <Field label="Yardage"><Input type="number" value={wholesale.yardage} onChange={(e) => setWholesale({ ...wholesale, yardage: e.target.value })} /></Field>
            <Field label="Fabric"><Input value={wholesale.fabric} onChange={(e) => setWholesale({ ...wholesale, fabric: e.target.value })} /></Field>
            <Field label="Event date"><Input type="date" value={wholesale.eventDate} onChange={(e) => setWholesale({ ...wholesale, eventDate: e.target.value })} /></Field>
          </div>
        )}
        <ErrorNote error={error} />
        <Button className="w-full" loading={save.isPending} disabled={form.summary.trim().length < 3} onClick={() => save.mutate()}>
          Log it
        </Button>
      </div>
    </Dialog>
  );
}
