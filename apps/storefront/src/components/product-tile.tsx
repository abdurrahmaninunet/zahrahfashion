"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart,
  Minus,
  Plus,
  ShoppingCart,
  Star,
  Trash2,
} from "lucide-react";
import { naira } from "@/lib/format";
import { lineKey, useCart } from "@/lib/cart";
import { toggleWishlist, useWishlisted } from "@/lib/wishlist";

/**
 * Shared product card — square image, delivery ribbon, wishlist heart, star
 * rating and add-to-cart. Used by "More to love", category listings and the
 * PDP related rail.
 */
export interface ProductTileData {
  id: string;
  name: string;
  href: string;
  image?: string | null;
  bg?: string; // gradient classes when there is no image
  price: number;
  compareAt?: number | null;
  badge?: string | null;
  savings?: number | null;
  onlyLeft?: number | null;
  rating?: number;
  reviews?: number;
  sold?: string;
  soldOut?: boolean;
  priority?: boolean;
  /** Real variant id — set only for simple single-variant products that can be
   *  added to the cart directly. When absent, add-to-cart opens the PDP so the
   *  shopper can pick a variant (prevents phantom ₦0 cart lines). */
  variantId?: string | null;
  unitName?: string;
  /** Live available stock — caps the add-to-cart stepper. */
  maxAvailable?: number;
}

