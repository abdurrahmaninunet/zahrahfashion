'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { naira, formatDate, formatDateTime } from '@/lib/format';
import { BackLink, Badge, Button, Card, Dialog, ErrorNote, Field, Input, PageHeader, Select, Spinner, Table, Tabs, Td, Textarea, statusColor } from '@/components/ui';
import { InteractionsTab } from '@/components/interactions';

interface Profile {
  id: string; fullName: string; primaryPhone: string; altPhone: string | null; email: string | null;
  type: string; status: string; statusReason: string | null; failedPodCount: number;
  metrics: { orders?: number; spend?: number; aov?: number; firstOrderAt?: string; lastOrderAt?: string; refunds?: number; channels?: string[] } | null;
  addresses: { id: string; label: string | null; addressLine: string; area: string | null; city: string | null; isDefault: boolean; status: string }[];
  tags: { tag: string }[];
  notesList: { id: string; note: string; createdAt: string }[];
  consents: { id: string; type: string; status: string; source: string; createdAt: string }[];
  consentNow: Record<string, string>;
  aliases: { id: string; kind: string; value: string }[];
  orders: { id: string; orderNumber: string; status: string; paymentStatus: string; grandTotal: number; channel: string; createdAt: string }[];
  anonymizedAt: string | null;
  createdAt: string;
}

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasCap } = useAuth();
  const [tab, setTab] = useState('orders');
  const [statusDialog, setStatusDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get<Profile>(`/customers/${id}`),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['customer', id] });

  if (isLoading || !profile) return <Spinner />;
  const m = profile.metrics ?? {};
  const limited = !profile.orders; // fulfilment gets a reduced shape

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <BackLink href="/customers" label="Back to customers" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{profile.fullName}</h1>
            <Badge color={statusColor(profile.status)}>{profile.status.replace('_', ' ')}</Badge>
            {profile.tags?.map((t) => <Badge key={t.tag}>{t.tag}</Badge>)}
          </div>
          <p className="mt-0.5 text-sm text-stone-500">
            {profile.primaryPhone}{profile.email ? ` · ${profile.email}` : ''} · customer since {formatDate(profile.createdAt)}
          </p>
          {profile.statusReason && <p className="mt-1 text-sm text-red-600">Reason: {profile.statusReason}</p>}
        </div>
        <div className="flex gap-2">
          {hasCap('customers.create_edit') && <Button size="sm" variant="outline" onClick={() => setEditDialog(true)}>Edit details</Button>}
          {hasCap('customers.flags') && <Button size="sm" variant="outline" onClick={() => setStatusDialog(true)}>Set status</Button>}
          {hasCap('customers.ndpa') && <NdpaMenu customerId={id} fullName={profile.fullName} onChanged={invalidate} />}
        </div>
      </div>

      {!limited && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ['Orders', String(m.orders ?? 0)],
            ['Total spend', naira(m.spend ?? 0)],
            ['Average Order Value', naira(m.aov ?? 0)],
            ['First order', m.firstOrderAt ? formatDate(m.firstOrderAt) : '—'],
            ['Last order', m.lastOrderAt ? formatDate(m.lastOrderAt) : '—'],
            // POD disabled — restore to re-enable pay on delivery
            // ['Failed PODs', String(profile.failedPodCount)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-stone-200 bg-white p-3">
              <p className="text-xs text-stone-400">{label}</p>
              <p className="mt-0.5 font-bold">{value}</p>
            </div>
          ))}
        </div>
      )}

      <Tabs
        tabs={[
          { key: 'orders', label: 'Orders' },
          { key: 'addresses', label: `Addresses (${profile.addresses?.length ?? 0})` },
          { key: 'notes', label: 'Notes' },
          // Consent & privacy hidden — restore to show consent management again
          // { key: 'consent', label: 'Consent & privacy' },
          { key: 'interactions', label: 'Interactions' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'orders' && (
        <Table headers={['Order number', 'Date', 'Channel', 'Total', 'Payment', 'Status']} empty="No orders yet">
          {profile.orders?.map((o) => (
            <tr key={o.id} className="cursor-pointer hover:bg-stone-50" onClick={() => router.push(`/orders/${o.id}`)}>
              <Td className="font-medium text-brand-700">{o.orderNumber}</Td>
              <Td className="text-stone-500">{formatDate(o.createdAt)}</Td>
              <Td className="text-stone-500">{o.channel}</Td>
              <Td>{naira(o.grandTotal)}</Td>
              <Td><Badge color={o.paymentStatus === 'PAID' ? 'green' : 'amber'}>{o.paymentStatus.replace(/_/g, ' ').toLowerCase()}</Badge></Td>
              <Td><Badge color={statusColor(o.status)}>{o.status.replace(/_/g, ' ').toLowerCase()}</Badge></Td>
            </tr>
          ))}
        </Table>
      )}

      {tab === 'addresses' && <AddressesTab profile={profile} />}
      {tab === 'notes' && <NotesTab profile={profile} onChanged={invalidate} canEdit={hasCap('customers.notes_tags')} />}
      {/* Consent & privacy hidden — restore with the tab above to re-enable
      {tab === 'consent' && <ConsentTab profile={profile} onChanged={invalidate} canEdit={hasCap('customers.create_edit')} />} */}
      {tab === 'interactions' && <InteractionsTab customerId={id} />}

      {statusDialog && <StatusDialog customerId={id} current={profile.status} onClose={() => setStatusDialog(false)} onSaved={() => { setStatusDialog(false); invalidate(); }} />}
      {editDialog && <EditCustomerDialog profile={profile} onClose={() => setEditDialog(false)} onSaved={() => { setEditDialog(false); invalidate(); }} />}
    </div>
  );
}

