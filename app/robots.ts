import type { MetadataRoute } from 'next';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tideeup.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Per-user and API surfaces have no business being indexed.
      disallow: ['/api/', '/auth/', '/dashboard', '/history', '/settings', '/plan/', '/print/'],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
