'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Amazon-style gallery: vertical thumbnail rail (hover to switch) + large main
 *  image with click-to-zoom, prev/next arrows, and a 3s auto-advance (pauses on
 *  hover, while zoomed, and for reduced-motion). Thumbnails drop below on mobile. */
export function Gallery({ media }: { media: { url: string; alt: string; type: string }[] }) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [paused, setPaused] = useState(false);
  const n = media.length;
  const current = media[index];

  // Auto-advance every 3s unless paused / zoomed / reduced-motion.
  useEffect(() => {
    if (n < 2 || paused || zoomed) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % n), 3000);
    return () => clearInterval(t);
  }, [n, paused, zoomed]);

  if (!media.length) {
    return <div className="flex h-[400px] items-center justify-center rounded-lg border border-stone-200 bg-stone-50 font-display text-6xl text-stone-200 sm:h-[460px] lg:h-[520px]">Z</div>;
  }

  const go = (dir: 1 | -1) => { setIndex((i) => (i + dir + n) % n); setZoomed(false); };

  return (
    <div className="flex min-w-0 flex-col-reverse gap-3 sm:flex-row sm:gap-4">
      {n > 1 && (
        <div className="flex flex-wrap gap-2 sm:w-14 sm:flex-col sm:flex-nowrap">
          {media.map((m, i) => (
            <button
              key={i}
              aria-label={`Image ${i + 1}`}
              onMouseEnter={() => { setIndex(i); setZoomed(false); }}
              onClick={() => { setIndex(i); setZoomed(false); }}
              className={`media-box aspect-square w-14 shrink-0 cursor-pointer rounded border transition-colors sm:w-full ${
                i === index ? 'border-[#8a6d1f] ring-1 ring-[#8a6d1f]' : 'border-stone-200 hover:border-stone-400'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <div
        className={`group relative h-[400px] w-full min-w-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-50 sm:h-[460px] sm:flex-1 lg:h-[520px] ${zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
        onClick={() => setZoomed(!zoomed)}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.alt}
          fetchPriority={index === 0 ? 'high' : undefined}
          className={`h-full w-full object-contain transition-transform duration-200 ${zoomed ? 'scale-[1.8]' : ''}`}
        />

        {n > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={(e) => { e.stopPropagation(); go(-1); }}
              className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-stone-800 shadow ring-1 ring-black/5 transition-colors hover:bg-white"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={(e) => { e.stopPropagation(); go(1); }}
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-stone-800 shadow ring-1 ring-black/5 transition-colors hover:bg-white"
            >
              <ChevronRight size={20} />
            </button>
            {/* dots */}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {media.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-[#8a6d1f]' : 'w-1.5 bg-stone-300'}`} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
