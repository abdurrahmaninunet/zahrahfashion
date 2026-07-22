'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Lock, Mail, Phone, ShieldCheck, User } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { GoogleButton } from './google-button';

type View = 'login' | 'register' | 'otp' | 'reset';

const OTP_TTL = 600; // 10 minutes — matches the API's OTP_TTL_MS
const RESEND_COOLDOWN = 30; // seconds before "Resend" is allowed again

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

  // Resend cooldown + code-expiry countdowns (shared by both OTP flows).
  const cooldown = useCountdown();
  const expiry = useCountdown();
  const expired = expiry.armed && expiry.remaining === 0;

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

  // Fresh code was just issued — reset the OTP field and (re)start both timers.
  function onCodeIssued(devCode?: string) {
    setOtp(devCode ?? '');
    cooldown.start(RESEND_COOLDOWN);
    expiry.start(OTP_TTL);
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
      onCodeIssued(res.devCode);
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
      onCodeIssued(res.devCode);
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
      const res = await api.post<{ pendingToken: string; devCode?: string }>('/store/account/reset/start', { email: form.identifier });
      setPendingToken(res.pendingToken);
      onCodeIssued(res.devCode);
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
                <PasswordField placeholder="Password" value={form.password} onChange={set('password')} autoComplete="current-password" required />
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
                <PasswordField placeholder="Password (min 8 characters)" value={form.password} onChange={set('password')} autoComplete="new-password" required minLength={8} strength />
                <SubmitButton busy={busy} disabled={form.password.length < 8}>Continue</SubmitButton>
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
              <p className="mt-1 text-sm text-stone-500">{notice ?? (resetSent ? 'Enter the code we emailed you and choose a new password.' : "Enter your email and we'll send a reset code.")}</p>
            </header>

            {error && <ErrorNote message={error} />}

            {!resetSent ? (
              <form onSubmit={startReset} className="space-y-3">
                <Field icon={<Mail size={16} />} type="email" placeholder="Email address" value={form.identifier} onChange={set('identifier')} autoComplete="email" required />
                <SubmitButton busy={busy}>Send reset code</SubmitButton>
              </form>
            ) : (
              <>
                <form onSubmit={verifyReset} className="space-y-4">
                  <OtpBoxes value={otp} onChange={setOtp} autoFocus disabled={expired} />
                  {expired && <ExpiredNote />}
                  <PasswordField placeholder="New password (min 8 characters)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required minLength={8} strength />
                  <SubmitButton busy={busy} disabled={otp.length !== 6 || newPassword.length < 8 || expired}>Reset password</SubmitButton>
                </form>
                <ResendRow cooldown={cooldown.remaining} busy={busy} onResend={() => startReset()} />
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
              <p className="mt-1 text-xs font-medium text-stone-400">{form.email}</p>
            </header>

            {error && <ErrorNote message={error} />}

            <form onSubmit={verifyOtp} className="space-y-4">
              <OtpBoxes value={otp} onChange={setOtp} autoFocus disabled={expired} />
              {expired ? <ExpiredNote /> : <p className="text-center text-xs text-stone-400">Code expires in {formatMMSS(expiry.remaining)}</p>}
              <SubmitButton busy={busy} disabled={otp.length !== 6 || expired}>Verify &amp; create account</SubmitButton>
            </form>

            <ResendRow cooldown={cooldown.remaining} busy={busy} onResend={resend} />
            <button type="button" onClick={() => { setView('register'); setError(null); setNotice(null); }} className="mt-2 w-full text-center text-xs text-stone-400 hover:text-stone-700">
              Wrong address? Change email address
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Six single-digit inputs with auto-advance, backspace-to-previous and paste-to-fill. */
function OtpBoxes({ value, onChange, autoFocus, disabled }: { value: string; onChange: (v: string) => void; autoFocus?: boolean; disabled?: boolean }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setAt = (i: number, digit: string) => {
    const next = (value.slice(0, i) + digit + value.slice(i + 1)).slice(0, 6);
    onChange(next);
    return next;
  };

  return (
    <div className="flex justify-between gap-2" onPaste={(e) => {
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (!pasted) return;
      e.preventDefault();
      onChange(pasted);
      refs.current[Math.min(pasted.length, 5)]?.focus();
    }}>
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={value[i] ?? ''}
          onChange={(e) => {
            const digit = e.target.value.replace(/\D/g, '').slice(-1);
            if (!digit) return;
            setAt(i, digit);
            if (i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (value[i]) setAt(i, '');
              else if (i > 0) { onChange(value.slice(0, i - 1) + value.slice(i)); refs.current[i - 1]?.focus(); }
            } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
          }}
          className="h-14 w-full min-w-0 rounded-xl border border-stone-300 text-center text-2xl font-semibold text-stone-900 outline-none focus:border-stone-900 disabled:bg-stone-100 disabled:text-stone-400"
        />
      ))}
    </div>
  );
}

