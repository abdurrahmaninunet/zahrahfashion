'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Download, Gift, Info, Loader2, Plus, Sparkles } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { naira, formatDate } from '@/lib/format';
import { AuthForms } from '@/components/auth/auth-forms';
import { AmountField, WalletModal, useWalletPay } from '@/components/wallet-ui';

const LEDGER_LABEL: Record<string, string> = {
  topup: 'Wallet top-up',
  gift_claim: 'Gift card claimed',
  gift_use: 'Gift card added to balance',
};

interface LedgerRow { id: string; amount: number; type: string; ref: string; seq: number; createdAt: string }

/** Human transaction reference: ZFH-YYYYMMDD-000001 (seq is per-customer). */
function txRef(l: LedgerRow) {
  const d = new Date(l.createdAt);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `ZFH-${ymd}-${String(l.seq).padStart(6, '0')}`;
}
const methodFor = (type: string) => (type === 'topup' ? 'Paystack' : 'Gift Card');

/** Download the server-generated PDF receipt for a transaction. The endpoint is
 *  same-origin (proxied to the API) so the session cookie authenticates it. */
function downloadReceipt(l: LedgerRow) {
  const a = document.createElement('a');
  a.href = `/api/store/account/balance/receipt/${encodeURIComponent(l.id)}`;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function BalancePage() {
  const qc = useQueryClient();
  const { data: me, isLoading } = useQuery({ queryKey: ['store-me'], queryFn: () => api.get<{ customer: { id: string } | null }>('/store/account/me') });

  // Paystack return — the callback is /balance?reference=…; verify then refresh.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (!reference) return;
    api.post('/store/checkout/paystack/verify', { reference }).catch(() => {}).finally(() => {
      qc.invalidateQueries({ queryKey: ['balance'] });
      const url = new URL(window.location.href);
      url.searchParams.delete('reference'); url.searchParams.delete('trxref');
      window.history.replaceState(null, '', url);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return <p className="py-20 text-center text-sm text-stone-400">Loading…</p>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Store Credit</h1>
      <p className="mt-1 text-sm text-stone-500">Top up your store credit or claim a gift card. Store credit top-ups are non-refundable.</p>
      <div className="mt-6">
        {me?.customer ? <BalanceManager /> : (
          <div className="mx-auto max-w-md">
            <p className="mb-4 text-center text-sm text-stone-500">Sign in to view and top up your store credit.</p>
            <AuthForms onDone={() => qc.invalidateQueries({ queryKey: ['store-me'] })} />
          </div>
        )}
      </div>
    </div>
  );
}

function BalanceManager() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['balance'], queryFn: () => api.get<{ balance: number; ledger: LedgerRow[] }>('/store/account/balance') });
  const [topup, setTopup] = useState(false);
  const [claim, setClaim] = useState(false);

  const ledger = data?.ledger ?? [];
  // Loyalty: 1 reward point per ₦100 loaded into the wallet (top-ups + claims).
  const lifetimeCreditedKobo = ledger.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0);
  const points = Math.floor(lifetimeCreditedKobo / 100 / 100);

  return (
    <div>
      <div className="rounded-2xl bg-gradient-to-br from-stone-900 to-stone-700 p-6 text-white shadow-md">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70">Your store credit</p>
        <p className="mt-1 text-4xl font-bold">{isLoading ? '…' : naira(data?.balance ?? 0)}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button onClick={() => setTopup(true)} className="flex items-center justify-center gap-2 rounded-full bg-stone-900 py-3 text-sm font-semibold text-white hover:bg-stone-800 cursor-pointer"><Plus size={16} /> Top up</button>
        <button onClick={() => setClaim(true)} className="flex items-center justify-center gap-2 rounded-full border border-stone-300 py-3 text-sm font-semibold text-stone-800 hover:border-stone-500 cursor-pointer"><Gift size={16} /> Claim a gift card</button>
      </div>

      {/* Zahra Rewards */}
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#c9a227]/40 bg-gradient-to-br from-[#faf5e6] to-white p-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold text-stone-900"><Sparkles size={15} className="text-[#c9a227]" /> Zahra Rewards · Gold Member</p>
          <p className="mt-0.5 text-xs text-stone-500">Earn 1 point for every ₦100 you add to your wallet.</p>
        </div>
        <div className="text-right">
          <p className="tabular text-2xl font-bold text-[#8a6d1f]">{points.toLocaleString('en-NG')}</p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">points</p>
        </div>
      </div>

      {/* Payment history */}
      <div className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Payment history</p>
        {isLoading ? (
          <p className="rounded-xl border border-stone-200 py-8 text-center text-sm text-stone-400">Loading…</p>
        ) : ledger.length ? (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-[11px] uppercase tracking-wide text-stone-400">
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  <th className="px-4 py-2.5 font-semibold">Description</th>
                  <th className="px-4 py-2.5 font-semibold">Method</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {ledger.map((l) => (
                  <tr key={l.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-stone-600">{formatDate(l.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-800">{LEDGER_LABEL[l.type] ?? l.type}</p>
                      <p className="tabular text-[11px] text-stone-400">{txRef(l)}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-600">{methodFor(l.type)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"><Check size={11} /> Successful</span>
                    </td>
                    <td className={`tabular whitespace-nowrap px-4 py-3 text-right font-semibold ${l.amount >= 0 ? 'text-emerald-600' : 'text-stone-800'}`}>{l.amount >= 0 ? '+' : ''}{naira(l.amount)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button onClick={() => downloadReceipt(l)} title="Download receipt" className="inline-flex items-center gap-1 text-xs font-medium text-[#8a6d1f] hover:underline cursor-pointer">
                        <Download size={13} /> Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-stone-200 py-8 text-center text-sm text-stone-400">No activity yet — top up or claim a gift card to get started.</p>
        )}
      </div>

      {/* Important information */}
      <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-900"><Info size={15} className="text-stone-500" /> Important Information</p>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-stone-600">
          <li>• Store credit is non-transferable and cannot be exchanged or withdrawn for cash.</li>
          <li>• Store credit can only be used towards purchases on Zahrah Fashion Hub, and top-ups are non-refundable.</li>
          <li>• Gift cards are subject to our gift card terms — keep your gift card number and password private.</li>
          <li>• Promotional or bonus credit may carry an expiry date; check the specific offer for its validity period.</li>
          <li>• Zahra Rewards points are earned on wallet top-ups and have no cash value.</li>
        </ul>
      </div>

      {topup && <TopupModal onClose={() => setTopup(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['balance'] }); setTopup(false); }} />}
      {claim && <ClaimModal onClose={() => setClaim(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['balance'] }); setClaim(false); }} />}
    </div>
  );
}

function TopupModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const kobo = Math.round(Number(amount) * 100);
  const { pay, busy, error } = useWalletPay('/store/account/balance/topup');
  return (
    <WalletModal title="Top up your store credit" onClose={onClose}>
      <AmountField amount={amount} setAmount={setAmount} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <button type="button" disabled={busy || kobo < 10000} onClick={() => pay(kobo, onDone)}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-stone-900 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50 cursor-pointer">
        {busy ? <><Loader2 size={16} className="animate-spin" /> Starting payment…</> : <>Top up{kobo >= 10000 ? ` — ${naira(kobo)}` : ''}</>}
      </button>
      <p className="mt-2 text-center text-[11px] text-stone-400">Paid securely via Paystack. Top-ups are non-refundable.</p>
    </WalletModal>
  );
}

function ClaimModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const claim = useMutation({
    mutationFn: () => api.post<{ amount: number }>('/store/account/balance/claim', { code, password }),
    onSuccess: () => { setTimeout(onDone, 1500); },
  });
  return (
    <WalletModal title="Claim a gift card" onClose={onClose}>
      {claim.isSuccess ? (
        <p className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-700"><Check size={16} /> {naira(claim.data.amount)} added to your store credit!</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-stone-500">Enter the 16-digit gift card number and the password from your gift card email.</p>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400">Gift card number</span>
            <input autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="0000 0000 0000 0000"
              className="tabular h-11 w-full rounded-md border border-stone-300 px-3 text-sm tracking-widest outline-none focus:border-stone-900" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400">Password</span>
            <input value={password} onChange={(e) => setPassword(e.target.value.toUpperCase())} placeholder="From your email"
              className="h-11 w-full rounded-md border border-stone-300 px-3 text-sm tracking-widest outline-none focus:border-stone-900" />
          </label>
          {claim.isError && <p className="text-xs text-red-600">{(claim.error as ApiError)?.message ?? 'Could not claim'}</p>}
          <button type="button" disabled={claim.isPending || code.replace(/\s/g, '').length < 12 || !password} onClick={() => claim.mutate()}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-stone-900 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50 cursor-pointer">
            {claim.isPending ? <><Loader2 size={16} className="animate-spin" /> Claiming…</> : <>Claim to store credit</>}
          </button>
        </div>
      )}
    </WalletModal>
  );
}