function StatusDialog({ customerId, current, onClose, onSaved }: { customerId: string; current: string; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState(current);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  const save = useMutation({
    mutationFn: () => api.put(`/customers/${customerId}/status`, { status, reason: reason || undefined }),
    onSuccess: onSaved,
    onError: setError,
  });
  return (
    <Dialog open onClose={onClose} title="Customer status">
      <div className="space-y-3">
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="watch">Watch</option>
            {/* POD disabled — restore to re-enable pay on delivery
            <option value="pod_blocked">POD blocked</option> */}
            <option value="blocked">Blocked</option>
          </Select>
        </Field>
        {status !== 'active' && <Field label="Reason (required)"><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
        <ErrorNote error={error} />
        <Button className="w-full" loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
      </div>
    </Dialog>
  );
}

// Addresses are read-only in the admin — customers manage them from the storefront account.
// The previous manual "Add address" form lived here; restore from git history if admin entry is ever needed again.
function EditCustomerDialog({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.primaryPhone);
  const [altPhone, setAltPhone] = useState(profile.altPhone ?? '');
  const [email, setEmail] = useState(profile.email ?? '');
  const [error, setError] = useState<unknown>(null);
  const save = useMutation({
    mutationFn: () => api.put(`/customers/${profile.id}`, {
      fullName: fullName.trim(),
      phone: phone.trim(),
      altPhone: altPhone.trim() || null,
      email: email.trim() || null,
    }),
    onSuccess: onSaved,
    onError: setError,
  });
  return (
    <Dialog open onClose={onClose} title="Edit customer details">
      <div className="space-y-3">
        <Field label="Full name"><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
        <Field label="Phone" hint="Any Nigerian format — saved normalized (+234…)"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="Alternate phone (optional)"><Input value={altPhone} onChange={(e) => setAltPhone(e.target.value)} /></Field>
        <Field label="Email (optional)"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <ErrorNote error={error} />
        <Button className="w-full" loading={save.isPending} disabled={!fullName.trim() || !phone.trim()} onClick={() => save.mutate()}>Save changes</Button>
      </div>
    </Dialog>
  );
}

function AddressesTab({ profile }: { profile: Profile }) {
  const active = profile.addresses.filter((a) => a.status === 'active');
  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-400">Addresses are auto-populated from the storefront — customers add and edit them in their account.</p>
      {active.map((a) => (
        <Card key={a.id} title={<span className="flex items-center gap-2">{a.label ?? 'Address'}{a.isDefault && <Badge color="green">default</Badge>}</span>}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label="Address"><Input value={a.addressLine} readOnly className="bg-stone-50 text-stone-600" /></Field>
            </div>
            <Field label="Area"><Input value={a.area ?? '—'} readOnly className="bg-stone-50 text-stone-600" /></Field>
            <Field label="City"><Input value={a.city ?? '—'} readOnly className="bg-stone-50 text-stone-600" /></Field>
          </div>
        </Card>
      ))}
      {!active.length && (
        <Card>
          <p className="py-6 text-center text-sm text-stone-400">No addresses yet — they appear here once the customer saves one in the storefront.</p>
        </Card>
      )}
    </div>
  );
}

function NotesTab({ profile, onChanged, canEdit }: { profile: Profile; onChanged: () => void; canEdit: boolean }) {
  const [note, setNote] = useState('');
  const [tags, setTags] = useState(profile.tags.map((t) => t.tag).join(', '));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Notes (append-only, staff-visible)">
        {canEdit && (
          <div className="mb-3 flex gap-2">
            <Input placeholder="Add note…" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button size="sm" variant="secondary" onClick={async () => { if (!note.trim()) return; await api.post(`/customers/${profile.id}/notes`, { note }); setNote(''); onChanged(); }}>Add</Button>
          </div>
        )}
        <div className="space-y-2">
          {profile.notesList.map((n) => (
            <div key={n.id} className="rounded-md bg-stone-50 p-2 text-sm">
              <p>{n.note}</p>
              <p className="mt-0.5 text-xs text-stone-400">{formatDateTime(n.createdAt)}</p>
            </div>
          ))}
          {!profile.notesList.length && <p className="py-4 text-center text-sm text-stone-400">No notes yet</p>}
        </div>
      </Card>
      {canEdit && (
        <Card title="Tags">
          <Field label="Tags (comma-separated)">
            <Input value={tags} onChange={(e) => setTags(e.target.value)} />
          </Field>
          <Button className="mt-3" size="sm" onClick={async () => {
            await api.put(`/customers/${profile.id}/tags`, { tags: tags.split(',').map((t) => t.trim()).filter(Boolean) });
            onChanged();
          }}>Save tags</Button>
        </Card>
      )}
    </div>
  );
}

