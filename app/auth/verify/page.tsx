'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client.js';

// ─── Verify content ───────────────────────────────────────────────────────────

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const email = searchParams.get('email') ?? '';
  const urlCode = searchParams.get('code') ?? '';
  const next = searchParams.get('next') ?? '/';

  const [code, setCode] = useState(urlCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async (token: string) => {
    const trimmed = token.replace(/\s/g, '');
    if (trimmed.length < 6) {
      setError('Please enter the code from your email.');
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: trimmed,
      type: 'magiclink',
    });

    if (verifyError) {
      setError(
        verifyError.message.toLowerCase().includes('expired')
          ? 'This code has expired. Please go back and request a new one.'
          : verifyError.message.toLowerCase().includes('invalid')
            ? 'Incorrect code. Please double-check and try again.'
            : verifyError.message,
      );
      setLoading(false);
      return;
    }

    // Session established in cookies via @supabase/ssr — redirect to plan
    router.push(next);
  }, [email, next, router]);

  // Auto-submit when code arrives via URL (user clicked the email link)
  useEffect(() => {
    if (urlCode && email) {
      void verify(urlCode);
    }
  // Run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void verify(code);
  }

  if (!email) {
    return (
      <div className="text-center space-y-4">
        <p className="text-muted-foreground">No email address provided.</p>
        <Link href="/quiz" className="text-primary underline text-sm">Start over</Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">
          {loading ? 'Signing you in…' : 'Check your email'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {loading
            ? 'Verifying your code, redirecting shortly…'
            : <>We sent an 8-digit code to <strong>{email}</strong></>
          }
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          placeholder="00000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="w-full text-center text-3xl font-mono tracking-widest border rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-primary"
          autoFocus={!urlCode}
          disabled={loading}
        />

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || code.length < 6}
          className="w-full bg-primary text-white font-semibold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          {loading ? 'Verifying…' : 'Verify & view my plan'}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Didn&apos;t get a code?{' '}
        <Link href="/quiz" className="text-primary underline">
          Start over
        </Link>
      </p>

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/" className="text-muted-foreground hover:text-foreground underline">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link href="/" className="text-xl font-bold text-primary mb-10">
        TideeUp
      </Link>
      <Suspense>
        <VerifyContent />
      </Suspense>
    </div>
  );
}
