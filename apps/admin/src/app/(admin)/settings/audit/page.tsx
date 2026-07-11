'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Badge, PageHeader, Select, Spinner, Table, Tabs, Td } from '@/components/ui';

export default function AuditPage() {
  const [tab, setTab] = useState('settings');
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Audit" subtitle="Append-only — settings history and account events" />
      <Tabs tabs={[{ key: 'settings', label: 'Settings changes' }, { key: 'accounts', label: 'Account events' }]} active={tab} onChange={setTab} />
      <div className="mt-4">
        {tab === 'settings' ? <SettingsAudit /> : <AccountsAudit />}
      </div>
    </div>
  );
}

function SettingsAudit() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-settings'],
    queryFn: () => api.get<{ id: string; key: string; oldValue: unknown; newValue: unknown; actorId: string; reason: string | null; createdAt: string }[]>('/audit/settings'),
  });
  if (isLoading) return <Spinner />;
  return (
    <Table headers={['When', 'Setting', 'Change', 'Reason']} empty="No settings changes yet">
      {data?.map((h) => (
        <tr key={h.id}>
          <Td className="whitespace-nowrap text-stone-500">{formatDateTime(h.createdAt)}</Td>
          <Td className="font-mono text-xs">{h.key}</Td>
          <Td className="max-w-md">
            <span className="text-red-500 line-through">{JSON.stringify(h.oldValue)}</span>{' → '}
            <span className="font-medium text-emerald-700">{JSON.stringify(h.newValue)}</span>
          </Td>
          <Td className="text-stone-500">{h.reason ?? '—'}</Td>
        </tr>
      ))}
    </Table>
  );
}

function AccountsAudit() {
  const [type, setType] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['audit-accounts', type],
    queryFn: () => api.get<{ id: string; userId: string | null; type: string; detail: unknown; ip: string | null; createdAt: string }[]>(`/audit/account-events${type ? `?type=${type}` : ''}`),
  });
  if (isLoading) return <Spinner />;
  return (
    <>
      <div className="mb-3">
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-52">
          <option value="">All event types</option>
          {['login', 'login_failed', 'lockout', 'invited', 'activated', 'deactivated', 'role_changed', '2fa_enabled', 'password_changed', 'step_up'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
      </div>
      <Table headers={['When', 'Event', 'Detail', 'IP']} empty="No events">
        {data?.map((e) => (
          <tr key={e.id}>
            <Td className="whitespace-nowrap text-stone-500">{formatDateTime(e.createdAt)}</Td>
            <Td><Badge color={e.type.includes('failed') || e.type === 'lockout' ? 'red' : 'gray'}>{e.type}</Badge></Td>
            <Td className="max-w-md truncate text-xs text-stone-400">{e.detail ? JSON.stringify(e.detail) : '—'}</Td>
            <Td className="text-xs text-stone-400">{e.ip ?? '—'}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
