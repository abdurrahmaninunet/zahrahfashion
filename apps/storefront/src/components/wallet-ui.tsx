'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

/** Shared bits for the Gift Card page and the account Balance tab. */

export function WalletModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-stone-900">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Start a Paystack payment; redirect to the hosted checkout or (dev) simulate. */
export function useWalletPay(path: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function pay(amountKobo: number, onSettled: () => void) {
    setBusy(true); setError(null);
    try {
      const res = await api.post<{ authorizationUrl?: string; reference: string; simulated?: boolean }>(path, { amount: amountKobo, origin: window.location.origin });
      if (res.authorizationUrl) { window.location.href = res.authorizationUrl; return; }
      await api.post('/store/account/wallet/simulate', { reference: res.reference }); // dev fallback
      onSettled();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Payment could not start');
      setBusy(false);
    }
  }
  return { pay, busy, error };
}

export function AmountField({ amount, setAmount }: { amount: string; setAmount: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400">Amount (₦)</span>
      <input type="number" min={100} step={100} autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 10000"
        className="h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-stone-900" />
    </label>
  );
}
