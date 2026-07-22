import type { Metadata } from 'next';
import { Playfair_Display, Jost } from 'next/font/google';
import './globals.css';

const display = Playfair_Display({ subsets: ['latin'], variable: '--font-display-var', display: 'swap' });
const sans = Jost({ subsets: ['latin'], variable: '--font-sans-var', display: 'swap' });

export const metadata: Metadata = {
  title: 'Zahrah Fashion Hub — Partner Portal',
  description: 'Wholesale portal for Zahrah Fashion Hub reseller partners.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
      <body>{children}</body>
    </html>
  );
}
