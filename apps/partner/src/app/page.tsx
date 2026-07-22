'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { KeyRound, Loader2, Lock, Mail } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

type Flow = 'signin' | 'activate' | 'reset';
type Stage = 'creds' | 'code';
interface OtpResult { sent?: boolean; devCode?: string; otpRequired?: boolean }

/** Partner portal landing — a centered auth card. Every path is two-step with an
 *  emailed one-time code: sign-in (2FA), first-time activation, and reset. */
export default function PortalHome() {
  const router = useRouter();
  const [flow, setFlow] = useState<Flow>('signin');
  const [stage, setStage] = useState<Stage>('creds');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset(next: Flow) {
    setFlow(next); setStage('creds'); setError(null); setNotice(null); setDevCode(null); setCode(''); setPassword('');
  }

  function afterRequest(res: OtpResult, msg: string) {
    setStage('code');
    setNotice(msg);
    setDevCode(res.devCode ?? null);
  }

  // Step 1 — submit credentials / request a code.
  async function submitCreds(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    try {
      if (flow === 'signin') {
        const res = await api.post<OtpResult>('/partnership/login', { email, password });
        afterRequest(res, `We sent a 6-digit code to ${email}.`);
      } else if (flow === 'activate') {
        const res = await api.post<OtpResult>('/partnership/activate/request', { email });
        afterRequest(res, `We sent a code to ${email} to activate your account.`);
      } else {
        const res = await api.post<OtpResult>('/partnership/password/reset/request', { email });
        afterRequest(res, `If that account exists, a reset code is on its way to ${email}.`);
      }
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as { code?: string } | null) : null;
      if (body?.code === 'NEEDS_ACTIVATION') {
        reset('activate');
        setError('First time here — activate your account to set a password.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
      }
    } finally { setBusy(false); }
  }

  // Step 2 — verify the code (and finish the action).
  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      if (flow === 'signin') {
        await api.post('/partnership/login/verify', { email, code });
        router.push('/catalog');
      } else if (flow === 'activate') {
        await api.post('/partnership/activate', { email, password, code });
        router.push('/catalog');
      } else {
        await api.post('/partnership/password/reset', { email, code, newPassword: password });
        reset('signin');
        setNotice('Password updated — sign in with your new password.');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong — please try again.');
    } finally { setBusy(false); }
  }

  async function resend() {
    setBusy(true); setError(null);
    try {
      const path = flow === 'signin' ? '/partnership/login' : flow === 'activate' ? '/partnership/activate/request' : '/partnership/password/reset/request';
      const payload = flow === 'signin' ? { email, password } : { email };
      const res = await api.post<OtpResult>(path, payload);
      setNotice('A new code is on its way.');
      setDevCode(res.devCode ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend the code.');
    } finally { setBusy(false); }
  }

  const input = 'h-11 w-full bg-transparent text-sm outline-none placeholder:text-stone-400';
  const field = 'flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 transition-colors focus-within:border-stone-900';
  const title = flow === 'activate' ? 'Activate your account' : flow === 'reset' ? 'Reset your password' : 'Sign in';
  const subtitle = flow === 'activate' ? 'Set a password for your approved partner account.' : flow === 'reset' ? 'We’ll email a code to reset your password.' : 'Wholesale access for approved partners.';
  // On the code step of activate/reset we also need a (new) password.
  const wantsPassword = (flow === 'activate' || flow === 'reset');

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f3e8c8] via-stone-100 to-[#faf5e6] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-xl">
        <div className="text-center">
          <p className="font-display text-2xl font-bold tracking-tight text-stone-900">ZAHRAH FASHION HUB</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-600">Partner Portal</p>
        </div>

        <h1 className="mt-6 text-center text-lg font-semibold text-stone-800">{title}</h1>
        <p className="mt-1 text-center text-sm text-stone-500">{stage === 'code' ? 'Enter the 6-digit code we emailed you.' : subtitle}</p>

        {notice && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{notice}</p>}
        {devCode && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">Dev code: <span className="font-mono font-bold tracking-widest">{devCode}</span></p>}

        {stage === 'creds' ? (
          <form onSubmit={submitCreds} className="mt-5 space-y-3">
            <div className={field}>
              <Mail size={16} className="text-stone-400" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="username" className={input} />
            </div>
            {flow !== 'reset' && (
              <div className={field}>
                <Lock size={16} className="text-stone-400" />
                <input type="password" required minLength={flow === 'activate' ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={flow === 'activate' ? 'Create a password (min 8)' : 'Password'} autoComplete={flow === 'activate' ? 'new-password' : 'current-password'} className={input} />
              </div>
            )}
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-stone-950 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : flow === 'reset' ? 'Send reset code' : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="mt-5 space-y-3">
            <div className={field}>
              <KeyRound size={16} className="text-stone-400" />
              <input inputMode="numeric" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" autoComplete="one-time-code" className={`${input} tracking-[0.3em]`} />
            </div>
            {wantsPassword && (
              <div className={field}>
                <Lock size={16} className="text-stone-400" />
                <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={flow === 'reset' ? 'New password (min 8)' : 'Your password'} autoComplete="new-password" className={input} />
              </div>
            )}
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <button type="submit" disabled={busy} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-stone-950 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : flow === 'signin' ? 'Verify & sign in' : flow === 'activate' ? 'Activate & sign in' : 'Set new password'}
            </button>
            <button type="button" onClick={resend} disabled={busy} className="w-full text-center text-xs text-stone-500 hover:text-stone-800">Didn&apos;t get it? Resend code</button>
          </form>
        )}

        <div className="mt-4 flex items-center justify-center gap-3 text-xs text-stone-500">
          {flow !== 'signin' && <button type="button" onClick={() => reset('signin')} className="hover:text-stone-800">Back to sign in</button>}
          {flow === 'signin' && stage === 'creds' && (
            <>
              <button type="button" onClick={() => reset('activate')} className="hover:text-stone-800">Set up account</button>
              <span className="text-stone-300">·</span>
              <button type="button" onClick={() => reset('reset')} className="hover:text-stone-800">Forgot password?</button>
            </>
          )}
        </div>

        <p className="mt-5 border-t border-stone-100 pt-5 text-center text-sm text-stone-500">
          New partner?{' '}
          <Link href="/apply" className="font-semibold text-accent-600 hover:underline">Apply to join</Link>
        </p>
      </div>
    </main>
  );
}
