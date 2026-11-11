'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Tells the server which time zone the viewer is in, so "today" on the
 * dashboard is their day. Stored as a plain cookie (a zone name is not
 * personal data beyond what the browser already reveals). Refreshes once when
 * the value is new, so the first visit corrects itself.
 */
export function TimezoneCookie() {
  const router = useRouter();
  useEffect(() => {
    let zone: string;
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return; }
    if (!zone) return;
    const current = document.cookie.split('; ').find((c) => c.startsWith('tz='))?.slice(3);
    if (current && decodeURIComponent(current) === zone) return;
    document.cookie = `tz=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);
  return null;
}
