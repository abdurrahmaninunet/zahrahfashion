'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Card, ErrorNote, Field, Input, PageHeader, Spinner, Textarea } from '@/components/ui';

/**
 * Settings → Store profile. Edits the public brand identity settings
 * (store.name/phone/whatsapp/email/address/social) via the generic settings API.
 * The social handles + WhatsApp number drive the storefront footer's
 * "Stay connected" icons and the floating WhatsApp button — without this page
 * they stay at their empty defaults and no icons appear.
 */
interface SettingRow { key: string; value: unknown }
interface Social { instagram?: string; facebook?: string; tiktok?: string }

export default function StoreProfilePage() {
  const queryClient = useQueryClient();
  const { hasCap } = useAuth();
  const canEdit = hasCap('settings.edit');

  const { data, isLoading } = useQuery({
    queryKey: ['settings-profile'],
    queryFn: () => api.get<SettingRow[]>('/settings'),
  });

  const [form, setForm] = useState({
    name: '', phone: '', whatsapp: '', email: '', address: '',
    instagram: '', facebook: '', tiktok: '',
  });

  useEffect(() => {
    if (!data) return;
    const get = (k: string) => data.find((s) => s.key === k)?.value;
    const social = (get('store.social') as Social) ?? {};
    setForm({
      name: (get('store.name') as string) ?? '',
      phone: (get('store.phone') as string) ?? '',
      whatsapp: (get('store.whatsapp') as string) ?? '',
      email: (get('store.email') as string) ?? '',
      address: (get('store.address') as string) ?? '',
      instagram: social.instagram ?? '',
      facebook: social.facebook ?? '',
      tiktok: social.tiktok ?? '',
    });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const get = (k: string) => data!.find((s) => s.key === k)?.value;
      const puts: Promise<unknown>[] = [];
      // Only write keys that actually changed, so the settings audit log stays clean.
      const pushIf = (k: string, cur: unknown, next: unknown) => {
        if (JSON.stringify(cur ?? '') !== JSON.stringify(next)) puts.push(api.put(`/settings/${k}`, { value: next }));
      };
      pushIf('store.name', get('store.name'), form.name.trim());
      pushIf('store.phone', get('store.phone'), form.phone.trim());
      pushIf('store.whatsapp', get('store.whatsapp'), form.whatsapp.trim());
      pushIf('store.email', get('store.email'), form.email.trim());
      pushIf('store.address', get('store.address'), form.address.trim());
      const social: Social = {
        instagram: form.instagram.trim().replace(/^@/, ''),
        facebook: form.facebook.trim(),
        tiktok: form.tiktok.trim().replace(/^@/, ''),
      };
      pushIf('store.social', get('store.social'), social);
      await Promise.all(puts);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings-profile'] }),
  });

  if (isLoading || !data) return <Spinner />;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="max-w-2xl">
      <PageHeader title="Store profile" subtitle="Your public brand details — shown in the storefront header, footer and contact pages." />

      <Card>
        <div className="space-y-4">
          <Field label="Store name"><Input value={form.name} onChange={set('name')} disabled={!canEdit} placeholder="Zahra Fashion" /></Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact phone"><Input value={form.phone} onChange={set('phone')} disabled={!canEdit} placeholder="0803 123 4567" /></Field>
            <Field label="WhatsApp number" hint="Powers the footer chat button and the floating WhatsApp button.">
              <Input value={form.whatsapp} onChange={set('whatsapp')} disabled={!canEdit} placeholder="+234 803 123 4567" />
            </Field>
          </div>

          <Field label="Contact email"><Input type="email" value={form.email} onChange={set('email')} disabled={!canEdit} placeholder="hello@zahrahfashion.com" /></Field>
          <Field label="Physical address"><Textarea rows={2} value={form.address} onChange={set('address')} disabled={!canEdit} placeholder="Street, area, city" /></Field>

          <div className="border-t border-stone-100 pt-4">
            <p className="text-sm font-semibold text-stone-700">Social handles</p>
            <p className="mt-1 text-xs text-stone-400">Shown as icons under “Stay connected” in the storefront footer. Leave a field blank to hide that icon.</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <Field label="Instagram" hint="handle, no @"><Input value={form.instagram} onChange={set('instagram')} disabled={!canEdit} placeholder="zahrahfashion" /></Field>
              <Field label="Facebook" hint="handle or full URL"><Input value={form.facebook} onChange={set('facebook')} disabled={!canEdit} placeholder="zahrahfashion" /></Field>
              <Field label="TikTok" hint="handle, no @"><Input value={form.tiktok} onChange={set('tiktok')} disabled={!canEdit} placeholder="zahrahfashion" /></Field>
            </div>
          </div>

          {save.isError && <ErrorNote error={save.error} />}

          {canEdit ? (
            <div className="flex items-center gap-3">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save changes'}
              </Button>
              {save.isSuccess && !save.isPending && (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600"><Check size={15} /> Saved</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-stone-400">You don’t have permission to edit store settings.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
