import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PaidFeature } from '@/hooks/useFeature';

const FEATURE_COPY: Record<PaidFeature, { title: string; description: string }> = {
  rotation_memory:   { title: 'Rotation memory',    description: "Tracks what you did last week so tasks don't repeat too soon." },
  member_assignment: { title: 'Member assignments', description: 'Assign each task to a specific person in your household.' },
  custom_tasks:      { title: 'Custom tasks',       description: 'Add your own tasks, set frequencies, and adjust times.' },
  season_mode:       { title: 'Season mode',        description: 'Override the season to boost spring-clean or winter tasks.' },
  sunday_email:      { title: 'Weekly email',       description: 'Get your plan in your inbox every Sunday morning.' },
  plan_history:      { title: 'Plan history',       description: "Look back at any previous week's plan." },
};

interface LockedFeatureProps {
  feature: PaidFeature;
  compact?: boolean;
}

export function LockedFeature({ feature, compact = false }: LockedFeatureProps) {
  const copy = FEATURE_COPY[feature];

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
    <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
          <Lock className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold">{copy.title}</p>
          <p className="text-xs text-muted-foreground">{copy.description}</p>
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="w-full text-primary border-primary/30 hover:bg-primary/5">
        <Link href="/pricing">Unlock with Pro — $7/mo</Link>
      </Button>
    </div>
  );
}
