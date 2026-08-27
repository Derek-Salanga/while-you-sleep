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

// Parses a YYYY-MM-DD string back into a local-midnight Date, falling
// back to "now" for a missing/malformed value rather than ever handing
// a native picker an Invalid Date -- some native date pickers coerce
// that to the Unix epoch instead of erroring, which (west of UTC) shows
// up on screen as Dec 31, 1969.
export function parseDateString(dateStr: string | null | undefined): Date {
  if (dateStr) {
    const parsed = new Date(`${dateStr}T00:00:00`);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}
