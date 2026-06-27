/**
 * Shared request / response shapes for TideeUp API routes.
 * Import these in both API route handlers and client-side fetch calls
 * to keep the contract in one place.
 */

import type { FlooringType, HomeSize, HomeType, PetType, TimePreference } from '@/lib/engine/types.js';
import type { SerializedWeekPlan } from '@/utils/serialize';

// ─── POST /api/plan/generate ──────────────────────────────────────────────────

export interface GeneratePlanRequest {
  homeSize: HomeSize;
  homeType: HomeType;
  /** 1–6 (6 means "6 or more") */
  householdCount: number;
  petTypes: PetType[];
  kids: boolean;
  flooringTypes: FlooringType[];
  timePreference: TimePreference;
}

export interface GeneratePlanResponse {
  planId: string;
  weekPlan: SerializedWeekPlan;
  /** True when the request was made by an authenticated user — plan is already saved to their account. */
  isAuthenticated: boolean;
}

// ─── POST /api/user/capture ───────────────────────────────────────────────────

export interface CaptureUserRequest {
  email: string;
  planId: string;
}

export interface CaptureUserResponse {
  userId: string;
  alreadyExisted: boolean;
  /** True when the email already existed — client should redirect to /auth/verify. */
  isReturningUser: boolean;
}

// ─── GET /api/plan/[planId] ───────────────────────────────────────────────────

export interface GetPlanResponse {
  planId: string;
  weekPlan: SerializedWeekPlan;
  isClaimed: boolean;
}

// ─── POST /api/stripe/create-checkout ────────────────────────────────────────

export interface CreateCheckoutRequest {
  priceId: string;
  /** Optional — used to pre-fill the Stripe checkout form and match the user. */
  email?: string;
}

export interface CreateCheckoutResponse {
  url: string;
}

// ─── POST /api/plan/complete ──────────────────────────────────────────────────

export interface CompleteWeekRequest {
  planId: string;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastCompletedWeek: string | null;
}

export interface CompleteWeekResponse {
  streak: StreakData;
}

// ─── /api/plan/[planId]/completions ──────────────────────────────────────────

export interface TaskCompletion {
  taskId: string;
  /** 0-based index into weekPlan.days for the day this task was scheduled. */
  dayIndex: number;
}

/** GET — current per-task completion state for a plan. */
export interface TaskCompletionsResponse {
  completions: TaskCompletion[];
  /** Total number of (day, task) checkboxes across the plan. */
  total: number;
}

export interface ToggleCompletionRequest {
  taskId: string;
  dayIndex: number;
  done: boolean;
}

/** POST — result of toggling a single task complete/incomplete. */
export interface ToggleCompletionResponse {
  completed: number;
  total: number;
  /** True when this toggle checked off the final task and finalized the week. */
  autoCompleted: boolean;
  /** Present only when autoCompleted is true. */
  streak?: StreakData;
}

// ─── POST /api/stripe/portal ─────────────────────────────────────────────────

export interface PortalRequest {
  email: string;
}

export interface PortalResponse {
  url: string;
}

// ─── GET /api/cron/sunday-email ───────────────────────────────────────────────

export interface SundayEmailResult {
  processed: number;
  skipped: number;
  errors: number;
}
