'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, ChevronLeft, Mail } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { naira, formatDate } from '@/lib/format';
import { AuthForms } from '@/components/auth/auth-forms';

export interface Me { customer: { id: string; fullName: string; phone: string; email: string | null; hasPassword?: boolean; emailVerified?: boolean; memberSince?: string; consentNow: Record<string, string> } | null }
interface OrderRow { id: string; orderNumber: string; placedAt: string; total: number; status: string; itemsSummary: string; trackingUrl: string }
interface Address { id: string; label: string | null; addressLine: string; area: string | null; isDefault: boolean }

interface ShellCtx { me: Me; customer: NonNullable<Me['customer']>; onChanged: () => void }

/**
 * Shared account frame: handles the auth gate, header (greeting + sign out) and,
 * for sub-pages, a "Your Account" back link. Each account section is now its own
 * route (/account, /account/orders, …) so header-dropdown links actually navigate.
 */
export function AccountShell({ title, showBack, children }: { title: string; showBack?: boolean; children: (ctx: ShellCtx) => React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useQuery({ queryKey: ['store-me'], queryFn: () => api.get<Me>('/store/account/me') });
  const onChanged = () => queryClient.invalidateQueries({ queryKey: ['store-me'] });

  if (isLoading) return <p className="py-20 text-center text-sm text-stone-400">Loading…</p>;
  if (!me?.customer) return <AuthForms onDone={onChanged} />;
  const customer = me.customer;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <button className="shrink-0 text-sm text-stone-400 hover:text-stone-800 cursor-pointer"
          onClick={async () => { await api.post('/store/account/logout'); onChanged(); }}>
          Sign out
        </button>
      </div>

      <div className="mt-6">
        {showBack && (
          <Link href="/account" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 cursor-pointer">
            <ChevronLeft size={15} /> Your Account
          </Link>
        )}
        {children({ me, customer, onChanged })}
      </div>
    </div>
  );
}

export function OrdersTab() {
  const { data: orders, isLoading } = useQuery({ queryKey: ['store-orders'], queryFn: () => api.get<OrderRow[]>('/store/account/orders') });
  if (isLoading) return <p className="py-10 text-center text-sm text-stone-400">Loading orders…</p>;
  if (!orders?.length) {
    return <p className="py-10 text-center text-sm text-stone-400">No orders yet — <Link href="/" className="text-[#8a6d1f] underline">start shopping</Link></p>;
  }
  return (
    <div className="space-y-2">
      {orders.map((o) => (
        <Link key={o.id} href={`/account/orders/${o.id}`} className="block rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-400">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-semibold">{o.orderNumber}</span>
            <span className="tabular text-sm font-bold">{naira(o.total)}</span>
          </div>
          <p className="mt-1 truncate text-xs text-stone-500">{o.itemsSummary}</p>
          <p className="mt-1 text-xs"><span className="font-medium text-[#6f571a]">{o.status}</span> · {formatDate(o.placedAt)}</p>
        </Link>
      ))}
    </div>
  );
}

