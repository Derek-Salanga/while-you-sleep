// Shared by anything that keys rows per-day (clips, daily answers): a
// plain YYYY-MM-DD string, matching the Postgres `date` columns.
export function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}
