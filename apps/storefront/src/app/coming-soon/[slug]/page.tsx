import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock } from 'lucide-react';

export const revalidate = 3600;

function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const title = titleFromSlug(slug);
  return { title: `${title} — Coming soon`, description: `Our ${title} collection is coming soon to Zahrah Fashion.` };
}

export default async function ComingSoonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = titleFromSlug(slug);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#faf5e6] text-[#8a6d1f]">
        <Clock size={30} strokeWidth={1.6} />
      </span>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[#8a6d1f]">Coming soon</p>
      <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">{title}</h1>
      <p className="mt-3 leading-relaxed text-stone-500">
        We&apos;re adding the finishing touches to our {title} collection. Check back shortly — it&apos;ll be worth the wait.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="rounded-full bg-stone-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-700">
          Back to home
        </Link>
        <Link href="/c/laces" className="rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-800 transition-colors hover:border-stone-900">
          Browse other collections
        </Link>
      </div>
    </div>
  );
}
