import { TASKS, Task, Frequency } from "./tasks";

export type SizeTier = "S" | "M" | "L" | "XL";
export type TimeTier = 10 | 20 | 30 | "BATCH";

export type Inputs = {
  size: SizeTier;
  household: 1 | 2 | 3 | 4 | 5 | 6;
  pets: boolean;
  time: TimeTier;
};

export type DayPlan = {
  day: string;         // Mon..Sun
  minutesBudget: number;
  minutesPlanned: number;
  tasks: Task[];
};

export type WeekPlan = {
  inputs: Inputs;
  days: DayPlan[];
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY_ZONE_ANCHOR: Record<string, string> = {
  Mon: "kitchen",
  Tue: "bathroom",
  Wed: "floors",
  Thu: "bedrooms",
  Fri: "laundry",
  Sat: "general",
  Sun: "general",
};

function baseBudget(time: TimeTier): number {
  if (time === "BATCH") return 20; // weekdays baseline; weekend gets extra below
  return time;
}

function weekendBoost(time: TimeTier): number {
  if (time === "BATCH") return 60; // big blocks on Sat/Sun
  return 0;
}

function intensityMultiplier(size: SizeTier, household: number, pets: boolean): number {
  const sizeM = size === "S" ? 0.9 : size === "M" ? 1.0 : size === "L" ? 1.15 : 1.3;
  const hhM = household <= 2 ? 1.0 : household === 3 ? 1.08 : household === 4 ? 1.16 : household === 5 ? 1.24 : 1.32;
  const petM = pets ? 1.08 : 1.0;
  return sizeM * hhM * petM;
}

function scoreTask(t: Task, pets: boolean): number {
  const petBonus = pets && t.petBoost ? t.petBoost : 0;
  // prioritize chaosImpact, penalize fatigue a bit
  return (t.chaosImpact + petBonus) - t.fatigueCost * 0.35;
}

function scaledMinutes(t: Task, mult: number): number {
  // keep minutes bounded so things don’t get insane
  const raw = Math.round(t.baseMinutes * mult);
  const min = Math.max(1, Math.round(t.baseMinutes * 0.85));
  const max = Math.round(t.baseMinutes * 1.8);
  return Math.min(Math.max(raw, min), max);
}

function quickenTask(t: Task, mins: number): Task {
  return { ...t, title: `${t.title} (quick)`, baseMinutes: mins };
}

function withMinutes(t: Task, minutes: number): Task {
  // We’ll store planned minutes in baseMinutes for display (keeps changes minimal)
  return { ...t, baseMinutes: minutes };
}

function quickMinutes(full: number, time: TimeTier): number {
  // Must fit tight budgets:
  // 10-min days need micro chunks
  // 20-min days need 6-min chunks
  if (time === 10) return Math.min(full, 4);
  if (time === 20) return Math.min(full, 6);

  // 30 / BATCH can handle bigger chunks
  if (full <= 10) return Math.max(6, Math.round(full * 0.75));
  if (full <= 18) return 8;
  return 10;
}

export function buildWeekPlan(inputs: Inputs): WeekPlan {
  const mult = intensityMultiplier(inputs.size, inputs.household, inputs.pets);

  const days: DayPlan[] = DAYS.map((d) => {
    let budget = baseBudget(inputs.time);
    if (d === "Sat" || d === "Sun") budget += weekendBoost(inputs.time);
    return { day: d, minutesBudget: budget, minutesPlanned: 0, tasks: [] };
  });

  const mustDo = TASKS.filter((t) => t.mustDo && t.frequency === "daily");

  // Gate pet-only tasks if you added requiresPets in tasks.ts
  const allowed = TASKS.filter((t) => !(t as any).requiresPets || inputs.pets);

  const weekly = allowed.filter((t) => t.frequency === "weekly");
  const monthly = allowed.filter((t) => t.frequency === "monthly");

  // 1) Place daily stabilizers on every day
  for (const day of days) {
    for (const t of mustDo) {
      const mins = scaledMinutes(t, Math.min(mult, 1.25));
      if (day.minutesPlanned + mins <= day.minutesBudget) {
        day.tasks.push({ ...t, baseMinutes: mins });
        day.minutesPlanned += mins;
      }
    }
  }

  function withMinutes(t: Task, minutes: number): Task {
    return { ...t, baseMinutes: minutes };
  }

  function quickMinutes(full: number): number {
    if (full <= 10) return Math.max(6, Math.round(full * 0.75));
    if (full <= 18) return 8;
    return 10;
  }

  // 2) Distribute weekly tasks by score (with zone anchoring + quick chunks)
  const weeklySorted = [...weekly].sort(
    (a, b) => scoreTask(b, inputs.pets) - scoreTask(a, inputs.pets)
  );

  for (const t of weeklySorted) {
    const fullMins = scaledMinutes(t, mult);

    const rankedDays = [...days].sort((a, b) => {
      const anchorA = DAY_ZONE_ANCHOR[a.day];
      const anchorB = DAY_ZONE_ANCHOR[b.day];

      const zoneLoadA = a.tasks.filter(task => task.zone === t.zone).length;
      const zoneLoadB = b.tasks.filter(task => task.zone === t.zone).length;

      const matchA = t.zone === anchorA ? 25 : 0;
      const matchB = t.zone === anchorB ? 25 : 0;

      const zonePenaltyA = zoneLoadA * 10;
      const zonePenaltyB = zoneLoadB * 10;

      const remainingA = a.minutesBudget - a.minutesPlanned;
      const remainingB = b.minutesBudget - b.minutesPlanned;

      return (matchB + remainingB - zonePenaltyB) -
     (matchA + remainingA - zonePenaltyA);
    });

    // Try full task
    const fullDay = rankedDays.find(
      (d) => d.minutesPlanned + fullMins <= d.minutesBudget
    );
    if (fullDay) {
      fullDay.tasks.push(withMinutes(t, fullMins));
      fullDay.minutesPlanned += fullMins;
      continue;
    }

    // Otherwise schedule quick chunk
    const qMins = quickMinutes(fullMins, inputs.time);

    const minChunk = inputs.time === 10 ? 4 : 6;
    const quickDay = rankedDays.find(d => (d.minutesBudget - d.minutesPlanned) >= Math.min(qMins, minChunk));

    if (quickDay) {
      const remaining = quickDay.minutesBudget - quickDay.minutesPlanned;
      const actual = Math.min(remaining, qMins);

      quickDay.tasks.push(
        withMinutes({ ...t, title: `${t.title} (quick)` }, actual)
      );
      quickDay.minutesPlanned += actual;
    }
  }

  // 3) Add up to 2 monthly tasks on weekend if budget allows (also quick-chunkable)
  const monthlySorted = [...monthly].sort(
    (a, b) => scoreTask(b, inputs.pets) - scoreTask(a, inputs.pets)
  );

  for (const t of monthlySorted.slice(0, 2)) {
    const fullMins = scaledMinutes(t, mult);

    const weekendDays = days.filter((d) => d.day === "Sat" || d.day === "Sun");
    const weekendRanked = [...weekendDays].sort(
      (a, b) =>
        (b.minutesBudget - b.minutesPlanned) - (a.minutesBudget - a.minutesPlanned)
    );

    const fullDay = weekendRanked.find(
      (d) => d.minutesPlanned + fullMins <= d.minutesBudget
    );
    if (fullDay) {
      fullDay.tasks.push(withMinutes(t, fullMins));
      fullDay.minutesPlanned += fullMins;
      continue;
    }

    const qMins = quickMinutes(fullMins);
    const quickDay = weekendRanked.find(
      (d) => d.minutesBudget - d.minutesPlanned >= qMins
    );
    if (quickDay) {
      const remaining = quickDay.minutesBudget - quickDay.minutesPlanned;
      const actual = Math.min(remaining, qMins);

      quickDay.tasks.push(
        withMinutes({ ...t, title: `${t.title} (quick)` }, actual)
      );
      quickDay.minutesPlanned += actual;
    }
  }

  return { inputs, days };
}