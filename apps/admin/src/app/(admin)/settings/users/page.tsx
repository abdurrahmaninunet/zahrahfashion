'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { Badge, Button, Dialog, ErrorNote, Field, Input, PageHeader, Spinner, Table, Td, statusColor } from '@/components/ui';

interface UserRow { id: string; name: string; email: string; phone: string | null; roleKey: string; status: string; lastLoginAt: string | null; role: { name: string } }
interface Invite { id: string; email: string; name: string; roleKey: string; expiresAt: string }

const CONFIRM_PHRASE = 'remove this user';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { me } = useAuth();
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<UserRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<{ users: UserRow[]; pendingInvites: Invite[] }>('/users'),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  if (isLoading || !data) return <Spinner />;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Staff accounts" subtitle="Every staff member gets full access — a temporary password is emailed on creation"
        action={<Button onClick={() => setInviting(true)}><Plus size={15} /> Add staff</Button>} />

      {data.pendingInvites.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-xs font-bold uppercase text-amber-700">Pending invites</p>
          {data.pendingInvites.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between py-1 text-sm">
              <span>{invite.name} · {invite.email}</span>
              <Button size="sm" variant="outline" onClick={async () => { await api.del(`/users/invites/${invite.id}`); invalidate(); }}>Revoke</Button>
            </div>
          ))}
        </div>
      )}

      <Table headers={['Staff', 'Role', 'Last login', 'Status', '']} empty="No staff yet">
        {data.users.map((user) => {
          const isManager = user.roleKey === 'owner'; // the Manager account — protected
          const isSelf = user.id === me?.user.id;
          return (
            <tr key={user.id} className="hover:bg-stone-50">
              <Td>
                <p className="font-medium">{user.name}{isSelf ? ' (you)' : ''}</p>
                <p className="text-xs text-stone-400">{user.email}</p>
              </Td>
              <Td><Badge color="blue">{user.role.name}</Badge></Td>
              <Td className="text-stone-500">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'never'}</Td>
              <Td><Badge color={statusColor(user.status)}>{user.status}</Badge></Td>
              <Td className="text-right">
                {!isManager && !isSelf && (
                  <Button size="sm" variant="danger" onClick={() => setRemoving(user)}><Trash2 size={14} /> Remove</Button>
                )}
              </Td>
            </tr>
          );
        })}
      </Table>

      {inviting && <InviteDialog onClose={() => setInviting(false)} onSaved={() => { setInviting(false); invalidate(); }} />}
      {removing && <RemoveUserDialog user={removing} onClose={() => setRemoving(null)} onRemoved={() => { setRemoving(null); invalidate(); }} />}
    </div>
  );
}

function InviteDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [result, setResult] = useState<{ email: string; emailed: boolean; devPassword?: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const invite = useMutation({
    mutationFn: () => api.post<{ ok: boolean; email: string; emailed: boolean; devPassword?: string }>('/users/invite', { ...form, phone: form.phone || undefined }),
    onSuccess: (r) => setResult(r),
    onError: setError,
  });
  return (
    <Dialog open onClose={result ? onSaved : onClose} title="Add staff member">
      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-stone-600">Staff account created for <b>{result.email}</b> with full access.</p>
          {result.emailed ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✓ A temporary password has been emailed to them. They&apos;ll set their own on first sign-in.</p>
          ) : (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p>Email isn&apos;t configured, so share this temporary password securely:</p>
              {result.devPassword && <p className="mt-1 font-mono text-base font-bold">{result.devPassword}</p>}
            </div>
          )}
          <Button className="w-full" onClick={onSaved}>Done</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Full name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email (login)"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Phone (optional)"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <p className="text-xs text-stone-400">Staff get full access. A temporary password is emailed automatically; they&apos;ll confirm a one-time code and set a new password on first sign-in.</p>
          <ErrorNote error={error} />
          <Button className="w-full" loading={invite.isPending} disabled={!form.name || !form.email} onClick={() => invite.mutate()}>Add staff</Button>
        </div>
      )}
    </Dialog>
  );
}

function RemoveUserDialog({ user, onClose, onRemoved }: { user: UserRow; onClose: () => void; onRemoved: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<unknown>(null);
  const remove = useMutation({
    mutationFn: () => api.del(`/users/${user.id}`),
    onSuccess: onRemoved,
    onError: setError,
  });
  const confirmed = text.trim().toLowerCase() === CONFIRM_PHRASE;
  return (
    <Dialog open onClose={onClose} title={`Remove ${user.name}`}>
      <div className="space-y-3">
        <p className="text-sm text-stone-600">
          This permanently removes <b>{user.name}</b> ({user.email}) and signs them out everywhere. This can&apos;t be undone.
        </p>
        <Field label={`Type "${CONFIRM_PHRASE}" to confirm`}>
          <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={CONFIRM_PHRASE} />
        </Field>
        <ErrorNote error={error} />
        <Button variant="danger" className="w-full" disabled={!confirmed || remove.isPending} loading={remove.isPending} onClick={() => remove.mutate()}>
          Remove user
        </Button>
      </div>
    </Dialog>
  );
}
