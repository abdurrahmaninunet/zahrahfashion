'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/** Scrolls to the top on every route change (unless the URL targets an anchor),
 *  so each new page starts from the top. */
export function ScrollToTop() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash) return; // let in-page anchor links work (e.g. #reviews)
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
