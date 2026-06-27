import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/server.js';
import { generateWeekPlan } from '@/lib/engine/planner.js';
import { serializeWeekPlan } from '@/utils/serialize.js';
import type { PlannerInput, RotationState, HomeSize, TimePreference, HomeType, PetType, FlooringType, Zone } from '@/lib/engine/types.js';
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
  planUrl, primaryZone, mondayTasks, streak, lastWeekPct, rotationInsights, members,
}: {
  planUrl: string;
  primaryZone: string;
  mondayTasks: { title: string; estimatedMinutes: number }[];
  streak: number;
  /** Last week's completion rate (0–100), or null if there was no prior plan. */
  lastWeekPct: number | null;
  /** Tasks resurfacing this week after a gap (rotation memory made visible). */
  rotationInsights: { title: string; weeksAgo: number }[];
  /** Household member names, for the assignment nudge. */
  members: string[];
}): string {
  const streakBadge = streak >= 2
    ? `<p style="font-size:13px;color:#0D9488;font-weight:700;margin:0 0 16px;">🔥 ${streak}-week streak — keep it going!</p>`
    : '';

  // Last week's completion rate — the personal progress hook.
  const lastWeekBlock = lastWeekPct !== null
    ? `<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:12px 18px;margin-bottom:20px;">
        <p style="color:#047857;font-size:14px;margin:0;font-weight:600;">
          ${lastWeekPct >= 80 ? '🎉 ' : ''}Last week you completed ${lastWeekPct}% of your tasks${lastWeekPct >= 80 ? ' — outstanding!' : lastWeekPct >= 50 ? ' — solid work.' : '. A fresh week, a fresh start.'}
        </p>
      </div>`
    : '';

  // Rotation insights — surface what's coming back around this week.
  const rotationBlock = rotationInsights.length > 0
    ? `<p style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px;">Coming back around this week</p>
      <ul style="margin:0 0 24px;padding-left:20px;">
        ${rotationInsights.map((r) =>
          `<li style="color:#334155;font-size:14px;margin:4px 0;">${r.title} <span style="color:#94a3b8;">(last done ${r.weeksAgo} weeks ago)</span></li>`,
        ).join('')}
      </ul>`
    : '';

  // Member assignment nudge for multi-person households.
  const membersBlock = members.length > 1
    ? `<div style="background:#f8fafc;border-radius:10px;padding:12px 18px;margin-bottom:20px;">
        <p style="color:#64748b;font-size:13px;margin:0;">
          Split the load with ${members.slice(0, -1).join(', ')} and ${members[members.length - 1]} —
          <a href="${planUrl}" style="color:#0D9488;">assign this week's tasks &rarr;</a>
        </p>
      </div>`
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

  ${lastWeekBlock}

  <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
    <p style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px;">This week's focus</p>
    <p style="color:#0f172a;font-size:18px;font-weight:700;margin:0;">${ZONE_LABEL[primaryZone] ?? primaryZone}</p>
  </div>

  ${membersBlock}

  ${rotationBlock}

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
        .select('home_size, home_type, household_count, pets, pet_types, kids, time_preference, flooring_types, rotation_state, members')
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

      // Map timePreference: accept new labels or legacy numeric values
      const rawPref = household.time_preference as unknown;
      const timePreference: TimePreference =
        rawPref === 'quick' || rawPref === 'steady' || rawPref === 'thorough' || rawPref === 'batch' ? rawPref
        : rawPref === 'BATCH' || rawPref === 30 || String(rawPref) === '30' ? 'thorough'
        : rawPref === 10 || String(rawPref) === '10' ? 'quick'
        : 'steady';

      // Derive petTypes from new column or fall back to legacy boolean
      const storedPetTypes = Array.isArray(household.pet_types) ? household.pet_types as PetType[] : null;
      const petTypes: PetType[] = storedPetTypes ?? (household.pets ? ['cat-1-2'] : []);

      // Generate plan
      const plannerInput: PlannerInput = {
        homeSize: household.home_size as HomeSize,
        homeType: (household.home_type as HomeType | undefined) ?? 'single-family',
        householdCount: household.household_count as number,
        petTypes,
        kids: household.kids as boolean,
        flooringTypes: Array.isArray(household.flooring_types)
          ? household.flooring_types as FlooringType[]
          : ['mixed'],
        timePreference,
        weekOf,
        rotationState: (household.rotation_state as RotationState) ?? undefined,
      };

      const weekPlan = generateWeekPlan(plannerInput);
      const serialized = serializeWeekPlan(weekPlan);

      // ── Last week's completion rate (LTV task 3) ──────────────────────────
      // The most recent existing plan is last week's (the new one isn't saved yet).
      let lastWeekPct: number | null = null;
      const { data: prevPlan } = await supabase
        .from('plans')
        .select('id, week_plan')
        .eq('user_id', user.id)
        .order('week_of', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prevPlan) {
        const prevWeekPlan = (prevPlan as { week_plan: SerializedWeekPlan }).week_plan;
        const prevTotal = prevWeekPlan.days.reduce((sum, d) => sum + d.tasks.length, 0);
        const { count } = await supabase
          .from('task_completions')
          .select('*', { count: 'exact', head: true })
          .eq('plan_id', (prevPlan as { id: string }).id);
        if (prevTotal > 0) lastWeekPct = Math.round(((count ?? 0) / prevTotal) * 100);
      }

      // ── Rotation insights (LTV task 3) ────────────────────────────────────
      // Featured tasks resurfacing this week after a 3+ week gap.
      const lastDone = plannerInput.rotationState?.lastDone ?? {};
      const seenInsight = new Set<string>();
      const rotationInsights: { title: string; weeksAgo: number }[] = [];
      for (const day of serialized.days) {
        for (const t of day.tasks) {
          if (t.task.frequency === 'daily' || seenInsight.has(t.task.id)) continue;
          seenInsight.add(t.task.id);
          const iso = lastDone[t.task.id];
          if (!iso) continue;
          const weeksAgo = Math.floor(
            (weekOf.getTime() - new Date(iso).getTime()) / (7 * 24 * 60 * 60 * 1000),
          );
          if (weeksAgo >= 3) rotationInsights.push({ title: t.task.title, weeksAgo });
        }
      }
      rotationInsights.sort((a, b) => b.weeksAgo - a.weeksAgo);
      const topInsights = rotationInsights.slice(0, 3);

      const members = Array.isArray((household as { members?: string[] }).members)
        ? (household as { members: string[] }).members
        : [];

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
          lastWeekPct,
          rotationInsights: topInsights,
          members,
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
