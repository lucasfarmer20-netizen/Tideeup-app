import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unsubscribeUrl, unsubscribeUser } from '../unsubscribe';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ from: vi.fn(), send: vi.fn() }));
vi.mock('@/lib/supabase/server.js', () => ({ createAdminClient: () => ({ from: mocks.from }) }));
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => ({ from: mocks.from }) }));
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.send }; } }));
import { GET as digest } from '../../../app/api/cron/sunday-email/route';
import { GET as confirm, POST as unsubscribe } from '../../../app/unsubscribe/[token]/route';
const id = '00000000-0000-4000-8000-000000000001';
const planId = '00000000-0000-4000-8000-000000000002';
const user = { id, email: 'synthetic@example.invalid' };
type Result = { data?: unknown; error?: unknown; count?: number | null };
let calls: { table: string; method: string; args: unknown[] }[];
function database(queues: Record<string, Result[]>) {
  mocks.from.mockImplementation((table: string) => {
    const result = queues[table]?.shift();
    if (!result) throw Error('Unexpected query: ' + table);
    const query: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'neq', 'order', 'limit', 'insert', 'update']) {
      query[method] = (...args: unknown[]) => { calls.push({ table, method, args }); return query; };
    }
    query.single = query.maybeSingle = () => Promise.resolve(result);
    query.then = (resolve: (r: Result) => unknown) => Promise.resolve(result).then(resolve);
    return query;
  });
}
function fixture(options: { lastWeek?: string; count?: number | null; prior?: boolean; suppressed?: boolean; queryError?: boolean } = {}) {
  database({
    users: [{ data: [user] }, { data: { email_status: options.suppressed ? 'unsubscribed' : 'sent' } }],
    households: [{ data: { home_size: 'M', household_count: 2, pets: false, kids: false, time_preference: 'steady' } }],
    streaks: [{ data: { current_streak: 2, last_completed_week: options.lastWeek ?? '2026-11-02' } }],
    plans: [{ data: options.prior === false ? null : { id: planId, week_plan: { days: [{ tasks: [{}, {}] }] } } }, { data: { id: planId } }],
    task_completions: [{ count: options.count === undefined ? 2 : options.count, error: options.queryError ? { message: 'failure' } : null }],
    email_events: [{ data: null }],
  });
}
const request = () => new Request('https://example.invalid/api/cron/sunday-email', { headers: { authorization: 'Bearer synthetic-key' } });
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-08T16:00:00Z'));
  vi.stubEnv('CRON_SECRET', 'synthetic-key'); vi.stubEnv('RESEND_API_KEY', 'synthetic-provider'); vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://example.invalid');
  calls = []; mocks.from.mockReset(); mocks.send.mockReset().mockResolvedValue({ error: null });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
describe('weekly digest regressions', () => {
  it('uses a real signed unsubscribe URL, not the plan URL', async () => {
    fixture(); expect((await digest(request())).status).toBe(200);
    const html = mocks.send.mock.calls[0]?.[0].html as string;
    expect(html).toContain(`${unsubscribeUrl('https://example.invalid', id, 'synthetic-key')}" style="color:#0D9488;">Unsubscribe`);
    expect(html).toContain('2-week streak');
    expect(calls).toContainEqual({ table: 'users', method: 'neq', args: ['email_status', 'unsubscribed'] });
    expect(calls).toContainEqual({ table: 'plans', method: 'eq', args: ['week_of', '2026-11-02'] });
  });
  it.each([{ count: 0 }, { lastWeek: '2026-10-26' }, { prior: false }, { queryError: true }])('does not advertise an unsupported streak: %j', async options => {
    fixture(options); await digest(request());
    expect(mocks.send).toHaveBeenCalledOnce();
    const html = mocks.send.mock.calls[0]?.[0].html as string;
    expect(html).not.toContain('2-week streak');
    if ('queryError' in options || 'prior' in options) expect(html).not.toContain('Last week you completed');
    if ('count' in options) expect(html).toContain('Last week you completed 0%');
  });
  it('skips recipients who unsubscribe during generation', async () => {
    fixture({ suppressed: true }); const response = await digest(request());
    expect(await response.json()).toEqual({ processed: 0, skipped: 1, errors: 0 }); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('does no work for an empty eligible recipient list or unauthorized cron', async () => {
    database({ users: [{ data: [] }] }); await digest(request()); expect(mocks.send).not.toHaveBeenCalled();
    mocks.from.mockClear(); expect((await digest(new Request('https://example.invalid'))).status).toBe(401); expect(mocks.from).not.toHaveBeenCalled();
  });
});
describe('unsubscribe capability and confirmation', () => {
  const token = () => new URL(unsubscribeUrl('https://example.invalid', id, 'synthetic-key')).pathname.split('/').pop() as string;
  const context = (value = token()) => ({ params: Promise.resolve({ token: value }) });
  it('GET confirms without changing preferences or requiring login', async () => {
    const r = await confirm(new Request('https://example.invalid'), context()); expect(r.status).toBe(200);
    expect(await r.text()).toContain('<form method="post">'); expect(mocks.from).not.toHaveBeenCalled(); expect(r.headers.get('cache-control')).toBe('no-store');
  });
  it('POST changes only the signed recipient preference, and is repeatable', async () => {
    database({ users: [{ data: { id } }, { data: { id } }] });
    for (let i = 0; i < 2; i++) expect((await unsubscribe(new Request('https://example.invalid', { method: 'POST' }), context())).status).toBe(200);
    expect(calls).toContainEqual({ table: 'users', method: 'eq', args: ['id', id] });
    expect(calls).toContainEqual({ table: 'users', method: 'update', args: [{ email_status: 'unsubscribed' }] });
  });
  it('rejects tampered identity, signature, missing key and rotated key', async () => {
    const t = token();
    for (const bad of [t.replace(id, planId), t.slice(0, -1), 'invalid']) {
      expect((await unsubscribe(new Request('https://example.invalid', { method: 'POST' }), context(bad))).status).toBe(400);
    }
    expect(unsubscribeUser(t, undefined)).toBeNull(); expect(unsubscribeUser(t, 'rotated-key')).toBeNull(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it('does not claim success on a database error or missing recipient', async () => {
    database({ users: [{ error: { message: 'failure' } }, { data: null }] });
    for (let i = 0; i < 2; i++) expect((await unsubscribe(new Request('https://example.invalid', { method: 'POST' }), context())).status).toBe(503);
  });
});
