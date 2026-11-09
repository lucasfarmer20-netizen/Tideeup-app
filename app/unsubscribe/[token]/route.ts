import { createAdminClient } from '@/lib/supabase/server';
import { unsubscribeUser } from '@/lib/email/unsubscribe';

type Context = { params: Promise<{ token: string }> };
function page(message: string, status = 200) {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TideeUp email preferences</title><body><h1>Weekly email preferences</h1>${message}</body></html>`, {
    status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex', 'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'" },
  });
}
const invalid = () => page('<p>This unsubscribe link is invalid or has expired. Please use a more recent weekly email.</p>', 400);

// Email scanners may open links. Only an explicit form submission changes preferences.
export async function GET(_request: Request, context: Context) {
  const { token } = await context.params;
  if (!unsubscribeUser(token, process.env.CRON_SECRET)) return invalid();
  return page('<p>Stop TideeUp weekly emails? Your subscription and saved plans will not change.</p><form method="post"><button type="submit">Unsubscribe from weekly emails</button></form>');
}
export async function POST(_request: Request, context: Context) {
  const { token } = await context.params;
  const id = unsubscribeUser(token, process.env.CRON_SECRET);
  if (!id) return invalid();
  try {
    const { data, error } = await createAdminClient().from('users')
      .update({ email_status: 'unsubscribed' }).eq('id', id).select('id').maybeSingle();
    if (error || !data) return page('<p>Your preference could not be saved. Please try again.</p>', 503);
    return page('<p>You are unsubscribed from weekly emails. Your subscription and saved plans are unchanged.</p>');
  } catch {
    return page('<p>Your preference could not be saved. Please try again.</p>', 503);
  }
}
