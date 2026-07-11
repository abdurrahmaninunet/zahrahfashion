'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { setWishlist, useWishlistIds } from '@/lib/wishlist';

/**
 * Keeps the device-local wishlist in sync with the signed-in customer's saved
 * set (persists across devices). On sign-in it merges local + server (union),
 * then pushes any local changes back. Guests are unaffected (local only).
 */
export function WishlistSync() {
  const { data: me } = useQuery({
    queryKey: ['store-me-header'],
    queryFn: () => api.get<{ customer: { id: string } | null }>('/store/account/me'),
  });
  const customerId = me?.customer?.id ?? null;
  const ids = useWishlistIds();
  const idsKey = [...ids].sort().join(',');

  const mergedFor = useRef<string | null>(null);
  const lastPushed = useRef<string>('');

  // Merge local + server once when a customer becomes active.
  useEffect(() => {
    if (!customerId || mergedFor.current === customerId) return;
    let cancelled = false;
    (async () => {
      try {
        const server = await api.get<{ ids: string[] }>('/store/account/wishlist');
        if (cancelled) return;
        const merged = [...new Set([...(server.ids ?? []), ...ids])];
        setWishlist(merged);
        mergedFor.current = customerId;
        lastPushed.current = [...merged].sort().join(',');
        await api.put('/store/account/wishlist', { ids: merged });
      } catch {
        /* offline / not yet available — retry on next change */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  // Push subsequent local changes to the server (debounced) while signed in.
  useEffect(() => {
    if (!customerId || mergedFor.current !== customerId) return;
    if (idsKey === lastPushed.current) return;
    const t = setTimeout(() => {
      lastPushed.current = idsKey;
      api.put('/store/account/wishlist', { ids }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, customerId]);

  // Forget the merge marker on sign-out so a later sign-in re-merges.
  useEffect(() => {
    if (!customerId) mergedFor.current = null;
  }, [customerId]);

  return null;
}