function ResendRow({ cooldown, busy, onResend }: { cooldown: number; busy: boolean; onResend: () => void }) {
  return (
    <button
      type="button"
      onClick={onResend}
      disabled={busy || cooldown > 0}
      className="mt-4 w-full text-center text-sm text-[#8a6d1f] hover:underline disabled:cursor-not-allowed disabled:text-stone-400 disabled:no-underline"
    >
      {cooldown > 0 ? `Didn't get it? Resend in ${cooldown}s` : "Didn't get it? Resend code"}
    </button>
  );
}

function ExpiredNote() {
  return (
    <p className="flex items-center justify-center gap-1.5 text-center text-xs font-medium text-red-600">
      <AlertCircle size={14} /> Your verification code has expired. Please request a new one.
    </p>
  );
}

/** Password input with a show/hide toggle and an optional strength meter. */
function PasswordField({ value, onChange, strength, ...props }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  strength?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [show, setShow] = useState(false);
  const pw = String(value ?? '');
  const s = scorePassword(pw);
  return (
    <div>
      <div className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 transition-colors focus-within:border-stone-900">
        <span className="text-stone-400"><Lock size={16} /></span>
        <input {...props} type={show ? 'text' : 'password'} value={value} onChange={onChange} className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-stone-400" />
        <button type="button" tabIndex={-1} onClick={() => setShow((v) => !v)} className="text-stone-400 hover:text-stone-700" aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {strength && pw.length > 0 && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i < s.score ? s.bar : 'bg-stone-200'}`} />
            ))}
          </div>
          <span className={`w-16 shrink-0 text-right text-[11px] font-medium ${s.text}`}>{s.label}</span>
        </div>
      )}
    </div>
  );
}

/** Lightweight 0–4 strength score (length + character-class variety). */
function scorePassword(pw: string): { score: number; label: string; bar: string; text: string } {
  if (!pw) return { score: 0, label: '', bar: 'bg-stone-200', text: 'text-stone-400' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  score = Math.min(4, score || (pw.length >= 4 ? 1 : 1));
  const tiers = [
    { label: 'Weak', bar: 'bg-red-500', text: 'text-red-600' },
    { label: 'Weak', bar: 'bg-red-500', text: 'text-red-600' },
    { label: 'Fair', bar: 'bg-amber-500', text: 'text-amber-600' },
    { label: 'Good', bar: 'bg-lime-500', text: 'text-lime-600' },
    { label: 'Strong', bar: 'bg-emerald-500', text: 'text-emerald-600' },
  ];
  return { score, ...tiers[score] };
}

/** Countdown driven by wall-clock so it survives re-renders. `armed` is true once started. */
function useCountdown() {
  const [target, setTarget] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (target == null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  const remaining = target == null ? 0 : Math.max(0, Math.round((target - now) / 1000));
  return {
    remaining,
    armed: target != null,
    start: (secs: number) => { const n = Date.now(); setNow(n); setTarget(n + secs * 1000); },
  };
}

function formatMMSS(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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
