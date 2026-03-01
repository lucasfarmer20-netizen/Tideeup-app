"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function QuizPage() {
  const router = useRouter();

  const [size, setSize] = useState<"S" | "M" | "L" | "XL">("M");
  const [household, setHousehold] = useState<1 | 2 | 3 | 4 | 5 | 6>(2);
  const [time, setTime] = useState<10 | 20 | 30 | "BATCH">(20);
  const [pets, setPets] = useState(false);

  const payload = useMemo(() => ({ size, household, time, pets }), [size, household, time, pets]);

  function onSubmit() {
    const encoded = encodeURIComponent(btoa(JSON.stringify(payload)));
    router.push(`/results?s=${encoded}`);
  }

  return (
    <main className="min-h-screen p-6 flex justify-center">
      <div className="w-full max-w-xl space-y-6">
        <h1 className="text-3xl font-semibold">Build your TideeUp plan</h1>
        <p className="text-gray-600">
          Quick inputs → a weekly plan that stays inside your time budget.
        </p>

        <div className="space-y-4 rounded-2xl border p-5">
          <label className="block">
            <div className="font-medium">Home size</div>
            <select className="mt-2 w-full rounded-xl border p-3" value={size} onChange={(e) => setSize(e.target.value as any)}>
              <option value="S">S</option>
              <option value="M">M</option>
              <option value="L">L</option>
              <option value="XL">XL</option>
            </select>
          </label>

          <label className="block">
            <div className="font-medium">Household size</div>
            <select className="mt-2 w-full rounded-xl border p-3" value={household} onChange={(e) => setHousehold(Number(e.target.value) as any)}>
              {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>

          <label className="block">
            <div className="font-medium">Time budget</div>
            <select className="mt-2 w-full rounded-xl border p-3" value={time} onChange={(e) => setTime((e.target.value === "BATCH" ? "BATCH" : Number(e.target.value)) as any)}>
              <option value={10}>10 min/day</option>
              <option value={20}>20 min/day</option>
              <option value={30}>30 min/day</option>
              <option value={"BATCH"}>Batch mode (weekend blocks)</option>
            </select>
          </label>

          <label className="flex items-center gap-3">
            <input type="checkbox" checked={pets} onChange={(e) => setPets(e.target.checked)} />
            <span className="font-medium">Pets</span>
          </label>

          <button onClick={onSubmit} className="w-full rounded-2xl bg-black text-white py-3 font-semibold">
            Generate my plan
          </button>

          <p className="text-xs text-gray-500">
            This is V1. Next we’ll add floors, bathrooms, and “chaos zones.”
          </p>
        </div>
      </div>
    </main>
  );
}