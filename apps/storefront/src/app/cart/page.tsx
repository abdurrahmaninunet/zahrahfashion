'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useCart, lineKey } from '@/lib/cart';
import { naira, qty } from '@/lib/format';

interface Evaluation {
  lines: { variantId?: string; bundleProductId?: string; quantity: number; name: string; unitPrice: number; discount: number; lineTotal: number }[];
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  grandTotal: number;
  appliedPromotions: { name: string; amount: number }[];
  codeError: { code: string; reason: string; message: string } | null;
}

type DesignPerson = { name?: string; previewUrl?: string; sides?: { label?: string; previewUrl?: string }[] };
type DesignSpec = { people?: DesignPerson[]; sides?: { label?: string; previewUrl?: string }[] };

export default function CartPage() {
  const cart = useCart();
  const [codeInput, setCodeInput] = useState('');
  const [stockNotes, setStockNotes] = useState<string[]>([]);
  const [openPiece, setOpenPiece] = useState<{ key: string; index: number } | null>(null);

  const payloadLines = cart.lines.map((l) => ({ variantId: l.variantId, bundleProductId: l.bundleProductId, formatId: l.formatId, personalization: l.personalization, anko: l.anko, quantity: l.quantity }));

  // Live evaluation on every change (FR-SF-CRT-02).
  const { data: evaluation } = useQuery({
    queryKey: ['cart-evaluate', JSON.stringify(payloadLines), cart.code],
    queryFn: () => api.post<Evaluation>('/store/cart/evaluate', { lines: payloadLines, code: cart.code }),
    enabled: cart.lines.length > 0,
  });

  // Availability revalidation on cart open (FR-SF-CRT-03).
  useEffect(() => {
    if (!cart.lines.length) return;
    api.post<{ ok: boolean; lines: { variantId?: string; bundleProductId?: string; quantity: number; available: number; ok: boolean }[] }>('/store/availability', { lines: payloadLines })
      .then((check) => {
        const notes: string[] = [];
        for (const result of check.lines) {
          if (!result.ok) {
            const key = result.variantId ?? `bundle:${result.bundleProductId}`;
            const line = cart.lines.find((l) => lineKey(l) === key);
            if (!line) continue;
            if (result.available <= 0) {
              notes.push(`"${line.name}" just sold out — removed from your cart`);
              cart.remove(key);
            } else {
              notes.push(`Only ${qty(result.available)} ${line.unitName !== 'piece' ? line.unitName : ''} of "${line.name}" left — quantity adjusted`);
              cart.updateQty(key, result.available);
            }
          }
        }
        if (notes.length) setStockNotes(notes);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cart.lines.length) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="font-display text-xl font-bold">Your cart is empty</p>
        <p className="mt-2 text-sm text-stone-500">Beautiful fabrics and fragrances are a tap away.</p>
        <Link href="/" className="mt-5 inline-block rounded-md bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-stone-700">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="font-display text-2xl font-bold">Your cart</h1>
      {stockNotes.map((note, i) => (
        <p key={i} className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{note}</p>
      ))}

      <div className="mt-4 grid gap-6 md:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          {cart.lines.map((line) => {
            const key = lineKey(line);
            const evalLine = evaluation?.lines.find((l) => (l.variantId ?? `bundle:${l.bundleProductId}`) === key);
            const perUnit = !['piece', 'package', 'set', 'pair'].includes(line.unitName);
            const designSpec = line.personalization?.mode === 'design' ? (line.personalization.spec as DesignSpec | undefined) : undefined;
            const people = designSpec?.people;
            const teamDesign = !!people?.length;
            const fixedPieces = line.personalization?.mode === 'names' || teamDesign;
            return (
              <div key={key} className="flex gap-3 rounded-xl border border-stone-200 bg-white p-3">
                <Link href={`/p/${line.slug}`} className="media-box aspect-square w-20 shrink-0 rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {line.image && <img src={line.image} alt="" />}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/p/${line.slug}`} className="text-sm font-medium leading-snug hover:underline">{line.name}</Link>
                    <button aria-label="Remove" className="text-stone-300 hover:text-red-500 cursor-pointer" onClick={() => cart.remove(key)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {line.anko && (
                    <span className="mt-1 inline-block rounded bg-[#faf5e6] px-2 py-0.5 text-[11px] font-semibold text-[#6f571a]">Anko — exclusive bulk</span>
                  )}
                  {/* MIM personalization — what gets printed */}
                  {line.personalization && (
                    <div className="mt-1.5 rounded-md bg-stone-50 px-2.5 py-1.5 text-xs">
                      {line.personalization.mode === 'names' ? (
                        <>
                          <p className="font-medium text-stone-500">To print ({line.personalization.names?.length}):</p>
                          <p className="mt-0.5 line-clamp-2 text-stone-700">{line.personalization.names?.join(' · ')}</p>
                        </>
                      ) : line.personalization.mode === 'design' ? (
                        teamDesign ? (
                          <>
                            <p className="font-medium text-stone-500">Custom design ({people!.length} {people!.length === 1 ? 'piece' : 'pieces'}):</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-stone-700">
                              {people!.map((p, i) => (
                                <span key={i} className="inline-flex items-center gap-1">
                                  {i > 0 && <span className="text-stone-300">·</span>}
                                  <button type="button" onClick={() => setOpenPiece({ key, index: i })}
                                    className="font-medium text-stone-900 underline underline-offset-2 hover:text-[#8a6d1f] cursor-pointer">
                                    {p.name || `Piece ${i + 1}`}
                                  </button>
                                </span>
                              ))}
                            </p>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            {line.personalization.previewUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={line.personalization.previewUrl} alt="Your design" className="h-10 w-10 shrink-0 rounded object-cover" />
                            )}
                            <p className="text-stone-600">Custom design: <button type="button" onClick={() => setOpenPiece({ key, index: 0 })}
                              className="font-medium text-stone-900 underline underline-offset-2 hover:text-[#8a6d1f] cursor-pointer">{line.personalization.text || 'view'}</button></p>
                          </div>
                        )
                      ) : (
                        <p className="text-stone-600">Print: <span className="font-medium text-stone-900">&ldquo;{line.personalization.text}&rdquo;</span></p>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    {fixedPieces ? (
                      <span className="rounded-md bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-600">{line.personalization?.mode === 'names' ? line.personalization.names?.length : line.quantity} pieces</span>
                    ) : (
                    <div className="flex items-center rounded-md border border-stone-200">
                      <button className="h-8 w-8 cursor-pointer" onClick={() => cart.updateQty(key, Math.max(line.minQty, Number((line.quantity - line.increment).toFixed(2))))}>−</button>
                      <span className="tabular w-14 border-x border-stone-100 text-center text-sm">{qty(line.quantity)}{perUnit ? ` ${line.unitName.slice(0, 2)}` : ''}</span>
                      <button
                        className="h-8 w-8 cursor-pointer disabled:cursor-not-allowed disabled:text-stone-300"
                        disabled={line.maxAvailable != null && line.quantity >= line.maxAvailable}
                        title={line.maxAvailable != null && line.quantity >= line.maxAvailable ? 'No more in stock' : undefined}
                        onClick={() => cart.updateQty(key, Number((line.quantity + line.increment).toFixed(2)))}
                      >+</button>
                    </div>
                    )}
                    <div className="text-right">
                      {evalLine ? (
                        <>
                          {evalLine.discount > 0 && <p className="text-xs text-[#8a6d1f]">−{naira(evalLine.discount)} promo</p>}
                          <p className="tabular text-sm font-semibold">{naira(evalLine.lineTotal)}</p>
                          {perUnit && <p className="text-[11px] text-stone-400">{qty(line.quantity)} × {naira(evalLine.unitPrice)}</p>}
                        </>
                      ) : (
                        <p className="text-xs text-stone-300">…</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="h-fit rounded-xl border border-stone-200 bg-white p-4">
          {/* Code entry with helpful engine messages (FR-SF-CRT-02) */}
          {cart.code ? (
            <div className="mb-3 flex items-center justify-between rounded-md bg-[#faf5e6] px-3 py-2 text-sm">
              <span className="font-mono font-semibold text-[#6f571a]">{cart.code}</span>
              <button className="text-xs text-stone-400 hover:text-red-500 cursor-pointer" onClick={() => cart.setCode(null)}>remove</button>
            </div>
          ) : (
            <form
              className="mb-3 flex gap-2"
              onSubmit={(e) => { e.preventDefault(); if (codeInput.trim()) { cart.setCode(codeInput.trim().toUpperCase()); setCodeInput(''); } }}
            >
              <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} placeholder="Promo code"
                className="h-9 w-full rounded-md border border-stone-200 px-2.5 text-sm uppercase outline-none focus:border-[#8a6d1f]" />
              <button className="h-9 shrink-0 rounded-md bg-stone-100 px-3 text-xs font-semibold cursor-pointer hover:bg-stone-200">Apply</button>
            </form>
          )}
          {evaluation?.codeError && (
            <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{evaluation.codeError.message}</p>
          )}

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-stone-500"><span>Subtotal</span><span className="tabular">{naira(evaluation?.subtotal ?? 0)}</span></div>
            {evaluation?.appliedPromotions.map((p, i) => (
              <div key={i} className="flex justify-between text-[#8a6d1f]"><span className="truncate pr-2">{p.name}</span><span className="tabular">−{naira(p.amount)}</span></div>
            ))}
            <div className="flex justify-between text-stone-500"><span>Delivery</span><span className="text-xs">calculated at checkout</span></div>
            <div className="flex justify-between border-t border-stone-100 pt-2 text-base font-bold">
              <span>Total</span>
              <span className="tabular">{naira((evaluation?.subtotal ?? 0) - (evaluation?.discountTotal ?? 0))}</span>
            </div>
          </div>
          <Link href="/checkout" className="mt-4 block rounded-md bg-stone-900 py-3 text-center text-sm font-semibold text-white hover:bg-stone-700">
            Checkout
          </Link>
          <p className="mt-2 text-center text-[11px] text-stone-400">Prefer to order by chat? Use the WhatsApp button — your cart comes with you.</p>
        </div>
      </div>

      {openPiece && <PieceModal openPiece={openPiece} onClose={() => setOpenPiece(null)} />}
    </div>
  );
}

/** Views a single MIM design piece from the cart, with remove / duplicate. For a
 *  team line each named piece is separate; for a single design it's the one line. */
function PieceModal({ openPiece, onClose }: { openPiece: { key: string; index: number }; onClose: () => void }) {
  const cart = useCart();
  const line = cart.lines.find((l) => lineKey(l) === openPiece.key);
  const spec = line?.personalization?.spec as DesignSpec | undefined;
  const people = spec?.people;
  const isTeam = !!people?.length;
  const piece: DesignPerson | undefined = isTeam
    ? people![openPiece.index]
    : line ? { name: line.personalization?.text, previewUrl: line.personalization?.previewUrl, sides: spec?.sides } : undefined;

  if (!line || !piece) return null;
  const sides = (piece.sides?.length ? piece.sides : [{ label: undefined, previewUrl: piece.previewUrl }]).filter((s) => s.previewUrl);
  const joinedNames = (ppl: DesignPerson[]) => ppl.map((p) => p.name || '').filter(Boolean).join(' · ');

  function removePiece() {
    if (isTeam) {
      cart.updateLine(openPiece.key, (l) => {
        const next = people!.filter((_, i) => i !== openPiece.index);
        return { ...l, quantity: next.length, image: next[0]?.previewUrl ?? l.image,
          personalization: { ...l.personalization!, previewUrl: next[0]?.previewUrl, text: joinedNames(next), spec: { ...spec, people: next } } };
      });
    } else {
      cart.remove(openPiece.key);
    }
    onClose();
  }
  function duplicatePiece() {
    if (isTeam) {
      cart.updateLine(openPiece.key, (l) => {
        const next = [...people!];
        next.splice(openPiece.index + 1, 0, { ...people![openPiece.index] });
        return { ...l, quantity: next.length,
          personalization: { ...l.personalization!, text: joinedNames(next), spec: { ...spec, people: next } } };
      });
    } else {
      cart.updateLine(openPiece.key, (l) => ({ ...l, quantity: l.quantity + 1 }));
    }
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-stone-900">{piece.name || (isTeam ? `Piece ${openPiece.index + 1}` : 'Custom design')}</h3>
            <p className="text-sm text-stone-500">{line.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          {sides.map((s, i) => (
            <div key={i} className="w-40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.previewUrl} alt={s.label ?? 'Design'} className="w-full rounded-lg border border-stone-200 bg-stone-50" />
              {s.label && <p className="mt-1 text-center text-xs text-stone-500">{s.label}</p>}
            </div>
          ))}
          {!sides.length && <p className="text-sm text-stone-400">No preview available.</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={removePiece}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 cursor-pointer">
            <Trash2 size={16} /> Remove{isTeam ? ' piece' : ''}
          </button>
          <button type="button" onClick={duplicatePiece}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-stone-900 text-sm font-semibold text-white hover:bg-stone-800 cursor-pointer">
            <Plus size={16} /> Duplicate
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-stone-400">Duplicate adds another piece with the same design.</p>
      </div>
    </div>,
    document.body,
  );
}
