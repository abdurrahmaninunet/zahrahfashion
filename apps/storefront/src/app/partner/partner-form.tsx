'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

export function PartnerForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', location: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const message = [
        form.location ? `Location: ${form.location}` : '',
        form.message ? `Interested in: ${form.message}` : '',
      ].filter(Boolean).join('\n') || 'Partner application';
      await api.post('/store/account/contact', {
        name: form.name || undefined,
        email: form.email,
        phone: form.phone || undefined,
        subject: 'Zahrah Fashion Hub Partner Application',
        message,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send your application — please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Thanks{form.name ? `, ${form.name.split(' ')[0]}` : ''}! Your partner application is in — we&apos;ll reach out to {form.email} soon.
      </div>
    );
  }

  const input = 'h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-[#8a6d1f]';
  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={input} placeholder="Your name" value={form.name} onChange={set('name')} required />
        <input className={input} type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={input} placeholder="Phone / WhatsApp" value={form.phone} onChange={set('phone')} required />
        <input className={input} placeholder="Your city / location" value={form.location} onChange={set('location')} />
      </div>
      <textarea
        className="min-h-28 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#8a6d1f]"
        placeholder="What would you like to stock? (lace, perfumes, fabrics…)"
        value={form.message}
        onChange={set('message')}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy || !form.email.trim() || !form.name.trim() || !form.phone.trim()}
        className="h-11 rounded-full bg-[#8a6d1f] px-7 text-sm font-semibold text-white transition-colors hover:bg-[#6f571a] disabled:opacity-60 cursor-pointer"
      >
        {busy ? 'Sending…' : 'Apply to become a partner'}
      </button>
    </form>
  );
}
