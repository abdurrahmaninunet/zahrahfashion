'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Gift, Loader2, Plus, Send } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { naira } from '@/lib/format';
import { AuthForms } from '@/components/auth/auth-forms';
import { AmountField, WalletModal, useWalletPay } from '@/components/wallet-ui';

interface GiftCard { id: string; code: string | null; amount: number; status: string; sharedTo: string | null; createdAt: string }
const CARD_CLS = 'w-[20rem] max-w-full aspect-[1.6]';

export default function GiftCardPage() {
  const qc = useQueryClient();
  const { data: me, isLoading } = useQuery({ queryKey: ['store-me'], queryFn: () => api.get<{ customer: { id: string } | null }>('/store/account/me') });

  // Paystack return — the callback is /gift-card?reference=…; verify then refresh.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (!reference) return;
    api.post('/store/checkout/paystack/verify', { reference }).catch(() => {}).finally(() => {
      qc.invalidateQueries({ queryKey: ['gift-cards'] });
      const url = new URL(window.location.href);
      url.searchParams.delete('reference'); url.searchParams.delete('trxref');
      window.history.replaceState(null, '', url);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return <p className="py-20 text-center text-sm text-stone-400">Loading…</p>;

  return (
    <div className="mx-auto max-w-[1905px] px-4 py-8 lg:px-[8rem]">
      <h1 className="font-display text-2xl font-bold md:text-3xl">Gift Cards</h1>
      <p className="mt-1 text-sm text-stone-500">Buy a gift card, then send it to someone or add it to your own balance. Gift cards are non-refundable.</p>
      <div className="mt-6">
        {me?.customer ? <GiftCardManager /> : (
          <div className="mx-auto max-w-md">
            <p className="mb-4 text-center text-sm text-stone-500">Sign in to buy and manage gift cards.</p>
            <AuthForms onDone={() => qc.invalidateQueries({ queryKey: ['store-me'] })} />
          </div>
        )}
      </div>
    </div>
  );
}

function GiftCardManager() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['gift-cards'], queryFn: () => api.get<{ cards: GiftCard[] }>('/store/account/gift-cards') });
  const [buying, setBuying] = useState(false);
  const [shareCard, setShareCard] = useState<GiftCard | null>(null);
  const [useCard, setUseCard] = useState<GiftCard | null>(null);
  const cards = data?.cards ?? [];

  if (isLoading) return <p className="py-10 text-center text-sm text-stone-400">Loading…</p>;
  return (
    <div>
      <div className="flex flex-wrap gap-4">
        {cards.map((c) => <GiftCardTile key={c.id} card={c} onShare={() => setShareCard(c)} onUse={() => setUseCard(c)} />)}
        <button onClick={() => setBuying(true)}
          className={`${CARD_CLS} flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 text-stone-400 transition-colors hover:border-[#8a6d1f] hover:bg-[#faf5e6] hover:text-[#8a6d1f] cursor-pointer`}>
          <Plus size={44} />
          <span className="text-sm font-medium">Buy a gift card</span>
        </button>
      </div>

      {buying && <PurchaseGiftModal onClose={() => setBuying(false)} onDone={() => { qc.invalidateQueries({ queryKey: ['gift-cards'] }); setBuying(false); }} />}
      {shareCard && <ShareGiftModal card={shareCard} onClose={() => setShareCard(null)} onDone={() => { qc.invalidateQueries({ queryKey: ['gift-cards'] }); setShareCard(null); }} />}
      {useCard && <UseGiftModal card={useCard} onClose={() => setUseCard(null)} onDone={() => { qc.invalidateQueries({ queryKey: ['gift-cards'] }); qc.invalidateQueries({ queryKey: ['balance'] }); setUseCard(null); }} />}
    </div>
  );
}

