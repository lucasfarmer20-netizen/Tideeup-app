import { Progress } from '@/components/ui/progress';

const STEP_LABELS = ['Home size', 'Home details', 'Your household', 'Your time', 'Review'];

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const pct = Math.round(((currentStep - 1) / (totalSteps - 1)) * 100);
  const label = STEP_LABELS[currentStep - 1] ?? '';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          Step {currentStep} of {totalSteps}
          {label ? ` — ${label}` : ''}
        </span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}
