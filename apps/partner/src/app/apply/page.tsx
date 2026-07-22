'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

/** Partner application form — reached from the storefront "Apply" CTA. Posts to
 *  the isolated partnership API; an admin approves before sign-in is granted. */
export default function ApplyPage() {
  const [form, setForm] = useState({ name: '', businessName: '', email: '', phone: '', address: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/partnership/apply', {
        name: form.name || undefined,
        businessName: form.businessName || undefined,
        email: form.email,
        phone: form.phone || undefined,
        address: form.address || undefined,
        note: form.note || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
    } finally {
      setBusy(false);
    }
  }

  const input = 'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-900';

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f3e8c8] via-stone-100 to-[#faf5e6] px-4">
        <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-xl">
          <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
          <h1 className="mt-4 font-display text-2xl font-bold">Application received</h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            Thank you for applying to partner with ZAHRAH FASHION HUB. Our team will review your details and email you once
            you&apos;re approved — then you can sign in to your wholesale portal.
          </p>
          <Link href="/" className="mt-6 inline-block rounded-full bg-stone-950 px-6 py-2.5 text-sm font-semibold text-white hover:bg-stone-800">
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f3e8c8] via-stone-100 to-[#faf5e6] px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xl sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-600">Partner Portal</p>
          <h1 className="mt-1 font-display text-2xl font-bold md:text-3xl">Apply to become a Partner</h1>
          <p className="mt-1 text-sm text-stone-500">Tell us about your business. Once approved, you&apos;ll get wholesale pricing and portal access.</p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-stone-500">Your name</span><input className={input} value={form.name} onChange={set('name')} placeholder="Full name" /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-stone-500">Business name</span><input className={input} value={form.businessName} onChange={set('businessName')} placeholder="e.g. Bello Fabrics" /></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-stone-500">Email *</span><input required type="email" className={input} value={form.email} onChange={set('email')} placeholder="you@example.com" /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-stone-500">Phone</span><input type="tel" className={input} value={form.phone} onChange={set('phone')} placeholder="0803 123 4567" /></label>
            </div>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-stone-500">Location / address</span><input className={input} value={form.address} onChange={set('address')} placeholder="City, state" /></label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-stone-500">Tell us about your business</span>
              <textarea rows={4} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900" value={form.note} onChange={set('note')} placeholder="What do you sell, and where? What would you like to resell?" />
            </label>

            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button type="submit" disabled={busy || !form.email} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-stone-950 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-60">
              {busy ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : 'Submit application'}
            </button>
            <p className="text-center text-sm text-stone-500">
              Already approved? <Link href="/" className="font-semibold text-accent-600 hover:underline">Sign in instead</Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
