'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { whatsappLink } from '@/lib/format';

interface Slide {
  // image/link may be a plain string (URL) or an object — tolerate both.
  image?: string | { url?: string; alt?: string };
  headline?: string;
  subtext?: string;
  ctaLabel?: string;
  link?: string | { url?: string };
}

const urlOf = (v?: string | { url?: string }) => (typeof v === 'string' ? v : v?.url);

const SLIDE_BACKGROUNDS = ['bg-[#f5f1de]', 'bg-[#ece9f4]', 'bg-[#e8f1ea]'];

/** Hero banner (§3.2): full-width pale band — headline + call-to-action on the
 *  left, imagery on the right, side arrows and bottom dots. Autoplay 6s. */
export function HeroSlider({ slides, priority, whatsapp }: { slides: Slide[]; priority?: boolean; whatsapp?: string }) {
  const wa = whatsapp ? whatsappLink(whatsapp, "Hi! I'd like to ask about your collections 👋") : null;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(timer);
  }, [paused, slides.length]);

  if (!slides.length) return null;
  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + slides.length) % slides.length);

  return (
    <section
      className={`relative transition-colors duration-500 ${SLIDE_BACKGROUNDS[index % SLIDE_BACKGROUNDS.length]}`}
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; setPaused(true); }}
      onTouchEnd={(e) => {
        if (touchStart.current == null) return;
        const dx = e.changedTouches[0].clientX - touchStart.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchStart.current = null;
      }}
    >
      <div className="relative mx-auto h-[420px] max-w-[1905px] md:h-[400px]">
        {slides.map((slide, i) => (
          <div
            key={i}
            aria-hidden={i !== index}
            className={`absolute inset-0 grid grid-cols-1 content-center gap-4 px-4 pb-10 pt-6 transition-opacity duration-500 md:grid-cols-2 md:items-center md:gap-10 md:py-0 lg:px-[8rem] ${i === index ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          >
            <div className="max-w-xl">
              {slide.headline && (
                <h2 className="max-w-lg font-display text-3xl font-bold leading-tight text-stone-900 md:text-5xl">{slide.headline}</h2>
              )}
              {slide.subtext && <p className="mt-3 text-stone-600 md:text-lg">{slide.subtext}</p>}
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                {slide.ctaLabel && (
                  <Link
                    href={urlOf(slide.link) || '/'}
                    className="inline-block whitespace-nowrap rounded-sm bg-stone-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-700"
                  >
                    {slide.ctaLabel}
                  </Link>
                )}
                {/* Static quick-actions, shown on every slide */}
                <Link
                  href="/shops"
                  className="inline-block whitespace-nowrap rounded-sm border border-stone-400 bg-white/70 px-5 py-3 text-sm font-semibold text-stone-900 transition-colors hover:border-stone-900 hover:bg-white"
                >
                  Visit Our Stores
                </Link>
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-sm bg-[#25d366] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#20bd5a]"
                  >
                    <MessageCircle size={16} /> Chat on WhatsApp
                  </a>
                )}
              </div>
            </div>
            <div className="relative hidden h-[300px] overflow-hidden rounded-xl md:block">
              {urlOf(slide.image) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urlOf(slide.image)!}
                  alt={(typeof slide.image === 'object' ? slide.image.alt : undefined) ?? slide.headline ?? ''}
                  loading={i === 0 && priority ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 && priority ? 'high' : undefined}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#c9a227] via-[#8a6d1f] to-[#3d3010]" />
              )}
            </div>
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <button
            aria-label="Previous slide"
            onClick={() => go(-1)}
            className="absolute left-0 top-1/2 hidden h-16 w-9 -translate-y-1/2 items-center justify-center bg-stone-500/25 text-stone-700 transition-colors hover:bg-stone-500/45 md:flex cursor-pointer"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            aria-label="Next slide"
            onClick={() => go(1)}
            className="absolute right-0 top-1/2 hidden h-16 w-9 -translate-y-1/2 items-center justify-center bg-stone-500/25 text-stone-700 transition-colors hover:bg-stone-500/45 md:flex cursor-pointer"
          >
            <ChevronRight size={22} />
          </button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${i === index ? 'w-6 bg-stone-800' : 'w-2.5 bg-stone-400/60'}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
