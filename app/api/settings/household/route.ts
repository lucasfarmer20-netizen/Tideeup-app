import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/server.js';
import { generateWeekPlan } from '@/lib/engine/planner.js';
import { serializeWeekPlan } from '@/utils/serialize';
import type { RotationState, Season, HomeType, PetType, FlooringType, TimePreference } from '@/lib/engine/types.js';

// All fields optional — send only what you want to change.
// Core profile fields (homeSize etc.) are required together when re-generating the plan.
const schema = z.object({
  homeSize:       z.enum(['S', 'M', 'L', 'XL']).optional(),
  householdCount: z.number().int().min(1).max(6).optional(),
  pets:           z.boolean().optional(),
  kids:           z.boolean().optional(),
  timePreference: z.union([
    z.enum(['quick', 'steady', 'thorough', 'batch']),
    z.literal(10), z.literal(20), z.literal(30), z.literal('BATCH'),
  ]).optional(),
  members:        z.array(z.string().min(1).max(50)).max(10).optional(),
  noGoDays:       z.array(z.number().int().min(0).max(6)).optional(),
  seasonOverride: z.enum(['spring', 'summer', 'fall', 'winter']).nullable().optional(),
});

async function getAuthUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );
  const { data: { user } } = await authClient.auth.getUser();
  if (!user?.email) return null;

  const supabase = createAdminClient();
  const { data } = await supabase.from('users').select('id').eq('email', user.email).maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ message: 'Unauthorised' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid input', errors: parsed.error.flatten() }, { status: 400 });
  }

  const { homeSize, householdCount, pets, kids, timePreference, members, noGoDays, seasonOverride } = parsed.data;
  const supabase = createAdminClient();

  // Gate paid-only fields behind tier check
  const paidFieldsPresent = members !== undefined || noGoDays !== undefined || 'seasonOverride' in parsed.data;
  if (paidFieldsPresent) {
    const { data: userRow } = await supabase.from('users').select('tier').eq('id', userId).maybeSingle();
    if ((userRow as { tier?: string } | null)?.tier !== 'paid') {
      return NextResponse.json({ message: 'Pro subscription required' }, { status: 403 });
    }
  }

  // Build the patch object — only include fields that were sent
  const patch: Record<string, unknown> = { user_id: userId };
  if (homeSize !== undefined) patch.home_size = homeSize;
  if (householdCount !== undefined) patch.household_count = householdCount;
  if (pets !== undefined) patch.pets = pets;
  if (kids !== undefined) patch.kids = kids;
  if (timePreference !== undefined) patch.time_preference = String(timePreference);
  if (members !== undefined) patch.members = members;
  if (noGoDays !== undefined) patch.no_go_days = noGoDays;
  if ('seasonOverride' in parsed.data) patch.season_override = seasonOverride ?? null;

  // Upsert household (partial — existing columns not in patch stay unchanged via ON CONFLICT DO UPDATE)
  // Supabase upsert replaces all columns, so we need to merge with existing data first
  const { data: existing } = await supabase.from('households').select('*').eq('user_id', userId).maybeSingle();
  const merged = { ...(existing ?? {}), ...patch };

  // Ensure required columns are present for insert
  if (!merged.home_size || merged.household_count === undefined) {
    // Only partial update for a household that doesn't exist yet — skip regen
    if (!existing) {
      return NextResponse.json({ ok: true, newPlanId: null });
    }
  }

  const { error: upsertError } = await supabase.from('households').upsert(merged, { onConflict: 'user_id' });

  if (upsertError) {
    return NextResponse.json({ message: upsertError.message }, { status: 500 });
  }

  // Only regenerate plan when core profile fields were changed
  const coreFieldChanged = homeSize !== undefined || householdCount !== undefined ||
    pets !== undefined || kids !== undefined || timePreference !== undefined;

  let newPlanId: string | null = null;
  if (coreFieldChanged) try {
    const currentMondayISO = (() => {
      const now = new Date();
      const dow = now.getUTCDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      const d = new Date(now);
      d.setUTCDate(now.getUTCDate() + diff);
      d.setUTCHours(0, 0, 0, 0);
      return d.toISOString().slice(0, 10);
    })();

    const [planRes, hRes, userRes] = await Promise.all([
      supabase.from('plans').select('id, completed_at').eq('user_id', userId).eq('week_of', currentMondayISO).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('households').select('rotation_state, season_override, no_go_days, home_size, home_type, household_count, pet_types, pets, kids, time_preference, flooring_types').eq('user_id', userId).maybeSingle(),
      supabase.from('users').select('tier').eq('id', userId).maybeSingle(),
    ]);

    const existingPlan = planRes.data;
    const household = hRes.data;
    const isPaid = (userRes.data as { tier?: string } | null)?.tier === 'paid';

    const effectiveHomeSize = (homeSize ?? household?.home_size ?? 'M') as Parameters<typeof generateWeekPlan>[0]['homeSize'];
    const effectiveCount = householdCount ?? (household?.household_count as number | undefined) ?? 2;
    const effectiveKids = kids ?? (household?.kids as boolean | undefined) ?? false;

    // Map timePreference: accept new labels or legacy numeric values
    const rawPref = timePreference ?? household?.time_preference;
    const effectivePref: TimePreference =
      rawPref === 'quick' || rawPref === 'steady' || rawPref === 'thorough' || rawPref === 'batch' ? rawPref
      : rawPref === 'BATCH' || rawPref === 30 || String(rawPref) === '30' ? 'thorough'
      : rawPref === 10 || String(rawPref) === '10' ? 'quick'
      : 'steady';

    // Derive petTypes from new column or fall back to legacy boolean
    const storedPetTypes = Array.isArray(household?.pet_types) ? household.pet_types as PetType[] : null;
    const legacyPets = pets ?? (household?.pets as boolean | undefined) ?? false;
    const effectivePetTypes: PetType[] = storedPetTypes ?? (legacyPets ? ['cat-1-2'] : []);

    const effectiveHomeType: HomeType = (household?.home_type as HomeType | undefined) ?? 'single-family';
    const effectiveFlooringTypes: FlooringType[] =
      Array.isArray(household?.flooring_types) ? household.flooring_types as FlooringType[] : ['mixed'];

    const effectiveRotationState = isPaid && household?.rotation_state
      ? (household.rotation_state as RotationState)
      : undefined;
    const effectiveSeasonOverride = (household?.season_override ?? seasonOverride ?? null) as Season | null;
    const effectiveNoGoDays = household?.no_go_days as number[] | undefined;

    const newPlan = generateWeekPlan({
      homeSize: effectiveHomeSize,
      homeType: effectiveHomeType,
      householdCount: effectiveCount,
      petTypes: effectivePetTypes,
      kids: effectiveKids,
      flooringTypes: effectiveFlooringTypes,
      timePreference: effectivePref,
      weekOf: new Date(),
      ...(effectiveRotationState ? { rotationState: effectiveRotationState } : {}),
      ...(effectiveSeasonOverride ? { seasonOverride: effectiveSeasonOverride } : {}),
      ...(effectiveNoGoDays?.length ? { noGoDays: effectiveNoGoDays } : {}),
    });
    const serialized = serializeWeekPlan(newPlan);

    if (existingPlan && !existingPlan.completed_at) {
      // Update in-place if not yet completed
      await supabase.from('plans').update({ week_plan: serialized as unknown as import('@/lib/supabase/types.js').Json }).eq('id', existingPlan.id);
      newPlanId = existingPlan.id;
    } else {
      // Insert a new plan for this week
      const { data: inserted } = await supabase.from('plans').insert({
        user_id: userId,
        is_claimed: true,
        home_size: effectiveHomeSize,
        household_count: effectiveCount,
        kids: effectiveKids,
        time_preference: String(effectivePref),
        week_of: currentMondayISO,
        week_plan: serialized as unknown as import('@/lib/supabase/types.js').Json,
      }).select('id').single();
      newPlanId = (inserted as { id?: string } | null)?.id ?? null;
    }
  } catch (err) {
    console.warn('[settings/household] plan regeneration failed:', err);
    // Non-fatal — household was still saved
  }

  return NextResponse.json({ ok: true, newPlanId });
}
