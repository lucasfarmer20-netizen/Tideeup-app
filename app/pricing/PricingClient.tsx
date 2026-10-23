'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Zap } from 'lucide-react';
import { FREE_FEATURES, PRO_FEATURES, PRICES } from '@/lib/stripe/plans.js';
import { useFeature } from '@/hooks/useFeature.js';
import { useSession } from '@/hooks/useSession.js';

interface ApiError {
  message: string;
}

const FAQ_ITEMS = [
  {
    q: 'How does Rotation Memory work?',
    a: "On the free plan, each week starts from scratch. With Pro, TideeUp tracks every task you complete and automatically rotates biweekly, monthly, and spillover tasks into your next Monday schedule so nothing gets neglected or repeated too soon.",
  },
  {
    q: 'Do I pay extra for my partner or kids?',
    a: 'Never. One Pro subscription covers your entire household — assign tasks to as many family members as you like with zero per-seat fees.',
  },
  {
    q: 'How does the Sunday email digest work, and can I cancel anytime?',
    a: 'Every Sunday morning, we generate your upcoming week and email you a clean summary + direct link before the week starts. You can cancel in two clicks from your billing portal anytime — no questions asked.',
  },
];

export function PricingClient() {
  const router = useRouter();
  const isPaid = useFeature('rotation_memory');
  const session = useSession();
  const hasAccount = !!session;

  const searchParams = useSearchParams();
  const prefilledEmail = searchParams.get('email') ?? undefined;
  const didSucceed = searchParams.get('success') === 'true';

  const [interval, setInterval] = useState<'monthly' | 'annual'>('annual');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Portal state
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const selectedPrice = PRICES[interval];
  const [countdown, setCountdown] = useState(didSucceed ? 3 : 0);

  useEffect(() => {
    if (!didSucceed) return;
    if (countdown <= 0) {
      router.replace('/dashboard?upgraded=true');
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [didSucceed, countdown, router]);

  async function handleUpgrade() {
    setCheckoutLoading(true);
    setCheckoutError(null);

    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: selectedPrice.id,
          email: session?.user.email ?? prefilledEmail,
        }),
      });

      const data = (await res.json()) as { url?: string } & ApiError;

      if (!res.ok || !data.url) {
        setCheckoutError(data.message ?? 'Something went wrong.');
        return;
      }

      router.push(data.url);
    } catch {
      setCheckoutError('Network error. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    setPortalError(null);

    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = (await res.json()) as { url?: string } & ApiError;

      if (!res.ok || !data.url) {
        setPortalError(data.message ?? 'Something went wrong.');
        return;
      }

      router.push(data.url);
    } catch {
      setPortalError('Network error. Please try again.');
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="border-b border-border/60 bg-surface/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <Link href="/" className="text-2xl font-display font-semibold text-primary">
            TideeUp
          </Link>
          <div className="flex items-center gap-4 text-sm">
            {hasAccount ? (
              <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                ← Back to dashboard
              </Link>
            ) : (
              <Link href="/quiz" className="text-muted-foreground hover:text-foreground transition-colors">
                Build free plan
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-6 py-16">
        {/* ── Success banner ──────────────────────────────────────────── */}
        {didSucceed && (
          <div className="mb-10 rounded-xl border border-secondary bg-secondary/40 px-6 py-4 text-foreground flex items-center justify-between gap-4">
            <div>
              <strong>You&apos;re on Pro!</strong> Your account has been upgraded.
              All paid features are now unlocked.
            </div>
            <span className="text-sm text-muted-foreground shrink-0">
              Redirecting in {countdown}s…
            </span>
          </div>
        )}

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-semibold text-foreground">
            Put your weekly cleaning on autopilot
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
            One simple household plan. No per-member seat fees, no hidden limits, cancel anytime.
          </p>
        </div>

        {/* ── Monthly / Annual toggle ──────────────────────────────────── */}
        <div className="mb-10 flex justify-center">
          <div className="inline-flex rounded-pill border border-border bg-surface p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setInterval('monthly')}
              className={`rounded-pill px-5 py-2 text-sm font-medium transition-colors ${
                interval === 'monthly'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly ($7/mo)
            </button>
            <button
              type="button"
              onClick={() => setInterval('annual')}
              className={`rounded-pill px-5 py-2 text-sm font-medium transition-colors ${
                interval === 'annual'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Annual ($5/mo)
              <span
                className={`ml-2 rounded-pill px-2 py-0.5 text-xs font-semibold ${
                  interval === 'annual'
                    ? 'bg-white/20 text-primary-foreground'
                    : 'bg-sage/25 text-foreground'
                }`}
              >
                Save $24
              </span>
            </button>
          </div>
        </div>

        {/* ── Cards ───────────────────────────────────────────────────── */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Free card */}
          <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="mb-6">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Free
                </p>
                <p className="mt-2 text-4xl font-semibold text-foreground">$0</p>
                <p className="mt-1 text-sm text-muted-foreground">No credit card needed</p>
              </div>

              <ul className="mb-8 space-y-3">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {hasAccount ? (
              <div className="block w-full rounded-md border border-border py-3 text-center text-sm font-semibold text-muted-foreground bg-muted">
                Current plan
              </div>
            ) : (
              <Link
                href="/quiz"
                className="block w-full rounded-md border border-border py-3 text-center text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Start for free
              </Link>
            )}
          </div>

          {/* Pro card */}
          <div className="relative rounded-2xl border-2 border-primary bg-surface p-8 shadow-md flex flex-col justify-between">
            <div className="absolute -top-3 left-6 rounded-pill bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
              Most popular
            </div>

            <div>
              <div className="mb-6">
                <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                  Pro
                </p>
                <p className="mt-2 text-4xl font-semibold text-foreground">
                  {interval === 'monthly' ? '$7' : '$5'}
                  <span className="text-lg font-normal text-muted-foreground"> / month</span>
                </p>
                {interval === 'annual' ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Billed as $60 / year &mdash; {PRICES.annual.savingsLabel}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Billed monthly &mdash; switch to annual to save $24/yr
                  </p>
                )}
              </div>

              <ul className="mb-8 space-y-3">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {isPaid ? (
              <div className="rounded-md border border-secondary bg-secondary/40 px-4 py-3 text-center text-sm text-foreground">
                <span className="font-semibold">Current plan</span> &mdash; you&apos;re
                on Pro.{' '}
                <button
                  type="button"
                  onClick={() => document.getElementById('portal-form')?.scrollIntoView({ behavior: 'smooth' })}
                  className="underline hover:no-underline"
                >
                  Manage subscription →
                </button>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={handleUpgrade}
                  disabled={checkoutLoading || !selectedPrice.id}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Zap className="h-4 w-4" />
                  {checkoutLoading
                    ? 'Redirecting to Stripe…'
                    : interval === 'annual'
                      ? 'Upgrade to Pro — $5/mo (billed annually)'
                      : 'Upgrade to Pro — $7/mo'}
                </button>

                {!selectedPrice.id && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Stripe price IDs not configured — see .env.example.
                  </p>
                )}

                {checkoutError && (
                  <p className="mt-2 text-center text-xs text-destructive">
                    {checkoutError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Mini FAQ ─────────────────────────────────────────────────── */}
        <div className="mt-16 space-y-6">
          <h2 className="text-2xl font-semibold text-center text-foreground">
            Common questions
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {FAQ_ITEMS.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl border border-border bg-surface p-6 space-y-2 shadow-sm"
              >
                <h3 className="text-sm font-semibold text-foreground">{item.q}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Manage subscription (portal) ─────────────────────────────── */}
        <div
          id="portal-form"
          className="mt-12 rounded-2xl border border-border bg-surface p-8 shadow-sm"
        >
          <h2 className="mb-1 text-lg font-semibold text-foreground">
            Manage your subscription
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Open your billing portal to update payment details or cancel.
          </p>

          {hasAccount ? (
            <button
              type="button"
              onClick={handlePortal}
              disabled={portalLoading}
              className="rounded-md bg-chestnut px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-chestnut/90 disabled:opacity-60"
            >
              {portalLoading ? 'Opening…' : 'Manage subscription'}
            </button>
          ) : (
            <Link
              href="/auth/signin"
              className="inline-block rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Sign in to manage your subscription
            </Link>
          )}

          {portalError && (
            <p className="mt-2 text-sm text-destructive">{portalError}</p>
          )}
        </div>

        {/* ── FAQ reassurance ──────────────────────────────────────────── */}
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Cancel any time from the billing portal. No questions asked.
        </p>
      </div>
    </main>
  );
}
