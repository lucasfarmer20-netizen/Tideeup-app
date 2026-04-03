'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, Mail, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CaptureUserRequest, CaptureUserResponse } from '@/types/api';

interface EmailRevealGateProps {
  planId: string;
  onReveal: () => void;
}

export function EmailRevealGate({ planId, onReveal }: EmailRevealGateProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Returning-user state: show confirmation message before redirecting
  const [returningEmail, setReturningEmail] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const body: CaptureUserRequest = { email: email.trim(), planId };
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
        setReturningEmail(email.trim());
        setIsLoading(false);
        setTimeout(() => {
          router.push(`/auth/verify?email=${encodeURIComponent(email.trim())}&next=/dashboard`);
        }, 2000);
        return;
      }

      // New user — clear draft and reveal the plan in place.
      sessionStorage.removeItem('tideeup_draft_plan');
      onReveal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setIsLoading(false);
    }
  }

  // ── Returning-user confirmation screen ──────────────────────────────────────
  if (returningEmail) {
    return (
      <div className="absolute inset-0 flex items-center justify-center z-10 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/70 to-white pointer-events-none" />
        <div className="relative z-20 w-full max-w-sm bg-white rounded-2xl border shadow-xl p-7 space-y-5 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-1">
            <CheckCircle className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Welcome back!</h2>
          <p className="text-sm text-muted-foreground">
            We've sent a sign-in code to <strong>{returningEmail}</strong>.
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

  // ── Default email capture form ───────────────────────────────────────────────
  return (
    <div className="absolute inset-0 flex items-center justify-center z-10 px-4">
      {/* Gradient fade from transparent top to white bottom */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/70 to-white pointer-events-none" />

      <div className="relative z-20 w-full max-w-sm bg-white rounded-2xl border shadow-xl p-7 space-y-5">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-1">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Your plan is ready</h2>
          <p className="text-sm text-muted-foreground">
            Enter your email to unlock it — we'll also send you a copy.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            className="w-full"
            disabled={isLoading || !email.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
                Saving…
              </>
            ) : (
              'Reveal my plan →'
            )}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          No password. No credit card. Unsubscribe any time.
        </p>
      </div>
    </div>
  );
}
