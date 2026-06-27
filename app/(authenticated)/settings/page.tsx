'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client.js';
import { Lock, Plus, X, Trash2 } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Household {
  home_size: string;
  household_count: number;
  pets: boolean;
  kids: boolean;
  time_preference: string;
  members: string[];
  no_go_days: number[];
  season_override: string | null;
}

interface CustomTask {
  id: string;
  title: string;
  zone: string;
  frequency: string;
  estimated_minutes: number;
}

// ─── Shared locked banner ─────────────────────────────────────────────────────

function UpgradeBanner() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
      <Lock className="w-3.5 h-3.5 shrink-0" />
      <span>Pro feature —</span>
      <Link href="/pricing" className="text-primary font-semibold hover:underline">
        Upgrade to Pro
      </Link>
    </div>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold border-b pb-2">{title}</h2>
      {children}
    </section>
  );
}

// ─── Household profile ────────────────────────────────────────────────────────

function HouseholdProfileSection({
  initial,
  isPaid,
  onSaved,
}: {
  initial: Household | null;
  isPaid: boolean;
  onSaved: (h: Household, newPlanId: string | null) => void;
}) {
  const [homeSize, setHomeSize]           = useState(initial?.home_size ?? 'M');
  const [householdCount, setCount]        = useState(String(initial?.household_count ?? 2));
  const [pets, setPets]                   = useState(initial?.pets ?? false);
  const [kids, setKids]                   = useState(initial?.kids ?? false);
  const [timePref, setTimePref]           = useState(() => {
    const raw = initial?.time_preference ?? 'steady';
    if (['quick', 'steady', 'thorough', 'batch'].includes(raw)) return raw;
    if (raw === '10') return 'quick';
    if (raw === '20') return 'steady';
    if (raw === '30') return 'thorough';
    if (raw === 'BATCH') return 'batch';
    return 'steady';
  });
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch('/api/settings/household', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        homeSize,
        householdCount: parseInt(householdCount),
        pets,
        kids,
        timePreference: timePref,
        ...(initial ? {
          members: initial.members,
          noGoDays: initial.no_go_days,
          seasonOverride: initial.season_override,
        } : {}),
      }),
    });

    const data = (await res.json()) as { ok?: boolean; newPlanId?: string | null; message?: string };
    setSaving(false);

    if (!res.ok) { setError(data.message ?? 'Save failed'); return; }

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    onSaved(
      { ...(initial ?? { members: [], no_go_days: [], season_override: null }), home_size: homeSize, household_count: parseInt(householdCount), pets, kids, time_preference: timePref },
      data.newPlanId ?? null,
    );
  }

  const labelClass = 'text-sm font-medium text-foreground';
  const selectClass = 'border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary w-full';

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className={labelClass}>Home size</label>
          <select value={homeSize} onChange={(e) => setHomeSize(e.target.value)} className={selectClass}>
            <option value="S">Small (studio / 1-bed)</option>
            <option value="M">Medium (2–3 bed)</option>
            <option value="L">Large (4 bed)</option>
            <option value="XL">Extra large (5+ bed)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>People in household</label>
          <select value={householdCount} onChange={(e) => setCount(e.target.value)} className={selectClass}>
            {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className={labelClass}>Time per day</label>
          <select value={timePref} onChange={(e) => setTimePref(e.target.value)} className={selectClass}>
            <option value="quick">~15 min/day (Quick)</option>
            <option value="steady">~30 min/day (Steady)</option>
            <option value="thorough">~50 min/day (Thorough)</option>
            <option value="batch">Batch weekends</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={pets} onChange={(e) => setPets(e.target.checked)} className="rounded" />
          Pets
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={kids} onChange={(e) => setKids(e.target.checked)} className="rounded" />
          Kids
        </label>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-primary text-white text-sm font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save & regenerate plan'}
        </button>
        {saved && <span className="text-sm text-primary">Saved! Plan regenerated.</span>}
      </div>
    </form>
  );
}

// ─── Members ──────────────────────────────────────────────────────────────────

