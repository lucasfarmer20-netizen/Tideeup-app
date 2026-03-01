import { buildWeekPlan } from "../../lib/planner";

type Inputs = { size: "S" | "M" | "L" | "XL"; household: 1 | 2 | 3 | 4 | 5 | 6; pets: boolean; time: 10 | 20 | 30 | "BATCH" };

function decode(input: string): Inputs | null {
  try {
    const b64 = decodeURIComponent(input);
    const json = Buffer.from(b64, "base64").toString("utf-8");
    return JSON.parse(json);
  } catch (e) {
    console.error("Decode failed", e);
    return null;
  }
}

export default async function ResultsPage(
  { searchParams }: { searchParams: Promise<{ s?: string }> }
) {
  const { s } = await searchParams;

  const payload = s ? decode(s) : null;

  if (!payload) {
    return (
      <main className="min-h-screen p-6 flex justify-center">
        <div className="max-w-xl w-full">
          <h1 className="text-2xl font-semibold">No plan found</h1>
          <p className="text-gray-600 mt-2">Go back and generate one from the quiz.</p>
          <a className="inline-block mt-4 underline" href="/quiz">Back to quiz</a>
        </div>
      </main>
    );
  }

  const plan = buildWeekPlan(payload);
  const today = plan.days[0]; // simple v1: Monday as "today" until we add real date logic

  return (
    <main className="min-h-screen p-6 flex justify-center">
      <div className="w-full max-w-3xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-semibold">Your TideeUp week</h1>
          <p className="text-gray-600">
            {payload.size} • household {payload.household} • {payload.time === "BATCH" ? "Batch mode" : `${payload.time} min/day`} • pets {payload.pets ? "yes" : "no"}
          </p>
          <p className="text-sm text-gray-500">Share/bookmark this link to keep the plan.</p>
        </header>

        <section className="rounded-2xl border p-5 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">Today (V1)</h2>
            <span className="text-sm text-gray-500">{today.minutesPlanned}/{today.minutesBudget}m</span>
          </div>
          <ul className="space-y-2">
            {today.tasks.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-4">
                <span>{t.title}</span>
                <span className="text-gray-500 text-sm">{t.baseMinutes}m</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          {plan.days.map((d) => (
            <section key={d.day} className="rounded-2xl border p-5 space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-lg font-semibold">{d.day}</h3>
                <span className="text-sm text-gray-500">{d.minutesPlanned}/{d.minutesBudget}m</span>
              </div>
              <ul className="space-y-2">
                {d.tasks.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-4">
                    <span>{t.title}</span>
                    <span className="text-gray-500 text-sm">{t.baseMinutes}m</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="text-sm text-gray-500">
          Next upgrade: real “today” based on date + rotation memory + spillover tasks instead of dropping overflow.
        </footer>
      </div>
    </main>
  );
}