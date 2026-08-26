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
- DailyQuestionScreen's close button navigates back to Timeline

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
