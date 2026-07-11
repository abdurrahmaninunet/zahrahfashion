'use client';

import { useState } from 'react';

/** Amazon-style gallery: vertical thumbnail rail (hover to switch) + large
 *  main image with click-to-zoom. Thumbnails drop below the image on mobile. */
export function Gallery({ media }: { media: { url: string; alt: string; type: string }[] }) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const current = media[index];

  if (!media.length) {
    return <div className="flex h-[400px] items-center justify-center rounded-lg border border-stone-200 bg-stone-50 font-display text-6xl text-stone-200 sm:h-[460px] lg:h-[520px]">Z</div>;
  }

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
      {media.length > 1 && (
        <div className="flex gap-2 overflow-x-auto sm:w-14 sm:flex-col sm:overflow-visible">
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
        className={`relative h-[400px] w-full min-w-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-50 sm:h-[460px] sm:flex-1 lg:h-[520px] ${zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
        onClick={() => setZoomed(!zoomed)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.alt}
          fetchPriority={index === 0 ? 'high' : undefined}
          className={`h-full w-full object-contain transition-transform duration-200 ${zoomed ? 'scale-[1.8]' : ''}`}
        />
      </div>
    </div>
  );
}
