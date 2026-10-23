import Link from 'next/link';
import { Lock, RefreshCw, Users, Mail, SlidersHorizontal, Sun, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PaidFeature } from '@/hooks/useFeature';

const FEATURE_COPY: Record<
  PaidFeature,
  {
    title: string;
    badge: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  rotation_memory: {
    title: 'Rotation memory',
    badge: 'Never repeat deep cleans',
    description:
      'Remembers what you finished this week and automatically rotates biweekly & monthly tasks next Monday.',
    icon: RefreshCw,
  },
  member_assignment: {
    title: 'Family & partner assignments',
    badge: 'Share the load',
    description:
      'Assign any task to a partner or kid in one tap — everyone sees their own list on the dashboard.',
    icon: Users,
  },
  sunday_email: {
    title: 'Sunday morning inbox digest',
    badge: 'Zero mental load',
    description:
      'Wake up every Sunday to a fresh, pre-rotated weekly plan in your email before the week begins.',
    icon: Mail,
  },
  custom_tasks: {
    title: 'Custom tasks & no-go days',
    badge: 'Make it yours',
    description:
      'Add your own household chores, customize frequencies, and block off busy days so nothing is scheduled.',
    icon: SlidersHorizontal,
  },
  season_mode: {
    title: 'Season mode override',
    badge: 'Spring & holiday ready',
    description:
      'Boost spring-cleaning or winter prep tasks whenever your home needs a seasonal reset.',
    icon: Sun,
  },
  plan_history: {
    title: 'Plan history & streaks',
    badge: 'Track your momentum',
    description:
      'Keep a full log of every completed week, hours invested, and your household cleaning streak.',
    icon: History,
  },
};

interface LockedFeatureProps {
  feature: PaidFeature;
  compact?: boolean;
}

export function LockedFeature({ feature, compact = false }: LockedFeatureProps) {
  const copy = FEATURE_COPY[feature];
  const Icon = copy.icon;

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-full px-2.5 py-1">
        <Lock className="w-3 h-3" />
        <span>{copy.title}</span>
        <span className="text-primary font-medium">Pro</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface/80 p-5 space-y-3.5 shadow-sm flex flex-col justify-between">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{copy.title}</p>
              <span className="text-[11px] font-medium text-primary">{copy.badge}</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-pill">
            <Lock className="w-2.5 h-2.5" /> Pro
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{copy.description}</p>
      </div>
      <Button
        asChild
        variant="outline"
        size="sm"
        className="w-full text-primary border-primary/30 hover:bg-primary/5"
      >
        <Link href="/pricing">Unlock with Pro — from $5/mo</Link>
      </Button>
    </div>
  );
}
