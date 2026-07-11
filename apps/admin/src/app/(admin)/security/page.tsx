'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDateTime, timeAgo } from '@/lib/format';
import { Button, Card, ErrorNote, Field, Input, PageHeader, Spinner } from '@/components/ui';

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Security" subtitle="Change your password and manage active sessions" />
      <PasswordCard />
      <SessionsCard />
    </div>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const change = useMutation({
    mutationFn: () => api.post('/auth/password', { currentPassword: current, newPassword: next }),
    onSuccess: () => { setDone(true); setCurrent(''); setNext(''); setError(null); },
    onError: setError,
  });
  return (
    <Card title="Change password">
      <div className="space-y-3">
        <Field label="Current password"><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
        <Field label="New password (min 10 characters)"><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
        <ErrorNote error={error} />
        {done && <p className="text-sm text-emerald-600">Password changed ✓</p>}
        <Button className="w-full" loading={change.isPending} disabled={!current || !next} onClick={() => change.mutate()}>Update password</Button>
      </div>
    </Card>
  );
}

function SessionsCard() {
  const queryClient = useQueryClient();
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<{ id: string; createdAt: string; lastSeenAt: string; ip: string | null; userAgent: string | null; current: boolean }[]>('/auth/sessions'),
  });
  if (isLoading) return <Spinner />;
  return (
    <Card title="Active sessions" action={
      <Button size="sm" variant="outline" onClick={async () => { await api.del('/auth/sessions/others'); queryClient.invalidateQueries({ queryKey: ['sessions'] }); }}>
        Log out other sessions
      </Button>
    }>
      <div className="space-y-2 text-sm">
        {sessions?.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-md border border-stone-100 px-3 py-2">
            <div>
              <p>{s.userAgent?.slice(0, 60) ?? 'Unknown device'}{s.current && <span className="ml-2 text-xs font-bold text-emerald-600">this device</span>}</p>
              <p className="text-xs text-stone-400">{s.ip ?? ''} · started {formatDateTime(s.createdAt)} · active {timeAgo(s.lastSeenAt)}</p>
            </div>
            {!s.current && (
              <Button size="sm" variant="ghost" onClick={async () => { await api.del(`/auth/sessions/${s.id}`); queryClient.invalidateQueries({ queryKey: ['sessions'] }); }}>
                Revoke
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
