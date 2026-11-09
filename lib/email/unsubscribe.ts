import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([0-9a-f]{64})$/i;
function signature(id: string, key: string) {
  if (!key) throw new Error('Unsubscribe signing unavailable');
  return createHmac('sha256', key).update(`tideeup:weekly-unsubscribe:v1:${id}`).digest('hex');
}
// Reuse the existing server-only cron key, with a separate signing purpose.
// Links remain usable until that key rotates; no new credential or schema.
export function unsubscribeUrl(origin: string, id: string, key: string): string {
  const token = `${id}.${signature(id, key)}`;
  if (!TOKEN.test(token)) throw new Error('Invalid recipient');
  return `${new URL(origin).origin}/unsubscribe/${token}`;
}
export function unsubscribeUser(token: string, key: string | undefined): string | null {
  const match = TOKEN.exec(token);
  if (!match?.[1] || !match[2] || !key) return null;
  return timingSafeEqual(Buffer.from(match[2], 'hex'), Buffer.from(signature(match[1], key), 'hex')) ? match[1] : null;
}
