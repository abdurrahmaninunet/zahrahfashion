'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { naira, formatDateTime } from '@/lib/format';
import { Badge, Button, Card, Checkbox, Dialog, ErrorNote, Field, Input, PageHeader, Select, Spinner, Table, Tabs, Td, statusColor } from '@/components/ui';

interface StaffMember { id: string; fullName: string; title: string | null; roleKey: string; phone: string; altPhone: string | null; branch: string | null; status: string; userId: string | null }

export default function StaffPage() {
  const { hasCap } = useAuth();
  const [tab, setTab] = useState(hasCap('staff.manage') ? 'members' : 'dispatch');
  const tabs = [
    ...(hasCap('staff.manage') ? [{ key: 'members', label: 'Riders' }] : []),
    ...(hasCap('staff.dispatch') ? [{ key: 'dispatch', label: 'Dispatch board' }] : []),
    // Rider cash removed — we don't take cash on delivery.
    // ...(hasCap('staff.cash_ledger') ? [{ key: 'cash', label: 'Rider cash' }] : []),
    // Geo review commented out for now.
    // ...(hasCap('staff.rider_review') ? [{ key: 'geo', label: 'Geo review' }] : []),
  ];
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Riders" subtitle="Add riders, manage their logins and assign deliveries" />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === 'members' && <MembersTab />}
        {tab === 'dispatch' && <DispatchTab />}
        {/* {tab === 'cash' && <CashTab />} */}
        {/* {tab === 'geo' && <GeoTab />} */}
      </div>
    </div>
  );
}

// ── Dispatch board (FR-DSP) ───────────────────────────────────────────────────

interface BoardShipment {
  id: string; status: string; codExpected: number | null; dispatchOrder: number | null;
  order: { id: string; orderNumber: string; grandTotal: number; paymentMethod: string | null; address: { line?: string; addressLine?: string; area?: string } | null; customer: { fullName: string; primaryPhone: string } | null; deliveryZone?: { name: string } | null };
}

