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
  but true native-level crashes (e.g. the fragment-manager crash in
  `docs/datepicker-debugging.md`) aren't caught without the native Sentry
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
npm test                    # jest, run once per TZ (UTC/LA/Tokyo) — also runs in CI
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
    date.test.ts               Jest tests for the above, run via `npm test`
                               (once per TZ — see "Two day boundaries" below)
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
    SettingsScreen.tsx          nickname, anniversary, and an Account row
    AccountSettingsScreen.tsx   email + sign out, pushed over Settings inside
                                the Settings tab's own small stack (MainTabs)
  theme/
    colors.ts, typography.ts    palette + Fraunces/Inter pairing from brand spec
  types/index.ts                shared data models
supabase/
  schema.sql                    tables + RLS policies (source of truth for schema)
.github/workflows/ci.yml        lint + type-check + test on every push/PR to main
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

**`npx expo install` does not pin a package's own native peers.** It pins
only the package you name; npm resolves that package's peer dependencies
itself and picks the newest version in range, which can be well ahead of
what Expo Go's binary actually has compiled in. The authoritative list of
native versions Expo Go ships is
`node_modules/expo/bundledNativeModules.json` — check it for the peers too,
and `npx expo install` each one explicitly so it lands in `package.json` at
the bundled version instead of floating as a transitive resolution.

