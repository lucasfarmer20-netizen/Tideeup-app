'use client';

import { useState } from 'react';
import { Sparkles, Check, Clock } from 'lucide-react';

const PREVIEW_DAYS = [
  {
    day: 'Mon',
    zone: 'Kitchen',
    minutes: '25m',
    tint: 'bg-[#F3E2D6] text-[#9A4F2E]',
    tasks: [
      { id: 'mon-1', title: 'Wipe counters & stovetop', defaultDone: true },
      { id: 'mon-2', title: 'Run & empty dishwasher', defaultDone: true },
      { id: 'mon-3', title: 'Sweep kitchen floor', defaultDone: false },
    ],
  },
  {
    day: 'Wed',
    zone: 'Bathroom',
    minutes: '30m',
    tint: 'bg-[#DEE7D7] text-[#566B43]',
    tasks: [
      { id: 'wed-1', title: 'Scrub sink & toilet', defaultDone: true },
      { id: 'wed-2', title: 'Swap hand & bath towels', defaultDone: false },
    ],
  },
  {
    day: 'Sat',
    zone: 'Living',
    minutes: '35m',
    tint: 'bg-[#DCE6DD] text-[#4F6B57]',
    tasks: [
      { id: 'sat-1', title: 'Vacuum rugs & sofa', defaultDone: false },
      { id: 'sat-2', title: 'Dust shelves & surfaces', defaultDone: false },
      { id: 'sat-3', title: '10-minute toy & clutter reset', defaultDone: false },
    ],
  },
];

const ALL_TASKS = PREVIEW_DAYS.flatMap((d) => d.tasks);

export function SampleWeekPreview() {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set(ALL_TASKS.filter((t) => t.defaultDone).map((t) => t.id)),
  );

  function toggleTask(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const doneCount = checkedIds.size;
  const totalCount = ALL_TASKS.length;
  const pct = Math.round((doneCount / totalCount) * 100);

  return (
    <div className="relative">
      {/* Decorative badge */}
      <div
        aria-hidden
        className="absolute -top-6 -right-4 hidden lg:flex items-center justify-center w-16 h-16 rounded-full bg-sage/25 text-2xl rotate-6 shadow-sm"
      >
        🐦
      </div>

      <div className="rounded-2xl border bg-surface shadow-lg p-5 space-y-4 animate-scale-in">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Sample 7-day plan · Tap a task to try</p>
            <p className="font-heading font-semibold text-foreground">This Week&apos;s Schedule</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-pill">
            <Sparkles className="w-3.5 h-3.5" /> Steady pace
          </div>
        </div>

        <div className="space-y-2.5">
          {PREVIEW_DAYS.map((d) => (
            <div key={d.day} className="rounded-xl border bg-background/60 p-3">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold w-9">{d.day}</span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-pill ${d.tint}`}>
                    {d.zone}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {d.minutes}
                </span>
              </div>
              <ul className="space-y-1.5">
                {d.tasks.map((t) => {
                  const isDone = checkedIds.has(t.id);
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => toggleTask(t.id)}
                        className="w-full flex items-center gap-2 text-xs text-left group py-0.5 focus:outline-none"
                      >
                        <span
                          className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${
                            isDone
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-muted-foreground/40 group-hover:border-primary'
                          }`}
                        >
                          {isDone && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                        </span>
                        <span
                          className={`transition-colors ${
                            isDone
                              ? 'line-through text-muted-foreground'
                              : 'text-foreground/90 group-hover:text-foreground'
                          }`}
                        >
                          {t.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2.5 pt-1">
          <div className="h-2 flex-1 rounded-pill bg-muted overflow-hidden">
            <div
              className="h-full rounded-pill bg-primary transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground shrink-0">
            {doneCount}/{totalCount} done ({pct}%)
          </span>
        </div>
      </div>
    </div>
  );
}
