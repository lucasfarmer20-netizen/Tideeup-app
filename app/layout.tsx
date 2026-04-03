import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'TideeUp — A smarter cleaning plan for your home',
    template: '%s | TideeUp',
  },
  description:
    'A personalized weekly cleaning plan for your home, in 2 minutes. Free. No login required.',
  keywords: ['cleaning schedule', 'household planner', 'chore list', 'family cleaning'],
  openGraph: {
    title: 'TideeUp — A smarter cleaning plan for your home',
    description: 'A personalized weekly cleaning plan for your home, in 2 minutes.',
    type: 'website',
  },
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
