import type { Metadata, Viewport } from 'next';
import { Playfair_Display, Jost } from 'next/font/google';
import './globals.css';
import { serverApi } from '@/lib/api';
import { SITE_URL } from '@/lib/site';
import { Providers } from './providers';
import { AnnouncementBar, Footer, Header, StoreContext } from '@/components/shell';
import { ScrollToTop } from '@/components/scroll-to-top';

const DESCRIPTION = 'Premium lace, ankara, perfumes and gift packages. Pay with card, transfer or on delivery in Abuja.';

const display = Playfair_Display({ subsets: ['latin'], variable: '--font-display-var', display: 'swap' });
const sans = Jost({ subsets: ['latin'], variable: '--font-sans-var', display: 'swap' });

export const revalidate = 10; // keep the shared shell (announcement, nav) fresh

export async function generateMetadata(): Promise<Metadata> {
  let name = 'Zahra Fashion';
  try {
    const context = await serverApi<StoreContext>('/store/context');
    if (context.store.name) name = String(context.store.name);
  } catch { /* API offline during build */ }
  const defaultTitle = `${name} — Fabrics, Perfumes & Packages`;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: defaultTitle, template: `%s · ${name}` },
    description: DESCRIPTION,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      siteName: name,
      title: defaultTitle,
      description: DESCRIPTION,
      url: SITE_URL,
      locale: 'en_NG',
    },
    twitter: { card: 'summary_large_image', title: defaultTitle, description: DESCRIPTION },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: '#8a6d1f',
  width: 'device-width',
  initialScale: 1,
};

const FALLBACK_CONTEXT: StoreContext = {
  store: { name: 'Zahra Fashion', phone: '', whatsapp: '', whatsappMessage: '', email: '', address: '', social: {} },
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

  const storeName = context.store.name || 'Zahra Fashion';
  const social = context.store.social ?? {};
  const sameAs = [
    social.instagram && `https://instagram.com/${social.instagram.replace(/^@/, '')}`,
    social.facebook && (social.facebook.startsWith('http') ? social.facebook : `https://facebook.com/${social.facebook.replace(/^@/, '')}`),
    social.tiktok && `https://tiktok.com/@${social.tiktok.replace(/^@/, '')}`,
  ].filter(Boolean);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: storeName,
      url: SITE_URL,
      ...(context.store.email ? { email: context.store.email } : {}),
      ...(context.store.phone ? { telephone: context.store.phone } : {}),
      ...(sameAs.length ? { sameAs } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: storeName,
      url: SITE_URL,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ];

  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap"
          rel="stylesheet"
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
