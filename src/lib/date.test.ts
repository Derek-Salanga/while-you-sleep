// Self-check for the two day-boundary conventions in date.ts. No test
// framework in this repo by design -- run it directly:
//
//   node src/lib/date.test.ts
//   TZ=America/Los_Angeles node src/lib/date.test.ts
//   TZ=Asia/Tokyo node src/lib/date.test.ts
//
// The whole point of the split is that the SHARED boundary must not move
// with the device's timezone while the LOCAL one must. Running this under
// several TZs is what actually proves that.

import assert from 'node:assert/strict';
/* eslint-disable no-console */
// The .ts extension is required by Node's ESM resolver when running this
// directly. tsconfig.json excludes *.test.ts for exactly that reason --
// this file is a standalone script, never bundled by Metro.
import {
  formatDateString,
  sharedTodayDateString,
  sharedYesterdayDateString,
  utcTimeToLocal,
} from './date.ts';

// 2026-06-18 20:00 US Pacific == 2026-06-19 03:00 UTC. This is exactly the
// window that broke partners apart: west of UTC, the local calendar day is
// still the 18th while UTC has already rolled to the 19th.
const instant = new Date('2026-06-19T03:00:00Z');

// The shared boundary must be the UTC date for this instant in every
// timezone. If someone "simplifies" sharedTodayDateString into a
// local-components implementation, this fails everywhere west of UTC.
const sharedForInstant = sharedTodayDateString(instant);
assert.equal(
  sharedForInstant,
  '2026-06-19',
  'shared day boundary must be the UTC date, identical on every device'
);
assert.equal(
  sharedYesterdayDateString(instant),
  '2026-06-18',
  'shared yesterday must roll back on the same UTC boundary'
);

// The local convention must track the device instead -- that's what makes a
// date the user picked on a wheel round-trip to the same calendar date.
const localForInstant = formatDateString(instant);
const offsetMinutes = instant.getTimezoneOffset();
const expectedLocal = offsetMinutes >= 180 ? '2026-06-18' : '2026-06-19';
assert.equal(
  localForInstant,
  expectedLocal,
  `local date should follow the device timezone (offset ${offsetMinutes}min)`
);

// A picked date must survive the round trip through formatDateString --
// this is the property that breaks if the local helper is switched to UTC
// (picking June 19 would store June 18 for anyone west of UTC).
const picked = new Date(2026, 5, 19); // local midnight, June 19
assert.equal(
  formatDateString(picked),
  '2026-06-19',
  'a locally-picked calendar date must store as that same date'
);

// The daily reminder is pinned to 20:00 UTC but expo-notifications only
// accepts a device-local hour/minute, so this conversion is what keeps
// the two aligned. Whatever local time it returns must refer back to the
// same instant -- checked here by converting forward and reading the UTC
// hour back off a Date built from the local result.
const reminder = utcTimeToLocal(20, 0, instant);
const roundTrip = new Date(instant);
roundTrip.setHours(reminder.hour, reminder.minute, 0, 0);
assert.equal(
  roundTrip.getUTCHours(),
  20,
  'local reminder time must map back to 20:00 UTC'
);
assert.equal(
  roundTrip.getUTCMinutes(),
  0,
  'local reminder time must map back to :00 -- sub-hour offsets (India ' +
    'UTC+5:30, Nepal UTC+5:45) break if the minute is assumed unchanged'
);

console.log(
  `ok  TZ=${Intl.DateTimeFormat().resolvedOptions().timeZone}  ` +
    `shared=${sharedForInstant}  local=${localForInstant}  ` +
    `reminder=${String(reminder.hour).padStart(2, '0')}:` +
    `${String(reminder.minute).padStart(2, '0')} local`
);