export function AddressesTab() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: '', addressLine: '', area: '', landmark: '', zoneId: '' });
  const { data: addresses } = useQuery({ queryKey: ['store-addresses'], queryFn: () => api.get<Address[]>('/store/account/addresses') });
  const { data: zones } = useQuery({ queryKey: ['store-zones'], queryFn: () => api.get<{ id: string; name: string }[]>('/store/zones') });

  const add = useMutation({
    mutationFn: () => api.post('/store/account/addresses', { ...form, zoneId: form.zoneId || null, isDefault: !addresses?.length }),
    onSuccess: () => { setAdding(false); setForm({ label: '', addressLine: '', area: '', landmark: '', zoneId: '' }); queryClient.invalidateQueries({ queryKey: ['store-addresses'] }); },
  });

  const input = 'h-11 w-full rounded-md border border-stone-200 bg-white px-3 text-sm outline-none focus:border-[#8a6d1f]';
  return (
    <div className="space-y-2">
      {addresses?.map((a) => (
        <div key={a.id} className="flex items-start justify-between rounded-xl border border-stone-200 bg-white p-4 text-sm">
          <div>
            <p className="font-medium">{a.label ?? 'Address'}{a.isDefault && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">DEFAULT</span>}</p>
            <p className="mt-0.5 text-stone-500">{a.addressLine}{a.area ? `, ${a.area}` : ''}</p>
          </div>
          <button className="text-xs text-stone-400 hover:text-red-500 cursor-pointer"
            onClick={async () => { await api.del(`/store/account/addresses/${a.id}`); queryClient.invalidateQueries({ queryKey: ['store-addresses'] }); }}>
            remove
          </button>
        </div>
      ))}
      {adding ? (
        <form className="space-y-2 rounded-xl border border-stone-200 bg-white p-4" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <input className={input} placeholder="Label (Home / Office)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <input required className={input} placeholder="Address" value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className={input} placeholder="Area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
            <input className={input} placeholder="Landmark" value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
          </div>
          <select className={input} value={form.zoneId} onChange={(e) => setForm({ ...form, zoneId: e.target.value })}>
            <option value="">Delivery state…</option>
            {zones?.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <button disabled={add.isPending} className="h-11 w-full rounded-md bg-stone-900 text-sm font-semibold text-white cursor-pointer">Save address</button>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="w-full rounded-xl border border-dashed border-stone-300 py-3 text-sm text-stone-500 hover:border-stone-400 cursor-pointer">
          + Add address
        </button>
      )}
    </div>
  );
}

export function ProfileTab({ customer, onChanged }: { customer: NonNullable<Me['customer']>; onChanged: () => void }) {
  const [name, setName] = useState(customer.fullName);
  const [saved, setSaved] = useState(false);
  const CONSENTS = [
    ['marketing_email', 'Email me about new arrivals & offers'],
    ['marketing_whatsapp', 'WhatsApp updates'],
    ['marketing_sms', 'SMS updates'],
  ] as const;

  const memberSince = customer.memberSince
    ? new Date(customer.memberSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="space-y-4">
      {/* Identity summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white p-4">
        <div>
          <p className="font-semibold text-stone-900">{customer.fullName}</p>
          {memberSince && <p className="mt-0.5 text-xs text-stone-400">Member since {memberSince}</p>}
        </div>
        {customer.emailVerified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <BadgeCheck size={14} /> Verified account
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Unverified
          </span>
        )}
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">Your name</label>
        <div className="flex gap-2">
          <input className="h-11 w-full rounded-md border border-stone-200 px-3 text-sm outline-none focus:border-[#8a6d1f]" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="h-11 shrink-0 rounded-md bg-stone-900 px-4 text-sm font-semibold text-white cursor-pointer disabled:opacity-50"
            disabled={!name.trim() || name.trim() === customer.fullName}
            onClick={async () => { await api.put('/store/account/profile', { fullName: name.trim() }); setSaved(true); setTimeout(() => setSaved(false), 1500); onChanged(); }}>
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>
      <ChangeEmailCard customer={customer} onChanged={onChanged} />
      {customer.hasPassword && <ChangePasswordCard />}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Marketing preferences</p>
        {CONSENTS.map(([type, label]) => {
          const granted = customer.consentNow[type] === 'granted';
          return (
            <label key={type} className="flex items-center justify-between py-1.5 text-sm">
              {label}
              <input type="checkbox" checked={granted}
                onChange={async (e) => {
                  await api.post('/store/account/consent', { type, status: e.target.checked ? 'granted' : 'revoked' });
                  onChanged();
                }} />
            </label>
          );
        })}
        <p className="mt-2 text-[11px] text-stone-400">You can change these anytime. We never share your data.</p>
      </div>
      <DeleteAccountCard customer={customer} />
    </div>
  );
}

/**
 * Email address, shown read-only. "Change" opens a two-step flow: enter a new
 * address → we email a 6-digit code to it → confirm to move the email across.
 * Verifying the NEW inbox stops anyone taking over the account.
 */
function ChangeEmailCard({ customer, onChanged }: { customer: NonNullable<Me['customer']>; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'otp' | 'done'>('form');
  const [newEmail, setNewEmail] = useState('');
  const [pendingToken, setPendingToken] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setStep('form'); setNewEmail(''); setPendingToken(''); setDevCode(null); setCode(''); setError(null); };

  const start = useMutation({
    mutationFn: () => api.post<{ pendingToken: string; devCode?: string }>('/store/account/email/change/start', { email: newEmail.trim() }),
    onSuccess: (d) => { setPendingToken(d.pendingToken); setDevCode(d.devCode ?? null); setCode(d.devCode ?? ''); setError(null); setStep('otp'); },
    onError: (e) => setError((e as ApiError)?.message ?? 'Could not send the code'),
  });
  const verify = useMutation({
    mutationFn: () => api.post('/store/account/email/change/verify', { pendingToken, code }),
    onSuccess: () => { setError(null); setStep('done'); onChanged(); },
    onError: (e) => setError((e as ApiError)?.message ?? 'Could not confirm the code'),
  });

  const input = 'h-11 w-full rounded-md border border-stone-200 px-3 text-sm outline-none focus:border-[#8a6d1f]';

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Email address</p>
        {!open && (
          <button className="text-sm font-medium text-[#8a6d1f] hover:underline cursor-pointer" onClick={() => { reset(); setOpen(true); }}>
            Change email
          </button>
        )}
      </div>

      {!open ? (
        <p className="mt-1 flex items-center gap-2 text-sm text-stone-700">
          <Mail size={15} className="text-stone-400" /> {customer.email ?? 'No email on file'}
          {customer.emailVerified && <BadgeCheck size={14} className="text-emerald-600" />}
        </p>
      ) : step === 'done' ? (
        <div className="mt-3">
          <p className="rounded-md bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-700">✓ Your email address has been updated and verified.</p>
          <button className="mt-3 text-sm text-stone-500 hover:text-stone-800 cursor-pointer" onClick={() => setOpen(false)}>Close</button>
        </div>
      ) : step === 'form' ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-stone-500">Enter your new email address. We&apos;ll send a code there to confirm it&apos;s yours.</p>
          <input type="email" autoFocus className={input} placeholder="new@email.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button disabled={!/^\S+@\S+\.\S+$/.test(newEmail.trim()) || start.isPending} onClick={() => start.mutate()}
              className="h-11 rounded-md bg-stone-900 px-4 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer">
              {start.isPending ? 'Sending code…' : 'Send code'}
            </button>
            <button className="h-11 rounded-md border border-stone-200 px-4 text-sm text-stone-600 cursor-pointer" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-stone-500">Enter the 6-digit code we sent to <b>{newEmail.trim()}</b>.</p>
          {devCode && <p className="text-xs text-stone-400">Dev code: <b className="tabular tracking-widest text-stone-600">{devCode}</b></p>}
          <input inputMode="numeric" maxLength={6} className={`${input} tracking-[0.4em]`} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button disabled={code.length !== 6 || verify.isPending} onClick={() => verify.mutate()}
              className="h-11 rounded-md bg-stone-900 px-4 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer">
              {verify.isPending ? 'Confirming…' : 'Confirm new email'}
            </button>
            <button className="h-11 rounded-md border border-stone-200 px-4 text-sm text-stone-600 cursor-pointer" onClick={() => { setStep('form'); setError(null); }}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Change password (email & password accounts). Two steps: verify the current
 * password → we email a 6-digit code → confirm the code to apply the new one.
 */
function ChangePasswordCard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'otp' | 'done'>('form');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pendingToken, setPendingToken] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep('form'); setOldPassword(''); setNewPassword(''); setConfirm('');
    setPendingToken(''); setDevCode(null); setCode(''); setError(null);
  };

  const start = useMutation({
    mutationFn: () => api.post<{ pendingToken: string; devCode?: string }>('/store/account/password/change/start', { oldPassword, newPassword }),
    onSuccess: (d) => { setPendingToken(d.pendingToken); setDevCode(d.devCode ?? null); setCode(d.devCode ?? ''); setError(null); setStep('otp'); },
    onError: (e) => setError((e as ApiError)?.message ?? 'Could not start the password change'),
  });
  const verify = useMutation({
    mutationFn: () => api.post('/store/account/password/change/verify', { pendingToken, code }),
    onSuccess: () => { setError(null); setStep('done'); },
    onError: (e) => setError((e as ApiError)?.message ?? 'Could not confirm the code'),
  });

  const canStart = oldPassword.length >= 1 && newPassword.length >= 8 && newPassword === confirm;
  const input = 'h-11 w-full rounded-md border border-stone-200 px-3 text-sm outline-none focus:border-[#8a6d1f]';

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Password</p>
        {!open && (
          <button className="text-sm font-medium text-[#8a6d1f] hover:underline cursor-pointer" onClick={() => { reset(); setOpen(true); }}>
            Change password
          </button>
        )}
      </div>

      {!open ? (
        <p className="mt-1 text-sm text-stone-400">Update the password you use to sign in. We&apos;ll email you a code to confirm.</p>
      ) : step === 'done' ? (
        <div className="mt-3">
          <p className="rounded-md bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-700">✓ Your password has been changed. Use it next time you sign in.</p>
          <button className="mt-3 text-sm text-stone-500 hover:text-stone-800 cursor-pointer" onClick={() => setOpen(false)}>Close</button>
        </div>
      ) : step === 'form' ? (
        <div className="mt-3 space-y-2">
          <input type="password" autoComplete="current-password" className={input} placeholder="Current password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
          <input type="password" autoComplete="new-password" className={input} placeholder="New password (min 8 characters)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <input type="password" autoComplete="new-password" className={input} placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {confirm.length > 0 && newPassword !== confirm && <p className="text-xs text-red-600">Passwords don&apos;t match.</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button disabled={!canStart || start.isPending} onClick={() => start.mutate()}
              className="h-11 rounded-md bg-stone-900 px-4 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer">
              {start.isPending ? 'Sending code…' : 'Send code'}
            </button>
            <button className="h-11 rounded-md border border-stone-200 px-4 text-sm text-stone-600 cursor-pointer" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-stone-500">Enter the 6-digit code we emailed you to confirm your new password.</p>
          {devCode && <p className="text-xs text-stone-400">Dev code: <b className="tabular tracking-widest text-stone-600">{devCode}</b></p>}
          <input inputMode="numeric" maxLength={6} className={`${input} tracking-[0.4em]`} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button disabled={code.length !== 6 || verify.isPending} onClick={() => verify.mutate()}
              className="h-11 rounded-md bg-stone-900 px-4 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer">
              {verify.isPending ? 'Confirming…' : 'Confirm & change password'}
            </button>
            <button className="h-11 rounded-md border border-stone-200 px-4 text-sm text-stone-600 cursor-pointer" onClick={() => { setStep('form'); setError(null); }}>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DeleteAccountCard({ customer }: { customer: NonNullable<Me['customer']> }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ['store-erasure'],
    queryFn: () => api.get<{ pending: { id: string; executeAfter: string } | null; graceDays: number }>('/store/account/privacy/erasure'),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['store-erasure'] });
  const graceDays = data?.graceDays ?? 7;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Privacy</p>
      {data?.pending ? (
        <div className="rounded-md bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-800">Your account is scheduled for deletion on {formatDate(data.pending.executeAfter)}.</p>
          <p className="mt-1 text-xs text-amber-700">Until then everything still works — you can change your mind below.</p>
          <button className="mt-2 rounded-md border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 cursor-pointer"
            onClick={async () => { await api.del(`/store/account/privacy/erasure/${data.pending!.id}`); refresh(); }}>
            Keep my account
          </button>
        </div>
      ) : confirming ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm">
          <p className="font-medium text-red-700">Delete your account?</p>
          <p className="mt-1 text-xs text-red-600">
            Your name, phone, email and addresses will be permanently erased after a {graceDays}-day grace period. This cannot be undone once it runs.
          </p>
          <input
            className="mt-2 h-11 w-full rounded-md border border-red-200 bg-white px-3 text-sm outline-none focus:border-red-400"
            placeholder={`Type "${customer.fullName}" to confirm`}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button
              disabled={confirmName.trim() !== customer.fullName}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-red-200 cursor-pointer"
              onClick={async () => {
                try {
                  await api.post('/store/account/privacy/erasure');
                  setConfirming(false);
                  setConfirmName('');
                  refresh();
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : 'Something went wrong');
                }
              }}>
              Schedule deletion
            </button>
            <button className="rounded-md border border-stone-200 px-3 py-1.5 text-xs text-stone-600 cursor-pointer"
              onClick={() => { setConfirming(false); setConfirmName(''); setError(null); }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <button className="text-sm text-red-600 hover:underline cursor-pointer" onClick={() => setConfirming(true)}>
            Delete my account
          </button>
          <p className="mt-1 text-[11px] text-stone-400">
            Erases your personal data after a {graceDays}-day grace period, as provided by the NDPA. Past orders are kept anonymously for our records.
          </p>
        </>
      )}
    </div>
  );
}
