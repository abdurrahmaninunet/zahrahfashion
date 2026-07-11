'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, MapPin, Phone, Clock, MessageCircle, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Dialog, ErrorNote, Field, Input, PageHeader, Spinner, Textarea } from '@/components/ui';

interface StoreLocation {
  id: string; name: string; phone: string | null; email: string | null; whatsapp: string | null;
  address: string | null; opensAt: string | null; closesAt: string | null; sortOrder: number; status: string;
}

export default function StoreLocationsPage() {
  const { hasCap } = useAuth();
  const canEdit = hasCap('settings.edit');
  const [editing, setEditing] = useState<StoreLocation | 'new' | null>(null);

  const { data: locations, isLoading } = useQuery({
    queryKey: ['store-locations'],
    queryFn: () => api.get<StoreLocation[]>('/store-locations'),
  });

  return (
    <div>
      <PageHeader title="Store locations" subtitle="Your physical shops — name, contact and opening hours. Shown on the storefront Shops page." />
      {isLoading ? <Spinner /> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {locations?.map((loc) => (
            <button
              key={loc.id}
              disabled={!canEdit}
              onClick={() => setEditing(loc)}
              className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-4 text-left transition-colors hover:border-brand-400 disabled:cursor-default"
            >
              <p className="font-semibold">{loc.name}</p>
              {loc.address && <p className="flex items-start gap-1.5 text-sm text-stone-500"><MapPin size={14} className="mt-0.5 shrink-0" />{loc.address}</p>}
              {loc.phone && <p className="flex items-center gap-1.5 text-sm text-stone-500"><Phone size={14} />{loc.phone}</p>}
              {loc.whatsapp && <p className="flex items-center gap-1.5 text-sm text-stone-500"><MessageCircle size={14} />{loc.whatsapp}</p>}
              {(loc.opensAt || loc.closesAt) && (
                <p className="flex items-center gap-1.5 text-sm text-stone-500"><Clock size={14} />{loc.opensAt ?? '—'} to {loc.closesAt ?? '—'}</p>
              )}
            </button>
          ))}
          {canEdit && (
            <button
              onClick={() => setEditing('new')}
              className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 text-stone-400 transition-colors hover:border-brand-400 hover:text-brand-600 cursor-pointer"
            >
              <Plus size={32} />
              <span className="text-sm font-medium">Add a shop</span>
            </button>
          )}
        </div>
      )}
      {editing && (
        <LocationDialog location={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function LocationDialog({ location, onClose }: { location: StoreLocation | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: location?.name ?? '',
    phone: location?.phone ?? '',
    email: location?.email ?? '',
    whatsapp: location?.whatsapp ?? '',
    address: location?.address ?? '',
    opensAt: location?.opensAt ?? '',
    closesAt: location?.closesAt ?? '',
  });
  const [error, setError] = useState<unknown>(null);
  const done = () => { queryClient.invalidateQueries({ queryKey: ['store-locations'] }); onClose(); };

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        whatsapp: form.whatsapp || null,
        address: form.address || null,
        opensAt: form.opensAt || null,
        closesAt: form.closesAt || null,
      };
      return location ? api.put(`/store-locations/${location.id}`, body) : api.post('/store-locations', body);
    },
    onSuccess: done,
    onError: setError,
  });
  const archive = useMutation({
    mutationFn: () => api.del(`/store-locations/${location!.id}`),
    onSuccess: done,
    onError: setError,
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open onClose={onClose} title={location ? `Edit ${location.name}` : 'Add a shop'}>
      <div className="space-y-3">
        <Field label="Store name"><Input value={form.name} onChange={set('name')} placeholder="e.g. Zahrah Fashion — Wuse 2" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact phone"><Input value={form.phone} onChange={set('phone')} placeholder="0803 123 4567" /></Field>
          <Field label="WhatsApp number"><Input value={form.whatsapp} onChange={set('whatsapp')} placeholder="+234 803 123 4567" /></Field>
        </div>
        <Field label="Email"><Input type="email" value={form.email} onChange={set('email')} placeholder="shop@zahrah.example" /></Field>
        <Field label="Shop address"><Textarea rows={2} value={form.address} onChange={set('address')} placeholder="Street, area, city" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Opens"><Input type="time" value={form.opensAt} onChange={set('opensAt')} /></Field>
          <Field label="Closes"><Input type="time" value={form.closesAt} onChange={set('closesAt')} /></Field>
        </div>
        <ErrorNote error={error} />
        <div className="flex gap-2">
          <Button className="flex-1" loading={save.isPending} disabled={!form.name.trim()} onClick={() => save.mutate()}>
            {location ? 'Save changes' : 'Add shop'}
          </Button>
          {location && (
            <Button variant="outline" loading={archive.isPending} onClick={() => archive.mutate()}>Remove</Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
