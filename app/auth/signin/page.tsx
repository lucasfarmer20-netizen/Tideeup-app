'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { safeNext } from '@/lib/auth/next';

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const upgrading = next.startsWith('/pricing');
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, next }),
      });

      const data = (await res.json()) as { message?: string };

      if (!res.ok) {
        setError(data.message ?? 'Something went wrong. Please try again.');
        return;
      }

      router.push(
        `/auth/verify?email=${encodeURIComponent(trimmed)}&next=${encodeURIComponent(next)}`,
      );
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link href="/" className="text-xl font-bold text-primary mb-10">
        TideeUp
      </Link>

      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            {upgrading
              ? 'One quick step before checkout: enter your email and we\u2019ll send a sign-in code, so Pro is attached to your plan.'
              : 'Enter your email and we\u2019ll send you a sign-in code.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
            disabled={loading}
            required
          />

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full bg-primary text-white font-semibold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {loading ? 'Sending…' : 'Send sign-in code'}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/quiz" className="text-primary underline">
            Get a free plan
          </Link>
        </p>
      </div>
    </div>
  );
}