function ConsentTab({ profile, onChanged, canEdit }: { profile: Profile; onChanged: () => void; canEdit: boolean }) {
  const TYPES = ['marketing_email', 'marketing_sms', 'marketing_whatsapp'];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Current consent">
        <div className="space-y-2">
          {TYPES.map((type) => {
            const status = profile.consentNow?.[type];
            return (
              <div key={type} className="flex items-center justify-between text-sm">
                <span>{type.replace('marketing_', '').toUpperCase()} marketing</span>
                <div className="flex items-center gap-2">
                  <Badge color={status === 'granted' ? 'green' : 'gray'}>{status ?? 'no record'}</Badge>
                  {canEdit && (
                    <Button size="sm" variant="outline" onClick={async () => {
                      await api.post(`/customers/${profile.id}/consents`, { type, status: status === 'granted' ? 'revoked' : 'granted' });
                      onChanged();
                    }}>
                      {status === 'granted' ? 'Revoke' : 'Record grant'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="Consent history (append-only)">
        <div className="max-h-64 space-y-1 overflow-y-auto text-sm">
          {profile.consents.map((c) => (
            <p key={c.id} className="text-stone-600">
              <Badge color={c.status === 'granted' ? 'green' : 'red'}>{c.status}</Badge> {c.type} · {c.source} · {formatDateTime(c.createdAt)}
            </p>
          ))}
          {!profile.consents.length && <p className="py-4 text-center text-stone-400">No consent records</p>}
        </div>
      </Card>
    </div>
  );
}

function NdpaMenu({ customerId, fullName, onChanged }: { customerId: string; fullName: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const queryClient = useQueryClient();
  const { data: pending } = useQuery({
    queryKey: ['anon', customerId],
    queryFn: () => api.get<{ id: string; executeAfter: string } | null>(`/customers/${customerId}/anonymization`),
  });
  const close = () => { setOpen(false); setConfirming(false); setConfirmName(''); };
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['anon', customerId] }); onChanged(); };
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>NDPA</Button>
      <Dialog open={open} onClose={close} title="NDPA — data subject rights">
        <div className="space-y-3 text-sm">
          <div>
            <Button variant="outline" className="w-full" onClick={async () => {
              const data = await api.get(`/customers/${customerId}/ndpa-export`);
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `subject-access-${customerId}.json`;
              a.click();
            }}>
              Export customer data
            </Button>
            <p className="mt-1 text-xs text-stone-400">Downloads everything stored about this customer — send it to them when they ask what data you hold.</p>
          </div>
          {pending ? (
            <div className="rounded-md bg-amber-50 p-3">
              <p>Erasure scheduled for {formatDate(pending.executeAfter)}.</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={async () => {
                await api.del(`/customers/anonymization/${pending.id}`);
                refresh();
              }}>Cancel request</Button>
            </div>
          ) : confirming ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="font-medium text-red-700">Erase this customer&apos;s data?</p>
              <p className="mt-1 text-xs text-red-600">
                Name, phone, email, addresses and notes will be wiped after a 7-day grace period. Orders are kept but de-identified. This cannot be undone after it runs.
              </p>
              <Field label={`Type "${fullName}" to confirm`}>
                <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={fullName} />
              </Field>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="danger" className="flex-1" disabled={confirmName.trim() !== fullName} onClick={async () => {
                  await api.post(`/customers/${customerId}/anonymize`);
                  refresh();
                  close();
                }}>
                  Schedule erasure
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setConfirming(false); setConfirmName(''); }}>Back</Button>
              </div>
            </div>
          ) : (
            <div>
              <Button variant="danger" className="w-full" onClick={() => setConfirming(true)}>
                Erase customer data
              </Button>
              <p className="mt-1 text-xs text-stone-400">Right to be forgotten — wipes personal data after a 7-day grace period. You&apos;ll confirm on the next step.</p>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
