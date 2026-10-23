import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces, Poppins } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Soft serif display face — big hero / editorial moments.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

// Friendly geometric sans — section headings & UI labels.
const poppins = Poppins({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
  weight: ['500', '600', '700'],
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
    'A personalized weekly cleaning plan for your home, in 2 minutes. Free. No password required.',
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
  themeColor: '#F4EEE1',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${poppins.variable} font-sans`}>
      <body>{children}</body>
    </html>
  );
}
