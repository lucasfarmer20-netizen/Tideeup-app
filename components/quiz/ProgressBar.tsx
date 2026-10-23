import { Progress } from '@/components/ui/progress';

const STEP_LABELS = ['Home size', 'Home details', 'Your household', 'Your time', 'Review'];
// Endowed progress: starting above 0% increases quiz completion rate.
const STEP_PROGRESS = [20, 45, 70, 90, 100];

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  const pct = STEP_PROGRESS[currentStep - 1] ?? 20;
  const label = STEP_LABELS[currentStep - 1] ?? '';
  const isReview = currentStep >= 5;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          {isReview ? (
            'Final step — Review your profile'
          ) : (
            <>
              Question {currentStep} of 4{label ? ` — ${label}` : ''}
            </>
          )}
        </span>
        <span className="text-xs font-medium text-muted-foreground">{pct}%</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}