function MembersSection({
  members,
  isPaid,
  onChange,
}: {
  members: string[];
  isPaid: boolean;
  onChange: (members: string[]) => void;
}) {
  const [newName, setNewName] = useState('');
  const [saving, setSaving]   = useState(false);

  async function saveMembersToServer(updated: string[]) {
    setSaving(true);
    await fetch('/api/settings/household', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members: updated }),
    }).catch(() => null);
    setSaving(false);
  }

  async function addMember() {
    const name = newName.trim();
    if (!name || members.includes(name)) return;
    const updated = [...members, name];
    setNewName('');
    onChange(updated);
    await saveMembersToServer(updated);
  }

  async function removeMember(name: string) {
    const updated = members.filter((m) => m !== name);
    onChange(updated);
    await saveMembersToServer(updated);
  }

  const content = (
    <div className={`space-y-3 ${!isPaid ? 'opacity-50 pointer-events-none select-none' : ''}`}>
      <p className="text-sm text-muted-foreground">
        Add names for each person in your household. Tasks can be assigned to them on the plan view.
      </p>
      <div className="flex flex-wrap gap-2">
        {members.map((m) => (
          <span key={m} className="flex items-center gap-1.5 text-sm bg-muted rounded-full px-3 py-1">
            {m}
            {isPaid && (
              <button onClick={() => void removeMember(m)} className="text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addMember(); } }}
          placeholder="Add member name…"
          maxLength={50}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary flex-1"
        />
        <button
          onClick={() => void addMember()}
          disabled={!newName.trim() || saving}
          className="flex items-center gap-1 bg-primary text-white text-sm px-3 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {content}
      {!isPaid && <UpgradeBanner />}
    </div>
  );
}

// ─── Custom tasks ─────────────────────────────────────────────────────────────

const ZONES = ['kitchen', 'bathroom', 'bedroom', 'living', 'outdoor', 'laundry', 'general'] as const;
const FREQS = ['daily', 'weekly', 'monthly'] as const;

function CustomTasksSection({
  tasks,
  isPaid,
  onChange,
}: {
  tasks: CustomTask[];
  isPaid: boolean;
  onChange: (tasks: CustomTask[]) => void;
}) {
  const [title, setTitle]       = useState('');
  const [zone, setZone]         = useState<string>('kitchen');
  const [freq, setFreq]         = useState<string>('weekly');
  const [minutes, setMinutes]   = useState('15');
  const [adding, setAdding]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function addTask() {
    const mins = parseInt(minutes);
    if (!title.trim() || isNaN(mins) || mins < 1) return;
    setAdding(true);
    setError(null);

    const res = await fetch('/api/settings/custom-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), zone, frequency: freq, estimatedMinutes: mins }),
    });

    const data = (await res.json()) as { task?: CustomTask; message?: string };
    setAdding(false);

    if (!res.ok) { setError(data.message ?? 'Failed to add task'); return; }
    if (data.task) {
      onChange([...tasks, data.task]);
      setTitle('');
      setMinutes('15');
    }
  }

  async function removeTask(id: string) {
    await fetch(`/api/settings/custom-tasks/${id}`, { method: 'DELETE' });
    onChange(tasks.filter((t) => t.id !== id));
  }

  const selectClass = 'border rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary';

  const content = (
    <div className={`space-y-3 ${!isPaid ? 'opacity-50 pointer-events-none select-none' : ''}`}>
      <p className="text-sm text-muted-foreground">
        Add tasks unique to your home. They merge with the standard library when generating plans.
      </p>
      {tasks.length > 0 && (
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-sm border rounded-lg px-3 py-2">
              <div>
                <span className="font-medium">{t.title}</span>
                <span className="text-muted-foreground ml-2 text-xs">{t.zone} · {t.frequency} · {t.estimated_minutes}m</span>
              </div>
              {isPaid && (
                <button onClick={() => void removeTask(t.id)} className="text-muted-foreground hover:text-destructive ml-2">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title…"
          maxLength={100}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full"
        />
        <div className="flex flex-wrap gap-2">
          <select value={zone} onChange={(e) => setZone(e.target.value)} className={selectClass}>
            {ZONES.map(z => <option key={z} value={z}>{z.charAt(0).toUpperCase() + z.slice(1)}</option>)}
          </select>
          <select value={freq} onChange={(e) => setFreq(e.target.value)} className={selectClass}>
            {FREQS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
          </select>
          <input
            type="number"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            min={1}
            max={480}
            className="border rounded-lg px-2 py-1.5 text-sm w-20 focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="min"
          />
          <button
            onClick={() => void addTask()}
            disabled={adding || !title.trim()}
            className="flex items-center gap-1 bg-primary text-white text-sm px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );

  return (
    <div>
      {content}
      {!isPaid && <UpgradeBanner />}
    </div>
  );
}

// ─── No-go days ───────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function NoGoDaysSection({
  noGoDays,
  isPaid,
  onChange,
}: {
  noGoDays: number[];
  isPaid: boolean;
  onChange: (days: number[]) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function toggle(day: number) {
    const updated = noGoDays.includes(day)
      ? noGoDays.filter((d) => d !== day)
      : [...noGoDays, day];
    onChange(updated);
    setSaving(true);
    await fetch('/api/settings/household', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noGoDays: updated }),
    }).catch(() => null);
    setSaving(false);
  }

  const content = (
    <div className={`space-y-3 ${!isPaid ? 'opacity-50 pointer-events-none select-none' : ''}`}>
      <p className="text-sm text-muted-foreground">
        Select days where no cleaning tasks should be scheduled.
      </p>
      <div className="flex flex-wrap gap-2">
        {DAY_LABELS.map((label, i) => {
          const active = noGoDays.includes(i);
          return (
            <button
              key={i}
              onClick={() => void toggle(i)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                active
                  ? 'bg-primary/10 border-primary text-primary font-medium'
                  : 'border-muted-foreground/20 text-muted-foreground hover:border-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
    </div>
  );

  return (
    <div>
      {content}
      {!isPaid && <UpgradeBanner />}
    </div>
  );
}

// ─── Season mode ──────────────────────────────────────────────────────────────

function SeasonSection({
  seasonOverride,
  isPaid,
  onChange,
}: {
  seasonOverride: string | null;
  isPaid: boolean;
  onChange: (val: string | null) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  async function handleChange(val: string | null) {
    onChange(val);
    setSaving(true);
    await fetch('/api/settings/household', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonOverride: val }),
    }).catch(() => null);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const content = (
    <div className={`space-y-3 ${!isPaid ? 'opacity-50 pointer-events-none select-none' : ''}`}>
      <p className="text-sm text-muted-foreground">
        Override the automatic season detection to boost specific task types.
      </p>
      <div className="flex flex-wrap gap-2">
        {([null, 'spring', 'summer', 'fall', 'winter'] as (string | null)[]).map((s) => {
          const label = s === null ? 'Auto' : s.charAt(0).toUpperCase() + s.slice(1);
          const active = seasonOverride === s;
          return (
            <button
              key={String(s)}
              onClick={() => void handleChange(s)}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                active
                  ? 'bg-primary/10 border-primary text-primary font-medium'
                  : 'border-muted-foreground/20 text-muted-foreground hover:border-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {seasonOverride
          ? `Active: ${seasonOverride.charAt(0).toUpperCase() + seasonOverride.slice(1)} mode — tasks weighted for this season.`
          : 'Auto — season detected from today\'s date.'}
        {saving && ' Saving…'}
        {saved && !saving && ' Saved.'}
      </p>
    </div>
  );

  return (
    <div>
      {content}
      {!isPaid && <UpgradeBanner />}
    </div>
  );
}

// ─── Danger zone ──────────────────────────────────────────────────────────────

function DangerZone() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch('/api/user/delete', { method: 'DELETE' });
      if (!res.ok) {
        setDeleting(false);
        return;
      }
    } catch {
      setDeleting(false);
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Permanently delete your account and all data. This cannot be undone.
      </p>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="text-sm text-destructive border border-destructive/30 rounded-lg px-4 py-2 hover:bg-destructive/5 transition-colors"
        >
          Delete account
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Are you sure? This is permanent.</p>
          <div className="flex gap-2">
            <button
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="text-sm bg-destructive text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Yes, delete my account'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-sm border rounded-lg px-4 py-2 hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [household, setHousehold]     = useState<Household | null>(null);
  const [customTasks, setCustomTasks] = useState<CustomTask[]>([]);
  const [isPaid, setIsPaid]           = useState(false);
  const [loading, setLoading]         = useState(true);

  const load = useCallback(async () => {
    const res = await fetch('/api/settings/profile');
    if (!res.ok) return;
    const data = (await res.json()) as {
      household: Household | null;
      customTasks: CustomTask[];
      isPaid: boolean;
    };
    setHousehold(data.household);
    setCustomTasks(data.customTasks);
    setIsPaid(data.isPaid);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your household, tasks, and preferences.</p>
      </div>

      <Section title="Household profile">
        <HouseholdProfileSection
          initial={household}
          isPaid={isPaid}
          onSaved={(h, _planId) => setHousehold(h)}
        />
      </Section>

      <Section title="Household members">
        <MembersSection
          members={household?.members ?? []}
          isPaid={isPaid}
          onChange={(members) => setHousehold((h) => h ? { ...h, members } : h)}
        />
      </Section>

      <Section title="Custom tasks">
        <CustomTasksSection
          tasks={customTasks}
          isPaid={isPaid}
          onChange={setCustomTasks}
        />
      </Section>

      <Section title="No-go days">
        <NoGoDaysSection
          noGoDays={household?.no_go_days ?? []}
          isPaid={isPaid}
          onChange={(days) => setHousehold((h) => h ? { ...h, no_go_days: days } : h)}
        />
      </Section>

      <Section title="Season mode">
        <SeasonSection
          seasonOverride={household?.season_override ?? null}
          isPaid={isPaid}
          onChange={(val) => setHousehold((h) => h ? { ...h, season_override: val } : h)}
        />
      </Section>

      <Section title="Danger zone">
        <DangerZone />
      </Section>
    </main>
  );
}
