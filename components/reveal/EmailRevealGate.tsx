'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, Mail, CheckCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CaptureUserRequest, CaptureUserResponse } from '@/types/api';

interface EmailRevealGateProps {
  planId: string;
  onReveal: (capturedEmail?: string) => void;
  totalTasks?: number;
  totalMinutes?: number;
}

export function EmailRevealGate({
  planId,
  onReveal,
  totalTasks,
  totalMinutes,
}: EmailRevealGateProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Returning-user state: show confirmation message before redirecting
  const [returningEmail, setReturningEmail] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setIsLoading(true);
    setError(null);

    try {
      const body: CaptureUserRequest = { email: trimmed, planId };
      const res = await fetch('/api/user/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? 'Something went wrong');
      }

      const data: CaptureUserResponse = await res.json();

      if (data.isReturningUser) {
        // Show welcome-back confirmation, then redirect to the verify page.
        // The pending_plan_id cookie (set by the generate API) will cause the
        // auth callback to claim this plan once they sign in.
        setReturningEmail(trimmed);
        setIsLoading(false);
        setTimeout(() => {
          router.push(`/auth/verify?email=${encodeURIComponent(trimmed)}&next=/dashboard`);
        }, 2000);
        return;
      }

      // New user — clear draft and reveal the plan in place.
      sessionStorage.removeItem('tideeup_draft_plan');
      onReveal(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setIsLoading(false);
    }
  }

  // ── Returning-user confirmation screen ──────────────────────────────────────
  if (returningEmail) {
    return (
      <div className="absolute inset-0 flex items-center justify-center z-10 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/75 to-background pointer-events-none" />
        <div className="relative z-20 w-full max-w-md bg-surface rounded-2xl border shadow-lg p-7 space-y-5 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-1">
            <CheckCircle className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Welcome back!</h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent a sign-in code to <strong>{returningEmail}</strong>.
            Enter it to access your dashboard — your new plan will be waiting there.
          </p>
          <Button
            size="lg"
            className="w-full"
            onClick={() =>
              router.push(`/auth/verify?email=${encodeURIComponent(returningEmail)}&next=/dashboard`)
            }
          >
            Enter sign-in code →
          </Button>
        </div>
      </div>
    );
  }

  const hoursLabel =
    totalMinutes && totalMinutes > 0
      ? `~${(totalMinutes / 60).toFixed(1).replace(/\.0$/, '')} hrs/week`
      : null;

  // ── Default email capture form ───────────────────────────────────────────────
  return (
    <div className="absolute inset-0 flex items-start sm:items-center justify-center z-10 px-4 pt-16 sm:pt-0">
      {/* Gradient fade from transparent top to warm background bottom */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background pointer-events-none" />

      <div className="relative z-20 w-full max-w-md bg-surface rounded-2xl border shadow-lg p-7 space-y-5 animate-scale-in">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-1">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          {totalTasks ? (
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-pill">
              <span>{totalTasks} custom tasks scheduled</span>
              {hoursLabel && <span>· {hoursLabel}</span>}
            </div>
          ) : null}
          <h2 className="text-2xl font-bold">Your 7-day plan is ready</h2>
          <p className="text-sm text-muted-foreground">
            Where should we send your permanent plan link? You&apos;ll also unlock the full schedule right now.
          </p>
        </div>

        <ul className="space-y-1.5 bg-background/60 rounded-xl border p-3.5 text-xs text-foreground/90">
          <li className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Instant access to all 7 zone-balanced days</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Interactive daily checklist + printable fridge view</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Direct link in your inbox so you never lose your plan</span>
          </li>
        </ul>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="sr-only">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                className="pl-10 h-11"
                disabled={isLoading}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full shadow-md shadow-primary/15"
            disabled={isLoading || !email.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
                Unlocking your plan…
              </>
            ) : (
              'Unlock my 7-day plan →'
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          100% free · No password or credit card · Unsubscribe anytime
        </p>
      </div>
    </div>
  );
}
