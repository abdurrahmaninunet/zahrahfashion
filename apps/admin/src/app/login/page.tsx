'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Button, Input, Field, ErrorNote } from '@/components/ui';
import { useAuth } from '@/lib/auth';

interface OtpResult { pendingToken: string; emailSent?: boolean; devCode?: string }

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [emailSent, setEmailSent] = useState(true);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  function applyDelivery(r: { emailSent?: boolean; devCode?: string }) {
    setEmailSent(r.emailSent !== false);
    setDevCode(r.devCode ?? null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (pendingToken) {
        // Step 2 — confirm the one-time code, then the session is created.
        await api.post('/auth/login/otp', { pendingToken, code });
        await refresh();
        router.push('/');
      } else {
        // Step 1 — verify password → a one-time code is emailed.
        const result = await api.post<OtpResult>('/auth/login', { email, password });
        setPendingToken(result.pendingToken);
        applyDelivery(result);
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err : { message: 'Login failed' });
      setLoading(false);
    }
  }

  async function resend() {
    if (!pendingToken || resending) return;
    setResending(true);
    setError(null);
    try {
      const r = await api.post<OtpResult>('/auth/login/resend', { pendingToken });
      applyDelivery(r);
      setCode('');
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    } catch (err) {
      setError(err instanceof ApiError ? err : { message: 'Could not resend the code' });
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-stone-100 to-brand-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">Z</div>
          <h1 className="text-lg font-bold">Zahra Admin</h1>
          <p className="text-sm text-stone-500">{pendingToken ? 'Enter your login code' : 'Sign in to your staff account'}</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {pendingToken ? (
            <>
              <Field label="6-digit code">
                <Input autoFocus inputMode="numeric" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} />
              </Field>
              {emailSent ? (
                <p className="text-xs text-stone-400">We emailed a 6-digit code to <b>{email}</b>. It expires in 10 minutes.</p>
              ) : (
                <p className="text-xs text-red-600">We couldn&apos;t send the email. Tap &ldquo;Resend code&rdquo; to try again.</p>
              )}
              {devCode && (
                <div className="mt-1 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                  Dev only — your code is <b className="font-mono text-sm tracking-wider">{devCode}</b>
                </div>
              )}
              {resent && <p className="text-xs text-emerald-600">A new code was sent.</p>}
            </>
          ) : (
            <>
              <Field label="Email">
                <Input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@zahrahfashion.com" />
              </Field>
              <Field label="Password">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            </>
          )}
          <ErrorNote error={error} />
          <Button type="submit" loading={loading} className="w-full">
            {pendingToken ? 'Verify' : 'Sign in'}
          </Button>
          {pendingToken && (
            <div className="flex items-center justify-between text-xs">
              <button type="button" className="text-stone-500 hover:underline cursor-pointer"
                onClick={() => { setPendingToken(null); setCode(''); setDevCode(null); setError(null); }}>
                Back to password
              </button>
              <button type="button" disabled={resending} className="font-medium text-brand-600 hover:underline disabled:opacity-50 cursor-pointer" onClick={resend}>
                {resending ? 'Resending…' : 'Resend code'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
