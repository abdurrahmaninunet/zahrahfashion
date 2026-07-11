'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, History, PackagePlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { naira, qty, toKobo } from '@/lib/format';
import { Badge, Button, Dialog, ErrorNote, Field, Input, PageHeader, Select, Spinner, Table, Tabs, Td, Textarea } from '@/components/ui';

interface StockRow {
  variantId: string; sku: string; product: string; productId: string; category: string;
  onHand: number; reserved: number; available: number; threshold: number;
  costPrice: number | null; costValue: number | null; minOrderQty: number;
  low: boolean; out: boolean; remnant: boolean; allowBackorder: boolean;
}

function InventoryPageInner() {
  const params = useSearchParams();
  const { hasCap } = useAuth();
  const [filter, setFilter] = useState(params.get('filter') ?? '');
  const [q, setQ] = useState('');
  const [adjusting, setAdjusting] = useState<StockRow | null>(null);
  const [receiving, setReceiving] = useState<StockRow | null>(null);

  const query = new URLSearchParams({ ...(q ? { q } : {}), ...(filter ? { filter } : {}) });
  const { data, isLoading } = useQuery({
    queryKey: ['stock', query.toString()],
    queryFn: () => api.get<{ total: number; rows: StockRow[] }>(`/inventory/stock?${query}`),
  });

  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <PageHeader
        title="Inventory"
        action={
          <div className="flex gap-2">
            <Link href="/inventory/movements"><Button variant="outline" size="sm"><History size={14} /> Ledger</Button></Link>
            {/* Stocktakes feature temporarily disabled — uncomment to restore
                (pages at /inventory/stocktakes and the API remain intact).
            {hasCap('inventory.stocktake_count') && <Link href="/inventory/stocktakes"><Button variant="outline" size="sm"><ClipboardList size={14} /> Stocktakes</Button></Link>}
            */}
          </div>
        }
      />
      <Tabs
        tabs={[
          { key: '', label: 'All stock' },
          { key: 'low', label: 'Low stock' },
          { key: 'out', label: 'Out of stock' },
          { key: 'remnant', label: 'Remnants' },
        ]}
        active={filter}
        onChange={setFilter}
      />
      <div className="my-3">
        <Input placeholder="Search product…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>
      {isLoading ? <Spinner /> : (
        <Table headers={['Product', 'Category', 'On hand', 'Reserved', 'Available', ...(hasCap('inventory.view_costs') ? ['Cost value'] : []), 'State', '', '']} empty="No stock records">
          {data?.rows.map((row) => (
            <tr key={row.variantId} className="hover:bg-stone-50">
              <Td><Link className="hover:underline" href={`/products/${row.productId}`}>{row.product}</Link></Td>
              <Td className="text-stone-500">{row.category}</Td>
              <Td>{qty(row.onHand)}</Td>
              <Td className="text-stone-500">{qty(row.reserved)}</Td>
              <Td className={row.out ? 'font-bold text-red-600' : row.low ? 'font-bold text-amber-600' : 'font-medium'}>{qty(row.available)}</Td>
              {hasCap('inventory.view_costs') && <Td>{row.costValue != null ? naira(row.costValue) : '—'}</Td>}
              <Td>
                {row.out && <Badge color="red">out</Badge>}
                {row.low && <Badge color="amber">low ≤{qty(row.threshold)}</Badge>}
                {row.remnant && <Badge color="purple">remnant &lt;{qty(row.minOrderQty)}</Badge>}
              </Td>
              <Td>
                {hasCap('inventory.receive') && (
                  <Button size="sm" onClick={() => setReceiving(row)}><PackagePlus size={13} /> Receive stock</Button>
                )}
              </Td>
              <Td>
                {(hasCap('inventory.adjust') || hasCap('inventory.adjust_recount')) && (
                  <Button size="sm" variant="outline" onClick={() => setAdjusting(row)}>Adjust</Button>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
      {adjusting && <AdjustDialog row={adjusting} onClose={() => setAdjusting(null)} />}
      {receiving && <ReceiveDialog row={receiving} canSeeCosts={hasCap('inventory.view_costs')} onClose={() => setReceiving(null)} />}
    </div>
  );
}

function AdjustDialog({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { hasCap } = useAuth();
  const [direction, setDirection] = useState<'up' | 'down'>('down');
  const [quantity, setQuantity] = useState('');
  const [reasonCode, setReasonCode] = useState('recount');
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>(null);
  const recountOnly = !hasCap('inventory.adjust');

  const adjust = useMutation({
    mutationFn: () => api.post('/inventory/adjust', { variantId: row.variantId, quantity: Number(quantity), direction, reasonCode, note: note || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['stock'] }); onClose(); },
    onError: setError,
  });

  return (
    <Dialog open onClose={onClose} title={`Adjust ${row.sku}`}>
      <div className="space-y-3">
        <p className="text-sm text-stone-500">On hand: {qty(row.onHand)} · every adjustment posts an immutable ledger movement.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Direction">
            <Select value={direction} onChange={(e) => setDirection(e.target.value as never)}>
              <option value="up">Increase (+)</option>
              <option value="down">Decrease (−)</option>
            </Select>
          </Field>
          <Field label="Quantity"><Input type="number" step="0.5" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
        </div>
        <Field label="Reason">
          <Select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
            <option value="recount">Recount</option>
            {!recountOnly && (
              <>
                <option value="damage">Damage</option>
                <option value="theft_loss">Theft / loss</option>
                <option value="promo_gift">Promo / gift</option>
                <option value="correction">Correction</option>
                <option value="expiry">Expiry</option>
                <option value="other">Other</option>
              </>
            )}
          </Select>
        </Field>
        <Field label={`Note${reasonCode === 'other' ? ' (required)' : ''}`}><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <ErrorNote error={error} />
        <Button className="w-full" loading={adjust.isPending} disabled={!quantity || Number(quantity) <= 0} onClick={() => adjust.mutate()}>
          Post adjustment
        </Button>
      </div>
    </Dialog>
  );
}

/** Per-row receiving: pre-mapped to the product — no searching needed. */
function ReceiveDialog({ row, canSeeCosts, onClose }: { row: StockRow; canSeeCosts: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState(canSeeCosts && row.costPrice != null ? String(row.costPrice / 100) : '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>(null);

  const receive = useMutation({
    mutationFn: () => api.post('/inventory/receipts', {
      note: note || undefined,
      lines: [{
        variantId: row.variantId,
        quantity: Number(quantity),
        unitCost: unitCost ? toKobo(unitCost) : null,
      }],
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['stock'] }); onClose(); },
    onError: setError,
  });

  return (
    <Dialog open onClose={onClose} title="Receive stock">
      <div className="space-y-3">
        <div className="rounded-md bg-stone-50 p-3 text-sm">
          <p className="font-semibold">{row.product}</p>
          <p className="mt-0.5 text-xs text-stone-500">
            {row.category} · currently {qty(row.onHand)} on hand
            {canSeeCosts && row.costPrice != null ? ` · last cost ${naira(row.costPrice)}` : ''}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity received">
            <Input autoFocus type="number" step="0.5" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field label="Unit cost (₦, optional)" hint="Updates the product's cost basis">
            <Input type="number" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
          </Field>
        </div>
        <Field label="Note (optional)"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. supplier delivery 05/07" /></Field>
        <ErrorNote error={error} />
        <Button className="w-full" loading={receive.isPending} disabled={!quantity || Number(quantity) <= 0} onClick={() => receive.mutate()}>
          Post receipt{quantity ? ` — +${quantity}` : ''}
        </Button>
      </div>
    </Dialog>
  );
}

export default function InventoryPage() {
  return <Suspense fallback={<Spinner />}><InventoryPageInner /></Suspense>;
}
