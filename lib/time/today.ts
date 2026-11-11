/**
 * The viewer's calendar day and the Monday that starts their week.
 *
 * Plans are stored against calendar dates (week_of is a Monday, YYYY-MM-DD),
 * so "today" has to be read on the viewer's clock. `timeZone` is an IANA name
 * from the browser; anything missing or invalid falls back to UTC.
 */
export function calendarToday(timeZone: string | undefined, now: Date = new Date()): { dateISO: string; dow: number; mondayISO: string } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  }
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // Rebuild the local calendar date as a UTC marker so date maths stays in UTC.
  const local = new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
  const dow = local.getUTCDay();
  const monday = new Date(local);
  monday.setUTCDate(local.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return { dateISO: local.toISOString().slice(0, 10), dow, mondayISO: monday.toISOString().slice(0, 10) };
}
