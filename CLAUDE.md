# While You Sleep

A private, video-first daily diary app for long-distance couples. Each
partner drops a short daily video clip; the other partner unlocks and
watches it. Full concept, naming research, icon design, and color
palette are documented in the original project brief (not in this repo
by default — ask the user if design rationale is needed).

## Tech stack

- React Native / Expo — **pinned to SDK 54** (see "SDK version notes"
  below before touching any Expo package version)
- TypeScript
- Supabase: Auth (email OTP), Postgres with Row Level Security, Storage
- TanStack Query (`@tanstack/react-query` v5) as the data layer — see
  "Data layer" below. Partially adopted: some screens still query
  Supabase inline.
- React Navigation (native stack)
- expo-camera for recording, expo-video for playback (not expo-av —
  deprecated in this SDK range)
- expo-notifications for the daily question/clip reminders — local
  on-device scheduling only, no push-token/server infra
- ESLint (`eslint-config-expo` + `eslint-config-prettier`) + Prettier
- Sentry (`@sentry/react-native`) for error/crash tracking — optional,
  no-ops if `EXPO_PUBLIC_SENTRY_DSN` is unset. Actually wired up in
  `App.tsx` as of 2026-08-27 (this line described the intended design
  before that — the dependency was installed but never initialized).
  **Expo Go caveat:** Sentry's JS SDK works fine in Expo Go for
  unhandled JS exceptions and explicit `captureMessage`/breadcrumbs,
  but true native-level crashes (e.g. the fragment-manager crash from
  the date-picker saga below) aren't caught without the native Sentry
  SDK compiled into the binary, which needs a custom EAS Dev Client —
  a bigger workflow shift, not made unilaterally. `EXPO_PUBLIC_SENTRY_DSN`
  is set in this user's `.env` as of 2026-08-27, so JS-level reporting
  is live.

## Commands

```bash
npm install              # install dependencies
npx expo start            # start dev server (Expo Go, SDK 54)
npm run lint               # eslint
npm run format             # prettier --write
npx tsc --noEmit            # type-check (also runs in CI)
```

## Project structure

```
App.tsx                        entry point, Sentry.init + Sentry.wrap
app.json                       Expo config (plugins, permissions strings, extra.*)
.env / .env.example            SUPABASE_URL, SUPABASE_ANON_KEY, EXPO_PUBLIC_SENTRY_DSN
src/
  lib/
    supabase.ts                Supabase client (reads via expo-constants)
    PairingContext.tsx         session + pair state, app-wide
    date.ts                    YYYY-MM-DD helpers — LOCAL (picked dates)
                               vs UTC (shared day boundary); see
                               "Two day boundaries" below
    date.test.ts               standalone self-check for the above,
                               run with `node src/lib/date.test.ts`
    notifications.ts           schedules the daily question/clip local reminders
  hooks/
    queries.ts                 usePair / useProfile / useClips / useClip
    mutations.ts               useUploadClip / useMarkClipViewed
  data/
    dailyQuestions.ts          bundled prompt pool + date -> prompt selector
  navigation/
    RootNavigator.tsx          gate: Auth -> Pairing -> Home (Timeline)
  screens/
    AuthScreen.tsx              email OTP sign-in (send code -> verify code)
    PairingScreen.tsx           create/join pair via invite code
    RecordScreen.tsx            shows today's question, captures the video
                                answer (+ optional caption), reveal state
                                once both partners have posted
    TimelineScreen.tsx          card feed of clips + question/summary entry cards
    ClipViewScreen.tsx          expo-video playback; optional `queue` param
                                plays a sequential reel (Monthly Summary) instead
                                of a single clip
    MonthlySummaryScreen.tsx    per-month stats, calendar grid, "watch this
                                month's clips" reel
  theme/
    colors.ts, typography.ts    palette + Fraunces/Inter pairing from brand spec
  types/index.ts                shared data models
supabase/
  schema.sql                    tables + RLS policies (source of truth for schema)
.github/workflows/ci.yml        lint + type-check on every push/PR to main
```

## Environment / accounts already set up

- Live Supabase project: `while-you-sleep`,
  `https://lgzcvryexckjrwlipenr.supabase.co`. Schema from
  `supabase/schema.sql` is already applied. Storage bucket `clips`
  (private) already created.
- Custom SMTP configured via Resend (free tier) so Supabase's
  "Confirm signup" email template could be edited to include
  `{{ .Token }}` — required for the 6-digit OTP code to actually appear
  in the email (Supabase's default template only sends a magic link,
  and template editing is locked without custom SMTP configured).
- GitHub repo: `github.com/Derek-Salanga/while-you-sleep` (public, for
  portfolio purposes). CI runs lint + type-check on every push to `main`.
- `.env` is gitignored and not in the repo — the user has it locally
  with real Supabase values filled in. Never commit real credentials.

## SDK version notes — read before changing any Expo-related dependency

**Expo Go on the App Store was capped at SDK 54 as of August 2026**,
because Apple's app review process was holding up Expo's newer release
(SDK 57). This may have resolved by the time you're reading this —
worth checking before assuming SDK 54 is still the right target. If
Expo Go has caught up to a newer SDK, upgrading is reasonable; if not,
stay on SDK 54.

**Do not hand-guess exact package version numbers.** Minor/patch
versions for Expo packages shift constantly and guessing wrong causes
`ETARGET`/`ERESOLVE` npm errors. Instead:
1. Make sure `expo` itself is pinned to the target SDK in `package.json`.
2. Run `npx expo install <package-name>` for any Expo package you need
   to add or fix — this lets Expo's CLI resolve the exact compatible
   version automatically.
3. If dependencies get into a broken/partial state, the reliable fix is:
   delete `node_modules` and `package-lock.json`, strip `package.json`
   down to `expo` + non-Expo packages, `npm install` that clean baseline,
   then re-add Expo packages via `npx expo install`.

