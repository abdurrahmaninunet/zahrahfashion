'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, MapPin, Phone } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { naira } from '@/lib/format';
import { Badge, Button, Dialog, ErrorNote, Field, Input, Spinner, statusColor } from '@/components/ui';

/**
 * Rider workspace (A2 FR-RWS) — phone-first Today list.
 * Status actions require a GPS fix (FR-GEO-02); server computes verdicts.
 */

interface RiderShipment {
  id: string; status: string; codExpected: number | null; dispatchOrder: number | null;
  order: {
    id: string; orderNumber: string; grandTotal: number; paymentMethod: string | null;
    address: { line?: string; addressLine?: string; area?: string; city?: string } | null;
    customer: { fullName: string; primaryPhone: string } | null;
  };
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10_000 });
  });
}

export default function RiderPage() {
  const { me, loading, refresh } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<unknown>(null);
  const [podShipment, setPodShipment] = useState<RiderShipment | null>(null);
  const [failShipment, setFailShipment] = useState<RiderShipment | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['rider-today'],
    queryFn: () => api.get<{ rider: { fullName: string }; cashCarried: number; shipments: RiderShipment[] }>('/rider/today'),
    enabled: !!me,
    refetchInterval: 60_000,
  });

  const act = useMutation({
    mutationFn: async ({ shipmentId, action, extra }: { shipmentId: string; action: string; extra?: Record<string, unknown> }) => {
      const pos = await getPosition().catch(() => {
        throw { message: 'Location is required — enable GPS and try again' };
      });
      return api.post(`/rider/shipments/${shipmentId}/action`, {
        action,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracyM: pos.coords.accuracy,
        clientTime: new Date().toISOString(),
        ...extra,
      });
    },
    onSuccess: () => {
      setError(null);
      setPodShipment(null);
      setFailShipment(null);
      queryClient.invalidateQueries({ queryKey: ['rider-today'] });
    },
    onError: setError,
  });

  if (loading || isLoading) return <Spinner />;
  if (!me) { router.replace('/login'); return null; }
  if (me.mustChangePassword) return <ForcePasswordChange onDone={refresh} />;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-stone-50 pb-10">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-brand-700 px-4 py-3 text-white">
        <div>
          <p className="text-sm opacity-80">Today's deliveries</p>
          <p className="font-bold">{data?.rider.fullName}</p>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-80">Cash carried</p>
          <p className="font-bold">{naira(data?.cashCarried ?? 0)}</p>
        </div>
        <button className="ml-3 cursor-pointer" onClick={async () => { await api.post('/auth/logout'); router.push('/login'); }}>
          <LogOut size={18} />
        </button>
      </header>

      <div className="space-y-3 p-3">
        <ErrorNote error={error} />
        {data?.shipments.map((s, i) => (
          <div key={s.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{i + 1}</span>
                <span className="font-bold">{s.order.orderNumber}</span>
              </span>
              <Badge color={statusColor(s.status)}>{s.status}</Badge>
            </div>
            <div className="mt-2 space-y-1 text-sm">
              <p className="font-medium">{s.order.customer?.fullName}</p>
              <p className="flex items-start gap-1 text-stone-500">
                <MapPin size={14} className="mt-0.5 shrink-0" />
                {s.order.address?.line ?? s.order.address?.addressLine}{s.order.address?.area ? `, ${s.order.address.area}` : ''}
              </p>
              {s.order.customer?.primaryPhone && (
                <a href={`tel:${s.order.customer.primaryPhone}`} className="flex items-center gap-1 text-brand-700">
                  <Phone size={13} /> {s.order.customer.primaryPhone}
                </a>
              )}
              {s.codExpected ? (
                <p className="rounded-md bg-amber-50 px-2 py-1 font-bold text-amber-800">Collect {naira(s.codExpected)}</p>
              ) : (
                <p className="text-xs font-medium text-emerald-600">Prepaid ✓</p>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {s.status === 'pending' && (
                <Button className="col-span-2" loading={act.isPending} onClick={() => act.mutate({ shipmentId: s.id, action: 'picked_up' })}>
                  Picked up
                </Button>
              )}
              {s.status === 'out' && (
                <>
                  <Button loading={act.isPending} onClick={() => {
                    if (s.codExpected) setPodShipment(s);
                    else act.mutate({ shipmentId: s.id, action: 'delivered' });
                  }}>
                    Delivered
                  </Button>
                  <Button variant="outline" onClick={() => setFailShipment(s)}>Failed</Button>
                  {s.codExpected ? (
                    <Button variant="ghost" className="col-span-2 text-xs" loading={act.isPending}
                      onClick={() => act.mutate({ shipmentId: s.id, action: 'transfer_flagged' })}>
                      Customer paying by transfer → alert office
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ))}
        {!data?.shipments.length && (
          <p className="py-16 text-center text-sm text-stone-400">No deliveries assigned yet — check back soon</p>
        )}
      </div>

      {podShipment && (
        <PodDialog shipment={podShipment} pending={act.isPending} onClose={() => setPodShipment(null)}
          onConfirm={(collected) => act.mutate({ shipmentId: podShipment.id, action: 'delivered', extra: { codCollected: collected } })} />
      )}
      {failShipment && (
        <FailDialog pending={act.isPending} onClose={() => setFailShipment(null)}
          onConfirm={(reason) => act.mutate({ shipmentId: failShipment.id, action: 'failed', extra: { failureReason: reason, customerCaused: true } })} />
      )}
    </div>
  );
}

function PodDialog({ shipment, pending, onClose, onConfirm }: { shipment: RiderShipment; pending: boolean; onClose: () => void; onConfirm: (kobo: number) => void }) {
  const [amount, setAmount] = useState(String((shipment.codExpected ?? 0) / 100));
  return (
    <Dialog open onClose={onClose} title="Cash collected">
      <div className="space-y-3">
        <Field label={`Amount collected — ${naira(shipment.codExpected)} due`}>
          <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg font-bold" />
        </Field>
        <p className="text-sm text-stone-500">Confirm: you collected <b>₦{Number(amount || 0).toLocaleString()}</b> from {shipment.order.customer?.fullName}. This adds to your cash-carried total.</p>
        <Button className="w-full" loading={pending} onClick={() => onConfirm(Math.round(Number(amount) * 100))}>
          Confirm delivery + cash
        </Button>
      </div>
    </Dialog>
  );
}

function FailDialog({ pending, onClose, onConfirm }: { pending: boolean; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('customer unreachable');
  return (
    <Dialog open onClose={onClose} title="Delivery failed">
      <div className="space-y-3">
        <Field label="Reason">
          <select className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option>customer unreachable</option>
            <option>customer rejected</option>
            <option>payment refused</option>
            <option>address not found</option>
          </select>
        </Field>
        <Button className="w-full" variant="danger" loading={pending} onClick={() => onConfirm(reason)}>Record failure</Button>
      </div>
    </Dialog>
  );
}

/** Forced password change on first login (rider must set their own before continuing). */
function ForcePasswordChange({ onDone }: { onDone: () => Promise<void> | void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<unknown>(null);
  const save = useMutation({
    mutationFn: () => api.post('/auth/password', { currentPassword, newPassword }),
    onSuccess: async () => { await onDone(); },
    onError: setError,
  });
  const mismatch = !!confirm && newPassword !== confirm;
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-stone-50 px-4">
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <h1 className="text-lg font-bold">Set your password</h1>
        <p className="mt-1 text-sm text-stone-500">For your security, choose your own password before continuing.</p>
        <div className="mt-4 space-y-3">
          <Field label="Current (temporary) password"><Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></Field>
          <Field label="New password (at least 8 characters)"><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></Field>
          <Field label="Confirm new password"><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
          {mismatch && <p className="text-xs text-red-600">Passwords do not match.</p>}
          <ErrorNote error={error} />
          <Button className="w-full" loading={save.isPending} disabled={!currentPassword || newPassword.length < 8 || mismatch} onClick={() => save.mutate()}>
            Save &amp; continue
          </Button>
        </div>
      </div>
    </div>
  );
}