function GiftCardTile({ card, onShare, onUse }: { card: GiftCard; onShare: () => void; onUse: () => void }) {
  const formatted = card.code ? (card.code.match(/.{1,4}/g) ?? []).join(' ') : '•••• •••• •••• ••••';
  const claimed = card.status === 'claimed';
  return (
    <div className={`${CARD_CLS} relative flex flex-col justify-between rounded-2xl bg-gradient-to-br p-5 text-white shadow-md ${claimed ? 'from-stone-500 to-stone-700 opacity-60 grayscale' : 'from-[#8a6d1f] to-[#4a3910]'}`}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">Zahra Gift</span>
        <Gift size={20} className="opacity-80" />
      </div>
      <div>
        <p className="tabular text-base tracking-[0.18em] sm:text-lg">{formatted}</p>
        <p className="mt-1 text-2xl font-bold">{naira(card.amount)}</p>
      </div>
      {claimed ? (
        <p className="inline-flex w-fit items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold"><Check size={12} /> Redeemed</p>
      ) : (
        <div className="flex gap-2">
          <button onClick={onShare} className="flex flex-1 items-center justify-center gap-1 rounded-full bg-white/20 py-1.5 text-xs font-semibold hover:bg-white/30 cursor-pointer"><Send size={13} /> Send as gift</button>
          <button onClick={onUse} className="flex-1 rounded-full bg-white py-1.5 text-xs font-semibold text-[#4a3910] hover:bg-white/90 cursor-pointer">Add to balance</button>
        </div>
      )}
    </div>
  );
}

function PurchaseGiftModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const kobo = Math.round(Number(amount) * 100);
  const { pay, busy, error } = useWalletPay('/store/account/gift-cards/purchase');
  return (
    <WalletModal title="Buy a gift card" onClose={onClose}>
      <AmountField amount={amount} setAmount={setAmount} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <button type="button" disabled={busy || kobo < 10000} onClick={() => pay(kobo, onDone)}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-stone-900 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50 cursor-pointer">
        {busy ? <><Loader2 size={16} className="animate-spin" /> Starting payment…</> : <>Purchase{kobo >= 10000 ? ` — ${naira(kobo)}` : ''}</>}
      </button>
      <p className="mt-2 text-center text-[11px] text-stone-400">Paid securely via Paystack. Gift cards are non-refundable.</p>
    </WalletModal>
  );
}

function ShareGiftModal({ card, onClose, onDone }: { card: GiftCard; onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const share = useMutation({
    mutationFn: () => api.post(`/store/account/gift-cards/${card.id}/share`, { email, phone: phone || undefined, message: message.trim() || undefined }),
    onSuccess: () => { setTimeout(onDone, 1500); },
  });
  return (
    <WalletModal title="Send this gift card" onClose={onClose}>
      {share.isSuccess ? (
        <p className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-700"><Check size={16} /> Sent! We&apos;ve emailed the gift card and how to claim it to {email}.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-stone-500">We&apos;ll email the {naira(card.amount)} gift card number and a claim password to the recipient.</p>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400">Recipient email</span>
            <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com"
              className="h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-stone-900" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400">Phone (optional)</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="080…"
              className="h-11 w-full rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-stone-900" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400">Personal message (optional)</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 2000))} rows={4} placeholder="Write a note, a love letter, or a birthday wish — we'll include it in the email…"
              className="w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900" />
            <span className="mt-0.5 block text-right text-[11px] text-stone-400">{message.length}/2000</span>
          </label>
          {share.isError && <p className="text-xs text-red-600">{(share.error as ApiError)?.message ?? 'Could not send'}</p>}
          <button type="button" disabled={!email.includes('@') || share.isPending} onClick={() => share.mutate()}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-stone-900 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50 cursor-pointer">
            {share.isPending ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : <><Send size={15} /> Send gift</>}
          </button>
        </div>
      )}
    </WalletModal>
  );
}

function UseGiftModal({ card, onClose, onDone }: { card: GiftCard; onClose: () => void; onDone: () => void }) {
  const use = useMutation({ mutationFn: () => api.post(`/store/account/gift-cards/${card.id}/use`), onSuccess: () => { setTimeout(onDone, 1200); } });
  return (
    <WalletModal title="Add to your balance" onClose={onClose}>
      {use.isSuccess ? (
        <p className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-700"><Check size={16} /> {naira(card.amount)} added to your balance.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-stone-600">Add <b>{naira(card.amount)}</b> from this gift card to your store balance? This can&apos;t be undone.</p>
          {use.isError && <p className="text-xs text-red-600">{(use.error as ApiError)?.message ?? 'Could not add'}</p>}
          <button type="button" disabled={use.isPending} onClick={() => use.mutate()}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-stone-900 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50 cursor-pointer">
            {use.isPending ? <><Loader2 size={16} className="animate-spin" /> Adding…</> : <>Add {naira(card.amount)} to balance</>}
          </button>
        </div>
      )}
    </WalletModal>
  );
}
