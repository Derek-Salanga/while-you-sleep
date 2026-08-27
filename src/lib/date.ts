// There are two different notions of "a day" in this app, and mixing
// them up causes real bugs — keep them separate:
//
// 1. A calendar date the USER PICKED on a wheel (trip date, anniversary)
//    -> formatDateString / todayDateString, which use LOCAL components.
//    Picking "June 19" must store "2026-06-19" regardless of the
//    device's UTC offset, so these must never go through toISOString().
//
// 2. The SHARED day boundary both partners key off (which question is
//    today's, which day a clip counts for) -> sharedTodayDateString(),
//    which is UTC. See its comment below.

// LOCAL calendar components — see (1) above.
export function formatDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Local "today". Used for comparing against a user-picked date (is this
// trip in the past? is this anniversary in the future?) and for
// countdowns off those dates — all of which should feel local.
export function todayDateString(): string {
  return formatDateString(new Date());
}

// The pair's shared day boundary, in UTC — see (2) above.
//
// This has to be the same instant for both partners, or a pair spanning
// timezones sits in a window where each side is on a different calendar
// day: they'd be served *different* daily questions, and their clips
// would land under different `recorded_for_date` values instead of
// pairing up as answers to each other. UTC is the one clock every device
// already agrees on without adding a per-pair timezone anchor (schema
// and UI neither of which exist yet — `profiles.timezone` is unused).
//
// Tradeoff: UTC midnight is an odd local hour for most people, and for
// anyone far enough west the 8pm local reminder fires *after* the UTC
// day has already rolled over. Accepted deliberately; the alternative is
// per-pair anchor infrastructure nobody has asked for.
// `now` is injectable only so the self-check can pin a fixed instant —
// callers should omit it.
export function sharedTodayDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// Yesterday on the same shared (UTC) boundary — for humanizing stored
// clip dates, which are stamped with sharedTodayDateString().
export function sharedYesterdayDateString(now: Date = new Date()): string {
  return new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
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
