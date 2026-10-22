import type { MetadataRoute } from 'next';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tideeup.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${APP_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${APP_URL}/quiz`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${APP_URL}/pricing`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${APP_URL}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${APP_URL}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