**`expo-file-system`'s new API** (`File`/`Directory` classes) replaced
the old one (`getInfoAsync`, `readAsStringAsync`) as of this SDK range.
This codebase currently imports from `expo-file-system/legacy` in
`RecordScreen.tsx` to keep using the old, already-working API rather
than migrating. A proper migration to the new API is a reasonable
cleanup task later, not urgent.

## Daily Question feature (video daily question, merged with the clip)

Each pair gets one shared prompt per day, picked deterministically from
a bundled list (`src/data/dailyQuestions.ts`) by date — no server-side
scheduling needed, both partners always see the same prompt.

**Originally a standalone text-answer feature** (`daily_answers` table,
its own `DailyQuestionScreen`, separate from the general daily clip).
**Merged into the clip itself** per user request: there's no more
separate free-form diary clip and text answer — the one daily video
*is* the answer to today's question, capped at 30s (down from the old
general clip's 60s) since it's now always a direct answer, not a
free-form update. `RecordScreen.tsx` shows the question as an overlay
while framing the shot, and after recording adds an optional short-text
caption step (`clips.caption_text`, nullable) before sending — "answer
in both video and text" per the user's request when scoping this.
`DailyQuestionScreen.tsx` and its `DailyQuestion` nav route are removed
entirely; `Record` is now the single entry point, reached from one
merged Home card (previously two: a "Today's question" card and a
separate "Record today's clip" button).

