import type { Metadata } from 'next';
import { Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { serverApi } from '@/lib/api';
import { whatsappLink } from '@/lib/format';

export const revalidate = 300;
export const metadata: Metadata = {
  title: 'Our shops',
  description: 'Visit Zahrah Fashion in person — store locations, opening hours and contact details.',
};

interface ShopLocation {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  address: string | null;
  opensAt: string | null;
  closesAt: string | null;
}

export default async function ShopsPage() {
  // Pulled live from the admin "Store locations" manager (shop identity).
  let locations: ShopLocation[] = [];
  try {
    locations = await serverApi<ShopLocation[]>('/store-locations', 300);
  } catch {
    /* no locations configured yet */
  }

  return (
    <div className="mx-auto max-w-[1905px] px-2.5 py-12 lg:px-[8rem]">
      <h1 className="font-display text-3xl font-bold md:text-4xl">Our shops</h1>
      <p className="mt-2 text-stone-500">Come see and feel the fabrics in person — here&apos;s where to find us.</p>

      {locations.length ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {locations.map((loc) => (
            <div key={loc.id} className="flex flex-col rounded-2xl border border-stone-200 p-5 transition-shadow hover:shadow-md">
              <h2 className="font-display text-lg font-bold">{loc.name}</h2>
              <dl className="mt-3 space-y-2 text-sm text-stone-600">
                {loc.address && (
                  <div className="flex gap-2.5">
                    <MapPin size={16} className="mt-0.5 shrink-0 text-[#8a6d1f]" />
                    <span>{loc.address}</span>
                  </div>
                )}
                {(loc.opensAt || loc.closesAt) && (
                  <div className="flex gap-2.5">
                    <Clock size={16} className="mt-0.5 shrink-0 text-[#8a6d1f]" />
                    <span>
                      {loc.opensAt ?? '—'}
                      {loc.opensAt && loc.closesAt ? ' – ' : ''}
                      {loc.closesAt ?? ''}
                    </span>
                  </div>
                )}
                {loc.phone && (
                  <div className="flex gap-2.5">
                    <Phone size={16} className="mt-0.5 shrink-0 text-[#8a6d1f]" />
                    <a href={`tel:${loc.phone.replace(/\s+/g, '')}`} className="hover:text-stone-900 hover:underline">{loc.phone}</a>
                  </div>
                )}
                {loc.email && (
                  <div className="flex gap-2.5">
                    <Mail size={16} className="mt-0.5 shrink-0 text-[#8a6d1f]" />
                    <a href={`mailto:${loc.email}`} className="hover:text-stone-900 hover:underline">{loc.email}</a>
                  </div>
                )}
              </dl>
              {loc.whatsapp && (
                <a
                  href={whatsappLink(loc.whatsapp, `Hi ${loc.name}! I have a question.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex w-fit items-center gap-2 rounded-full border border-[#25d366]/40 bg-[#25d366]/10 px-4 py-2 text-sm font-medium text-[#128c4b] hover:bg-[#25d366]/20"
                >
                  <MessageCircle size={15} /> Chat on WhatsApp
                </a>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-stone-200 bg-stone-50 p-8 text-center">
          <p className="text-sm text-stone-600">Our shop locations will appear here soon.</p>
          <p className="mt-1 text-sm text-stone-400">In the meantime, tap the WhatsApp button for directions and opening hours.</p>
        </div>
      )}
    </div>
  );
}
