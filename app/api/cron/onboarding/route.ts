import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/server.js';
import type { SundayEmailResult } from '@/types/api';

// ─── Onboarding sequence (LTV task 5) ─────────────────────────────────────────
// Three emails over the first week after upgrade. Paced off users.paid_since and
// made idempotent via email_events (payload {type:'onboarding', step}).

interface OnboardingStep {
  step: 1 | 2 | 3;
  /** Earliest whole-day offset from paid_since at which this email may send. */
  dueAfterDays: number;
  subject: string;
}

const STEPS: OnboardingStep[] = [
  { step: 1, dueAfterDays: 0, subject: 'Welcome to TideeUp Pro 🎉' },
  { step: 2, dueAfterDays: 2, subject: 'Make TideeUp yours 🛠️' },
  { step: 3, dueAfterDays: 4, subject: 'Your Sunday digest is on its way 📬' },
];

// Stop considering a user for onboarding after this many days, so a first deploy
// (or a long-dormant paid_since) never back-fills the whole sequence at once.
const WINDOW_DAYS = 9;

function ctaButton(url: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 24px;">
    <tr><td style="border-radius:8px;background:#0D9488;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:13px 26px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;font-family:system-ui,sans-serif;border-radius:8px;">${label}</a>
    </td></tr></table>`;
}

function shell(bodyInner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 16px;color:#1e293b;">
${bodyInner}
<p style="color:#94a3b8;font-size:12px;margin:24px 0 0;border-top:1px solid #e2e8f0;padding-top:16px;">You're receiving this as a new TideeUp Pro subscriber.</p>
</body></html>`;
}

function buildOnboardingEmail(step: 1 | 2 | 3, appUrl: string): string {
  if (step === 1) {
    return shell(`
      <h1 style="color:#0D9488;font-size:22px;margin:0 0 8px;">Welcome to TideeUp Pro 🎉</h1>
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">You just unlocked rotation memory, member assignment, history, custom tasks, and your Sunday digest. Here's the fastest way to feel the difference:</p>
      <p style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 4px;">Add the people you live with</p>
      <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 4px;">Assign tasks to each person so the work is shared, not assumed. It takes about a minute.</p>
      ${ctaButton(`${appUrl}/settings`, 'Set up your household →')}`);
  }
  if (step === 2) {
    return shell(`
      <h1 style="color:#0D9488;font-size:22px;margin:0 0 8px;">Make TideeUp yours 🛠️</h1>
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">Two settings make every future plan fit your real life:</p>
      <p style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 4px;">1. Add a custom task</p>
      <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 12px;">Got something the library doesn't cover — a pool, a wood stove, a fish tank? Add it and the engine schedules it for you.</p>
      <p style="color:#0f172a;font-size:16px;font-weight:700;margin:0 0 4px;">2. Set your no-go days</p>
      <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 4px;">Block the days you never want chores on. TideeUp plans around them.</p>
      ${ctaButton(`${appUrl}/settings`, 'Customize your plan →')}`);
  }
  return shell(`
    <h1 style="color:#0D9488;font-size:22px;margin:0 0 8px;">Your Sunday digest is on its way 📬</h1>
    <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">Every Sunday we'll email you a fresh, personalized week — built from your rotation memory so the same chores never pile up on the same days.</p>
    <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 4px;">It'll show your streak, last week's completion rate, and what's coming back around. Check your dashboard any time to get a head start.</p>
    ${ctaButton(`${appUrl}/dashboard`, 'Open your dashboard →')}`);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: 'Unauthorised' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'plans@tideeup.com';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tideeup.com';

  const result: SundayEmailResult = { processed: 0, skipped: 0, errors: 0 };

  const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Paid, active subscribers who upgraded within the onboarding window.
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, paid_since')
    .eq('tier', 'paid')
    .eq('subscription_status', 'active')
    .not('paid_since', 'is', null)
    .gte('paid_since', windowStart);

  if (error || !users) {
    console.error('[onboarding] Failed to fetch users:', error?.message);
    return NextResponse.json({ message: 'Failed to fetch users' }, { status: 500 });
  }

  const now = Date.now();

  for (const user of users) {
    try {
      const paidSince = new Date((user as { paid_since: string }).paid_since).getTime();
      const daysSince = Math.floor((now - paidSince) / (24 * 60 * 60 * 1000));

      // Which onboarding events has this user already received?
      const { data: events } = await supabase
        .from('email_events')
        .select('payload')
        .eq('user_id', user.id);
      const sentSteps = new Set<number>();
      for (const e of events ?? []) {
        const p = (e as { payload?: { type?: string; step?: number } }).payload;
        if (p?.type === 'onboarding' && typeof p.step === 'number') sentSteps.add(p.step);
      }

      // Send every step that is now due and not yet sent (usually just one).
      const due = STEPS.filter((s) => daysSince >= s.dueAfterDays && !sentSteps.has(s.step));
      if (due.length === 0) {
        result.skipped++;
        continue;
      }

      if (!resendKey) {
        console.warn(`[onboarding] No RESEND_API_KEY — skipping ${user.email}`);
        result.skipped++;
        continue;
      }

      const resend = new Resend(resendKey);
      for (const s of due) {
        const { error: emailError } = await resend.emails.send({
          from: fromEmail,
          to: user.email,
          subject: s.subject,
          html: buildOnboardingEmail(s.step, appUrl),
        });
        if (emailError) {
          throw new Error(`Resend error: ${JSON.stringify(emailError)}`);
        }
        await supabase.from('email_events').insert({
          user_id: user.id,
          event_type: 'sent',
          payload: { type: 'onboarding', step: s.step },
        });
        result.processed++;
      }
    } catch (err) {
      console.error(`[onboarding] Error processing ${user.email}:`, err);
      result.errors++;
    }
  }

  console.log('[onboarding] Complete:', result);
  return NextResponse.json(result, { status: 200 });
}