`RecordScreen` has four phases: `loading` (checking today's clips),
`camera` (question overlay + capture), `review` (caption input +
Send/Retake — no video preview, just re-record if you don't like it),
and `revealed` (your answer + your partner's, once they've posted —
tapping either navigates to the existing `ClipViewScreen` rather than
building inline playback). Landing back on this screen later in the
day (e.g. partner posts after you) goes straight to `revealed` without
ever requesting camera permission, since only the `camera`/`review`
phases need it.

Same reveal mechanic `daily_answers` had: you can't see your partner's
clip for a given day until you've posted your own for that day. This
now applies to `clips` generally (`has_own_clip()`, mirroring
`has_own_daily_answer()`) — not just going forward, since RLS can't
distinguish "old" from "new" rows. In practice this only matters for a
day you haven't posted on yet; past days are almost always already
mutually visible by the time anyone looks back at them. Flagged to and
accepted by the user before implementing.

`daily_answers` and its RLS policies are left in place, just no longer
written to — no screen ever showed historical answers, so nothing
about removing `DailyQuestionScreen` makes old data newly inaccessible;
it's just retained rather than deleted.

One local (on-device, not push) reminder now fires daily at **20:00
UTC** — not 8pm local — scheduled once a pairing exists
(`RootNavigator`), by fixed identifier so re-scheduling replaces rather
than duplicates. Previously two separate reminders (question + clip) at
8pm local. `notifications.ts` explicitly cancels the old
`daily-clip-reminder` identifier on every schedule call so a device that
already had it scheduled from before this merge doesn't keep firing a
reminder for a flow that no longer exists.

Pinned to UTC so it lines up with the pair's shared day boundary (see
"Two day boundaries" below): at a local 8pm, anyone far enough west was
reminded *after* the UTC day had already rolled over, so the nudge
pointed at the next day's question. 20:00 UTC always lands 4 hours
before the boundary, and both partners get it simultaneously. Tradeoff:
the local hour now varies (13:00 at UTC-7, 05:00 in Tokyo) instead of
being a consistent evening nudge.

expo-notifications' `DAILY` trigger takes a device-local hour/minute
with no timezone field, so `utcTimeToLocal()` (`src/lib/date.ts`)
translates it per device. It returns minutes as well as hours because
not every offset is a whole hour — India is UTC+5:30, Nepal +5:45 — and
it's recomputed on every call so a DST transition self-corrects on the
next app launch (between the transition and that launch the reminder can
be an hour off).

## Monthly Summary feature

Deliberately scoped as stats + sequential playback, not an actual
stitched highlight-reel video file — that would need native
video-processing tooling (e.g. ffmpeg-kit) that Expo Go doesn't
support, meaning a move to a custom EAS Dev Client build. Asked the
user explicitly before building; they chose to stay in Expo Go.

No new table — computed entirely from `clips` by querying
`recorded_for_date` within the viewed month's range. `MonthlySummaryScreen`
shows: counts (yours/partner's/days both posted), a per-day calendar
grid (a dot per person who posted that day, not aligned to actual
weekdays — a simple wrapped grid, not a literal calendar layout), and a
"watch this month's clips" button. That button navigates to
`ClipView` with a `queue` of chronologically-ordered clip ids;
`ClipViewScreen` auto-advances on `playToEnd` when a queue is present,
otherwise behaves exactly as before (single clip, manual controls,
no auto-advance) for the normal Timeline-card tap path.

## Trips/Goals feature

Scoped as a single shared "next visit" countdown, not multiple/past
trips — the least-defined item on the original feature backlog, so the
mechanic was picked via AskUserQuestion before building: one active
trip (date + meeting country), either partner can set/edit it, shown
as a card on Home. Tapping the card reveals an inline edit form (a
country picker + native date picker,
`@react-native-community/datetimepicker`) in place of the card; saving
is one upsert on `pair_id`. The set-state card reads top to bottom:
country/date line, the countdown, then a muted "until we see each
other again" label at the bottom — per user request, deliberately not
the more literal "Our next trip" (still used as the edit form's own
header, a different context, unchanged).

The meeting location is a country picked from a full-screen searchable
list (`src/data/countries.ts` — ISO 3166-1 alpha-2 codes + English
names, generated once via Node's `Intl.DisplayNames` rather than a
runtime dependency or an on-device `Intl` call, since Hermes ICU
completeness varies by build), not free text — started as a text
field, changed after the user asked for a country list + flag. The
flag is computed, not an image asset: a flag emoji is just two
"regional indicator" code points spelling out the ISO code (e.g.
`JP` → 🇯🇵), see `flagEmoji()` in that file. `pair_trips.country_code`
stores the code; `countryName()` resolves it back to a display name at
render time.

New `pair_trips` table, one row per pair (`pair_id` is the primary
key — there's nothing else to key on since it's a singleton value, not
a per-day record like `clips`/`daily_answers`). RLS reuses
`is_pair_member`, same read/write-by-either-partner shape as `clips`'
policies — no reveal-gating, since there's nothing to hide here.
`HomeScreen.tsx` fetches/saves it inline (matching the rest of the
codebase's per-screen query style, no data-layer file). `set_by` is
overwritten on every edit, so it just tracks who set it most recently,
not a history.

The countdown ("N days") is computed from each device's own local
calendar day (`todayDateString()`), the same convention the rest of
the app already uses — not anchored to a shared/destination timezone.
`profiles.timezone` exists in the schema but is unused anywhere in the
app, so there's no per-user timezone data to anchor to without adding
new infrastructure; explicitly deferred, not an oversight.

### Date picker: six real-device bug rounds (resolved)

Both date pickers (trip and anniversary, below) went through six
rounds of real-device fixes, all caused by how
`@react-native-community/datetimepicker` (and its container) was
embedded — see also [[feedback_datetimepicker_no_modal]] in memory for
the reusable lesson:

1. **Wrapping the picker in a custom RN `Modal` at all.** Android's
   `display="default"` is itself an imperative native dialog; mounting
   it inside `Modal`'s separate native window is a documented
   fragment-manager crash in this library. iOS's `display="inline"`
   inside that same narrow bottom-sheet `Modal` didn't have the layout
   width it needed, clipping most of the calendar. Fixed by dropping
   the custom `Modal` entirely — both pickers render directly in the
   screen now, in an inline edit section that replaces the card/row
   while active.
2. **`display="compact"` on iOS**, tried as the fix for (1). Compact
   mode presents its calendar as a native popover, which is a known
   crash source specifically on iPad (this user's real-device
   target) when the presenting view's context isn't set up exactly
   right — hit immediately on the very next trip-card tap after fixing
   (1). Reverted to `display="inline"`, which (now that neither picker
   is Modal-wrapped) has the layout room it needs without clipping and
   has no popover to crash. Settings' anniversary edit card also had
   `alignItems: 'flex-start'`, which would have shrunk the inline
   calendar back down to its intrinsic width and reproduced the
   original clipping bug on that screen specifically — removed.
3. **A second `display="inline"` picker mounting in a different,
   already-mounted tab.** Crashed after setting a trip date on Home,
   then opening the Settings anniversary picker — the first time two
   *different* screens' pickers had been opened in the same app
   session. `@react-navigation/bottom-tabs` keeps all tab screens
   mounted across tab switches by default (no `unmountOnBlur`), so a
   stale native picker instance from Home was plausibly still alive in
   the background when Settings mounted its own. Two independent
   mitigations applied together rather than a fourth blind guess at
   display mode alone: added `unmountOnBlur: true` to the tab
   navigator (`MainTabs.tsx`) — free, since every screen already
   re-fetches on focus via `useFocusEffect` — and switched both
   pickers from `"inline"` (`UICalendarView`, iOS 14+) to `"spinner"`
   (the classic `UIDatePicker` wheel, in the library since iOS 2), the
   most battle-tested presentation mode. Trades calendar-grid polish
   for reliability after two prior modes both crashed.
4. **Anniversary wheel showed Dec 31, 1969** (the Unix epoch, shifted a
   day by a negative UTC offset) when opened right after setting a
   trip date. No stack trace to confirm the exact mechanism — this
   isn't a crash, so nothing for Sentry to catch even if it's
   configured — so two plausible causes were hardened together rather
   than guessing once blind: added `parseDateString()` to
   `src/lib/date.ts`, used everywhere a stored date string is parsed
   for picker/display use, so an Invalid Date can never reach a native
   picker (some coerce `NaN` timestamps to epoch 0 instead of
   erroring); and wrapped both spinner pickers in a fixed-height
   (`216`, `UIDatePicker`'s intrinsic spinner height) container, since
   RN's Yoga layout can hand a native view a zero-size frame for a
   render or two after a screen transition, and `UIDatePicker` is
   known to reset its displayed date when that happens.
5. **Same Dec 31, 1969 symptom, still reproducing after (4).** Since
   both of (4)'s hardening fixes were in place and it still happened,
   both hypotheses were most likely wrong — time to stop guessing and
   get real evidence instead of a sixth blind fix, which is also what
   the user explicitly asked for ("set up a logger... for future
   debugging purposes"). Two things done: added `console.warn` calls
   at `SettingsScreen.tsx`'s three key points (row fetched from
   Supabase, computed picker value on open, every `onChange` firing)
   so a repro shows exactly what value is in play at each step — these
   are temporary and should come out once the bug's actually found,
   not permanent instrumentation; and actually wired up
   `Sentry.init`/`Sentry.wrap` in `App.tsx` (previously just an
   unused dependency, see "Environment" above) for durable signal on
   whatever comes next. Also spotted and fixed one concrete asymmetry
   while investigating: the trip picker has `minimumDate={new Date()}`,
   which would silently clamp away any stray native-default epoch
   value; the anniversary picker had no lower bound at all, so nothing
   would stop an epoch default from being accepted and possibly echoed
   back through `onChange`. Added `minimumDate` there too (100 years
   back — no real anniversary is older). Plausible real fix, but
   unconfirmed without a repro showing the new logs.
6. **Root cause found and fixed (2026-08-27), via the new `console.warn`
   logs from (5).** A repro showed the JS state was correct at every
   step (loaded row, parsed value, `onChange` value, saved value all
   matched what was expected) — proving the epoch display was a *native
   rendering* bug, not a data/state bug. The user then found a reliable
   trigger: scrolling the trip wheel backward past its `minimumDate`.
   Two more hypotheses were tried and **both disproven** by real-device
   retests before the actual fix: (a) gating the picker's mount behind
   `onLayout` reporting a non-zero container height (the round-4 "zero
   frame" theory, made more rigorous) — still reproduced; (b) hoisting
   `minimumDate`/`maximumDate` out of inline `new Date()` calls into
   per-edit-session state, since an inline `new Date()` is a fresh
   object every render and gets re-pushed to the native view on every
   `onChange` mid-scroll — still reproduced. Both were reverted rather
   than left stacked. The actual fix: **remove `minimumDate` and
   `maximumDate` from both pickers entirely.** The bound prop itself —
   not its staleness or the timing of when it's applied — is what
   `@react-native-community/datetimepicker` mishandles on iOS spinner
   mode when scrolled past it. Confirmed fixed on a real device across
   both the original trip-then-anniversary sequence and the
   scroll-backward repro. Range validation moved to Save-time instead:
   `HomeScreen.tsx`'s `handleSaveTrip` rejects a trip date before today,
   `SettingsScreen.tsx`'s `handleSaveAnniversary` rejects one after
   today, both via a plain string-compare on `todayDateString()` /
   `formatDateString()` and an `Alert.alert`. The temporary
   `console.warn` calls from (5) are removed now that the bug's
   resolved; `Sentry.init`/`Sentry.wrap` stay wired in `App.tsx` as
   durable signal for anything else.

Current state (both pickers): no `Modal`, `unmountOnBlur: true` on the
tab navigator, `display="spinner"` on iOS in a fixed-height container,
`display="default"` on Android, dates always parsed through
`parseDateString()`, **neither picker has `minimumDate`/`maximumDate`**
— date-range rules are enforced on Save via a plain string compare
instead. Confirmed fixed on a real device (2026-08-27), single-account
pass only — see "Testing status" below for what's still unverified.

### Anniversary day-counter

A separate, independent feature sharing the same shape: a single
shared "together since" date per pair, in its own `pair_anniversary`
table (not a column on `pair_trips` — deliberately kept separate since
it's a distinct feature with a different entry point). Set from a row
on `SettingsScreen.tsx` (native date picker; future dates are rejected
on Save rather than via a picker `maximumDate` — see "Date picker: six
real-device bug rounds" above), shown read-only on Home as "N days
together" under the title.
Same RLS shape as `pair_trips`, same local-calendar-day math.

Originally saved on every `onChange` (i.e. every wheel-stop), with no
way to review before it took effect — changed to stage the picked date
locally and only save on an explicit Save button (Cancel discards),
mirroring the trip form's existing Save/Cancel pattern in
`HomeScreen.tsx`, per user request.

### Partner nicknames

`profiles.display_name` already existed (defaulted to the email
prefix, e.g. `dereksalanga+partner2`) but had no edit UI and no way
for a partner to read it — `profiles_select_own` was the only RLS
policy on that table. Added a `profiles_select_pair_partner` policy
(read-only; write stays own-row-only via the existing
`profiles_update_own`) and a "Nickname" row under Settings (inline
edit, same pattern as the anniversary picker). `PairingContext.tsx`
now exposes `myProfile`/`partnerProfile`/`refreshProfiles`, shared
across screens rather than each fetching its own. Home's
"N days together" reads "...with [partner's nickname]"; Timeline's
"You"/"Your partner" labels use the nicknames, falling back to the old
text if a profile hasn't loaded yet.

Capped at 20 characters — started at 40 (arbitrary), the user asked
for 15, then two pre-existing test-account rows turned out to already
be 21 chars (the email-prefix default, not real nicknames), so 20 was
picked instead of chasing the default text upward again; those two
rows still need renaming before the DB `check` constraint can be
applied to the live project (client-side `maxLength={20}` is already
live either way). See "Testing status" below for exactly what's
confirmed vs. still pending.

## Video capture: capped at capture time, not compressed after

`RecordScreen.tsx` originally uploaded whatever `expo-camera` handed
back with no size control — fine on a phone that defaults to a modest
recording quality, but a single 4K-capable device could turn a 60s
clip into hundreds of MB against Supabase's 1GB free-tier bucket.

Considered and rejected post-capture compression
(`react-native-compressor`, `ffmpeg-kit`-style libraries): these ship
native iOS/Android code needing autolinking at build time, which
Expo Go can't load — same constraint already noted for Monthly
Summary's recap-video idea, which is why that shipped as stats +
sequential playback instead. Moving to that class of tooling means an
EAS Dev Client, a bigger workflow shift not made unilaterally.
`expo-video-thumbnails` was also considered and ruled out — it extracts
a static image frame from a video, unrelated to compression.

Used `expo-camera`'s own capture-time controls instead — already
installed, no new dependency, no eject: `videoQuality="720p"` and
`videoBitrate={2_500_000}` (2.5 Mbps) as props on `CameraView`, plus
`codec: 'hvc1'` (HEVC) passed to `recordAsync()` on iOS only (no
Android equivalent in this API; `videoQuality`/`videoBitrate` still
apply there). Caps a full 60s clip at roughly 19MB regardless of the
source device's camera capabilities — HEVC brings iOS clips in
smaller still, since it roughly halves size vs. H.264 at the same
visual quality. Every iPhone since the 7 supports HEVC, so no real
device compatibility concern.

Tradeoff: this caps quality going in rather than compressing an
already-recorded file, so there's no lever to shrink a clip *after*
it's captured. Doesn't matter for this app's flow — clips are recorded
fresh each time, never imported, so there's no pre-existing full-quality
file to compress. Not yet verified on a real device — worth confirming
actual clip file sizes land in the expected range and playback quality
is still acceptable at 720p for a phone-screen daily clip.

## Two day boundaries: local vs. the pair's shared (UTC) day

`src/lib/date.ts` deliberately exposes two conventions. Mixing them up
causes real bugs, so pick by *purpose*, not by whichever is nearby:

- **A calendar date the user picked on a wheel** (trip date,
  anniversary) → `formatDateString()` / `todayDateString()`, which use
  LOCAL components. Picking "June 19" must store `2026-06-19` whatever
  the device's offset, so these must never go through `toISOString()`.
  Also used for comparing a picked date against "today" (is this trip
  in the past?) and for countdowns off those dates — all of which
  should feel local.
- **The shared day boundary both partners key off** (which question is
  today's, which day a clip counts for) → `sharedTodayDateString()` /
  `sharedYesterdayDateString()`, which are UTC.

**Why the shared one is UTC:** originally everything used the local
day. For a pair spanning timezones that leaves a window where each
partner is on a different calendar day — they'd be served *different*
daily questions, and their clips would land under different
`recorded_for_date` values instead of pairing up as answers to each
other. UTC is the one clock every device already agrees on without
adding a per-pair timezone anchor (`profiles.timezone` exists in the
schema but is still unused, and there's no UI to set one).

**Accepted tradeoffs**, both deliberate:
1. UTC midnight is an odd local hour for most people. The daily
   reminder was **moved to 20:00 UTC** to match (see "Daily Question
   feature" above) — at a local 8pm, anyone far enough west was
   reminded after the boundary had already rolled, pointing them at the
   next day's question. The cost is that the reminder's local hour now
   varies by timezone rather than always being an evening nudge.
2. `MonthlySummaryScreen` still builds its month bounds from local
   components while clips are now UTC-stamped, so a clip recorded near
   a month edge can land in the adjacent month's summary. Left alone —
   it's a month-granularity stats view that isn't verified against real
   multi-day data yet, and fixing it properly means deciding whether
   "this month" itself is local or UTC.

`src/lib/date.test.ts` is a standalone self-check (no test framework in
this repo by design). Run it under several timezones — that's what
actually proves the split holds:

```bash
for tz in UTC America/Los_Angeles Asia/Tokyo; do TZ=$tz node src/lib/date.test.ts; done
```

It's excluded from `tsconfig.json` (`exclude: ["**/*.test.ts"]`) because
it imports with an explicit `.ts` extension, which Node's ESM resolver
requires and this tsconfig would otherwise reject. Never bundled by
Metro — nothing in the app imports it.

## Data layer (TanStack Query)

Added because every screen hand-rolled `useState` + `useEffect` around
its own Supabase call: `TimelineScreen` needed a `useFocusEffect`
refetch just to notice new clips, and nothing connected posting a clip
to the Timeline showing it.

`App.tsx` holds one module-level `QueryClient` with **stock defaults**,
wrapped outside `PairingProvider` (the context consumes query hooks).
The defaults are load-bearing, so don't "tune" them casually:
`staleTime: 0` is what makes a remount refetch, which is how tab focus
works here (`unmountOnBlur: true` in `MainTabs.tsx`), and the default
retry-with-backoff is what replaced `withClockSkewRetry` (see below).

Query keys are plain arrays, no key factory — there are four of them:
`['pair', userId]`, `['profile', userId]`, `['clips', pairId]`,
`['clip', clipId]`. Both mutations invalidate `['clips']` on success,
which is what makes the Timeline update on its own.

`useClip` deliberately returns `{ clip, videoUrl }` — the row fetch and
the 10-minute signed Storage URL in one `queryFn` — because
`ClipViewScreen` can never use one without the other. Note it does *not*
match the `['clips', …]` prefix, so invalidating the list never refetches
it (which is why the mark-viewed effect in `ClipViewScreen` can't loop).

`PairingContext` keeps its exact public API (`session`, `pair`,
`loading`, `refreshPair`, `myProfile`, `partnerProfile`,
`refreshProfiles`) but is now a thin wrapper over `usePair` /
`useProfile` — so screens read pair/profile data from one cache instead
of a second copy. `session` and the `onAuthStateChange` listener are
still plain state, and `loading` still means only "the auth session
hasn't resolved yet" (`RootNavigator`'s gate depends on that).
`useProfile` is called twice (mine, partner) rather than the old single
`.in('id', [...])` — two cheap requests, but the partner one stays
`enabled: false` until `partnerId` resolves.

**Partially adopted, on purpose.** Migrated: `TimelineScreen`,
`ClipViewScreen`, `PairingContext`, and `RecordScreen`'s upload.
Still querying Supabase inline: `HomeScreen`, `SettingsScreen`,
`MonthlySummaryScreen`, `PairingScreen`, and `RecordScreen`'s
`loadTodayClips` (+ its 15s partner-reveal poll). Those still rely on
`useFocusEffect` refetching, so `unmountOnBlur` must stay.

Not done, both deliberate: no `focusManager`/`AppState` wiring (so
returning from background doesn't refetch on its own — add if that feels
stale in practice), and no AsyncStorage cache persistence (offline reads
are their own backlog item).

## Storage cleanup: orphaned clip files

Deleting a `clips` row never deleted its video. **A DELETE trigger can't
fix that**, and the attempt makes it worse: `storage.objects` is metadata
only, the bytes live in S3, and Supabase's docs are explicit that
"deleting objects via a SQL query will not remove the object from the
bucket and will result in the object being orphaned". A trigger doing
`delete from storage.objects` leaves the blob alive *and* destroys the
row the Storage API needs to ever find it again. Native
cascade-on-row-delete is still an open feature request.

A trigger calling the Storage API over HTTP (pg_net) *would* delete the
file, but it's the wrong tool here, because **the orphans this app makes
mostly don't come from DELETEs**:

1. `clips` has no DELETE policy — no client can delete a clip at all.
2. Rows vanish via `on delete cascade` when a pair or an `auth.users` row
   goes; no app code runs there.
3. `storage_path` used to end in the recorded file's own extension
   (`.mov` on iOS, `.mp4` on Android), so re-recording the same day from
   the other platform wrote a *different* path and orphaned the old file
   **with its row still present**. No DELETE fires for that one, ever.

So cleanup is reconciliation, not a delete hook: `cleanup_orphaned_clip_files()`
(in `supabase/schema.sql`) re-derives the orphan set from current state —
every object in the `clips` bucket with no matching `clips.storage_path` —
and deletes each via the Storage API, on a nightly `pg_cron` job. That
covers all three cases, is idempotent, and self-heals: a request that
fails tonight is re-found and retried tomorrow, because the file is still
orphaned. A fire-and-forget trigger gets one shot and no retry.

Case 3 is also fixed at the source, in `useUploadClip` — the path no
longer carries an extension, so the upsert always overwrites in place.
That forced `contentType` to become a real MIME type (`video/quicktime` /
`video/mp4`) rather than the `video/mov` it sent before, since without an
extension in the URL the player has only Content-Type to go on. Existing
rows keep their old extensioned paths and still play; the first
re-record on such a day moves them to the extensionless path, and the
cleanup job sweeps what's left behind.

Deliberate properties, don't "fix" them casually:

- **One HTTP request per orphan.** `net.http_delete` takes no body, so
  the Storage API's batch form (`DELETE /object/clips` with a
  `{"prefixes": [...]}` body) isn't reachable from pg_net. `max_deletions`
  (default 200) caps a run. If that cap is ever genuinely hit, move the
  job to an Edge Function that can batch — don't just raise it.
- **A one-day `grace_period`.** A file is uploaded *before* its row is
  inserted, so a just-uploaded file is briefly a legitimate orphan. A day
  is far wider than that window and costs nothing.
- **`revoke all ... from public, anon, authenticated`** on the function.
  It's `security definer` and reads a service_role key out of Vault;
  Postgres grants EXECUTE to `public` by default, so the revoke is
  load-bearing, not tidiness.
- **Errors are not surfaced.** pg_net is async — a 4xx lands in
  `net._http_response` (pruned after 6h) and nothing reads it. That's
  acceptable only because the job is self-healing; if orphans ever stop
  disappearing, check that table, not `cron.job_run_details` (which only
  sees whether the function itself ran).

**Live-project setup is not in `schema.sql` and can't be** — it needs the
service_role key. One-time, from the SQL editor:
`select vault.create_secret('<service_role_key>', 'service_role_key', '...')`.
The function raises a clear error if that secret is missing.

## Known transient error: "JWT issued at future"

Seen occasionally on cold start from `PairingContext.tsx`'s `ensureProfile`
/ `refreshPair` calls. This is PostgREST's server-side JWT `iat` check,
not a client/device clock issue — most likely explained by the Supabase
project cold-starting from free-tier auto-pause with a few seconds of
clock drift before it NTP-syncs. It self-corrects within a couple
seconds, so it's retried rather than "fixed" client-side.

`PairingContext.tsx` used to hand-roll this as a `withClockSkewRetry`
wrapper (2 retries, 1500ms apart). That's gone — since those calls are
now react-query queries/mutations, the library's default retry (3
attempts, exponential backoff) covers it, and covers strictly more than
the old wrapper did. Nothing special is configured for it.

## Testing status (update this section as things get verified)

Confirmed working end-to-end:
- Email OTP sign-in (send code, receive via Resend, verify)
- Full two-user pairing: create invite on one account, join with a
  second real account via `join_pair_by_code` — confirmed 2026-08-27
  after applying the invite-code RLS fix (PR #16) to the live project.
  Reject path also confirmed (reusing an already-claimed code shows the
  function's error message, not a silent failure).
- Camera recording
- Upload (record -> Supabase Storage -> `clips` row) — re-confirmed
  2026-08-25 after the `expo-file-system/legacy` fix; partner device
  received the clip.
- Partner nicknames (PR #17): set on both of two real paired accounts,
  confirmed on Home ("...with [nickname]") and Timeline (both sender
  labels), and that edits persist and reload correctly. Confirmed
  2026-08-27 after applying the `profiles_select_pair_partner` RLS
  policy to the live project. The `profiles_display_name_check`
  (<= 20 chars) constraint **is** applied on the live project as of
  2026-08-27 — this section previously recorded it as still pending.
  Applying it surfaced a real bug: `ensureProfile` seeded
  `display_name` from the email prefix with no truncation, and
  `dereksalanga+partner2` is 21 chars, so the client was handing the DB
  a default it was guaranteed to reject ("new row for relation
  \"profiles\" violates check constraint"). Now sliced to 20 at the
  source, matching SettingsScreen's `maxLength`. Any write path that
  generates a `display_name` has to respect that cap itself — the
  constraint is the source of truth, not a backstop.

Confirmed on the live project (2026-08-27, `feat/storage-orphan-cleanup`):
storage orphan cleanup works end to end. `pg_net` + `pg_cron` enabled,
the `service_role_key` Vault secret created (holding an `sb_secret_…`
key, not the legacy `service_role` JWT — legacy keys are deleted late
2026, so a job keyed on one would have silently stopped working). A
deliberately-uploaded junk file was seen as an orphan, removed by
`select cleanup_orphaned_clip_files(interval '0')`, and confirmed gone
from the bucket, with `net._http_response` showing
`200 {"message":"Successfully deleted"}` — i.e. the file left S3, not
just `storage.objects`.

Also confirmed by that pass: **`postgres` can read `storage.objects`**
(the counts query returned 5 files against 5 `clips` rows, not 0), which
is what the whole `security definer` design rests on — if that had come
back 0, the function could never have found an orphan. And 0 orphans
across a real bucket means the `.mov`/`.mp4` path bug never fired here,
as expected on a single-platform device.

Confirmed on a real device (2026-08-27, `feat/storage-orphan-cleanup`,
iOS/Expo Go): the extensionless `storage_path` + real-MIME-type change
records **and plays back** on both accounts of a pair. The stored object
is `<pair>/<sender>/2026-08-27` with no extension and
`mimetype = video/quicktime`, and playback works with no extension in
the signed URL — which was the open question, since the player then has
only Content-Type to go on. Old `.mov` clips recorded before the change
still play alongside the new ones, so the transition needs no backfill.

Also settled by that pass, open since PR #18: **capture-time compression
holds**. A full-length clip came in at 8.9 MB, right against the ~9.4 MB
the 720p/2.5 Mbps cap predicts for 30s, and short clips at 0.7-1.1 MB.
Playback quality was not separately graded beyond "plays properly".

Note both accounts had posted for the same day before this check, so it
confirms both clips are watchable once revealed — it does **not**
exercise the reveal-gating block (that a partner's clip is hidden
*before* you've posted your own), which is still untested.

Visually confirmed only (2026-08-26, `fix/screen-polish-and-nav-fixes`
in Expo Go, not a functional re-test):
- Auth screen's "While You Sleep" title renders
- Pressed/active feedback shows on buttons across all five screens
- Timeline clip dates render humanized ("Today" / "Yesterday" / "Aug 25")
- ClipView close button renders and is tappable

Confirmed on `feat/daily-question` (2026-08-26, Expo Go, one-sided —
only one partner's account exercised so far), **superseded by the
video-daily-question merge** (the text-answer flow and
`DailyQuestionScreen` this refers to no longer exist — kept here as a
record of what was verified about the underlying `security definer`
reveal-gating pattern, which the new `has_own_clip()` reuses):
- Answer submission worked end-to-end against the live Supabase project
  (this is what surfaced and confirmed the RLS self-recursion bug in
  the select policy, since fixed via a `security definer` function)

Not yet tested:
- Video daily question (merged clip+answer, PR depends on #18's
  compression settings being in place): the whole flow end to end on a
  real device — question overlay while recording at the new 30s cap,
  the caption step, the `revealed` phase showing both partners' clips
  via `ClipViewScreen`, the reveal-gating (can't see partner's clip for
  a day until you've posted your own), landing straight on `revealed`
  without a camera-permission prompt when reopening after already
  answering, and that the single merged Home entry card's
  answered/not-answered dot is correct. Needs a two-account pass.
  Also needs the `RETIRED_REMINDER_IDS` cleanup in `notifications.ts`
  confirmed on a device that had the old two-reminder version installed.
- The UTC shared day boundary (see "Two day boundaries" above) on real
  devices: that two partners in *different* timezones see the same
  daily question and that their clips pair up as the same day's
  answers, especially during the window where their local dates
  disagree. `date.test.ts` covers the helper logic, but only a
  two-timezone real-device pass exercises the actual behavior. Also
  worth eyeballing Timeline's "Today"/"Yesterday" labels near the
  boundary, since those now compare on UTC rather than local.
- Storage orphan cleanup: the **nightly `pg_cron` run actually firing**
  (`cleanup-orphaned-clip-files` at 04:17 UTC) — check
  `cron.job_run_details`. The function itself is confirmed (below); only
  the schedule that invokes it is untested, since it hadn't come around
  yet.
- The extensionless `storage_path` change **on Android** (`video/mp4`).
  iOS is confirmed (below), but the point of the change is that the two
  platforms write to the same path, and that cross-platform case is the
  one that can't be exercised on this user's iPad-only setup. Until an
  Android device runs it, the `.mov`/`.mp4` collision it fixes stays
  theoretically-fixed rather than demonstrated.
- TanStack Query data layer (see "Data layer" above) — nothing about it
  is device-verified yet. Needs: Timeline loads + pull-to-refresh still
  works; **recording a clip makes it appear on Timeline with no manual
  refresh** (the headline change — the upload mutation invalidating
  `['clips']`); watching a partner's clip clears its unwatched dot on
  Timeline immediately on return, without a focus refetch; the Monthly
  Summary reel still auto-advances and exits at the end of its queue;
  and the `PairingContext` rewire hasn't regressed anything —
  Settings nickname edit still re-renders on Home/Timeline
  (`refreshProfiles`), a fresh join still gates into MainTabs
  (`refreshPair`), and cold start doesn't surface "JWT issued at future"
  now that `withClockSkewRetry` is gone.
- Timeline screen with real clip data
- Clip playback / viewed-status marking
- Daily local notification: permission prompt, firing at the right
  local time for 20:00 UTC on a real device, and that tapping it routes
  to Home (deliberately deferred by the user for now). `date.test.ts`
  covers the `utcTimeToLocal()` conversion, but nothing has verified
  that expo-notifications actually fires at the converted time on a
  device — worth checking on a device whose timezone isn't UTC.
- Monthly Summary: stats/grid correctness against real multi-day data,
  month navigation, and the sequential reel's auto-advance +
  end-of-queue behavior in `ClipViewScreen`
- Trips/Goals and anniversary day-counter: **two-account pass** —
  confirm either partner can set or overwrite either the trip or the
  anniversary and both partners see the same values.

Confirmed on `fix/anniversary-epoch-date` (2026-08-27, real device,
single-account): the Dec 31, 1969 epoch-display bug (see "Date picker:
six real-device bug rounds" above) is fixed — both the original
trip-then-anniversary sequence and the scroll-backward repro no longer
show it. Setting/editing a trip (incl. country) and an anniversary date
both persist and show the correct previously-set value when reopened;
countdown/day-count are correct. Save-time range validation (trip must
be today or later, anniversary must be today or earlier) not yet
explicitly tried against a rejection case — worth a quick check.

Confirmed on `fix/local-timezone-dates` (2026-08-26, computational check,
not a real device): `formatDateString` returns the correct local calendar
day (not UTC's) for a `Date` at 9pm US Pacific, the case that previously
broke. Still not tested on an actual device with its timezone set behind
UTC — that's the one open item on this PR before merge.

Confirmed on a real device (2026-08-27): the bottom tab bar
(`feat/bottom-tab-nav` — Home/Timeline/Month/Settings, icon-only)
works as expected.

## Design tooling installed

Two unofficial/community Claude Code skills are installed locally for
design work — neither is app-specific, both are generic tooling:

- **UI UX Pro Max** (`.claude/skills/ui-ux-pro-max/`) — third-party
  design-intelligence skill with searchable UI styles, palettes, and
  UX guidelines.
- **Taste Skill** (`Leonxlnx/taste-skill` on GitHub) — third-party
  anti-generic-UI skill, installed as a bundle of several locally
  symlinked skill names (`design-taste-frontend`, `gpt-taste`,
  `minimalist-ui`, `brandkit`, etc., see `skills-lock.json`).
  Primarily web-oriented, but its `imagegen-frontend-mobile` sub-skill
  and underlying principles (e.g. the em-dash ban) apply here too.

Both are gitignored, not committed.

## Design identity

This app's palette, typography, and icon motif are already established
in `src/theme/` and are locked down — the design skills above are tools
to use *within* these constraints, not sources to consult for new
palette/type proposals:

- **Palette:** `#6A85F1` night-blue = "you", `#FFC670` day-orange =
  "partner" (`src/theme/colors.ts`).
- **Typography:** Fraunces/Inter pairing (`src/theme/typography.ts`).
- **Icon motif:** the "crossover split" (see `colors.ts`'s header
  comment and the original project brief).

## Explicitly out of scope for now

- Home screen widgets (day-counter, distance-counter) — needs a native
  config plugin (e.g. `@bacons/apple-targets`) outside the managed
  Expo workflow currently in use.
- Actual stitched highlight-reel video generation — Monthly Summary
  covers the "recap" need via stats + sequential playback instead (see
  "Monthly Summary feature" above); a real compiled video file is a
  bigger lift (native video-processing tooling, moving off Expo Go).
- Streak/mascot mechanic ("Tamagotchi") — deferred per the original
  project brief; not a core-loop feature yet.

## Git workflow

- No direct commits to `main`. All work happens on a feature branch,
  created from an up-to-date `main`, and lands via a PR.
- Branch names: `type/short-description` (e.g. `fix/upload-clock-skew`,
  `docs/git-workflow`), where `type` matches the conventional-commit
  type below.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
  `type(optional scope): summary`, e.g. `fix: retry profile upsert on
  transient clock-skew error`. Common types: `feat`, `fix`, `docs`,
  `refactor`, `chore`, `test`, `ci`.
- Open the PR with `gh pr create`; do not auto-merge — merging is the
  user's call.
- The `commit-push-pr` skill (`.claude/skills/commit-push-pr/`) automates
  the stage -> commit -> push -> PR steps of this workflow.

## Claude Code skills

- `commit-push-pr` skill (`.claude/skills/commit-push-pr/`) — see "Git
  workflow" above; automates stage -> commit -> push -> PR.
- Design-focused skills (`ui-ux-pro-max`, the `Leonxlnx/taste-skill`
  bundle) — see "Design tooling installed".

## Session checklist

How work with Claude Code is orchestrated in this repo, session to
session:

- The user states a specific goal at the start of each session. Work
  from that goal, not an inferred one.
- Confirm we're on a feature branch (not `main`) before starting any
  work.
- Checkpoint with the user before destructive actions, and after
  proposing any nontrivial plan — don't proceed on your own judgment
  alone.
- When fixing a bug, explain the root cause, not just the fix.
- Update the "Testing status" section above before ending a session,
  reflecting whatever got newly verified (or newly broken).
- Treat one run of the `commit-push-pr` skill as one coherent unit of
  work per PR — don't bundle unrelated changes into the same PR just
  because they happened in the same session.
- Never decide something is ready to merge. That call is the user's,
  not Claude's — the PR is the deliverable, not the merge.

## Working with this user

- iPad/Mac only, no dedicated dev machine. Give exact, copy-pasteable
  terminal commands. When a file needs multi-line edits, prefer giving
  the full corrected file content over a diff/patch description —
  manual patching in `nano` has caused duplicated content before.
- Prefers being told the reasoning behind a fix briefly, not just the
  fix itself.
- Communication style: answer-first, numbered steps, minimal preamble.
  The globally-installed "I have ADHD" skill can produce this on
  request via `/i-have-adhd`, or persistently via its always-on flag
  (`touch ~/.claude/.i-have-adhd-always`) — it's disabled for
  automatic model invocation otherwise, so apply this style directly
  rather than assuming the skill is already doing it.
- Prefer minimal, non-over-engineered solutions — don't add
  abstraction, config options, or dependencies beyond what the task
  actually needs (see globally-installed Ponytail skill, which is
  model-invocable and can be applied directly).
