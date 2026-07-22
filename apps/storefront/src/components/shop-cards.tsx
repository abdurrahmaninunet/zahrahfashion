import { Clock, Image as ImageIcon, MapPin, MessageCircle, Navigation, Phone } from 'lucide-react';
import { serverApi } from '@/lib/api';
import { whatsappLink } from '@/lib/format';

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

/** Shop-location cards — the "Visit our stores" design. Pulled live from the
 *  admin Store-locations manager. Reused on the Shops page and policy pages. */
export async function ShopCards({ empty }: { empty?: React.ReactNode }) {
  let locations: ShopLocation[] = [];
  try {
    locations = await serverApi<ShopLocation[]>('/store-locations', 300);
  } catch {
    /* no locations configured yet */
  }

  if (!locations.length) return <>{empty ?? null}</>;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {locations.map((loc) => {
        const hours = loc.opensAt || loc.closesAt
          ? `${loc.opensAt ?? '—'}${loc.opensAt && loc.closesAt ? ' – ' : ''}${loc.closesAt ?? ''}`
          : null;
        return (
          <div key={loc.id} className="overflow-hidden rounded-2xl border border-stone-200 transition-shadow hover:shadow-md">
            {/* Interior photograph */}
            <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-stone-200 via-stone-100 to-[#f3e8c8]">
              <div className="flex flex-col items-center text-stone-400">
                <ImageIcon size={44} strokeWidth={1.2} />
                <span className="mt-2 text-xs font-medium uppercase tracking-[0.14em]">{loc.name} interior</span>
              </div>
            </div>

            <div className="space-y-6 p-6 md:p-8">
              <h3 className="font-display text-2xl font-bold not-prose">{loc.name}</h3>

              {loc.address && (
                <div className="flex gap-4">
                  <MapPin size={20} className="mt-0.5 shrink-0 text-[#8a6d1f]" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">Address</p>
                    <p className="mt-1 text-sm text-stone-700">{loc.address}</p>
                  </div>
                </div>
              )}

              {hours && (
                <div className="flex gap-4">
                  <Clock size={20} className="mt-0.5 shrink-0 text-[#8a6d1f]" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">Opening Hours</p>
                    <p className="mt-1 text-sm text-stone-700">{hours}</p>
                  </div>
                </div>
              )}

              {(loc.phone || loc.email) && (
                <div className="flex gap-4">
                  <Phone size={20} className="mt-0.5 shrink-0 text-[#8a6d1f]" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">Customer Service</p>
                    {loc.phone && (
                      <a href={`tel:${loc.phone.replace(/\s+/g, '')}`} className="mt-1 block text-sm text-stone-700 hover:text-stone-900 hover:underline">{loc.phone}</a>
                    )}
                    {loc.email && (
                      <a href={`mailto:${loc.email}`} className="block text-sm text-stone-700 hover:text-stone-900 hover:underline">{loc.email}</a>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-1">
                {loc.address && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(loc.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md bg-stone-900 px-5 py-2.5 text-sm font-semibold !text-white no-underline transition-colors hover:bg-stone-700"
                  >
                    <Navigation size={16} /> Get Directions
                  </a>
                )}
                {loc.whatsapp && (
                  <a
                    href={whatsappLink(loc.whatsapp, `Hi ${loc.name}! I have a question.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md bg-[#25d366] px-5 py-2.5 text-sm font-semibold !text-white no-underline transition-colors hover:bg-[#20bd5a]"
                  >
                    <MessageCircle size={16} /> Chat on WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