function DispatchTab() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<unknown>(null);
  const { data: board, isLoading } = useQuery({
    queryKey: ['dispatch-board'],
    queryFn: () => api.get<{
      unassigned: BoardShipment[];
      riders: { rider: { id: string; fullName: string; phone: string }; stops: BoardShipment[]; codExposure: number }[];
    }>('/staff/dispatch/board'),
    refetchInterval: 30_000,
  });
  const assign = useMutation({
    mutationFn: (riderId: string) => api.post('/staff/dispatch/assign', { shipmentIds: Array.from(selected), riderId }),
    onSuccess: () => { setSelected(new Set()); queryClient.invalidateQueries({ queryKey: ['dispatch-board'] }); },
    onError: setError,
  });

  if (isLoading || !board) return <Spinner />;

  return (
    <div className="space-y-4">
      <ErrorNote error={error} />
      <Card title={`Unassigned rider shipments (${board.unassigned.length})`}
        action={selected.size > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500">{selected.size} selected → assign to:</span>
            {board.riders.map(({ rider }) => (
              <Button key={rider.id} size="sm" loading={assign.isPending} onClick={() => assign.mutate(rider.id)}>{rider.fullName.split(' ')[0]}</Button>
            ))}
          </div>
        ) : undefined}
      >
        {board.unassigned.length ? (
          <div className="space-y-1.5">
            {board.unassigned.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-stone-100 px-3 py-2 text-sm hover:border-brand-300">
                <input type="checkbox" checked={selected.has(s.id)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(s.id); else next.delete(s.id);
                    setSelected(next);
                  }} />
                <span className="font-medium">{s.order.orderNumber}</span>
                <span className="text-stone-500">{s.order.customer?.fullName}</span>
                <span className="truncate text-xs text-stone-400">{s.order.address?.line ?? s.order.address?.addressLine} {s.order.address?.area}</span>
                <span className="ml-auto flex items-center gap-2">
                  {s.codExpected ? <Badge color="amber">COD {naira(s.codExpected)}</Badge> : <Badge color="green">prepaid</Badge>}
                </span>
              </label>
            ))}
          </div>
        ) : <p className="py-4 text-center text-sm text-stone-400">Nothing waiting for dispatch</p>}
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {board.riders.map(({ rider, stops, codExposure }) => (
          <Card key={rider.id} title={
            <span>{rider.fullName} <span className="text-xs font-normal text-stone-400">· {stops.length} stops · COD exposure {naira(codExposure)}</span></span>
          }>
            <ol className="space-y-1.5">
              {stops.map((s, i) => (
                <li key={s.id} className="flex items-center gap-2 rounded-md border border-stone-100 px-2.5 py-1.5 text-sm">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-100 text-[10px] font-bold">{i + 1}</span>
                  <span className="font-medium">{s.order.orderNumber}</span>
                  <Badge color={statusColor(s.status)}>{s.status}</Badge>
                  {s.codExpected ? <span className="ml-auto text-xs text-amber-700">{naira(s.codExpected)}</span> : null}
                </li>
              ))}
              {!stops.length && <p className="py-3 text-center text-xs text-stone-400">No stops today</p>}
            </ol>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Staff directory (FR-STF) ──────────────────────────────────────────────────

function MembersTab() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ loginEmail: string; password: string } | null>(null);
  const [removing, setRemoving] = useState<StaffMember | null>(null);
  const { data: members, isLoading } = useQuery({
    queryKey: ['staff-members', 'rider'],
    queryFn: () => api.get<StaffMember[]>('/staff/members?roleKey=rider'),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['staff-members', 'rider'] });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/staff/members/${id}`),
    onSuccess: () => { setRemoving(null); refresh(); },
  });
  if (isLoading) return <Spinner />;
  const active = members?.filter((m) => m.status === 'active') ?? [];
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setCreating(true)}><Plus size={14} /> Add rider</Button></div>
      <Table headers={['Name', 'Phone', 'Alternative phone', 'Status', '']} empty="No riders yet">
        {active.map((m) => (
          <tr key={m.id}>
            <Td className="font-medium">{m.fullName}</Td>
            <Td>{m.phone}</Td>
            <Td className="text-stone-500">{m.altPhone ?? '—'}</Td>
            <Td><Badge color={statusColor(m.status)}>{m.status}</Badge></Td>
            <Td className="text-right">
              <button onClick={() => setRemoving(m)} className="text-stone-400 hover:text-red-600 cursor-pointer" title="Remove rider"><Trash2 size={15} /></button>
            </Td>
          </tr>
        ))}
      </Table>
      {creating && <RiderDialog onClose={() => setCreating(false)} onCreated={(res) => { setCreating(false); setCreated(res); refresh(); }} />}
      {created && <CredentialsDialog creds={created} onClose={() => setCreated(null)} />}
      {removing && (
        <Dialog open onClose={() => setRemoving(null)} title="Remove rider">
          <div className="space-y-3">
            <p className="text-sm text-stone-500">Remove <b>{removing.fullName}</b>? Their login is deactivated so they can no longer sign in. Past delivery history is kept.</p>
            <div className="flex gap-2">
              <Button variant="danger" className="flex-1" loading={remove.isPending} onClick={() => remove.mutate(removing.id)}>Remove rider</Button>
              <Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function RiderDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (r: { loginEmail: string; password: string }) => void }) {
  const [form, setForm] = useState({ name: '', phone: '', altPhone: '', email: '' });
  const [autoPassword, setAutoPassword] = useState(true);
  const [password, setPassword] = useState('');
  const [mustChange, setMustChange] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const create = useMutation({
    mutationFn: () => api.post<{ loginEmail: string; password: string }>('/staff/riders', {
      name: form.name,
      phone: form.phone,
      altPhone: form.altPhone || null,
      email: form.email || null,
      password: autoPassword ? null : password,
      mustChangePassword: mustChange,
    }),
    onSuccess: onCreated,
    onError: setError,
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <Dialog open onClose={onClose} title="Add rider">
      <div className="space-y-3">
        <Field label="Name"><Input value={form.name} onChange={set('name')} placeholder="Rider's full name" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone number"><Input value={form.phone} onChange={set('phone')} placeholder="0803 123 4567" /></Field>
          <Field label="Alternative phone number"><Input value={form.altPhone} onChange={set('altPhone')} /></Field>
        </div>
        <Field label="Email (optional)" hint="Used as the login if given; otherwise a phone-based login is created">
          <Input type="email" value={form.email} onChange={set('email')} />
        </Field>
        <div className="space-y-2 rounded-md border border-stone-100 p-3">
          <Checkbox label="Generate a password automatically" checked={autoPassword} onChange={(e) => setAutoPassword(e.target.checked)} />
          {!autoPassword && (
            <Field label="Password"><Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" /></Field>
          )}
          <Checkbox label="Require password change on first login" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />
        </div>
        <ErrorNote error={error} />
        <Button className="w-full" loading={create.isPending}
          disabled={!form.name.trim() || !form.phone.trim() || (!autoPassword && password.trim().length < 6)}
          onClick={() => create.mutate()}>
          Add rider
        </Button>
      </div>
    </Dialog>
  );
}

function CredentialsDialog({ creds, onClose }: { creds: { loginEmail: string; password: string }; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} title="Rider login created">
      <div className="space-y-3 text-sm">
        <p className="text-stone-500">Share these with the rider. The password is shown only once — copy it now.</p>
        <div className="space-y-1 rounded-md bg-stone-50 p-3">
          <p><span className="text-stone-400">Login:</span> <span className="font-mono">{creds.loginEmail}</span></p>
          <p><span className="text-stone-400">Password:</span> <span className="font-mono font-semibold">{creds.password}</span></p>
        </div>
        <p className="text-xs text-stone-400">If you required a change on first login, the rider must set a new password before using the app.</p>
        <Button className="w-full" onClick={onClose}>Done</Button>
      </div>
    </Dialog>
  );
}

// ── Cash (FR-CSH) ─────────────────────────────────────────────────────────────

function CashTab() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [remit, setRemit] = useState<{ riderId: string; name: string } | null>(null);
  const [amount, setAmount] = useState('');
  const { data: balances, isLoading } = useQuery({
    queryKey: ['rider-balances'],
    queryFn: () => api.get<{ rider: { id: string; fullName: string; status: string }; balance: number; collectedToday: number }[]>('/staff/cash/balances'),
  });
  const remittance = useMutation({
    mutationFn: () => api.post('/staff/cash/remittance', { riderId: remit!.riderId, amount: Math.round(Number(amount) * 100) }),
    onSuccess: () => { setRemit(null); setAmount(''); queryClient.invalidateQueries({ queryKey: ['rider-balances'] }); },
    onError: setError,
  });
  const dayClose = useMutation({
    mutationFn: (riderId: string) => api.post('/staff/cash/day-close', { riderId, date: new Date().toISOString().slice(0, 10) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rider-balances'] }),
    onError: setError,
  });

  if (isLoading) return <Spinner />;
  return (
    <div className="space-y-3">
      <ErrorNote error={error} />
      <Table headers={['Rider', 'Collected today', 'Cash carried', '']} empty="No riders">
        {balances?.map((b) => (
          <tr key={b.rider.id}>
            <Td className="font-medium">{b.rider.fullName}</Td>
            <Td>{naira(b.collectedToday)}</Td>
            <Td className={b.balance > 0 ? 'font-bold text-amber-700' : 'text-emerald-700'}>{naira(b.balance)}</Td>
            <Td className="text-right">
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setRemit({ riderId: b.rider.id, name: b.rider.fullName })}>Record remittance</Button>
                <Button size="sm" variant="ghost" loading={dayClose.isPending} onClick={() => dayClose.mutate(b.rider.id)}>Close day</Button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>
      {remit && (
        <Dialog open onClose={() => setRemit(null)} title={`Remittance from ${remit.name}`}>
          <div className="space-y-3">
            <Field label="Amount handed over (₦)"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <ErrorNote error={error} />
            <Button className="w-full" loading={remittance.isPending} disabled={!amount} onClick={() => remittance.mutate()}>Record</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ── Geo review (FR-GEO-04) ────────────────────────────────────────────────────

function GeoTab() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const { data: flags, isLoading } = useQuery({
    queryKey: ['geo-flags'],
    queryFn: () => api.get<{ id: string; action: string; distanceM: string | null; riderName: string; serverTime: string; shipment: { order: { id: string; orderNumber: string; address: unknown } } }[]>('/staff/geo/flags'),
  });
  const disposition = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => api.post(`/staff/geo/flags/${id}/disposition`, { disposition: value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['geo-flags'] }),
    onError: setError,
  });

  if (isLoading) return <Spinner />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-500">Flags are review items, never automatic accusations — GPS drift and bad geocoding are real.</p>
      <ErrorNote error={error} />
      <Table headers={['When', 'Rider', 'Action', 'Distance from pin', 'Order', 'Disposition']} empty="No flagged events 🎉">
        {flags?.map((f) => (
          <tr key={f.id}>
            <Td className="text-stone-500">{formatDateTime(f.serverTime)}</Td>
            <Td className="font-medium">{f.riderName}</Td>
            <Td><Badge color="red">{f.action}</Badge></Td>
            <Td className="font-bold text-red-600">{f.distanceM ? `${(Number(f.distanceM) / 1000).toFixed(1)} km` : '—'}</Td>
            <Td><a href={`/orders/${f.shipment.order.id}`} className="text-brand-700 hover:underline">{f.shipment.order.orderNumber}</a></Td>
            <Td>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => disposition.mutate({ id: f.id, value: 'ok' })}>OK</Button>
                <Button size="sm" variant="outline" onClick={() => disposition.mutate({ id: f.id, value: 'address_error' })}>Address error</Button>
                <Button size="sm" variant="ghost" onClick={() => disposition.mutate({ id: f.id, value: 'unresolved' })}>Unresolved</Button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
