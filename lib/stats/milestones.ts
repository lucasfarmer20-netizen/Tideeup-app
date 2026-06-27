/**
 * Streak milestone copy for the dashboard progress layer (LTV task 2).
 * Returns an encouraging callout for the current streak, or null below the
 * first milestone.
 */
export function streakMilestone(currentStreak: number): string | null {
  if (currentStreak >= 52) return 'A full year — legendary consistency 🏆';
  if (currentStreak >= 26) return '26 weeks — half a year strong 💪';
  if (currentStreak >= 12) return "12 weeks — you're in the top 10% of households!";
  if (currentStreak >= 8) return '8 weeks — two months of momentum 🔥';
  if (currentStreak >= 4) return '4 weeks — a full month, habit locked in ✨';
  if (currentStreak >= 2) return `${currentStreak} weeks in a row — keep it going!`;
  return null;
}

/** Format minutes as a compact "Xh Ym" / "Ym" string. */
export function formatHours(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