Hit for real on 2026-08-28: `npx expo install react-native-reanimated` gave
4.1.7 (correct), but reanimated 4's peer range `"react-native-worklets":
"0.5 - 0.8"` let npm install worklets **0.8.3**, while Expo Go SDK 54 ships
**0.5.1**. The app died at startup before rendering anything, with
`[runtime not ready]: Error: Exception in HostFunction: <unknown>` /
`NativeWorklets`. Fixed by `npx expo install react-native-worklets`.
Note `npx expo install --check` does **not** catch this — it only validates
packages already listed in `package.json`, and the bad version was never
listed there. A `HostFunction`/native-module error at startup that no
JS-level debugging explains is the signature of this class of bug; after
fixing, restart with `npx expo start -c`, since Metro caches the bad bundle.

**`expo-file-system`'s new API** (`File`/`Directory` classes) replaced
the old one (`getInfoAsync`, `readAsStringAsync`) as of this SDK range.
This codebase currently imports from `expo-file-system/legacy` in
`RecordScreen.tsx` to keep using the old, already-working API rather
than migrating. A proper migration to the new API is a reasonable
cleanup task later, not urgent.

## EAS Build (in progress, started 2026-08-29)

Moving off Expo Go — see the dedicated plan for the full comparison
against a test-framework arc, reasoning on Dev Client vs. standalone,
and the EAS-secrets correction (`SUPABASE_URL`/`SUPABASE_ANON_KEY` are
already hardcoded in `app.json`'s `extra`, not read from `.env`; only
`EXPO_PUBLIC_SENTRY_DSN` needs an EAS secret).

**Done:** `expo-dev-client` installed; `eas.json` added with four
profiles — `development` (device, internal distribution),
`development-simulator` (extends `development`, `ios.simulator: true`,
so it can be built and tested with no Apple account at all),
`preview` (internal distribution, for sideloading/TestFlight-adjacent
testing), and `production` (`autoIncrement: true`, for store
submission). `eas login` done (account `fretz143`) and `eas init` has
linked `extra.eas.projectId` in `app.json`.

**Correction to what was assumed going in:** a missing Sentry
org/project config was expected to just degrade gracefully (native
crashes still captured, less-readable stack traces). It doesn't — the
`@sentry/react-native` Expo config plugin tries to auto-upload source
maps during every native build via `sentry-cli`, and with no org/project
configured anywhere (`app.json`'s `plugins` entry is the bare string
`"@sentry/react-native"`, no `sentry.properties` exists), that upload
step **fails the whole build**, first hit on the `development-simulator`
profile 2026-08-29. Fixed by setting `SENTRY_DISABLE_AUTO_UPLOAD: "true"`
as a build-profile `env` var in `eas.json` (all three non-`extends`
profiles — `development-simulator` inherits it). Source-map upload
(needed for readable native stack traces, not for crash capture itself)
is deferred until a real Sentry org/project + `SENTRY_AUTH_TOKEN` are
set up — a later, optional step, not a blocker.

**Blocked on, both external and only the user can do them:**
- Apple Developer Program enrollment (in progress as of 2026-08-29) —
  only blocks the `development` (device) and `production`/TestFlight
  profiles. `development-simulator` and the Android profiles don't
  need it.

First `development-simulator` build succeeded 2026-08-29 (after the
Sentry fix above) — confirms the whole pipeline (login, project link,
profile config) end to end. Install it with `eas build:run --platform
ios`, or the link/QR code EAS prints, to drag into the iOS Simulator.

**Not yet done:** installing/running the simulator build, confirming
native Sentry crash capture, Android build in parallel + BlurView/
extensionless-MIME playback on it, EAS secret for
`EXPO_PUBLIC_SENTRY_DSN`, Sentry org/project + `SENTRY_AUTH_TOKEN` for
source-map upload, Apple bundle ID/provisioning/TestFlight setup once
enrollment clears, Google Play Console account (only needed for Play
Store distribution, not sideloading).

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

**Inherits same-day reveal-gating, permanently, for past days.** The
screen's fetch is a plain `select` against `clips`, so it's subject to
the same `has_own_clip()` RLS as everywhere else (see "Reveal gating"
under "Daily Question feature"): a partner's clip for a given date is
only visible to you if you also have a clip of your own for that same
date. Unlike `RecordScreen`'s reveal, which is just delayed until you
post, a *past* day can never be retroactively posted to — so if there's
ever a day where your partner posted and you didn't, that day's clip is
permanently invisible in your own Monthly Summary stats, grid, and
"watch this month's clips" queue, not just gated until you catch up.
Confirmed on a real device (2026-08-28): a synthetic partner-only day
undercounted the partner/both-days stats and the grid by exactly one
day, consistent with `has_own_clip()` rejecting it. Accepted as
consistent with the app's existing reveal-gating philosophy rather than
treated as a bug — not fixed.

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

### Date picker setup

Both pickers (trip on Home, anniversary in Settings) went through six rounds
of real-device crashes and display bugs, all caused by how
`@react-native-community/datetimepicker` and its container were embedded —
full history in [docs/datepicker-debugging.md](docs/datepicker-debugging.md),
reusable lesson in [[feedback_datetimepicker_no_modal]] in memory.

Current state (both pickers): no `Modal`, `unmountOnBlur: true` on the tab
navigator, `display="spinner"` on iOS in a fixed-height container,
`display="default"` on Android, dates always parsed through
`parseDateString()`, **neither picker has `minimumDate`/`maximumDate`** —
date-range rules are enforced on Save via a plain string compare instead
(`handleSaveTrip` in `HomeScreen.tsx`, `handleSaveAnniversary` in
`SettingsScreen.tsx`).

### Anniversary day-counter

A separate, independent feature sharing the same shape: a single
shared "together since" date per pair, in its own `pair_anniversary`
table (not a column on `pair_trips` — deliberately kept separate since
it's a distinct feature with a different entry point). Set from a row
on `SettingsScreen.tsx` (native date picker; future dates are rejected
on Save rather than via a picker `maximumDate` — see "Date picker setup"
above), shown read-only on Home as "N days
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
picked instead of chasing the default text upward again. The DB `check`
constraint is applied on the live project; any write path that generates
a `display_name` has to respect the cap itself (`ensureProfile` slices to
20 at the source), since the constraint is the source of truth, not a
backstop.

**Two separate name features now, not one.** `display_name` above is the
name you set for *yourself*, and your partner can read it. Alongside it,
`partner_nicknames` is the name *you* give your partner, private to you —
Settings shows them as "Your name" and "Name for them". `display_name`
is unchanged and still the fallback.

It's a separate table rather than a column on `profiles` because RLS is
row-level: any column added there is covered by
`profiles_select_pair_partner` too, so the partner could read it with a
direct REST call regardless of what the app's own `select` asks for.
Column-level grants can't express "only on your own row" either — they're
per-role, not per-row. `partner_nicknames`' only select policy is
`auth.uid() = owner_id`, and it deliberately has **no** partner-read
policy, unlike every other table in `schema.sql`. `schema.sql` carries a
one-line query to verify that from the other account rather than trusting
it.

Keyed on `owner_id`, not `pair_id` — the nickname belongs to the person
who set it, so it shouldn't survive into a re-pairing with someone else.
Blank-on-save deletes the row (that's how you clear one), which is why the
check constraint's lower bound is 1, not 0, and why there's no separate
"remove" button.

Resolution order is `usePartnerName()` (`src/hooks/usePartnerName.ts`),
the single answer to "what do I call my partner on screen": your private
nickname → their `display_name` → `null`. It returns `null` rather than a
built-in fallback so each caller keeps its own wording — Timeline says
"Your partner", StoryRings says "Partner", Home drops its clause entirely
rather than naming an unknown person. Those three had already drifted
apart because each site hand-rolled its own `??` ladder. It lives outside
`hooks/queries.ts` because it reads `PairingContext`, which imports from
there.

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
file to compress. Confirmed on a real device: a full-length clip lands at
~9 MB, right against what the 720p/2.5 Mbps cap predicts for 30s.

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

`src/lib/date.test.ts` is a Jest test (`jest-expo` preset, added
2026-08-29 — see "Testing" below). It's still run under several
timezones, since that's what actually proves the split holds — Node/V8
read `TZ` once per process, so this is three separate Jest runs, not one
run with the env swapped mid-test:

```bash
npm test   # loops TZ=UTC / America/Los_Angeles / Asia/Tokyo, one jest run each
```

Never bundled by Metro — nothing in the app imports it.

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

One consequence to keep in mind when wiring UI to query state: because
every tab visit remounts and refetches, **`isRefetching` is true on a
plain screen open**, not just after a user action. `TimelineScreen`
originally passed it to `RefreshControl`'s `refreshing` prop, so opening
the Timeline expanded the pull-to-refresh spinner area and pushed the
whole list down by ~60pt until the refetch landed — and claimed a pull
had happened when none had. It now tracks its own `pulling` flag around
an explicit `refetch()`. Any future pull-to-refresh should do the same.

Query keys are plain arrays, no key factory — there are six of them:
`['pair', userId]`, `['profile', userId]`, `['clips', pairId]`,
`['clip', clipId]`, `['pairTrip', pairId]`, `['pairAnniversary', pairId]`.
Both mutations invalidate `['clips']` on success, which is what makes the
Timeline update on its own.

**One deliberate deviation from the stock defaults**, and the only one:
`usePair` sets a `refetchInterval` of 5s, but *only* while a pairs row
exists with `user_b` still null. The partner who creates an invite would
otherwise sit on `PairingScreen` forever — that screen refreshes via
`useFocusEffect`, but it's the only mounted screen at that point, so it
never blurs and never re-focuses. Chosen over Supabase realtime, which
would be the app's only websocket plus a publication change on the live
project, to cover a window that happens once per account;
`RecordScreen`'s 15s partner-reveal poll already set that precedent. The
interval returns `false` the moment `user_b` lands, so a completed pair is
never polled.

`useClip` deliberately returns `{ clip, videoUrl }` — the row fetch and
the 10-minute signed Storage URL in one `queryFn` — because
`ClipViewScreen` can never use one without the other. Note it does *not*
match the `['clips', …]` prefix, so invalidating the list never refetches
it (which is why the mark-viewed effect in `ClipViewScreen` can't loop).

`PairingContext`'s public API is `session`, `pair`, `pairPending`,
`loading`, `refreshPair`, `myProfile`, `partnerProfile`,
`refreshProfiles`; it's a thin wrapper over `usePair` / `useProfile` — so
screens read pair/profile data from one cache instead of a second copy.
`session` and the `onAuthStateChange` listener are still plain state.

**`loading` and `pairPending` are not interchangeable.** `loading` still
means only "the auth session hasn't resolved yet"; `pairPending` means "we
have a session but don't yet know whether it's paired". `RootNavigator`
gates on **both** (`loading || (session && pairPending)`). It gated on
`loading` alone until 2026-08-29, which meant that on a cold start with a
stored session, `loading` flipped false while the pair query was still in
flight — `pair` undefined, so `isPaired` false — and an already-paired
user got a flash of `PairingScreen` before `MainTabs` swapped in. A user
with genuinely no pair still lands on `PairingScreen`: that query resolves
to `null`, which is not pending. A pair query that exhausts its retries
and errors also falls through to `PairingScreen`, same as before.
`useProfile` is called twice (mine, partner) rather than the old single
`.in('id', [...])` — two cheap requests, but the partner one stays
`enabled: false` until `partnerId` resolves.

**Partially adopted, on purpose.** Migrated: `TimelineScreen`,
`ClipViewScreen`, `PairingContext`, `RecordScreen`'s upload, and — as of
2026-08-29 — `HomeScreen`'s and `SettingsScreen`'s reads.
Still querying Supabase inline: `MonthlySummaryScreen`, `PairingScreen`,
and `RecordScreen`'s `loadTodayClips` (+ its 15s partner-reveal poll).
Those still rely on `useFocusEffect` refetching, so `unmountOnBlur` must
stay — and the migrated screens now depend on it too, for the opposite
reason: remount is what refetches them.

**Why Home and Settings were migrated: they flashed wrong content, not
blank space.** Both held fetched rows in `useState` initialised to `null`,
and `unmountOnBlur` remounts them on every tab visit — so the state reset
to its falsy default each time and the screen rendered "Not set", "Plan
your next visit" and a missing anniversary line *as though those were
loaded data*. No spinner would have fixed that; the fix was to stop
throwing the value away. The cache now serves the previous row instantly on
remount and refetches behind it, so the flash only exists on a cold start.
Net −52 lines, and no skeleton components.

Two details worth keeping: `HomeScreen`'s "you haven't answered" dot is
derived from `['clips', pairId]` — the list `TimelineScreen` already
populates, so arriving from that tab costs no request — and it renders on
`answeredToday === false`, never on `undefined`, so it can't assert you
haven't posted before it knows. Saves write the upsert's returned row back
with `setQueryData` rather than invalidating, which keeps the old
`setTrip(data)` immediacy and, because the cache is shared, updates
`HeroCard` on the Timeline tab too.

Not done, both deliberate: no `focusManager`/`AppState` wiring (so
returning from background doesn't refetch on its own — add if that feels
stale in practice), and no AsyncStorage cache persistence (offline reads
are their own backlog item).

## Account deletion

`delete_own_account()` (`supabase/schema.sql`), called from
`AccountSettingsScreen` via `useDeleteAccount`. **`security definer`, takes
no arguments** — the target is always `auth.uid()`, so there's no parameter
a caller could point at someone else's account.

**No service_role key, no Edge Function, no Vault.** That key is only needed
to reach the Admin API *over HTTP*; a `security definer` function owned by
`postgres` deletes the `auth.users` row directly. Verified against a
throwaway account on the live project (2026-08-29) inside a rolled-back
transaction, impersonating an `authenticated` user — so it tested the real
client path, not the SQL editor's privileged one.

The Vault + pg_net pattern used by `cleanup_orphaned_clip_files` would have
been the *wrong* precedent here even though it's in this repo. It suits that
job because the job is unattended and self-healing: pg_net is
fire-and-forget, so a failure is just retried tomorrow. A user tapping
"Delete account" needs a synchronous yes/no, which pg_net structurally can't
give. And `cleanup_orphaned_clip_files` revokes execute from
`authenticated` — making a function that holds a service key client-callable
would invert the one property that keeps it safe.

**The cascade is accepted, not mitigated.** Every FK in `schema.sql` is
`on delete cascade`, so deleting your `auth.users` row takes your profile,
the `pairs` row you belong to, and through it `clips`, `daily_answers`,
`pair_trips` and `pair_anniversary` — **including your partner's**. They
keep their login and profile and lose everything shared.

**The partner's running app does not notice until it is relaunched.**
Nothing refetches `['pair', userId]` once a pair is complete: `refreshPair`
is only called from `PairingScreen`, `usePair`'s `refetchInterval` returns
`false` for a complete pair, `PairProvider` mounts at the app root so
`unmountOnBlur` never remounts it, and there's no `focusManager`/`AppState`
wiring (see "Data layer"). So until they force-quit, the partner keeps a
stale `pair` and sees a tab bar over an app that looks like a fresh empty
pairing — Timeline's empty state, Home's "Plan your next visit" — and
recording fails with an RLS error rather than a handled message. On next
launch the gate routes them to `PairingScreen` correctly. Accepted for now;
wiring `focusManager` to `AppState` is the fix if this ever matters, and
would make the whole app refresh on foreground rather than just this case.

Blocking deletion while paired was
considered and rejected: there's no unpair feature, so it would mean
building one first. Notifying the partner needs a tombstone row that
survives the cascade plus somewhere to show it. Soft-delete makes "Delete
account" not a deletion. So the confirmation copy carries the consequence
instead, naming the partner via `usePartnerName()`.

**Confirmation is two chained `Alert`s**, not a typed "DELETE". Typed is
stronger, but `Alert.prompt` is iOS-only in React Native and the Android
half would need a custom `Modal` — which is what six rounds of device
crashes came from here (`docs/datepicker-debugging.md`). The second alert
exists so the destructive button can't be hit by muscle memory from the
sign-out row directly above it.

**Storage is purged by the delete path itself**, via pg_net requests fired
from `delete_own_account()` before the row cascade runs — the pairs row has
to still exist to find the objects by prefix.

It originally leaned on the nightly `cleanup_orphaned_clip_files`, which
does find these files (cascaded clip rows leave textbook orphans), but not
for 24–48h. That lag isn't a tuning choice: the job's grace period exists to
protect an **in-flight upload**, since `useUploadClip` writes the file before
its row, so a just-uploaded file is briefly a legitimate orphan. None of that
applies to a deleted account, whose rows are never coming back. Fine for a
free-tier quota sweep, not fine for "delete my account" — especially with the
App Store's account-deletion expectations in view. The nightly job stays as
the backstop for anything the requests miss.

**It has to be server-side.** A client-driven purge can't work here:
`clips_select_pair_members` hides a partner's clip on any date you didn't
post one, so the client cannot enumerate the very files it would need to
delete, and would silently skip exactly those. `storage.objects` also has no
DELETE policy for the client to use. Matching is done on the storage prefix
(`<pair-id>/…`) rather than by joining `clips`, for the same reason.

**Object names are anchored to `<uuid>/<uuid>/<YYYY-MM-DD>` before being put
in a URL**, in both this function and the nightly job. The storage INSERT
policy only constrains the *first* path segment, so a crafted name like
`<pair-id>/../../other` satisfies it — and both functions interpolate the
name straight into a Storage API URL. A non-matching name is skipped rather
than requested.

**A missing Vault secret degrades, it doesn't block.** The account is still
deleted and the nightly job picks the files up; refusing to delete an account
because a storage credential is absent would be the worse failure. pg_net is
fire-and-forget, which is acceptable *here* precisely because that backstop
exists — the same reasoning that makes it unacceptable for the account
deletion itself.

`signOut` is scoped to `'local'` in `useDeleteAccount`. The default revokes
server-side, but the user it belongs to is already gone by then, so that
call fails and would strand the app holding a session for a deleted account.

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

## RLS hardening (2026-08-28 audit)

Prompted by deciding whether the Supabase anon key — briefly committed to
git before `.env` was gitignored (see the `.env` secrets hygiene item in
memory) — needed rotating. It doesn't: the anon key is meant to be public
in a Supabase app, safe as long as RLS covers everything. Auditing that
coverage instead turned up three real gaps, since fixed on the live
project and in `schema.sql`:

1. **`pairs` had an UPDATE policy with no `with check`.** `using` alone
   only restricts which rows a policy touches, not what they can be
   changed to — so any pair member could call the REST API directly
   (not through the app's own code, which never did this) and rewrite
   `user_b` to an arbitrary account or change `invite_code`, bypassing
   `join_pair_by_code()`'s atomic "only if unclaimed, only by exact code"
   invariant entirely. Fixed by dropping the policy — the app has no
   legitimate use for a client-side `pairs` update at all.
2. **`clips`' UPDATE policy was scoped to "any pair member," not "the
   sender."** Same missing-`with check` issue: a recipient could rewrite
   any field of the *other* partner's clip (caption, storage path, even
   which day it's recorded for), not just mark it viewed. Fixed by
   scoping the policy to `sender_id = auth.uid()` (preserving
   `useUploadClip`'s upsert-based "overwrite in place" design for your
   own clip) and moving the recipient's one legitimate write — marking a
   clip viewed — into a narrow `mark_clip_viewed()` security definer
   function instead, mirroring `join_pair_by_code()`'s existing pattern
   of using a function where RLS alone can't scope a write tightly
   enough. `useMarkClipViewed` (`src/hooks/mutations.ts`) now calls
   `supabase.rpc('mark_clip_viewed', ...)` instead of a raw table update.
   Confirmed on a real device (2026-08-28): watching a clip still clears
   its unwatched dot with no error, so the RPC swap didn't break the
   live path.
3. **`storage.objects` had no UPDATE policy**, only INSERT and SELECT.
   Supabase Storage's `upsert: true` upload needs both to actually
   overwrite an existing object — without the UPDATE policy, a same-day
   re-record or a retry after a partial upload failure would fail with a
   permissions error instead of overwriting. Added
   `clip_files_pair_members_update`, mirroring the existing insert/select
   policies. **Not verified on-device** — the app's current UI has no
   "re-record after send" path, so this is a correctness fix for a case
   that isn't actually reachable right now, not something a device test
   could exercise today.

None of these three had ever been exploited or hit in practice — they
were latent gaps in what the REST API allowed, not observed bugs — found
by reading `schema.sql` against what the app's own client code actually
calls (`grep -rn "from('pairs')"` etc.), not by an incident.

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

## Testing status

Current state only. Dated verification history: [docs/testing-log.md](docs/testing-log.md).

**Confirmed on a real device or the live project:**
- `date.ts`'s day-boundary logic under Jest (`jest-expo`, added 2026-08-29),
  wired into CI (`npm test`) so it's no longer possible to regress the
  UTC/local split silently — all 11 assertions pass under `TZ=UTC`,
  `America/Los_Angeles`, and `Asia/Tokyo`
- Email OTP sign-in; two-user pairing (create, join, reused-code rejection)
- Camera recording, upload, playback, viewed-status marking
- Reveal gating — a partner's clip is hidden until you post your own that day;
  two-account pass confirms the `revealed` phase resolves in both directions
  without a manual refresh
- Video daily question: 30s recording cap auto-stops (native `maxDuration`,
  matching the on-screen countdown), and the caption step's text shows
  correctly on the "You" card
- Extensionless `storage_path` + real MIME types, iOS only; old `.mov` rows
  still play
- Capture-time compression: 720p / 2.5 Mbps caps hold (~9 MB for a full clip)
- Partner nicknames, incl. the 20-char DB check constraint
- TanStack Query data layer: Timeline updates without manual refresh, reel
  auto-advances
- Pull-to-refresh no longer opens a gap on plain screen open
- Bottom tab bar
- Home and Settings reading through the query cache: repeated tab visits show
  the real trip, anniversary and days-together line immediately, with no
  flash of "Plan your next visit" / "Not set", and Home's unanswered dot no
  longer appears on a day already posted. Saving a trip updates HeroCard on
  the Timeline tab with no manual refresh, which the old local-state write
  couldn't do
- `cleanup_orphaned_clip_files` including its object-name guard: a manual run
  with `grace_period` 0 swept 9 real orphans in one pass, all 200 in
  `net._http_response`, leaving the bucket at 0 orphans. Confirms the guard's
  regex accepts genuine paths rather than silently matching nothing
- Account deletion purging clip files immediately: on a throwaway pair with a
  clip from each side, both objects were gone from the bucket within seconds
  of deleting (not the next nightly run), and `net._http_response` showed two
  200s. Includes the partner's file, which is the half a client-driven purge
  could never have reached
- Account deletion from Account Settings: both alerts fire, Cancel at either
  step aborts with nothing deleted, confirming lands on AuthScreen. Cascade
  verified in SQL on a throwaway pair that had a real clip from each side —
  auth.users row, pairs row and clips rows all 0 afterwards. The partner's
  device routes to PairingScreen after a force-quit and relaunch (not while
  running — see "Account deletion"). The two Storage objects correctly
  survive the row cascade, awaiting the nightly sweep
- Pairing auto-refresh: the invite creator's app moved to MainTabs on its own
  within ~5s of the partner joining, with the creating device left
  foregrounded and untouched — the case `useFocusEffect` could never catch
- Cold-start gate: force-quit and reopen on a paired account with a stored
  session goes straight to MainTabs, no flash of PairingScreen
- Private partner nickname: renders for the person who set it, `Your name`
  still edits `display_name`, blank-on-save clears it — and the partner
  cannot see it, confirmed both in-app from the second account and at the
  RLS layer (0 rows visible, 0 leaked, while impersonating the partner in a
  transaction)
- Timeline card colour: the `*Soft` fills plus the 4pt left edge read as
  distinct at a glance and don't compete with HeroCard — iOS
- Account Settings sub-screen: email reads there and is gone from Settings,
  `Account ›` pushes with the tab bar still visible, sign-out confirmation
  works both ways. `unmountOnBlur` still tears the nested stack down on a
  tab switch (reopens on Settings, not Account), and the anniversary
  spinner still opens and saves with a navigator now between the tab and
  the screen that owns it
- Trip + anniversary pickers: epoch-display bug fixed, values persist and reload
- Trips + anniversary two-account pass: either partner sets, both see the same
  value after a tab-away-and-back (no live sync — focus/remount refetch only)
- Save-time range rejection: both alerts fire (trip before today, anniversary
  after today), and today itself saves on both — the boundary is inclusive
- HeroCard on real trip data; story rings track any unwatched clip, not just
  today's
- HeroCard's anniversary branch ("N days / together", "since <date>") and its
  "neither set" state (bare split card, heart only, no text)
- HeroCard's past-trip fallthrough: a `pair_trips` row dated in the past
  correctly falls through to the anniversary branch instead of showing
  anything trip-related
- Empty states: Timeline with no clips, PairingScreen with an unclaimed invite
- Fonts (Fraunces/Inter), gradient record button, frosted prompt card,
  entrance motion — iOS
- Storage orphan cleanup: deletion confirmed end to end, nightly `pg_cron` job
  fires
- App boots on `@sentry/react-native` 7 and the pinned `react-native-worklets`
- Monthly Summary: stats/grid against real multi-day data (seeded), month
  navigation between an empty and a populated month; inherits same-day
  reveal-gating for past days (see "Monthly Summary feature" above) —
  accepted, not a bug
- Daily local notification: permission granted (surfaces under "Expo Go" in
  iOS Settings, not "While You Sleep" — an Expo-Go-only quirk, won't
  reproduce that way in a standalone build); `ensureDailyRemindersScheduled`
  actually schedules a real repeating `UNCalendarNotificationTrigger` with
  the correct device-local hour/minute for 20:00 UTC (verified 13:00 at
  UTC-7)

**Not verified:**
- Video daily question, remaining piece: `RETIRED_REMINDER_IDS` cleanup on a
  device that had the old two-reminder version
- Monthly Summary reel's end-of-queue behavior (what happens after the last
  clip finishes) — not exercised this pass, since the seeded rows used fake
  `storage_path` values with no real video to play
- UTC shared day boundary across two real timezones, incl. Timeline's
  "Today"/"Yesterday" labels near the boundary
- Anything on Android: extensionless `storage_path` (`video/mp4`), BlurView's
  `dimezisBlurView` on the prompt card
- Daily local notification: actually firing at 20:00 UTC and tap routing to
  Home (permission grant and correct scheduled local time are confirmed —
  see "Confirmed" list)
- Story-ring colors at the reveal-gating boundary: the gray-because-invisible
  case (partner has posted, you haven't yet) — needs a fresh day, since it's
  unreachable once both have posted. The unwatched→watched transition itself
  is confirmed.
- Splash holding with no flash of unstyled text
- Gradient record button's press-scale feel; entrance motion not re-triggering
  on scroll or pull-to-refresh
- `clips_update_own_as_sender` and `storage.objects`' UPDATE policy (RLS
  hardening, see that section above) — not reachable through the app's
  current UI, since there's no re-record-after-send path

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
  "partner" (`src/theme/colors.ts`). The `*Soft` steps were added to that
  file's existing scale (Dark → base → Light → Soft → Tint), not chosen
  fresh: `*Tint` sits only ~4% off `background`, so a card filled with it
  reads as plain white. The `*Tint` values themselves are unchanged —
  `secondaryTint` also backs `Button`'s secondary variant, which is a
  different semantic and shouldn't move with the Timeline.
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
- Update "Testing status" above with anything newly verified (or newly
  broken), and append the dated detail to `docs/testing-log.md`.
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
