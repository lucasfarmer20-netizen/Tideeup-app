import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tideeup.com';

export const metadata: Metadata = {
  // metadataBase makes every relative OG/canonical URL below resolve to the
  // production origin, so share cards work on Pinterest, iMessage, Slack, etc.
  metadataBase: new URL(APP_URL),
  title: {
    default: 'TideeUp — A smarter cleaning plan for your home',
    template: '%s | TideeUp',
  },
  description:
    'A personalized weekly cleaning plan for your home, in 2 minutes. Free. No login required.',
  keywords: ['cleaning schedule', 'household planner', 'chore list', 'family cleaning'],
  alternates: { canonical: '/' },
  openGraph: {
    siteName: 'TideeUp',
    title: 'TideeUp — A smarter cleaning plan for your home',
    description: 'A personalized weekly cleaning plan for your home, in 2 minutes.',
    type: 'website',
    url: '/',
    // Rendered by app/opengraph-image.tsx (1200×630).
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TideeUp — A smarter cleaning plan for your home',
    description: 'A personalized weekly cleaning plan for your home, in 2 minutes.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0D9488',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
