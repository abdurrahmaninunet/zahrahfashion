'use client';

import { useState } from 'react';
import { AlertCircle, ArrowLeft, Lock, Mail, Phone, ShieldCheck, User } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { GoogleButton } from './google-button';

type View = 'login' | 'register' | 'otp' | 'reset';

/** Styled, self-contained sign-in / sign-up card: email+password, Google, and
 *  email-OTP-confirmed registration. Calls onDone() once a session exists. */
export function AuthForms({ onDone }: { onDone: () => void }) {
  const [view, setView] = useState<View>('login');
  const [form, setForm] = useState({ identifier: '', password: '', name: '', phone: '', email: '' });
  const [otp, setOtp] = useState('');
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function run(fn: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const login = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.post('/store/account/login', { identifier: form.identifier, password: form.password });
      onDone();
    });
  };

  const startRegister = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await api.post<{ pendingToken: string; devCode?: string }>('/store/account/register/start', {
        name: form.name || undefined,
        phone: form.phone,
        email: form.email,
        password: form.password,
      });
      setPendingToken(res.pendingToken);
      setOtp(res.devCode ?? '');
      setNotice(res.devCode ? `Dev mode — your code is ${res.devCode} (email not configured).` : `We sent a 6-digit code to ${form.email}.`);
      setView('otp');
    });
  };

  const verifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.post('/store/account/register/verify', { pendingToken, code: otp });
      onDone();
    });
  };

  const resend = () =>
    run(async () => {
      const res = await api.post<{ pendingToken: string; devCode?: string }>('/store/account/register/start', {
        name: form.name || undefined,
        phone: form.phone,
        email: form.email,
        password: form.password,
      });
      setPendingToken(res.pendingToken);
      if (res.devCode) setOtp(res.devCode);
      setNotice(res.devCode ? `Dev mode — your code is ${res.devCode} (email not configured).` : `A new code was sent to ${form.email}.`);
    });

  const onGoogle = (credential: string) =>
    run(async () => {
      await api.post('/store/account/google', { credential });
      onDone();
    });

  const openReset = () => {
    setView('reset');
    setResetSent(false);
    setOtp('');
    setNewPassword('');
    setError(null);
    setNotice(null);
  };

  const startReset = (e?: React.FormEvent) => {
    e?.preventDefault();
    run(async () => {
      const res = await api.post<{ pendingToken: string; devCode?: string }>('/store/account/reset/start', { identifier: form.identifier });
      setPendingToken(res.pendingToken);
      setOtp(res.devCode ?? '');
      setResetSent(true);
      setNotice(res.devCode ? `Dev mode — your code is ${res.devCode} (email not configured).` : `If an account exists, we sent a reset code to its email.`);
    });
  };

  const verifyReset = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api.post('/store/account/reset/verify', { pendingToken, code: otp, password: newPassword });
      onDone();
    });
  };

  return (
    <div className="mx-auto my-10 w-full max-w-sm px-4">
      <div className="border-4 border-stone-400 bg-white p-6 sm:p-8">
        {view === 'login' || view === 'register' ? (
          <>
            <header className="mb-6 text-center">
              <h1 className="font-display text-2xl font-bold">{view === 'login' ? 'Welcome back' : 'Create your account'}</h1>
              <p className="mt-1 text-sm text-stone-500">
                {view === 'login' ? 'Sign in to track orders and save favourites.' : 'Join Zahra — it only takes a minute.'}
              </p>
            </header>

            {/* Segmented tabs */}
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-stone-100 p-1 text-sm font-medium">
              {(['login', 'register'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { setView(v); setError(null); }}
                  className={`rounded-full py-2 transition-colors ${view === v ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
                >
                  {v === 'login' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>

            <GoogleButton onCredential={onGoogle} />

            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-stone-400">
              <span className="h-px flex-1 bg-stone-200" /> or <span className="h-px flex-1 bg-stone-200" />
            </div>

            {error && <ErrorNote message={error} />}

            {view === 'login' ? (
              <form onSubmit={login} className="space-y-3">
                <Field icon={<Mail size={16} />} type="text" placeholder="Email or phone" value={form.identifier} onChange={set('identifier')} autoComplete="username" required />
                <Field icon={<Lock size={16} />} type="password" placeholder="Password" value={form.password} onChange={set('password')} autoComplete="current-password" required />
                <div className="text-right">
                  <button type="button" onClick={openReset} className="text-xs font-medium text-[#8a6d1f] hover:underline">
                    Forgot password?
                  </button>
                </div>
                <SubmitButton busy={busy}>Sign in</SubmitButton>
              </form>
            ) : (
              <form onSubmit={startRegister} className="space-y-3">
                <Field icon={<User size={16} />} type="text" placeholder="Full name" value={form.name} onChange={set('name')} autoComplete="name" />
                <Field icon={<Phone size={16} />} type="tel" placeholder="Phone number" value={form.phone} onChange={set('phone')} autoComplete="tel" required />
                <Field icon={<Mail size={16} />} type="email" placeholder="Email address" value={form.email} onChange={set('email')} autoComplete="email" required />
                <Field icon={<Lock size={16} />} type="password" placeholder="Password (min 8 characters)" value={form.password} onChange={set('password')} autoComplete="new-password" required minLength={8} />
                <SubmitButton busy={busy}>Continue</SubmitButton>
                <p className="text-center text-[11px] leading-relaxed text-stone-400">We&apos;ll email you a code to confirm your address. By continuing you agree to our <a href="/pages/terms-of-service" className="underline">Terms</a> and <a href="/pages/privacy-policy" className="underline">Privacy Policy</a>.</p>
              </form>
            )}
          </>
        ) : view === 'reset' ? (
          <>
            <button type="button" onClick={() => { setView('login'); setError(null); setNotice(null); }} className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
              <ArrowLeft size={15} /> Back to sign in
            </button>
            <header className="mb-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#faf5e6] text-[#8a6d1f]"><Lock size={22} /></span>
              <h1 className="mt-3 font-display text-2xl font-bold">Reset your password</h1>
              <p className="mt-1 text-sm text-stone-500">{notice ?? (resetSent ? 'Enter the code we emailed you and choose a new password.' : "Enter your email or phone and we'll send a reset code.")}</p>
            </header>

            {error && <ErrorNote message={error} />}

            {!resetSent ? (
              <form onSubmit={startReset} className="space-y-3">
                <Field icon={<Mail size={16} />} type="text" placeholder="Email or phone" value={form.identifier} onChange={set('identifier')} autoComplete="username" required />
                <SubmitButton busy={busy}>Send reset code</SubmitButton>
              </form>
            ) : (
              <>
                <form onSubmit={verifyReset} className="space-y-4">
                  <input
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    className="h-14 w-full rounded-xl border border-stone-300 text-center text-2xl font-semibold tracking-[0.5em] outline-none focus:border-stone-900"
                  />
                  <Field icon={<Lock size={16} />} type="password" placeholder="New password (min 8 characters)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required minLength={8} />
                  <SubmitButton busy={busy} disabled={otp.length !== 6 || newPassword.length < 8}>Reset password</SubmitButton>
                </form>
                <button type="button" onClick={() => startReset()} disabled={busy} className="mt-4 w-full text-center text-sm text-[#8a6d1f] hover:underline disabled:opacity-50">
                  Didn&apos;t get it? Resend code
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <button type="button" onClick={() => { setView('register'); setError(null); }} className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
              <ArrowLeft size={15} /> Back
            </button>
            <header className="mb-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#faf5e6] text-[#8a6d1f]"><ShieldCheck size={24} /></span>
              <h1 className="mt-3 font-display text-2xl font-bold">Verify your email</h1>
              <p className="mt-1 text-sm text-stone-500">{notice ?? 'Enter the 6-digit code we sent you.'}</p>
            </header>

            {error && <ErrorNote message={error} />}

            <form onSubmit={verifyOtp} className="space-y-4">
              <input
                inputMode="numeric"
                autoFocus
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="h-14 w-full rounded-xl border border-stone-300 text-center text-2xl font-semibold tracking-[0.5em] outline-none focus:border-stone-900"
              />
              <SubmitButton busy={busy} disabled={otp.length !== 6}>Verify &amp; create account</SubmitButton>
            </form>
            <button type="button" onClick={resend} disabled={busy} className="mt-4 w-full text-center text-sm text-[#8a6d1f] hover:underline disabled:opacity-50">
              Didn&apos;t get it? Resend code
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ icon, ...props }: { icon: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 transition-colors focus-within:border-stone-900">
      <span className="text-stone-400">{icon}</span>
      <input {...props} className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-stone-400" />
    </div>
  );
}

function SubmitButton({ busy, children, disabled }: { busy: boolean; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="h-11 w-full rounded-full bg-stone-900 text-sm font-semibold text-white transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? 'Please wait…' : children}
    </button>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
