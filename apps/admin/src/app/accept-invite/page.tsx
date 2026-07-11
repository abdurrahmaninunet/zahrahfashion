'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button, ErrorNote, Field, Input, Spinner } from '@/components/ui';

function AcceptInviteInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError({ message: 'Passwords do not match' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/users/accept-invite', { token, password });
      router.push('/login');
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-stone-100 to-brand-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-xl">
        <h1 className="mb-1 text-lg font-bold">Welcome to Zahrah Admin</h1>
        <p className="mb-5 text-sm text-stone-500">Set your password to activate your staff account.</p>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Password (min 10 characters)">
            <Input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm password">
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <ErrorNote error={error} />
          <Button type="submit" loading={loading} className="w-full" disabled={!token || password.length < 10}>
            Activate account
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return <Suspense fallback={<Spinner />}><AcceptInviteInner /></Suspense>;
}
