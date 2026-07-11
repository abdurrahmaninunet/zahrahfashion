import type { Metadata, Viewport } from 'next';
import { Playfair_Display, Jost } from 'next/font/google';
import './globals.css';
import { serverApi } from '@/lib/api';
import { Providers } from './providers';
import { AnnouncementBar, Footer, Header, StoreContext } from '@/components/shell';
import { ScrollToTop } from '@/components/scroll-to-top';

const display = Playfair_Display({ subsets: ['latin'], variable: '--font-display-var', display: 'swap' });
const sans = Jost({ subsets: ['latin'], variable: '--font-sans-var', display: 'swap' });

export const revalidate = 10; // keep the shared shell (announcement, nav) fresh

export async function generateMetadata(): Promise<Metadata> {
  let name = 'Zahrah Fashion';
  try {
    const context = await serverApi<StoreContext>('/store/context');
    if (context.store.name) name = String(context.store.name);
  } catch { /* API offline during build */ }
  return {
    title: { default: `${name} — Fabrics, Perfumes & Packages`, template: `%s · ${name}` },
    description: 'Premium lace, ankara, perfumes and gift packages. Pay with card, transfer or on delivery across Lagos.',
    manifest: '/manifest.json',
  };
}

export const viewport: Viewport = {
  themeColor: '#8a6d1f',
  width: 'device-width',
  initialScale: 1,
};

const FALLBACK_CONTEXT: StoreContext = {
  store: { name: 'Zahrah Fashion', phone: '', whatsapp: '', whatsappMessage: '', email: '', address: '', social: {} },
  mimEnabled: true,
  podAvailable: false,
  announcement: null,
  categories: [],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let context = FALLBACK_CONTEXT;
  try {
    context = await serverApi<StoreContext>('/store/context', 10);
  } catch { /* stale-while-error: shell renders with fallback (Business Rule 6) */ }

  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <ScrollToTop />
          <AnnouncementBar announcement={context.announcement} />
          <Header context={context} />
          <main className="min-h-[70vh]">{children}</main>
          <Footer context={context} />
        </Providers>
      </body>
    </html>
  );
}
