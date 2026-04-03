import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateWeekPlan } from '@/lib/engine/planner.js';
import { createAdminClient } from '@/lib/supabase/server.js';
import { getServerUser } from '@/lib/supabase/session.js';
import { serializeWeekPlan } from '@/utils/serialize';
import type { PlannerInput, HomeSize, TimePreference, Task, RotationState, Season } from '@/lib/engine/types.js';
import type { GeneratePlanResponse } from '@/types/api';

// ─── Input schema ─────────────────────────────────────────────────────────────

const schema = z.object({
  homeSize: z.enum(['S', 'M', 'L', 'XL']),
  homeType: z.enum(['apartment', 'townhouse', 'single-family', 'large-home']),
  householdCount: z.number().int().min(1).max(6),
  petTypes: z.array(z.enum(['cat-1-2', 'cat-3-plus', 'small-dog-1-2', 'large-dog-1-2', 'large-dog-3-plus', 'small-animals', 'other'])),
  kids: z.boolean(),
  flooringTypes: z.array(z.enum(['hardwood', 'carpet', 'tile', 'mixed'])),
  timePreference: z.enum(['quick', 'steady', 'thorough', 'batch']),
});

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  // Parse + validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid input', errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { homeSize, homeType, householdCount, petTypes, kids, flooringTypes, timePreference } = parsed.data;

  // Detect authenticated user — reuses the same getServerUser() path that
  // works for server components (dashboard, etc.) so the cookie-reading logic
  // is identical and proven.
  let hasAuthSession = false;
  let authenticatedUserId: string | null = null;
  let isPaidUser = false;
  let planSavedToAccount = false;
  let rotationState: RotationState | undefined;
  let seasonOverride: Season | undefined;
  let noGoDays: number[] | undefined;
  let customTasks: Task[] | undefined;

  const authUser = await getServerUser();

  if (authUser?.email) {
    hasAuthSession = true;
    try {
      const supabase = createAdminClient();

      // Find the public.users row, creating it if this is the user's first quiz.
      let { data: userRow } = await supabase
        .from('users')
        .select('id, tier')
        .eq('email', authUser.email)
        .maybeSingle();

      if (!userRow) {
        const { data: newUser } = await supabase
          .from('users')
          .insert({ email: authUser.email })
          .select('id, tier')
          .single();
        userRow = newUser;
      }

      authenticatedUserId = userRow?.id ?? null;
      isPaidUser = (userRow as { tier?: string } | null)?.tier === 'paid';

      if (authenticatedUserId) {
        const [hRes, ctRes] = await Promise.all([
          supabase
            .from('households')
            .select('rotation_state, season_override, no_go_days')
            .eq('user_id', authenticatedUserId)
            .maybeSingle(),
          isPaidUser
            ? supabase.from('custom_tasks').select('*').eq('user_id', authenticatedUserId)
            : Promise.resolve({ data: null }),
        ]);

        const household = hRes.data;
        if (household) {
          if (isPaidUser && household.rotation_state) {
            rotationState = household.rotation_state as RotationState;
          }
          if (household.season_override) {
            seasonOverride = household.season_override as Season;
          }
          if (household.no_go_days && (household.no_go_days as number[]).length > 0) {
            noGoDays = household.no_go_days as number[];
          }
        }

        if (isPaidUser && ctRes.data && ctRes.data.length > 0) {
          customTasks = ctRes.data.map((ct) => {
            const mins = ct.estimated_minutes as number;
            return {
              id: `custom-${ct.id as string}`,
              title: ct.title as string,
              zone: ct.zone as Task['zone'],
              frequency: ct.frequency as Task['frequency'],
              typicalMinutes: { S: mins, M: mins, L: mins, XL: mins },
              chaosImpact: 0.2,
              fatigueCost: 0.3,
              tags: ['custom'],
              flooringTypes: null,
              petTypes: null,
              seasonalMonths: null,
              homeTypes: null,
            };
          });
        }
      }
    } catch {
      // Non-fatal — plan generation continues, user association may be incomplete.
    }
  }

  // Build PlannerInput
  const plannerInput: PlannerInput = {
    homeSize: homeSize as HomeSize,
    homeType,
    householdCount,
    petTypes,
    kids,
    flooringTypes,
    timePreference: timePreference as TimePreference,
    weekOf: new Date(), // always plan for the current week
    ...(rotationState !== undefined ? { rotationState } : {}),
    ...(seasonOverride !== undefined ? { seasonOverride } : {}),
    ...(noGoDays !== undefined ? { noGoDays } : {}),
    ...(customTasks !== undefined ? { customTasks } : {}),
  };

  // Run the engine (pure, synchronous)
  const weekPlan = generateWeekPlan(plannerInput);
  const serialized = serializeWeekPlan(weekPlan);

  // Persist to Supabase
  // If Supabase is not configured (e.g., local dev without .env.local),
  // we still return the plan — it just won't have a persistent planId.
  let planId: string;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('plans')
      .insert({
        ...(authenticatedUserId ? { user_id: authenticatedUserId, is_claimed: true } : {}),
        home_size: homeSize,
        home_type: homeType,
        household_count: householdCount,
        pet_types: petTypes,
        kids,
        flooring_types: flooringTypes,
        time_preference: timePreference,
        week_of: serialized.weekOf.slice(0, 10), // ISO date portion
        week_plan: serialized as unknown as import('@/lib/supabase/types').Json,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Insert failed');
    }

    planId = data.id;
    if (authenticatedUserId) planSavedToAccount = true;

    // Upsert household config so streak/rotation features work immediately
    if (authenticatedUserId) {
      await supabase.from('households').upsert(
        {
          user_id: authenticatedUserId,
          home_size: homeSize,
          home_type: homeType,
          household_count: householdCount,
          pet_types: petTypes,
          kids,
          flooring_types: flooringTypes,
          time_preference: timePreference,
        },
        { onConflict: 'user_id' },
      );
    }
  } catch (err) {
    // In development without Supabase, generate a placeholder ID so the UI
    // can still proceed through the quiz → result flow.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[TideeUp] Supabase not available — using placeholder planId:', err);
      planId = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    } else {
      return NextResponse.json(
        { message: 'Failed to save plan. Please try again.' },
        { status: 500 },
      );
    }
  }

  const response: GeneratePlanResponse = {
    planId,
    weekPlan: serialized,
    // Only true when the plan was actually linked to the user's account.
    // If the DB insert failed (e.g. schema mismatch in dev), fall back to
    // the /quiz/result flow which reads from sessionStorage.
    isAuthenticated: planSavedToAccount,
  };
  const res = NextResponse.json(response, { status: 201 });

  // For anonymous plans, set a short-lived cookie so the auth callback can
  // claim the plan the moment the user signs in (Bug 2 fix).
  if (!authenticatedUserId) {
    res.cookies.set('pending_plan_id', planId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });
  }

  return res;
}
