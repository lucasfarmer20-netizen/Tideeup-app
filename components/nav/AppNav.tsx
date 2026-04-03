'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client.js';
import { useSession } from '@/hooks/useSession.js';
import { useFeature } from '@/hooks/useFeature.js';
import { Lock, ChevronDown, Menu, X } from 'lucide-react';

export function AppNav() {
  const session = useSession();
  const isPaid = useFeature('plan_history');
  const router = useRouter();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  const username = session?.user.email?.split('@')[0] ?? '…';

  const navLinks = (
    <>
      <Link
        href="/dashboard"
        className={`text-sm transition-colors ${pathname === '/dashboard' ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
      >
        Dashboard
      </Link>
      <Link
        href="/history"
        className={`flex items-center gap-1 text-sm transition-colors ${pathname === '/history' ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
      >
        History
        {!isPaid && <Lock className="w-3 h-3" />}
      </Link>
      <Link
        href="/settings"
        className={`text-sm transition-colors ${pathname === '/settings' ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
      >
        Settings
      </Link>
    </>
  );

  return (
    <nav className="border-b bg-white sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: logo + desktop links */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-xl font-bold text-primary">
            TideeUp
          </Link>
          <div className="hidden sm:flex items-center gap-5">{navLinks}</div>
        </div>

        {/* Right: tier badge + account dropdown + hamburger */}
        <div className="flex items-center gap-3">
          <span
            className={`hidden sm:inline text-xs font-semibold px-2 py-1 rounded-full ${
              isPaid
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {isPaid ? 'Pro' : 'Free'}
          </span>

          {/* Account dropdown */}
          <div className="relative hidden sm:block" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              {username}
              <ChevronDown className="w-4 h-4" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 min-w-44 z-30">
                <Link
                  href="/pricing"
                  className="block px-4 py-2 text-sm hover:bg-muted"
                  onClick={() => setDropdownOpen(false)}
                >
                  Manage subscription
                </Link>
                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-muted text-destructive"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* Hamburger (mobile) */}
          <button
            className="sm:hidden p-1 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="sm:hidden border-t px-4 py-4 space-y-4 bg-white">
          <div className="flex flex-col gap-3">{navLinks}</div>
          <div className="border-t pt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{username}</span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  isPaid ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                {isPaid ? 'Pro' : 'Free'}
              </span>
            </div>
            <div className="flex gap-4 text-sm">
              <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
                Manage
              </Link>
              <button onClick={handleSignOut} className="text-destructive">
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
