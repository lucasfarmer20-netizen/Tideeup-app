'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Zap } from 'lucide-react';
import { FREE_FEATURES, PRO_FEATURES, PRICES } from '@/lib/stripe/plans.js';
import { useFeature } from '@/hooks/useFeature.js';
import { useSession } from '@/hooks/useSession.js';

interface ApiError {
  message: string;
}

export function PricingClient() {
  const router = useRouter();
  const isPaid = useFeature('rotation_memory');
  const session = useSession();
  const hasAccount = !!session;

  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Portal state
  const [portalEmail, setPortalEmail] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const selectedPrice = PRICES[interval];
  const searchParams = useSearchParams();
  const didSucceed = searchParams.get('success') === 'true';
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
        body: JSON.stringify({ priceId: selectedPrice.id, email: session?.user.email }),
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

  async function handlePortal(e: React.FormEvent) {
    e.preventDefault();
    setPortalLoading(true);
    setPortalError(null);

    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: portalEmail }),
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
    <main className="min-h-screen bg-slate-50">
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="border-b border-slate-200 bg-white px-6 py-4">
        <a href="/" className="text-teal-600 font-semibold text-lg">
          TideeUp
        </a>
      </nav>

      <div className="mx-auto max-w-4xl px-6 py-16">
        {/* ── Success banner ──────────────────────────────────────────── */}
        {didSucceed && (
          <div className="mb-10 rounded-xl border border-teal-200 bg-teal-50 px-6 py-4 text-teal-800 flex items-center justify-between gap-4">
            <div>
              <strong>You&apos;re on Pro!</strong> Your account has been upgraded.
              All paid features are now unlocked.
            </div>
            <span className="text-sm text-teal-600 shrink-0">
              Redirecting in {countdown}s…
            </span>
          </div>
        )}

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-slate-900">
            Simple, honest pricing
          </h1>
          <p className="mt-3 text-slate-500">
            One plan. No seat fees, no hidden limits, no dark patterns.
          </p>
        </div>

        {/* ── Monthly / Annual toggle ──────────────────────────────────── */}
        <div className="mb-10 flex justify-center">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              onClick={() => setInterval('monthly')}
              className={`rounded-md px-5 py-2 text-sm font-medium transition-colors ${
                interval === 'monthly'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval('annual')}
              className={`rounded-md px-5 py-2 text-sm font-medium transition-colors ${
                interval === 'annual'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Annual
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                Save $24
              </span>
            </button>
          </div>
        </div>

        {/* ── Cards ───────────────────────────────────────────────────── */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Free card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Free
              </p>
              <p className="mt-2 text-4xl font-bold text-slate-900">$0</p>
              <p className="mt-1 text-sm text-slate-500">No credit card needed</p>
            </div>

            <ul className="mb-8 space-y-3">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
                  {f}
                </li>
              ))}
            </ul>

            {hasAccount ? (
              <div className="block w-full rounded-lg border border-slate-200 py-3 text-center text-sm font-semibold text-slate-500 bg-slate-50">
                Current plan
              </div>
            ) : (
              <a
                href="/quiz"
                className="block w-full rounded-lg border border-slate-200 py-3 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Start for free
              </a>
            )}
          </div>

          {/* Pro card */}
          <div className="relative rounded-2xl border-2 border-teal-500 bg-white p-8 shadow-md">
            <div className="absolute -top-3 left-6 rounded-full bg-teal-600 px-3 py-0.5 text-xs font-bold text-white">
              Most popular
            </div>

            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-600">
                Pro
              </p>
              <p className="mt-2 text-4xl font-bold text-slate-900">
                {interval === 'monthly' ? '$7' : '$5'}
                <span className="text-lg font-normal text-slate-400"> / month</span>
              </p>
              {interval === 'annual' && (
                <p className="mt-1 text-sm text-slate-500">
                  Billed as $60 / year &mdash; {PRICES.annual.savingsLabel}
                </p>
              )}
            </div>

            <ul className="mb-8 space-y-3">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
                  {f}
                </li>
              ))}
            </ul>

            {isPaid ? (
              <div className="rounded-lg border border-teal-100 bg-teal-50 px-4 py-3 text-center text-sm text-teal-800">
                <span className="font-semibold">Current plan</span> &mdash; you&apos;re
                on Pro.{' '}
                <button
                  onClick={() => document.getElementById('portal-form')?.scrollIntoView({ behavior: 'smooth' })}
                  className="underline hover:no-underline"
                >
                  Manage subscription →
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={handleUpgrade}
                  disabled={checkoutLoading || !selectedPrice.id}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Zap className="h-4 w-4" />
                  {checkoutLoading ? 'Redirecting…' : 'Upgrade to Pro'}
                </button>

                {!selectedPrice.id && (
                  <p className="mt-2 text-center text-xs text-amber-600">
                    Stripe price IDs not configured — see .env.example.
                  </p>
                )}

                {checkoutError && (
                  <p className="mt-2 text-center text-xs text-red-600">
                    {checkoutError}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Manage subscription (portal) ─────────────────────────────── */}
        <div
          id="portal-form"
          className="mt-16 rounded-2xl border border-slate-200 bg-white p-8"
        >
          <h2 className="mb-1 text-lg font-semibold text-slate-900">
            Already a subscriber?
          </h2>
          <p className="mb-6 text-sm text-slate-500">
            Enter the email you used to sign up and we&apos;ll open your billing
            portal where you can update payment details or cancel.
          </p>

          <form onSubmit={handlePortal} className="flex gap-3">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={portalEmail}
              onChange={(e) => setPortalEmail(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
            <button
              type="submit"
              disabled={portalLoading}
              className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-900 disabled:opacity-60"
            >
              {portalLoading ? 'Opening…' : 'Manage plan'}
            </button>
          </form>

          {portalError && (
            <p className="mt-2 text-sm text-red-600">{portalError}</p>
          )}
        </div>

        {/* ── FAQ reassurance ──────────────────────────────────────────── */}
        <p className="mt-10 text-center text-sm text-slate-400">
          Cancel any time from the billing portal. No questions asked.
        </p>
      </div>
    </main>
  );
}
