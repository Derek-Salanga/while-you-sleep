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
- React Navigation (native stack)
- expo-camera for recording, expo-video for playback (not expo-av —
  deprecated in this SDK range)
- expo-notifications for the daily question/clip reminders — local
  on-device scheduling only, no push-token/server infra
- ESLint (`eslint-config-expo` + `eslint-config-prettier`) + Prettier
- Sentry (`@sentry/react-native`) for error/crash tracking — optional,
  no-ops if `EXPO_PUBLIC_SENTRY_DSN` is unset

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
    date.ts                    todayDateString() — shared YYYY-MM-DD helper
    notifications.ts           schedules the daily question/clip local reminders
  data/
    dailyQuestions.ts          bundled prompt pool + date -> prompt selector
  navigation/
    RootNavigator.tsx          gate: Auth -> Pairing -> Home (Timeline)
  screens/
    AuthScreen.tsx              email OTP sign-in (send code -> verify code)
    PairingScreen.tsx           create/join pair via invite code
    RecordScreen.tsx            camera capture + upload to Supabase Storage
    TimelineScreen.tsx          card feed of clips + question/summary entry cards
    ClipViewScreen.tsx          expo-video playback; optional `queue` param
                                plays a sequential reel (Monthly Summary) instead
                                of a single clip
    DailyQuestionScreen.tsx     answer/reveal flow for the daily question
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

## Daily Question feature

Each pair gets one shared prompt per day, picked deterministically from
a bundled list (`src/data/dailyQuestions.ts`) by date — no server-side
scheduling needed, both partners always see the same prompt. Each
partner submits one text answer per day (`daily_answers` table, unique
per pair/user/date, same shape as `clips`'s unique constraint). Answers
are a reveal mechanic like clips: you can see your partner's answer
only once you've submitted your own for that day. No editing after
submit, same as clips.

Two local (on-device, not push) notifications fire daily at 8:00 PM —
one nudging toward the question, one toward recording the clip. They're
scheduled once a pairing exists (`RootNavigator`), by fixed identifier
so re-scheduling replaces rather than duplicates. They fire on schedule
regardless of whether you've already done either that day — no
suppression logic yet; a reasonable follow-up, not v1.

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
is one upsert on `pair_id`.

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

### Date picker: two real-device bugs, both from the same cause

Both date pickers (trip and anniversary, below) went through two
rounds of real-device fixes, both caused by how
`@react-native-community/datetimepicker` was embedded:

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

Current state (both pickers): no `Modal`, `display="inline"` on iOS,
`display="default"` on Android. Not yet re-verified on a real device.

### Anniversary day-counter

A separate, independent feature sharing the same shape: a single
shared "together since" date per pair, in its own `pair_anniversary`
table (not a column on `pair_trips` — deliberately kept separate since
it's a distinct feature with a different entry point). Set from a row
on `SettingsScreen.tsx` (native date picker, `maximumDate` capped at
today), shown read-only on Home as "N days together" under the title.
Same RLS shape as `pair_trips`, same local-calendar-day math.

## Known transient error: "JWT issued at future"

Seen occasionally on cold start from `PairingContext.tsx`'s `ensureProfile`
/ `refreshPair` calls. This is PostgREST's server-side JWT `iat` check,
not a client/device clock issue — most likely explained by the Supabase
project cold-starting from free-tier auto-pause with a few seconds of
clock drift before it NTP-syncs. It self-corrects within a couple
seconds, so `PairingContext.tsx` wraps those two calls in
`withClockSkewRetry` (short retry with backoff) rather than trying to
"fix" the skew itself.

## Testing status (update this section as things get verified)

Confirmed working end-to-end:
- Email OTP sign-in (send code, receive via Resend, verify)
- Pairing screen loads
- Camera recording
- Upload (record -> Supabase Storage -> `clips` row) — re-confirmed
  2026-08-25 after the `expo-file-system/legacy` fix; partner device
  received the clip.

Visually confirmed only (2026-08-26, `fix/screen-polish-and-nav-fixes`
in Expo Go, not a functional re-test):
- Auth screen's "While You Sleep" title renders
- Pressed/active feedback shows on buttons across all five screens
- Timeline clip dates render humanized ("Today" / "Yesterday" / "Aug 25")
- ClipView close button renders and is tappable

Confirmed on `feat/daily-question` (2026-08-26, Expo Go, one-sided —
only one partner's account exercised so far):
- Answer submission works end-to-end against the live Supabase project
  (this is what surfaced and confirmed the RLS self-recursion bug in
  the select policy, since fixed via a `security definer` function)
- DailyQuestionScreen's close button navigates back (to wherever it was
  opened from — Home, as of the bottom-tab-nav change)

Not yet tested:
- Full two-user pairing (only the pairing screen loading has been
  tested, not two real accounts completing a pair)
- Timeline screen with real clip data
- Clip playback / viewed-status marking
- Daily Question: the reveal-after-both-answer behavior specifically
  (needs a second account), and the Timeline entry card's
  answered/not-answered dot
- Daily local notifications: permission prompt, both firing at 8:00 PM
  on a real device, and that tapping one routes to Home (deliberately
  deferred by the user for now)
- Monthly Summary: stats/grid correctness against real multi-day data,
  month navigation, and the sequential reel's auto-advance +
  end-of-queue behavior in `ClipViewScreen`
- Trips/Goals and anniversary day-counter: found broken twice on real-
  device passes (2026-08-27) — see "Date picker: two real-device bugs"
  under "Trips/Goals feature" above for both. First: tapping the trip
  card crashed the app, and the calendar was mostly clipped/not
  visible for both pickers (custom `Modal` wrapping). Second, after
  that fix: tapping the trip card crashed again (iOS `display="compact"`'s
  popover). Trip location is now a country picker (with flag) instead
  of free text, per the user's follow-up request — that part hasn't
  been tested at all yet either. Not yet re-verified on a real device
  since the latest fix. Still needs both a single-account pass (set/edit
  a trip incl. country, and an anniversary date, confirm both persist
  and the countdown/day-count are correct) and a two-account pass
  (confirm either partner can set or overwrite either one and both see
  the same values)

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
