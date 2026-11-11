/**
 * Where to send someone after sign-in. Only same-site relative paths are
 * accepted, so a crafted link cannot bounce a signed-in user to another site.
 */
export function safeNext(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  return raw;
}
