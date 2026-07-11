'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Gift, Loader2, Plus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { naira, formatDate } from '@/lib/format';
import { AuthForms } from '@/components/auth/auth-forms';
import { AmountField, WalletModal, useWalletPay } from '@/components/wallet-ui';

const LEDGER_LABEL: Record<string, string> = { topup: 'Top-up', gift_claim: 'Gift card claimed', gift_use: 'Gift card added' };

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
    <div className="mx-auto max-w-[1905px] px-2.5 py-8 lg:px-[8rem]">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Your Balance</h1>
      <p className="mt-1 text-sm text-stone-500">Top up your store balance or claim a gift card. Balance top-ups are non-refundable.</p>
      <div className="mt-6">
        {me?.customer ? <BalanceManager /> : (
          <div className="mx-auto max-w-md">
            <p className="mb-4 text-center text-sm text-stone-500">Sign in to view and top up your balance.</p>
            <AuthForms onDone={() => qc.invalidateQueries({ queryKey: ['store-me'] })} />
          </div>
        )}
      </div>
    </div>
  );
}

function BalanceManager() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['balance'], queryFn: () => api.get<{ balance: number; ledger: { amount: number; type: string; createdAt: string }[] }>('/store/account/balance') });
  const [topup, setTopup] = useState(false);
  const [claim, setClaim] = useState(false);

  return (
    <div>
      <div className="rounded-2xl bg-gradient-to-br from-stone-900 to-stone-700 p-6 text-white shadow-md">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70">Your balance</p>
        <p className="mt-1 text-4xl font-bold">{isLoading ? '…' : naira(data?.balance ?? 0)}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button onClick={() => setTopup(true)} className="flex items-center justify-center gap-2 rounded-full bg-stone-900 py-3 text-sm font-semibold text-white hover:bg-stone-800 cursor-pointer"><Plus size={16} /> Top up</button>
        <button onClick={() => setClaim(true)} className="flex items-center justify-center gap-2 rounded-full border border-stone-300 py-3 text-sm font-semibold text-stone-800 hover:border-stone-500 cursor-pointer"><Gift size={16} /> Claim a gift card</button>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Activity</p>
        {data?.ledger.length ? (
          <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
            {data.ledger.map((l, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-stone-800">{LEDGER_LABEL[l.type] ?? l.type}</p>
                  <p className="text-xs text-stone-400">{formatDate(l.createdAt)}</p>
                </div>
                <span className={`tabular font-semibold ${l.amount >= 0 ? 'text-emerald-600' : 'text-stone-800'}`}>{l.amount >= 0 ? '+' : ''}{naira(l.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-stone-200 py-8 text-center text-sm text-stone-400">No activity yet — top up or claim a gift card to get started.</p>
        )}
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
    <WalletModal title="Top up your balance" onClose={onClose}>
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
        <p className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-700"><Check size={16} /> {naira(claim.data.amount)} added to your balance!</p>
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
            {claim.isPending ? <><Loader2 size={16} className="animate-spin" /> Claiming…</> : <>Claim to balance</>}
          </button>
        </div>
      )}
    </WalletModal>
  );
}
