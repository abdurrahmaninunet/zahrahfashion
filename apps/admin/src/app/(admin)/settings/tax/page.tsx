'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { naira } from '@/lib/format';
import { Button, Card, ErrorNote, Field, Input, PageHeader, Spinner } from '@/components/ui';

/** Settings → Tax. A single editable percentage applied to the product subtotal
 *  at checkout (shown to shoppers as "Tax"). Added on top of prices — never part
 *  of the product price — and not applied to delivery. Set 0 to switch it off. */
export default function TaxSettingsPage() {
  const queryClient = useQueryClient();
  const { hasCap } = useAuth();
  const canEdit = hasCap('settings.edit');

  const { data, isLoading } = useQuery({ queryKey: ['tax'], queryFn: () => api.get<{ ratePercent: number }>('/tax') });
  const [value, setValue] = useState('');

  useEffect(() => {
    if (data) setValue(String(data.ratePercent));
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put('/tax', { ratePercent: Number(value) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tax'] }),
  });

  if (isLoading || !data) return <Spinner />;

  const rate = Number(value);
  const valid = Number.isFinite(rate) && rate >= 0 && rate <= 100;
  const changed = valid && rate !== data.ratePercent;
  const sampleTax = valid ? Math.round((1_000_000 * rate) / 100) : 0; // ₦10,000 example

  return (
    <div className="max-w-xl">
      <PageHeader title="Tax" subtitle="A percentage added to the product subtotal at checkout, shown to shoppers as “Tax”." />

      <Card>
        <Field label="Tax rate (%)" hint="Applied to the product subtotal only — not to delivery. It is added on top of prices, never included in a product’s price. Set 0 to turn tax off.">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              inputMode="decimal"
              value={value}
              disabled={!canEdit}
              onChange={(e) => setValue(e.target.value)}
              className="max-w-[140px]"
            />
            <span className="text-sm font-medium text-stone-500">%</span>
          </div>
        </Field>

        <p className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-600">
          {valid && rate > 0 ? (
            <>Example: on <b>{naira(1_000_000)}</b> of products, customers pay <b>{naira(sampleTax)}</b> tax at checkout.</>
          ) : rate === 0 ? (
            <>Tax is <b>off</b> — no tax line is shown at checkout.</>
          ) : (
            <span className="text-red-600">Enter a percentage between 0 and 100.</span>
          )}
        </p>

        {save.isError && <div className="mt-3"><ErrorNote error={save.error} /></div>}

        {canEdit && (
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={() => save.mutate()} disabled={!changed || save.isPending}>
              {save.isPending ? 'Saving…' : 'Save changes'}
            </Button>
            {save.isSuccess && !changed && <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600"><Check size={15} /> Saved</span>}
          </div>
        )}
        {!canEdit && <p className="mt-4 text-sm text-stone-400">You don’t have permission to change tax settings.</p>}
      </Card>
    </div>
  );
}
