'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Lock, Star } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { openAuthDrawer } from '@/lib/auth-drawer';

interface ReviewItem { id: string; rating: number; body: string | null; createdAt: string; author: string }
interface ReviewsData { summary: { average: number; count: number; distribution: number[] }; reviews: ReviewItem[] }
interface MyReview { canReview: boolean; purchased: boolean; review: { rating: number; body: string | null; status: string } | null }

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={size} className={i < Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-stone-200 text-stone-200'} />
      ))}
    </span>
  );
}

const INITIAL = 4;

export function Reviews({ productId, slug }: { productId: string; slug: string }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data } = useQuery({ queryKey: ['reviews', slug], queryFn: () => api.get<ReviewsData>(`/store/products/${slug}/reviews`) });
  const { data: me } = useQuery({ queryKey: ['store-me'], queryFn: () => api.get<{ customer: { id: string } | null }>('/store/account/me') });
  const signedIn = !!me?.customer;
  const { data: mine } = useQuery({
    queryKey: ['review-mine', productId],
    queryFn: () => api.get<MyReview>(`/store/account/reviews/mine?productId=${productId}`),
    enabled: signedIn,
  });

  const summary = data?.summary ?? { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] };
  const reviews = data?.reviews ?? [];
  const shown = expanded ? reviews : reviews.slice(0, INITIAL);
  const dist = [5, 4, 3, 2, 1].map((star) => ({ star, pct: summary.count ? Math.round((summary.distribution[star - 1] / summary.count) * 100) : 0 }));

  const onSaved = () => {
    qc.invalidateQueries({ queryKey: ['reviews', slug] });
    qc.invalidateQueries({ queryKey: ['review-mine', productId] });
  };

  return (
    <section id="reviews" className="mt-12 scroll-mt-24 border-t border-stone-200 pt-8">
      <h2 className="font-display text-xl font-bold">Ratings &amp; reviews</h2>

      <div className="mt-5 grid gap-8 md:grid-cols-[240px_minmax(0,1fr)]">
        {/* Summary + distribution */}
        <div className="h-fit">
          {summary.count > 0 ? (
            <>
              <div className="flex items-center gap-3">
                <span className="text-4xl font-bold text-stone-900">{summary.average.toFixed(1)}</span>
                <div>
                  <Stars value={summary.average} size={18} />
                  <p className="mt-1 text-xs text-stone-500">{summary.count} rating{summary.count === 1 ? '' : 's'}</p>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                {dist.map((d) => (
                  <div key={d.star} className="flex items-center gap-2 text-xs">
                    <span className="w-12 shrink-0 text-stone-600">{d.star} star</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                      <span className="block h-full rounded-full bg-amber-400" style={{ width: `${d.pct}%` }} />
                    </span>
                    <span className="w-8 shrink-0 text-right text-stone-400">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Stars value={0} size={18} />
              <p className="text-sm text-stone-500">No reviews yet</p>
            </div>
          )}
        </div>

        {/* Write area + review list */}
        <div>
          <WriteArea signedIn={signedIn} mine={mine} productId={productId} onSaved={onSaved} />

          {reviews.length > 0 ? (
            <>
              <ul className="mt-6 space-y-6">
                {shown.map((r) => (
                  <li key={r.id} className="border-b border-stone-100 pb-6 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-200 text-xs font-bold text-stone-600">{r.author.charAt(0).toUpperCase()}</span>
                      <span className="text-sm font-medium text-stone-800">{r.author}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check size={12} /> Verified purchase</span>
                    </div>
                    <div className="mt-2"><Stars value={r.rating} /></div>
                    <p className="mt-1 text-xs text-stone-400">{new Date(r.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    {r.body && <p className="mt-2 text-sm leading-relaxed text-stone-600">{r.body}</p>}
                  </li>
                ))}
              </ul>
              {reviews.length > INITIAL && (
                <button type="button" onClick={() => setExpanded((v) => !v)}
                  className="mt-5 rounded-full border border-stone-300 px-6 py-2 text-sm font-medium text-stone-800 transition-colors hover:border-stone-900 hover:bg-stone-900 hover:text-white">
                  {expanded ? 'Show fewer reviews' : `Show all ${reviews.length} reviews`}
                </button>
              )}
            </>
          ) : (
            <p className="mt-6 text-sm text-stone-500">Be the first to review this product.</p>
          )}
        </div>
      </div>
    </section>
  );
}

/** The write-a-review area — depends on sign-in + verified-purchase state. */
function WriteArea({ signedIn, mine, productId, onSaved }: { signedIn: boolean; mine?: MyReview; productId: string; onSaved: () => void }) {
  if (!signedIn) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
        <p className="text-sm text-stone-600">Bought this? Share your experience.</p>
        <button onClick={openAuthDrawer} className="mt-2 rounded-full bg-stone-900 px-5 py-2 text-sm font-semibold text-white hover:bg-stone-800 cursor-pointer">Sign in to write a review</button>
      </div>
    );
  }
  if (mine === undefined) return null; // eligibility still loading
  if (!mine.purchased) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-500">
        <Lock size={15} /> Only shoppers who&apos;ve purchased this product can review it.
      </p>
    );
  }
  return <ReviewForm productId={productId} existing={mine.review} onSaved={onSaved} />;
}

function ReviewForm({ productId, existing, onSaved }: { productId: string; existing: MyReview['review']; onSaved: () => void }) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState(existing?.body ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Sync when the loaded existing review changes.
  useEffect(() => { setRating(existing?.rating ?? 0); setBody(existing?.body ?? ''); }, [existing?.rating, existing?.body]);

  const save = useMutation({
    mutationFn: () => api.post<{ ok: boolean; pending: boolean }>('/store/account/reviews', { productId, rating, body: body.trim() || undefined }),
    onSuccess: (r) => { setPending(r.pending); setError(null); onSaved(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not save your review'),
  });

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-sm font-semibold text-stone-800">{existing ? 'Edit your review' : 'Write a review'}</p>
      {existing?.status === 'hidden' && (
        <p className="mt-1 text-xs text-amber-600">Your review is awaiting moderation and isn&apos;t shown publicly yet.</p>
      )}
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)}
            className="cursor-pointer">
            <Star size={26} className={n <= (hover || rating) ? 'fill-amber-400 text-amber-400' : 'fill-stone-200 text-stone-200'} />
          </button>
        ))}
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={3}
        placeholder="Tell others what you think — keep it kind and honest."
        className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900" />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {pending
        ? <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700"><Check size={15} /> Submitted — it&apos;ll appear after a quick review.</p>
        : save.isSuccess
          ? <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700"><Check size={15} /> Thanks — your review is live!</p>
          : (
            <button type="button" disabled={rating < 1 || save.isPending} onClick={() => save.mutate()}
              className="mt-3 flex h-10 items-center justify-center gap-2 rounded-full bg-stone-900 px-6 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50 cursor-pointer">
              {save.isPending ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : existing ? 'Update review' : 'Submit review'}
            </button>
          )}
    </div>
  );
}
