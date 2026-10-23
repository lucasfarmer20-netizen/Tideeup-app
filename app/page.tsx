import Link from 'next/link';
import { ArrowRight, CheckCircle, Clock, Sparkles, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SampleWeekPreview } from '@/components/landing/SampleWeekPreview';

// ─── Quick-start options (1-click jump into Step 2) ──────────────────────────

const QUICK_START_SIZES = [
  { value: 'S', label: 'Studio / 1 BR', emoji: '🏠' },
  { value: 'M', label: '2–3 BR', emoji: '🏡' },
  { value: 'L', label: '4–5 BR', emoji: '🏘️' },
  { value: 'XL', label: '6+ BR', emoji: '🏰' },
] as const;

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden border-b bg-gradient-to-br from-sage-light/50 via-surface to-background">
      {/* Soft decorative blobs — calm, brand-warm depth */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-sage/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-0 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-24 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
        {/* Left: copy */}
        <div className="space-y-6 text-center lg:text-left animate-fade-in">
          <Badge variant="secondary" className="text-sm px-4 py-1.5">
            ✨ Free personalized plan — no password or card required
          </Badge>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.05]">
            A calmer home,
            <br />
            <span className="text-primary">one tidy week</span> at a time.
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Answer 4 quick questions and get a personalized weekly cleaning plan that fits
            your home, your household, and the time you actually have — then get back to your life.
          </p>

          <div className="flex flex-col sm:flex-row items-center lg:items-start gap-3 sm:gap-4 lg:justify-start justify-center">
            <Button asChild size="xl" className="shadow-lg shadow-primary/20 w-full sm:w-auto">
              <Link href="/quiz">
                Get my free plan
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline" className="w-full sm:w-auto">
              <Link href="#how">See how it works</Link>
            </Button>
          </div>

          {/* 1-click quick-start home size pills — cuts Step 1 entirely */}
          <div className="pt-1 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Or tap your home size to jump right in:
            </p>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
              {QUICK_START_SIZES.map((s) => (
                <Link
                  key={s.value}
                  href={`/quiz?step=2&homeSize=${s.value}`}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface/90 px-3.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-all hover:border-primary hover:bg-primary/5 hover:text-primary"
                >
                  <span>{s.emoji}</span>
                  <span>{s.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Trust row */}
          <div className="flex flex-col sm:flex-row items-center lg:items-start gap-2 sm:gap-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Takes 60 seconds · Printable &amp; mobile-ready · No account needed
            </p>
          </div>
        </div>

        {/* Right: interactive product preview */}
        <div className="relative max-w-sm w-full mx-auto lg:ml-auto">
          <SampleWeekPreview />
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
    body: 'Home size, flooring, who lives there, pets, and your daily time budget. 4 quick questions, under 60 seconds.',
  },
  {
    icon: Sparkles,
    title: 'We build your zone-balanced plan',
    body: 'Our engine schedules tasks by room zone, day, and fatigue — so no single day ever feels like a weekend-ruining chore marathon.',
  },
  {
    icon: Clock,
    title: 'Check off & stay on top of it',
    body: 'Check off tasks on your phone or print the fridge sheet. Upgrade anytime if you want automatic weekly rotation and family assignments.',
  },
];

function HowItWorks() {
  return (
    <section id="how" className="max-w-4xl mx-auto px-4 py-24 space-y-12 scroll-mt-20">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-semibold">How it works</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          No spreadsheets. No guilt. Just a realistic routine built around the time you actually have.
        </p>
      </div>
      <div className="grid sm:grid-cols-3 gap-8">
        {HOW_STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={i} className="rounded-2xl border bg-surface p-6 text-center space-y-4 shadow-sm">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10">
                <Icon className="w-7 h-7 text-primary" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs font-bold text-primary bg-primary/10 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
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

// ─── Pricing teaser ───────────────────────────────────────────────────────────

const FREE_FEATURES = [
  'Personalized 7-day weekly plan',
  'Tailored to your flooring, pets & kids',
  'Zone-anchored & fatigue-balanced days',
  'Interactive checklist + printable view',
  'Emailed link so you can bookmark it',
];

const PRO_FEATURES = [
  'Everything in Free',
  'Rotation memory (never repeat deep cleans)',
  'Assign tasks to family members or partner',
  'Weekly Sunday morning email digest',
  'Custom tasks, frequencies & no-go days',
  'Season override mode & full plan history',
];

function PricingTeaser() {
  return (
    <section className="max-w-4xl mx-auto px-4 py-20 space-y-10">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold">Simple, honest pricing</h2>
        <p className="text-muted-foreground">
          Build your first weekly plan for free. Upgrade only if you want TideeUp to run your rotation every week.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {/* Free */}
        <div className="rounded-2xl border bg-card p-7 space-y-5 flex flex-col justify-between shadow-sm">
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Free</p>
              <p className="text-4xl font-bold mt-1">$0</p>
              <p className="text-sm text-muted-foreground mt-1">Always free · No credit card needed</p>
            </div>
            <ul className="space-y-2.5">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/quiz">Build my free plan</Link>
          </Button>
        </div>

        {/* Pro */}
        <div className="rounded-2xl border-2 border-primary bg-card p-7 space-y-5 relative flex flex-col justify-between shadow-md">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="shadow-sm">Most popular</Badge>
          </div>
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Pro</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-4xl font-bold">$5</span>
                <span className="text-muted-foreground">/month</span>
                <span className="text-xs bg-sage/25 text-foreground font-medium px-2 py-0.5 rounded-pill ml-1">
                  Save $24/yr
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Billed $60 annually, or $7/mo monthly · Cancel anytime
              </p>
            </div>
            <ul className="space-y-2.5">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/quiz">Start free, upgrade later →</Link>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <Link href="/pricing" className="underline hover:text-foreground">
                Compare plans &amp; billing options
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer CTA ───────────────────────────────────────────────────────────────

function FooterCta() {
  return (
    <section className="bg-sage text-ink">
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6">
        <h2 className="text-3xl sm:text-4xl font-semibold">Ready for a calmer, cleaner home?</h2>
        <p className="text-ink/80 text-lg">
          Stop guessing what to clean. Get a plan that fits your home, your people, and the time you actually have.
        </p>
        <Button asChild size="xl" className="shadow-lg">
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
    <nav className="border-b border-border/60 bg-surface/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-2xl font-display font-semibold text-primary">
          TideeUp
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/pricing"
            className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Pricing
          </Link>
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
        <PricingTeaser />
        <FooterCta />
      </main>
      <footer className="border-t bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} TideeUp. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
