import Link from 'next/link';
import { ArrowRight, CheckCircle, Clock, Sparkles, Users, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-teal-50 via-white to-teal-50/30 border-b">
      <div className="max-w-4xl mx-auto px-4 py-20 sm:py-28 text-center space-y-8">
        <Badge variant="secondary" className="text-sm px-4 py-1.5">
          ✨ Free — no account required
        </Badge>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
          A personalized weekly{' '}
          <span className="text-primary">cleaning plan</span>
          <br />
          for your home, in 2 minutes.
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Answer 4 quick questions. Get a schedule that fits your home size, household,
          and how much time you actually have — then get back to your life.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="xl" className="shadow-lg shadow-primary/25">
            <Link href="/quiz">
              Get my free plan
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            Takes 2 minutes · No login wall · Works on any device
          </p>
        </div>

        {/* Proof strip */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground pt-4">
          {['Dishes every day', 'Deep cleans on weekends', 'Never misses bathrooms', '7-day view'].map(
            (item) => (
              <div key={item} className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-primary" />
                {item}
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

const HOW_STEPS = [
  {
    icon: Home,
    title: 'Tell us about your home',
    body: 'Home size, who lives there, pets, kids. 4 questions, 30 seconds.',
  },
  {
    icon: Sparkles,
    title: 'We build your plan',
    body: 'Our engine schedules tasks by zone, day, and fatigue — so no one day is a death march.',
  },
  {
    icon: Clock,
    title: 'Clean smarter every week',
    body: "Save your plan, come back each Monday, and follow the schedule. That's it.",
  },
];

function HowItWorks() {
  return (
    <section className="max-w-4xl mx-auto px-4 py-20 space-y-12">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold">How it works</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          No spreadsheets. No guilt. Just a plan that works for your actual home.
        </p>
      </div>
      <div className="grid sm:grid-cols-3 gap-8">
        {HOW_STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={i} className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10">
                <Icon className="w-7 h-7 text-primary" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs font-bold text-primary bg-primary/10 rounded-full w-5 h-5 flex items-center justify-center">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold">{step.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Social proof ──────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote: "We haven't missed a bathroom in 3 weeks. That's a personal record.",
    name: 'Sarah M.',
    role: 'Mom of two, suburban Boston',
  },
  {
    quote: "I set it to 'weekend warrior' and it's perfect. Barely have to think about it.",
    name: 'James T.',
    role: 'Single dad, 4-bedroom house',
  },
  {
    quote: "The zone anchoring thing is genius. Kitchen Monday just makes sense.",
    name: 'Priya K.',
    role: 'Family of 5, 3 cats',
  },
];

function SocialProof() {
  return (
    <section className="bg-muted/40 border-y">
      <div className="max-w-4xl mx-auto px-4 py-20 space-y-10">
        <h2 className="text-3xl font-bold text-center">What families are saying</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="bg-white rounded-xl border p-6 space-y-4 shadow-sm">
              <p className="text-sm leading-relaxed italic text-foreground/80">
                "{t.quote}"
              </p>
              <div>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing teaser ───────────────────────────────────────────────────────────

const FREE_FEATURES = [
  'Full 7-day weekly plan',
  'All household task types',
  'Seasonal task weighting',
  'Zone-anchored scheduling',
  'Mobile-friendly view',
];

const PRO_FEATURES = [
  'Everything in Free',
  'Rotation memory (no repeats)',
  'Assign tasks to family members',
  'Weekly Sunday email digest',
  'Custom tasks & frequencies',
  'Season override control',
  'Plan history',
];

function PricingTeaser() {
  return (
    <section className="max-w-4xl mx-auto px-4 py-20 space-y-10">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold">Simple, honest pricing</h2>
        <p className="text-muted-foreground">Start free. Upgrade when you're ready.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {/* Free */}
        <div className="rounded-xl border bg-card p-7 space-y-5">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Free</p>
            <p className="text-4xl font-bold mt-1">$0</p>
            <p className="text-sm text-muted-foreground mt-1">Always free, no card needed</p>
          </div>
          <ul className="space-y-2.5">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" className="w-full">
            <Link href="/quiz">Get started free</Link>
          </Button>
        </div>

        {/* Pro */}
        <div className="rounded-xl border-2 border-primary bg-card p-7 space-y-5 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="shadow-sm">Most popular</Badge>
          </div>
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">Pro</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-4xl font-bold">$7</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Cancel any time</p>
          </div>
          <ul className="space-y-2.5">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <Button asChild className="w-full">
            <Link href="/quiz">Try free, upgrade later</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Footer CTA ───────────────────────────────────────────────────────────────

function FooterCta() {
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <h2 className="text-3xl font-bold">Ready for a cleaner home?</h2>
        <p className="text-primary-foreground/80">
          Join families who've stopped guessing and started planning.
        </p>
        <Button asChild size="xl" variant="secondary">
          <Link href="/quiz">
            Get my free plan
            <ArrowRight className="w-5 h-5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav className="border-b bg-white/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-primary">
          TideeUp
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/auth/signin"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link href="/quiz">Get started free</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <SocialProof />
        <PricingTeaser />
        <FooterCta />
      </main>
      <footer className="border-t bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>© 2025 TideeUp. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
