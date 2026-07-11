'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { STATIC_PAGES } from '@/lib/static-pages';

interface Me { customer: { fullName: string; phone: string; email: string | null } | null }

const CONTACT_BODY = STATIC_PAGES.contact.body;
const PROSE =
  'prose prose-stone text-sm leading-relaxed [&_a]:font-medium [&_a]:text-[#8a6d1f] [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5';

/** Contact — signed-in shoppers get a message form (pre-filled) plus the store
 *  contact details; guests see the same static contact info as the footer link. */
export default function ContactPage() {
  const router = useRouter();
  const { data: me, isLoading } = useQuery({ queryKey: ['store-me'], queryFn: () => api.get<Me>('/store/account/me') });

  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      {me?.customer ? (
        <Link href="/account" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
          <ChevronLeft size={15} /> Your Account
        </Link>
      ) : (
        <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 cursor-pointer">
          <ChevronLeft size={15} /> Back
        </button>
      )}
      <h1 className="font-display text-2xl font-bold">Contact us</h1>
      {isLoading ? (
        <p className="mt-6 text-sm text-stone-400">Loading…</p>
      ) : me?.customer ? (
        <>
          <ContactForm customer={me.customer} />
          <div className={`${PROSE} mt-8 border-t border-stone-200 pt-8`} dangerouslySetInnerHTML={{ __html: CONTACT_BODY }} />
        </>
      ) : (
        <div className={`${PROSE} mt-5`} dangerouslySetInnerHTML={{ __html: CONTACT_BODY }} />
      )}
    </article>
  );
}

function ContactForm({ customer }: { customer: NonNullable<Me['customer']> }) {
  const [form, setForm] = useState({ name: customer.fullName, email: customer.email ?? '', phone: customer.phone, subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/store/account/contact', {
        name: form.name || undefined,
        email: form.email,
        phone: form.phone || undefined,
        subject: form.subject || undefined,
        message: form.message,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send your message — please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Thanks{form.name ? `, ${form.name.split(' ')[0]}` : ''}! Your message has been sent — we&apos;ll reply to {form.email} soon.
      </div>
    );
  }

  const input = 'h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-[#8a6d1f]';
  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      <p className="text-sm text-stone-500">Send us a message and we&apos;ll get back to you by email.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={input} placeholder="Your name" value={form.name} onChange={set('name')} />
        <input className={input} type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={input} placeholder="Phone (optional)" value={form.phone} onChange={set('phone')} />
        <input className={input} placeholder="Subject (optional)" value={form.subject} onChange={set('subject')} />
      </div>
      <textarea
        className="min-h-32 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#8a6d1f]"
        placeholder="How can we help?"
        value={form.message}
        onChange={set('message')}
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy || !form.message.trim()} className="h-11 rounded-full bg-stone-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-stone-700 disabled:opacity-60 cursor-pointer">
        {busy ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