export function ProductTile({ item }: { item: ProductTileData }) {
  const router = useRouter();
  const { lines, add, updateQty, remove } = useCart();
  const wishlisted = useWishlisted(item.id);
  // Only simple products with a resolved variantId get an in-place stepper; the
  // rest route to the PDP, so their line count is always 0 here.
  const cartKey = item.variantId ? lineKey({ variantId: item.variantId }) : "";
  const inCart = item.variantId
    ? (lines.find((l) => lineKey(l) === cartKey)?.quantity ?? 0)
    : 0;

  const discounted = item.compareAt != null && item.compareAt > item.price;
  const off = discounted
    ? Math.round(((item.compareAt! - item.price) / item.compareAt!) * 100)
    : 0;
  // Show "Save ₦X" whenever there's a crossed-out price (or an explicit savings).
  const savings =
    item.savings ?? (discounted ? item.compareAt! - item.price : 0);
  // Real ratings only — no reviews yet shows an honest "No ratings" state.
  const hasReviews = (item.reviews ?? 0) > 0;
  const rating = item.rating ?? 0;

  function addToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (item.soldOut) return;
    // No direct variant (multi-variant, fractional, or dummy) → open the PDP to
    // choose, rather than adding an unresolvable ₦0 line.
    if (!item.variantId) {
      router.push(item.href);
      return;
    }
    add({
      variantId: item.variantId,
      quantity: 1,
      name: item.name,
      image: item.image ?? null,
      unitName: item.unitName ?? "piece",
      slug: item.href.startsWith("/p/") ? item.href.slice(3) : item.id,
      minQty: 1,
      increment: 1,
      maxAvailable: item.maxAvailable,
    });
  }

  const atMax = item.maxAvailable != null && inCart >= item.maxAvailable;

  function inc(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (atMax) return;
    updateQty(cartKey, inCart + 1);
  }

  function dec(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (inCart <= 1) remove(cartKey);
    else updateQty(cartKey, inCart - 1);
  }

  return (
    <div className="group flex flex-col border border-stone-200 bg-white transition-shadow hover:shadow-md">
      <div className="relative">
        <Link
          href={item.href}
          className={`media-box block aspect-square ${item.image ? "" : `bg-gradient-to-br ${item.bg ?? "from-stone-100 to-stone-200"}`}`}
        >
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image}
              alt={item.name}
              loading={item.priority ? "eager" : "lazy"}
              fetchPriority={item.priority ? "high" : undefined}
              className="transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold text-white/70 transition-transform duration-300 group-hover:scale-105">
              {item.name.charAt(0)}
            </span>
          )}

          {item.badge && (
            <span className="absolute left-0 top-0 z-10 bg-[#8a6d1f] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              {item.badge}
            </span>
          )}

          {item.soldOut && (
            <span className="absolute inset-0 z-[6] flex items-center justify-center bg-white/55">
              <span className="rounded bg-stone-800/90 px-2.5 py-1 text-xs font-semibold text-white">
                Sold out
              </span>
            </span>
          )}
        </Link>

        {/* Wishlist heart — sibling of the image link so it stays clickable */}
        <button
          type="button"
          aria-label={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
          aria-pressed={wishlisted}
          onClick={() => toggleWishlist(item.id)}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white/90 backdrop-blur transition-colors hover:bg-white"
        >
          <Heart
            size={15}
            className={
              wishlisted ? "fill-rose-500 text-rose-500" : "text-stone-500"
            }
          />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-2">
        <Link
          href={item.href}
          className="line-clamp-2 min-h-[2.4rem] text-[13px] leading-snug text-stone-700 hover:text-stone-950"
        >
          {item.name}
        </Link>

        {/* Star rating — real reviews only */}
        <div className="mt-1 flex items-center gap-1">
          <span
            className="flex items-center"
            aria-label={hasReviews ? `${rating.toFixed(1)} out of 5 stars` : "No ratings yet"}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <Star
                key={i}
                size={12}
                className={
                  hasReviews && i < Math.round(rating)
                    ? "fill-amber-400 text-amber-400"
                    : "fill-stone-200 text-stone-200"
                }
              />
            ))}
          </span>
          {hasReviews ? (
            <>
              <span className="text-[11px] font-medium text-stone-700">
                {rating.toFixed(1)}
              </span>
              <span className="text-[11px] text-stone-400">({item.reviews})</span>
            </>
          ) : (
            <span className="text-[11px] text-stone-400">No ratings</span>
          )}
        </div>

        {/* Fixed two-line price block (price, then was-price + discount on a
            reserved line) so every card is the same height. */}
        <div className="mt-1">
          <div className="tabular text-base font-bold text-stone-900">
            {naira(item.price)}
          </div>
          <div className="flex min-h-[1rem] items-center gap-1.5">
            {item.compareAt != null && item.compareAt > item.price && (
              <span className="text-[11px] text-stone-400 line-through">
                {naira(item.compareAt)}
              </span>
            )}
            {off > 0 && (
              <span className="text-[11px] font-bold text-[#c02b2b]">
                −{off}%
              </span>
            )}
          </div>
        </div>

        {/* Reserved slot for savings / low-stock lines so all cards stay the
            same height whether or not these are present. */}
        <div className="mt-0.5 min-h-[2rem]">
          {savings > 0 && (
            <p className="text-[11px] font-medium leading-4 text-[#c02b2b]">
              Save {naira(savings)}
            </p>
          )}
          {item.onlyLeft != null && (
            <p className="text-[11px] font-medium leading-4 text-amber-600">
              Only {item.onlyLeft} left
            </p>
          )}
        </div>

        {/* Add to cart → quantity stepper once in the cart (Amazon-style).
            mt-auto keeps it bottom-aligned across all cards. */}
        {item.soldOut ? (
          <button
            type="button"
            disabled
            className="mt-auto flex h-9 w-full shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-stone-400"
          >
            Sold out
          </button>
        ) : inCart === 0 ? (
          <button
            type="button"
            onClick={addToCart}
            className="mt-auto flex h-9 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-amber-400 text-xs font-semibold text-stone-900 transition-colors hover:bg-amber-500"
          >
            <ShoppingCart size={14} /> Add to cart
          </button>
        ) : (
          <div className="mt-auto flex h-9 w-full shrink-0 items-center justify-between rounded-full bg-amber-400 text-stone-900">
            <button
              type="button"
              onClick={dec}
              aria-label={
                inCart === 1 ? "Remove from cart" : "Decrease quantity"
              }
              className="flex h-full w-10 items-center justify-center rounded-l-full transition-colors hover:bg-amber-500"
            >
              {inCart === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
            </button>
            <span className="tabular text-xs font-semibold">
              {inCart} in cart
            </span>
            <button
              type="button"
              onClick={inc}
              disabled={atMax}
              aria-label="Increase quantity"
              title={atMax ? "No more in stock" : undefined}
              className="flex h-full w-10 items-center justify-center rounded-r-full transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
