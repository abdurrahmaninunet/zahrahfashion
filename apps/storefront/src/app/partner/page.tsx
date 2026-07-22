import type { Metadata } from 'next';
import { ArrowRight, BadgeCheck, PackageCheck, Percent, Truck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Become a Zahrah Fashion Hub Partner',
  description: 'Resell premium lace, fabrics and perfumes with wholesale pricing. Apply to become a Zahrah Fashion Hub partner.',
  alternates: { canonical: '/partner' },
};

// Partner portal (sign-in + application). Subdomain to be configured.
const PARTNER_URL = 'https://partner.zahrahfashion.com';

const BENEFITS = [
  { icon: Percent, title: 'Wholesale pricing', text: 'Partner rates that leave you a healthy margin on every sale.' },
  { icon: BadgeCheck, title: 'Premium quality', text: 'The same trusted lace, Atampa, Swiss voile and perfumes we’re known for.' },
  { icon: PackageCheck, title: 'We handle sourcing', text: 'You focus on selling — we keep the stock coming.' },
  { icon: Truck, title: 'Nationwide delivery', text: 'Reliable dispatch to you or straight to your customers across Nigeria.' },
];

export default function PartnerPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#f3e8c8] via-[#faf8f5] to-[#faf5e6]">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center lg:py-24">
          <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6d1f]">
            Reseller Network
          </span>
          <h1 className="font-display mx-auto mt-4 max-w-3xl text-4xl font-bold leading-tight text-stone-900 md:text-5xl">
            Become a Zahrah Fashion Hub Partner
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-stone-600 md:text-lg">
            Resell premium lace, fabrics and perfumes to your own customers — with wholesale pricing, trusted quality
            and our team behind you.
          </p>
          <a
            href={`${PARTNER_URL}/apply`}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-stone-950 px-8 py-4 text-base font-semibold text-white shadow-lg transition-colors hover:bg-stone-800"
          >
            Apply to become a Partner <ArrowRight size={18} />
          </a>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid gap-5 sm:grid-cols-2">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4 rounded-2xl border border-stone-200 bg-white p-6 transition-shadow hover:shadow-sm">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#faf5e6] text-[#8a6d1f]">
                <Icon size={22} />
              </span>
              <div>
                <p className="text-lg font-semibold text-stone-900">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-stone-500">{text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Closing CTA */}
        <div className="mt-14 rounded-2xl bg-stone-950 px-6 py-12 text-center">
          <h2 className="font-display text-2xl font-bold text-white md:text-3xl">Ready to grow your business?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-stone-300 md:text-base">
            Apply in minutes. Once you’re approved, sign in to your partner portal to browse wholesale stock and place orders.
          </p>
          <a
            href={`${PARTNER_URL}/apply`}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#c9a227] px-8 py-4 text-base font-semibold text-stone-950 transition-colors hover:bg-[#d8b43a]"
          >
            Apply to become a Partner <ArrowRight size={18} />
          </a>
          <p className="mt-4 text-xs text-stone-400">
            Already a partner? <a href={PARTNER_URL} className="font-medium text-white underline underline-offset-2">Sign in</a>
          </p>
        </div>
      </section>
    </div>
  );
}
