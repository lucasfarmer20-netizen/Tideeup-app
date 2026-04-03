import type { Metadata } from 'next';
import { QuizShell } from '@/components/quiz/QuizShell';

export const metadata: Metadata = {
  title: 'Build your plan',
  description: 'Answer 4 quick questions and get a personalized weekly cleaning plan for your home.',
};

export default function QuizPage() {
  return <QuizShell />;
}
