// Shared by anything that keys rows per-day (clips, daily answers): a
// plain YYYY-MM-DD string, matching the Postgres `date` columns.
//
// Uses the Date's LOCAL calendar components, not toISOString() (which is
// UTC) — the device's local day is what "today"/"this month" actually
// mean to the user. toISOString() shifts to the wrong day for a multi-
// hour window around local midnight in any timezone not at UTC+0 (e.g.
// 9pm PST is already "tomorrow" in UTC), which matters a lot here since
// the 8pm daily reminder prompts exactly during that window for anyone
// west of UTC.
export function formatDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayDateString(): string {
  return formatDateString(new Date());
}
