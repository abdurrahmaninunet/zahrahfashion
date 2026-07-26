'use client';

import { useEffect, useRef, useState } from 'react';

/** Coverflow showcase for the hero's right side. Three images read at once — one
 *  large in the centre, the neighbours scaled down and dimmed either side — and
 *  it slides one across every ~2.6s, looping forever (no snap-back). Sides are
 *  clickable (tap to centre). Pauses on hover and for reduced-motion. On phones
 *  the container clips the sides to slivers. Best with 3–6 images. */
export function HeroShowcase({ images, alt }: { images: string[]; alt?: string }) {
  const imgs = images.slice(0, 6);
  const n = imgs.length;
  const [center, setCenter] = useState(0);
  const [paused, setPaused] = useState(false);
  // Remember each image's last on-screen offset so a card that wraps around the
  // loop snaps to its new side instead of streaking across the stage.
  const prevOff = useRef<Record<number, number>>({});

  useEffect(() => {
    if (n < 2 || paused) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setCenter((c) => (c + 1) % n), 2600);
    return () => clearInterval(t);
  }, [n, paused]);

  // Record current offsets after each render (used to detect wraps next time).
  useEffect(() => {
    const m: Record<number, number> = {};
    imgs.forEach((_, i) => { m[i] = shortestOffset(i - center, n); });
    prevOff.current = m;
  });

  if (!n) return null;

  const W = 360, H = 480, SPACING = 250;

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="group"
      aria-label="Product showcase"
    >
      {imgs.map((src, i) => {
        const off = shortestOffset(i - center, n);
        const prev = prevOff.current[i];
        const wrapped = prev !== undefined && Math.abs(off - prev) > 1; // jumped across the loop seam
        const isCenter = off === 0;
        const visible = Math.abs(off) <= 1;
        return (
          <div
            key={i}
            aria-hidden={!isCenter}
            onClick={() => { if (visible && !isCenter) setCenter(i); }}
            className="absolute inset-0 m-auto overflow-hidden rounded-2xl bg-stone-100 shadow-2xl ring-1 ring-black/10"
            style={{
              width: W,
              height: H,
              transform: `translateX(${off * SPACING}px) scale(${isCenter ? 1 : 0.72})`,
              opacity: isCenter ? 1 : visible ? 0.5 : 0,
              zIndex: isCenter ? 30 : visible ? 20 : 10,
              cursor: visible && !isCenter ? 'pointer' : 'default',
              pointerEvents: visible ? 'auto' : 'none',
              transition: wrapped ? 'opacity 300ms ease' : 'transform 700ms cubic-bezier(0.4,0,0.2,1), opacity 700ms ease',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={isCenter ? (alt ?? '') : ''} className="h-full w-full object-cover" draggable={false} />
            {/* dim overlay on the side cards so the centre pops */}
            {!isCenter && <div className="absolute inset-0 bg-black/10" />}
          </div>
        );
      })}
    </div>
  );
}

/** Signed distance from centre on a ring of n, taking the short way round. */
function shortestOffset(raw: number, n: number): number {
  let o = ((raw % n) + n) % n; // 0..n-1
  if (o > n / 2) o -= n;
  return o;
}
