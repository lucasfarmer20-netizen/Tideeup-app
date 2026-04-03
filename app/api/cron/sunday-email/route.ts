import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/server.js';
import { generateWeekPlan } from '@/lib/engine/planner.js';
import { serializeWeekPlan } from '@/utils/serialize.js';
import type { PlannerInput, RotationState, HomeSize, TimePreference, Zone } from '@/lib/engine/types.js';
import type { SerializedWeekPlan } from '@/utils/serialize.js';
import type { SundayEmailResult } from '@/types/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNextMondayMidnightUTC(): Date {
  const now = new Date();
  const dow = now.getUTCDay(); // 0=Sun, 1=Mon …
  const daysUntilMonday = dow === 0 ? 1 : 8 - dow;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + daysUntilMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function getPrimaryZone(weekPlan: SerializedWeekPlan): string {
  const counts = new Map<string, number>();
  for (const day of weekPlan.days) {
    for (const t of day.tasks) {
      if (t.task.frequency !== 'daily') {
        counts.set(t.zone, (counts.get(t.zone) ?? 0) + 1);
      }
    }
  }
  if (counts.size === 0) return 'general';
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'general';
}

const ZONE_LABEL: Record<string, string> = {
  kitchen: 'Kitchen', bathroom: 'Bathroom', bedroom: 'Bedroom',
  living: 'Living Room', outdoor: 'Outdoor', laundry: 'Laundry', general: 'General',
};

function buildSundayEmailHtml({
  planUrl, primaryZone, mondayTasks, streak,
}: {
  planUrl: string;
  primaryZone: string;
  mondayTasks: { title: string; estimatedMinutes: number }[];
  streak: number;
}): string {
  const streakBadge = streak >= 2
    ? `<p style="font-size:13px;color:#0D9488;font-weight:700;margin:0 0 16px;">🔥 ${streak}-week streak — keep it going!</p>`
    : '';

  const taskRows = mondayTasks.slice(0, 4).map((t) =>
    `<li style="color:#334155;font-size:14px;margin:4px 0;">${t.title} <span style="color:#94a3b8;">(${t.estimatedMinutes}m)</span></li>`,
  ).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 16px;color:#1e293b;">
  <h1 style="color:#0D9488;font-size:22px;margin:0 0 4px;">Your week is planned 🏠</h1>
  <p style="color:#64748b;font-size:14px;margin:0 0 20px;">Here's what's coming up this week.</p>

  ${streakBadge}

  <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
    <p style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px;">This week's focus</p>
    <p style="color:#0f172a;font-size:18px;font-weight:700;margin:0;">${ZONE_LABEL[primaryZone] ?? primaryZone}</p>
  </div>

  <p style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;">Monday's tasks</p>
  <ul style="margin:0 0 24px;padding-left:20px;">
    ${taskRows}
  </ul>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:16px;">
    <tr>
      <td style="border-radius:8px;background:#0D9488;">
        <a href="${planUrl}" target="_blank"
           style="display:inline-block;padding:13px 26px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;font-family:system-ui,sans-serif;border-radius:8px;">
          View full plan &rarr;
        </a>
      </td>
    </tr>
  </table>

  <p style="color:#94a3b8;font-size:12px;margin:0 0 4px;">Button not showing? Copy this link:</p>
  <p style="font-size:12px;margin:0 0 32px;word-break:break-all;">
    <a href="${planUrl}" style="color:#0D9488;">${planUrl}</a>
  </p>

  <p style="color:#94a3b8;font-size:12px;margin:0;border-top:1px solid #e2e8f0;padding-top:16px;">
    You're receiving this as a TideeUp Pro subscriber.<br>
    <a href="${planUrl}" style="color:#0D9488;">Unsubscribe</a>
  </p>
</body>
</html>`.trim();
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  // Verify cron secret
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

  // Fetch all paid active users with their email and household
  const { data: paidUsers, error: usersError } = await supabase
    .from('users')
    .select('id, email')
    .eq('tier', 'paid')
    .eq('subscription_status', 'active');

  if (usersError || !paidUsers) {
    console.error('[sunday-email] Failed to fetch paid users:', usersError?.message);
    return NextResponse.json({ message: 'Failed to fetch users' }, { status: 500 });
  }

  const weekOf = getNextMondayMidnightUTC();

  for (const user of paidUsers) {
    try {
      // Get household config
      const { data: household } = await supabase
        .from('households')
        .select('home_size, household_count, pets, kids, time_preference, rotation_state')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!household) {
        console.log(`[sunday-email] Skipping ${user.email} — no household config`);
        result.skipped++;
        continue;
      }

      // Get streak (optional)
      const { data: streak } = await supabase
        .from('streaks')
        .select('current_streak')
        .eq('user_id', user.id)
        .maybeSingle();

      // Generate plan
      const plannerInput: PlannerInput = {
        homeSize: household.home_size as HomeSize,
        householdCount: household.household_count,
        pets: household.pets,
        kids: household.kids,
        timePreference: (household.time_preference === 'BATCH'
          ? 'BATCH'
          : Number(household.time_preference)) as TimePreference,
        weekOf,
        rotationState: (household.rotation_state as RotationState) ?? undefined,
      };

      const weekPlan = generateWeekPlan(plannerInput);
      const serialized = serializeWeekPlan(weekPlan);

      // Save plan
      const { data: savedPlan, error: planError } = await supabase
        .from('plans')
        .insert({
          user_id: user.id,
          home_size: household.home_size,
          household_count: household.household_count,
          pets: household.pets,
          kids: household.kids,
          time_preference: household.time_preference,
          week_of: serialized.weekOf.slice(0, 10),
          week_plan: serialized as unknown as import('@/lib/supabase/types.js').Json,
          is_claimed: true,
        })
        .select('id')
        .single();

      if (planError || !savedPlan) {
        throw new Error(planError?.message ?? 'Plan insert failed');
      }

      // Compute email content
      const planUrl = `${appUrl}/plan/${savedPlan.id}`;
      const primaryZone = getPrimaryZone(serialized);
      const mondayDay = serialized.days[0];
      const mondayTasks = mondayDay
        ? mondayDay.tasks.map((t) => ({
            title: t.task.title,
            estimatedMinutes: t.estimatedMinutes,
          }))
        : [];

      if (!resendKey) {
        console.warn(`[sunday-email] No RESEND_API_KEY — skipping email for ${user.email}`);
        result.skipped++;
        continue;
      }

      const resend = new Resend(resendKey);
      const { error: emailError } = await resend.emails.send({
        from: fromEmail,
        to: user.email,
        subject: 'Your TideeUp week is ready 🏠',
        html: buildSundayEmailHtml({
          planUrl,
          primaryZone,
          mondayTasks,
          streak: streak?.current_streak ?? 0,
        }),
      });

      if (emailError) {
        throw new Error(`Resend error: ${JSON.stringify(emailError)}`);
      }

      // Record email event
      await supabase.from('email_events').insert({
        user_id: user.id,
        event_type: 'sent',
        payload: { type: 'sunday_digest', plan_id: savedPlan.id },
      });

      console.log(`[sunday-email] Processed ${user.email}`);
      result.processed++;
    } catch (err) {
      console.error(`[sunday-email] Error processing ${user.email}:`, err);
      result.errors++;
      // Continue processing remaining users
    }
  }

  console.log('[sunday-email] Complete:', result);
  return NextResponse.json(result, { status: 200 });
}
