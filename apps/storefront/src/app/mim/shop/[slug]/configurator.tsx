'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft, Minus, Plus, Settings2, ShoppingCart, Trash2, Users, Wand2, X } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { naira } from '@/lib/format';
import { BuyBox, type PdpProduct, type PdpVariant } from '@/app/p/[slug]/buy-box';
import type { DesignSpec } from './design-editor';

// Konva-based editor — client only (canvas touches `window`), loaded on demand.
const DesignEditor = dynamic(() => import('./design-editor'), {
  ssr: false,
  loading: () => <div className="py-24 text-center text-sm text-stone-400">Loading designer…</div>,
});

interface SavedDesign { previewUrl: string; spec: DesignSpec; text: string }

let pidSeq = 0;
const newPid = () => `p${++pidSeq}`;

/** The product's design sides (front/back…), falling back to a single Front. */
function productSides(product: PdpProduct) {
  return product.mimSides?.length
    ? product.mimSides
    : [{ id: 'front', label: 'Front', image: product.media[0]?.url ?? null, printArea: product.mimPrintArea ?? null }];
}

/** Client wrapper — renders the Zahrah buy box and feeds it the personalise
 *  cards via `asideExtra`. Lives client-side so the render prop (a function)
 *  never has to cross the server→client boundary. */
export function MimBuyBox({ product, storeName }: { product: PdpProduct; storeName: string }) {
  return (
    <BuyBox
      product={product}
      storeName={storeName}
      // Personalise cards only when the product is marked customizable (admin MIM tab).
      asideExtra={product.mimCustomizable
        ? ({ variant, soldOut }) => <MimPersonalise product={product} variant={variant} soldOut={soldOut} />
        : undefined}
    />
  );
}

/** MIM personalise cards. "Personalise one" is a two-step: Configure (opens a
 *  modal to set the text + quantity) then an add button that stays disabled until
 *  a design has been saved. Pricing = product price + printing surcharge, per
 *  piece. "Personalise many" opens the team-order modal. */
