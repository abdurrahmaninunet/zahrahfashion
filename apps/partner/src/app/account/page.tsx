'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { PortalHeader } from '@/components/portal-header';

interface Me { id: string; email: string; name: string | null; businessName: string | null; phone: string | null }

const input = 'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-900';
const label = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500';

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [form, setForm] = useState({ name: '', businessName: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ partner: Me | null }>('/partnership/me')
      .then((r) => {
        if (!r.partner) { router.replace('/'); return; }
        setMe(r.partner);
        setForm({ name: r.partner.name ?? '', businessName: r.partner.businessName ?? '', phone: r.partner.phone ?? '' });
      })
      .catch(() => router.replace('/'));
  }, [router]);

  if (me === undefined) {
    return <main className="flex min-h-screen items-center justify-center text-stone-400"><Loader2 className="animate-spin" /></main>;
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveErr(null);
    try {
      await api.put('/partnership/profile', { name: form.name.trim(), businessName: form.businessName.trim(), phone: form.phone.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setSaveErr(err instanceof ApiError ? err.message : 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    setPwBusy(true);
    setPwErr(null);
    setPwMsg(null);
    try {
      await api.post('/partnership/password/change', { currentPassword: pw.current, newPassword: pw.next });
      setPwMsg('Your password has been changed.');
      setPw({ current: '', next: '' });
    } catch (err) {
      setPwErr(err instanceof ApiError ? err.message : 'Could not change your password.');
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas">
      <PortalHeader active="account" />

      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold md:text-3xl">Account settings</h1>
        <p className="mt-1 text-sm text-stone-500">Manage your partner business details and password.</p>

        {/* Business details */}
        <form onSubmit={saveProfile} className="mt-6 space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
          <p className="text-sm font-semibold text-stone-700">Business details</p>
          <div>
            <span className={label}>Email</span>
            <input value={me?.email ?? ''} disabled className={`${input} bg-stone-50 text-stone-500`} />
            <p className="mt-1 text-[11px] text-stone-400">Your sign-in email can&apos;t be changed here — contact us if it needs updating.</p>
          </div>
          <div><span className={label}>Business name</span><input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className={input} placeholder="e.g. Bello Fabrics" /></div>
          <div><span className={label}>Contact name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} placeholder="Your full name" /></div>
          <div><span className={label}>Phone</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} placeholder="0803 123 4567" /></div>
          {saveErr && <p className="text-xs text-red-600">{saveErr}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-full bg-stone-950 px-6 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60">
              {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save changes'}
            </button>
            {saved && <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600"><Check size={15} /> Saved</span>}
          </div>
        </form>

        {/* Password */}
        <form onSubmit={changePw} className="mt-4 space-y-3 rounded-2xl border border-stone-200 bg-white p-6">
          <p className="text-sm font-semibold text-stone-700">Change password</p>
          <div><span className={label}>Current password</span><input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} className={input} /></div>
          <div><span className={label}>New password (min 8)</span><input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} className={input} minLength={8} /></div>
          {pwErr && <p className="text-xs text-red-600">{pwErr}</p>}
          {pwMsg && <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{pwMsg}</p>}
          <button type="submit" disabled={pwBusy || pw.current.length < 1 || pw.next.length < 8} className="inline-flex h-11 items-center gap-2 rounded-full bg-stone-900 px-6 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50">
            {pwBusy ? <Loader2 size={16} className="animate-spin" /> : 'Update password'}
          </button>
        </form>
      </div>
    </main>
  );
}
