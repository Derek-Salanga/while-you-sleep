// The two day-boundary conventions in date.ts, under Jest.
//
// The whole point of the split is that the SHARED boundary must not move
// with the device's timezone while the LOCAL one must. `npm test` runs this
// file once per TZ (see the "test" script in package.json) -- that's what
// actually proves the split holds, since Node/V8 read TZ once per process
// rather than reliably picking up a mid-run change.

import {
  formatDateString,
  sharedTodayDateString,
  sharedYesterdayDateString,
  utcTimeToLocal,
  daysBetween,
} from './date';

// 2026-06-18 20:00 US Pacific == 2026-06-19 03:00 UTC. This is exactly the
// window that broke partners apart: west of UTC, the local calendar day is
// still the 18th while UTC has already rolled to the 19th.
const instant = new Date('2026-06-19T03:00:00Z');

test('shared day boundary is the UTC date, identical on every device', () => {
  // If someone "simplifies" sharedTodayDateString into a local-components
  // implementation, this fails everywhere west of UTC.
  expect(sharedTodayDateString(instant)).toBe('2026-06-19');
});

test('shared yesterday rolls back on the same UTC boundary', () => {
  expect(sharedYesterdayDateString(instant)).toBe('2026-06-18');
});

test('local date follows the device timezone', () => {
  // The local convention must track the device instead -- that's what makes
  // a date the user picked on a wheel round-trip to the same calendar date.
  const offsetMinutes = instant.getTimezoneOffset();
  const expectedLocal = offsetMinutes >= 180 ? '2026-06-18' : '2026-06-19';
  expect(formatDateString(instant)).toBe(expectedLocal);
});

test('a locally-picked calendar date stores as that same date', () => {
  // This is the property that breaks if the local helper is switched to
  // UTC (picking June 19 would store June 18 for anyone west of UTC).
  const picked = new Date(2026, 5, 19); // local midnight, June 19
  expect(formatDateString(picked)).toBe('2026-06-19');
});

test('utcTimeToLocal maps back to the same UTC instant', () => {
  // The daily reminder is pinned to 20:00 UTC but expo-notifications only
  // accepts a device-local hour/minute, so this conversion is what keeps
  // the two aligned. Whatever local time it returns must refer back to the
  // same instant -- checked here by converting forward and reading the UTC
  // hour/minute back off a Date built from the local result.
  const reminder = utcTimeToLocal(20, 0, instant);
  const roundTrip = new Date(instant);
  roundTrip.setHours(reminder.hour, reminder.minute, 0, 0);
  expect(roundTrip.getUTCHours()).toBe(20);
  // Sub-hour offsets (India UTC+5:30, Nepal UTC+5:45) break this if the
  // minute is assumed unchanged.
  expect(roundTrip.getUTCMinutes()).toBe(0);
});

describe('daysBetween', () => {
  // Feeds the trip countdown and the "days together" counter, both of which
  // the user reads against their own calendar. The Math.round in the
  // implementation is load-bearing, not cosmetic: across a DST transition
  // the elapsed milliseconds are not a whole multiple of 86400000, so
  // truncating would under- or over-count by a day for anyone in a
  // DST-observing zone.
  test('one day forward', () => {
    expect(daysBetween('2026-06-18', '2026-06-19')).toBe(1);
  });

  test('one day back', () => {
    expect(daysBetween('2026-06-19', '2026-06-18')).toBe(-1);
  });

  test('same day is zero', () => {
    expect(daysBetween('2026-06-18', '2026-06-18')).toBe(0);
  });

  test('spans the US spring-forward transition (23h local day) without losing a day', () => {
    // 2026-03-08 is the US spring-forward date.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });

  test('spans the US fall-back transition (25h local day) without gaining a day', () => {
    // 2026-11-01 is the US fall-back date.
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });

  test('a full non-leap year', () => {
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
  });
});