export function MimPersonalise({ product, variant, soldOut }: {
  product: PdpProduct;
  variant: PdpVariant | null;
  soldOut: boolean;
}) {
  const cart = useCart();
  const [editorOpen, setEditorOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [design, setDesign] = useState<SavedDesign | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const printPrice = product.mimPrintPrice ?? 0;
  const unitPrice = (variant?.price ?? 0) + printPrice; // product + printing, per piece
  const total = unitPrice * quantity;
  const launchDisabled = soldOut || !variant;
  const configured = design !== null;

  function addToCart() {
    if (!variant || !design || quantity < 1) return;
    cart.add({
      variantId: variant.id,
      quantity,
      personalization: { mode: 'design', text: design.text, previewUrl: design.previewUrl, spec: design.spec },
      name: product.name
        + (variantLabel(variant) ? ` — ${variantLabel(variant)}` : '')
        + (design.text ? ` — “${design.text}”` : ' — custom design'),
      image: design.previewUrl || product.media[0]?.url || null,
      unitName: 'piece',
      slug: product.slug,
      minQty: 1,
      increment: 1,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="mt-4 space-y-3 border-t border-stone-100 pt-4">
      {/* Personalise one */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Personalise one</p>
        <h3 className="mt-0.5 flex items-center gap-1.5 font-display text-lg font-bold"><Wand2 size={16} /> Make it yours</h3>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">
          Add text or a logo, style it, and place it on the product — designed exactly how you want it.
        </p>
        {printPrice > 0 && (
          <p className="mt-2 text-xs text-stone-500">
            {naira(variant?.price ?? 0)} item + {naira(printPrice)} printing = <b className="text-stone-800">{naira(unitPrice)}</b> each
          </p>
        )}

        {/* Saved design preview */}
        {configured && design && (
          <div className="mt-3 flex items-center gap-3 rounded-md border border-stone-200 bg-stone-50 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={design.previewUrl} alt="Your design" className="h-14 w-14 shrink-0 rounded object-cover" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-800">Your design</p>
              {design.text && <p className="truncate text-xs text-stone-500">&ldquo;{design.text}&rdquo;</p>}
            </div>
          </div>
        )}

        {/* Configure — opens the design editor */}
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          disabled={launchDisabled}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-stone-300 bg-white text-sm font-semibold text-stone-800 transition-colors hover:border-stone-500 disabled:opacity-50 cursor-pointer"
        >
          {soldOut ? 'Sold out' : <><Settings2 size={16} /> {configured ? 'Edit design' : 'Configure'}</>}
        </button>

        {/* Quantity — on the card (not the modal); the total rises as you tap + */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-stone-500">Quantity</span>
          <div className="flex items-center rounded-full border border-stone-300 bg-white">
            <button type="button" aria-label="Fewer" onClick={() => setQuantity((q) => Math.max(0, q - 1))} className="flex h-9 w-10 items-center justify-center rounded-l-full hover:bg-stone-100 cursor-pointer"><Minus size={14} /></button>
            <span className="tabular w-12 border-x border-stone-200 text-center text-sm font-semibold">{quantity}</span>
            <button type="button" aria-label="More" onClick={() => setQuantity((q) => q + 1)} className="flex h-9 w-10 items-center justify-center rounded-r-full hover:bg-stone-100 cursor-pointer"><Plus size={14} /></button>
          </div>
        </div>

        {/* Add — disabled until a design has been created */}
        <button
          type="button"
          onClick={addToCart}
          disabled={launchDisabled || !configured || quantity < 1}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-amber-400 text-sm font-semibold text-stone-900 transition-colors hover:bg-amber-500 disabled:opacity-50 cursor-pointer"
        >
          {added
            ? <><Check size={16} /> Added to cart</>
            : <><ShoppingCart size={16} /> Add personalised — {naira(total)}</>}
        </button>
        {!configured && !launchDisabled && (
          <p className="mt-1.5 text-center text-[11px] text-stone-400">Configure your design to continue.</p>
        )}
      </div>

      {/* Personalise many */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Personalise many</p>
        <h3 className="mt-0.5 flex items-center gap-1.5 font-display text-lg font-bold"><Users size={16} /> One order, every name</h3>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">
          Ordering for a team, an event or an aso-ebi crew? Set the quantity and type a name for each piece — every shirt printed individually.
        </p>
        <button
          type="button"
          onClick={() => setTeamOpen(true)}
          disabled={launchDisabled}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-stone-950 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-50 cursor-pointer"
        >
          Start a team order
        </button>
      </div>

      {editorOpen && variant && (
        <Modal title="Design your product" subtitle={`${product.name}${variantLabel(variant) ? ` — ${variantLabel(variant)}` : ''}`} wide onClose={() => setEditorOpen(false)}>
          <DesignEditor
            productName={product.name}
            sides={productSides(product)}
            initial={design?.spec ?? null}
            onSave={(result) => { setDesign(result); setEditorOpen(false); }}
          />
        </Modal>
      )}
      {teamOpen && variant && <TeamModal product={product} variant={variant} unitPrice={unitPrice} onClose={() => setTeamOpen(false)} />}
    </div>
  );
}

/** Shared modal shell — bottom sheet on mobile, centred dialog on desktop.
 *  `wide` widens it for the design editor. */
function Modal({ title, subtitle, onClose, children, wide }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  // Lock background scroll while open so the overlay is truly full-screen (no
  // scrollbar gutter, no scrolling behind).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  // Portal to <body> so the fixed overlay covers the whole viewport regardless of
  // any transformed/positioned ancestor (a containing block would otherwise clip
  // a plain `fixed` element).
  if (typeof document === 'undefined') return null;
  return createPortal(
    // No backdrop-click close — only the ✕ dismisses it (avoids losing a design).
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div
        className={`max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl ${wide ? 'max-w-4xl' : 'max-w-md'}`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-stone-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function variantLabel(variant: PdpVariant) {
  const vals = Object.values(variant.optionValues);
  return vals.length ? vals.join(' / ') : '';
}

/** Team-order modal — one full design per person. Looks like the Configure
 *  editor; "Add another person" lets you configure each piece individually. */
function TeamModal({ product, variant, unitPrice, onClose }: { product: PdpProduct; variant: PdpVariant; unitPrice: number; onClose: () => void }) {
  const cart = useCart();
  const label = variantLabel(variant);
  const sides = productSides(product);
  const [people, setPeople] = useState<{ id: string; name: string; design: SavedDesign | null }[]>(() => [{ id: newPid(), name: '', design: null }]);
  const [editing, setEditing] = useState<number | null>(null); // start on the overview list
  const [added, setAdded] = useState(false);

  const configured = people.filter((p) => p.design);
  const total = configured.length * unitPrice;

  const updatePerson = (i: number, patch: Partial<{ name: string; design: SavedDesign | null }>) =>
    setPeople((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  function addAnother() {
    setPeople((ps) => [...ps, { id: newPid(), name: '', design: null }]);
  }
  function removePerson(i: number) {
    setPeople((ps) => (ps.length > 1 ? ps.filter((_, j) => j !== i) : ps));
  }

  function addToCart() {
    if (!variant || !configured.length) return;
    cart.add({
      variantId: variant.id,
      quantity: configured.length,
      personalization: {
        mode: 'design',
        text: configured.map((p) => p.name || p.design!.text).filter(Boolean).join(' · '),
        previewUrl: configured[0].design!.previewUrl,
        spec: { people: configured.map((p) => ({ name: p.name, previewUrl: p.design!.previewUrl, sides: p.design!.spec.sides })) },
      },
      name: `${product.name}${label ? ` — ${label}` : ''} (team of ${configured.length})`,
      image: configured[0].design!.previewUrl,
      unitName: 'piece',
      slug: product.slug,
      minQty: 1,
      increment: 1,
    });
    setAdded(true);
    setTimeout(onClose, 1100);
  }

  // ── Editor view — configure one person's design (looks like Configure). ──
  if (editing !== null && people[editing]) {
    const person = people[editing];
    return (
      <Modal wide title="Team order" subtitle={`Person ${editing + 1}${person.name ? ` — ${person.name}` : ''}`} onClose={onClose}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setEditing(null)} className="flex items-center gap-1 rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:border-stone-500 cursor-pointer">
            <ChevronLeft size={15} /> Back
          </button>
          <input value={person.name} onChange={(e) => updatePerson(editing, { name: e.target.value })} placeholder="Name / label for this piece (optional)"
            className="h-9 min-w-0 flex-1 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-stone-900" />
        </div>
        <DesignEditor
          key={person.id}
          productName={`${product.name} — ${person.name || `Person ${editing + 1}`}`}
          sides={sides}
          initial={person.design?.spec ?? null}
          onSave={(d) => { updatePerson(editing, { design: d }); setEditing(null); }}
        />
      </Modal>
    );
  }

  // ── List view — the people and their designs. ──
  return (
    <Modal wide title="Team order" subtitle={`${product.name}${label ? ` — ${label}` : ''}`} onClose={onClose}>
      <p className="mb-3 text-sm text-stone-500">One design per person — configure each, then add the whole set to your cart.</p>
      <div className="space-y-2">
        {people.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border border-stone-200 p-2.5">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-stone-100">
              {p.design?.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.design.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-stone-300">{i + 1}</div>
              )}
            </div>
            <input value={p.name} onChange={(e) => updatePerson(i, { name: e.target.value })} placeholder={`Name for piece ${i + 1}`}
              className="h-9 min-w-0 flex-1 rounded-md border border-stone-300 px-3 text-sm outline-none focus:border-stone-900" />
            <button type="button" onClick={() => setEditing(i)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium cursor-pointer ${p.design ? 'border border-stone-300 hover:border-stone-500' : 'bg-stone-900 text-white hover:bg-stone-800'}`}>
              {p.design ? 'Edit' : 'Design'}
            </button>
            {people.length > 1 && (
              <button type="button" aria-label={`Remove piece ${i + 1}`} onClick={() => removePerson(i)} className="shrink-0 text-stone-400 hover:text-red-600 cursor-pointer"><Trash2 size={15} /></button>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={addAnother} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#8a6d1f] hover:underline">
        <Plus size={14} /> Add another person
      </button>

      <div className="mt-4 flex items-baseline justify-between border-t border-stone-100 pt-3">
        <span className="text-sm text-stone-600">{configured.length} {configured.length === 1 ? 'piece' : 'pieces'} × {naira(unitPrice)}</span>
        <span className="tabular text-lg font-bold text-stone-900">{naira(total)}</span>
      </div>
      <button type="button" onClick={addToCart} disabled={!configured.length}
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-stone-950 text-sm font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-50 cursor-pointer">
        {added ? <><Check size={16} /> Added {configured.length} to cart</> : <><ShoppingCart size={16} /> Add {configured.length || ''} to cart</>}
      </button>
      {!configured.length && <p className="mt-1.5 text-center text-[11px] text-stone-400">Configure at least one person&apos;s design.</p>}
    </Modal>
  );
}
