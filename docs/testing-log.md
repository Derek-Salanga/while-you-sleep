# Testing log

Dated verification history for While You Sleep. Current state — what works,
what's unverified — is in [CLAUDE.md](../CLAUDE.md#testing-status); this file
is the append-only record behind it. Newest entries at the bottom.

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

Confirmed by the user against PR #20's checklist before merging
(2026-08-27): the TanStack Query data layer (see "Data layer" above) —
Timeline loads and pull-to-refresh still works, recording a clip makes it
appear on Timeline with no manual refresh (the headline change), watching
a partner's clip clears its unwatched dot on return, the Monthly Summary
reel still auto-advances, and the `PairingContext` rewire regressed
nothing (nickname edits, a fresh join, and cold start all still behave).
Reported as a pass rather than re-verified here.

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

Note both accounts had posted for the same day before that check, so it
confirmed both clips are watchable once revealed but did not exercise the
gate itself. **The gate is now confirmed too (2026-08-28, two real
accounts): a partner's clip is hidden until you have posted your own for
that day.** That is the app's core mechanic and had never been tested from
the blocked side until now — every prior pass had both partners already
posted, which is exactly the state that cannot see the gate work.

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

Confirmed on a real device by screenshot (2026-08-28, iPad/Expo Go) across
the whole 2026-08 UI pass:

- **#26 fonts** — Fraunces renders on the Home and Timeline titles, Inter on
  body text. Not a system fallback.
- **#27 HeroCard** — split card renders, and the heart halves do take the
  *opposite* side's color, which is the crossover the icon uses.
- **#28 story rings** — both rings render with avatar initials.
- **#29 gradient record button** — the Home CTA carries the blue-to-orange
  gradient, and the RecordScreen capture button is a gradient circle rather
  than the old solid red. **The regression check passed**: Home's
  trip-planning card is still a plain white card, unaffected by splitting
  `recordCta` out of the shared `entryCard` style.
- **#31 frosted prompt card** — genuinely blurred over the live viewfinder,
  orange "TODAY'S CLIP" eyebrow, prompt in Fraunces, clearly legible.
- **#32 entrance motion** — Timeline cards fly in on mount, and it reads as
  brief rather than a slow cascade.
- **#33** — one heart, unchanged in appearance.

That the app boots is itself load-bearing here: until `react-native-worklets`
was pinned to 0.5.1, every branch carrying react-native-reanimated died at
startup before rendering (see "SDK version notes" above).

**That pass also found two defects, both regressions from this work, fixed
on `fix/dot-contrast-and-ring-label` and confirmed by a follow-up
screenshot:** the Home CTA's unanswered dot was `colors.error` salmon on the
gradient's amber end and so was invisible (it was rendering the whole time —
the "you haven't answered today" signal was silently lost the moment that
card stopped being white); and `StoryRings`' container was pinned to the
ring's own 64px, so a 20-char `display_name` wrapped mid-word
("dereksalan / ga+part1"). Dot is now white; the label has its own width and
ellipsizes on one line, with the ring and avatar moved into an inner
RING_SIZE box so the avatar's absolute offsets still resolve against the
ring. Both verified on device.


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
- The extensionless `storage_path` change **on Android** (`video/mp4`).
  iOS is confirmed (below), but the point of the change is that the two
  platforms write to the same path, and that cross-platform case is the
  one that can't be exercised on this user's iPad-only setup. Until an
  Android device runs it, the `.mov`/`.mp4` collision it fixes stays
  theoretically-fixed rather than demonstrated.
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
- Residue from the 2026-08 UI pass. Most of it is confirmed by screenshot
  (see the note above); what that pass could **not** reach:
  - #27 HeroCard: **resolved by #37** — the card now derives from
    `pair_trips` / `pair_anniversary` instead of the hardcoded "Day 14"
    and "Your city"/"Partner's city", and falls back to no text when
    neither is set. Confirmed on device (see below). The *anniversary*
    branch is still unexercised: this pair has a trip set but no
    anniversary, so only the trip path has actually rendered.
  - #28 story rings: **resolved by #36, confirmed on device (2026-08-28)**
    — the rings and the Timeline used to contradict each other, because
    the ring considered only *today's* clips: an unwatched clip from an
    earlier day showed a grey (watched-looking) ring above a card wearing
    a red unwatched dot. The ring now tracks any unwatched clip, newest
    first. See the A/B note below for how this was finally pinned down.
  - #28 story rings, separately: the ring colors at the real reveal-gating
    boundary. RLS hides a partner's clip until you've posted your own that
    day, so "partner hasn't posted" and "posted but still gated" render
    identically. Needs a two-account pass.
  - #26 fonts: that the splash holds with no flash of unstyled text. The
    fonts themselves are confirmed; only the splash timing is unobserved.
  - #29 gradient record button: the press-scale *feel* (a still screenshot
    can't show it). Appearance and the trip-card regression are confirmed.
  - #30 empty states: neither has been seen. Timeline's needs an account
    with no clips; PairingScreen's needs an unclaimed invite to sit on.
  - #31 frosted prompt card: **Android blur is unverified** —
    `experimentalBlurMethod="dimezisBlurView"` is set, without which
    BlurView degrades to plain translucency there, and this setup is
    iPad-only. iOS legibility is confirmed.
  - #32 entrance motion: that scrolling a longer timeline doesn't
    re-trigger it, and that pull-to-refresh doesn't either. The mount
    animation itself is confirmed.

Confirmed on a real device (2026-08-28, iPad/Expo Go): **#37, HeroCard on
real data.** The Timeline header reads "65 days / until we meet" with
"🇵🇭 Philippines / November 1, 2026", matching Home's own trip card exactly
— which also cross-checks that moving `daysBetween` into `date.ts` left
Home's countdown intact. No placeholder text remains anywhere on screen.

Two caveats on that pass: the **anniversary fallback never rendered** (this
pair has a trip but no anniversary, so only the trip branch ran), and the
"neither set" empty state is likewise unseen.


Confirmed on the live project (2026-08-28): **the nightly `pg_cron` job
actually fires.** `cleanup-orphaned-clip-files` (jobid 1, `17 4 * * *`,
active) ran at 04:17:00.22 UTC and finished 90ms later with
`status = 'succeeded'`. That rules out the failure this was open on: pg_cron
only runs in the `postgres` database on Supabase, and the project could have
been auto-paused through the window. It also means the `service_role_key`
Vault secret still resolves, since the function raises without it.

What it does **not** prove is that anything was deleted. `succeeded` only
means the function ran — pg_net is async, so a failed Storage call lands in
`net._http_response`, never in `cron.job_run_details` (see "Storage cleanup"
above). With no orphans present there would have been no HTTP calls at all.
Deletion itself was confirmed separately on 2026-08-27 with a planted junk
file, so the two passes together cover the whole path.


Confirmed on a real device (2026-08-28): **#36's story-ring fix**, via a
deliberate A/B against `main` on identical data. Partner's clip for *today*
marked watched, an *earlier* one left unwatched: `main` drew a grey ring
above a card still wearing its red unwatched dot, and the fix branch drew an
orange one. Same rows, same screen, opposite conclusions -- which is the bug.

Worth recording how many attempts this took, because the trap is easy to
fall into again. Three earlier device checks all *looked* like they
confirmed the fix and confirmed nothing: each time the partner had posted
that same day, a state the old today-only logic also handles, so both
versions agreed. The versions diverge only when the unwatched clip is from
an earlier day **and** nothing is unwatched today -- a state that is rare in
casual use and has to be set up deliberately:

```sql
update clips set viewed_at = now()  where id = '<partner clip, today>';
update clips set viewed_at = null   where id = '<partner clip, earlier day>';
```

Also note the logged-in account had switched between passes (`+part1` vs
`+part2`), which silently inverted which rows counted as "the partner's".
Check whose clips render blue/right (yours) before picking rows to edit.


Confirmed on a real device (2026-08-28), from the day's screenshots rather
than a dedicated pass:

- **Timeline with real clip data.** Four clips across two days render with
  the right sender labels, humanised dates ("Today"/"Yesterday") and
  mine-vs-partner sides. Note the sides key off the *signed-in* account, so
  the same rows swap colour and alignment when you switch accounts -- which
  caused a false start while setting up the #36 test.
- **Clip playback and viewed-status marking.** Watching a partner's clip
  cleared its unwatched dot and wrote `viewed_at`, verified directly in the
  `clips` table rather than only on screen.
- **#40, the pull-to-refresh fix.** Opening the Timeline no longer leaves a
  ~60pt gap above the first card; a real pull still shows the spinner and
  reloads.
- **#42, `@sentry/react-native` 7.2.0.** The app boots. That is the check
  that mattered: this is a startup-path package, and CI cannot see a crash
  before first render -- the react-native-worklets crash earlier that day
  passed CI too. The JS SDK now matches the native module Expo Go bundles,
  and `npx expo install --check` reports no drift at all.


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

Confirmed on a real device (2026-08-28, `docs/two-account-testing-pass`,
two accounts): the video daily question's `revealed` phase and its
reveal-gating resolve in both directions without any manual refresh.
Account A posted first and sat on "Waiting for your partner to answer…";
after Account B recorded, A's screen swapped in the partner card on its
own within a few seconds (the 15s `loadTodayClips` poll in
`RecordScreen.tsx`). B, having posted second, was shown A's clip a few
seconds after finishing their own recording — the case where RLS's
`has_own_clip()` starts permitting the partner row the moment your own
row exists.

Still open on that bullet: the question overlay at the 30s cap and the
caption step weren't checked off explicitly on this pass, and
`RETIRED_REMINDER_IDS` cleanup still needs a device that had the old
two-reminder version scheduled.

Same pass, story rings: on Account A the partner ring went gray after
watching Account B's clip, confirming the unwatched→watched transition
drives the ring color off `viewed_at` with no manual refresh. The
gray-because-invisible case at the reveal boundary (partner has posted,
you have not, so RLS hides their row entirely and the ring is gray for a
different reason) was not reachable on this pass — both accounts had
already posted by the time the rings were checked. It needs a fresh day
where only one account posts.

Same pass, trips + anniversary across two accounts: values set by one
partner show up for the other after switching tabs away and back, exactly
as the focus/remount refetch predicts — nothing updates live while sitting
on an already-open screen, since there is no realtime subscription
anywhere in the app.

Same pass, save-time range rejection: both alerts fire as written — "That's
in the past" for a trip date before today, "That's in the future" for an
anniversary date after today — and the form stays open with nothing saved.
Today itself saves on both, confirming the boundary is inclusive on each
side, which the plain `YYYY-MM-DD` string compare in `handleSaveTrip` /
`handleSaveAnniversary` is what gives you. This closes the open question
left on the `fix/anniversary-epoch-date` entry above, which had noted the
rejection case was never explicitly tried.

Same pass, HeroCard's two remaining branches, checked on-device by
deleting the backing rows in the SQL editor (there is no in-app way to
unset either value). With only an anniversary left, the card reads
"6 days" / "together" on the left and "since" / "August 22, 2026" on the
right. With both rows gone it renders as a bare split-color card — heart
icon only, no text in any of the four slots, which is the intended
"neither set" state rather than a placeholder string.

Not exercised: the past-trip fallthrough, where a trip whose date has
already passed makes the card silently show the anniversary instead. It
is unreachable through the UI, since save-time validation refuses a past
trip date in the first place; it would need a row edited directly in SQL.

Same pass, both empty states. Timeline with every `clips` row deleted shows
the CrossoverHeart, "Your story starts here", and "Record your first clip.
Your partner will find it waiting when they wake up." — with HeroCard and
the story rings still rendered above it, as intended. The same screen also
incidentally confirms the "You" ring drops to gray once you have no clip
for today, the inverse of the ring check above.

PairingScreen's unclaimed-invite state, checked on a throwaway third
account rather than by breaking the existing pair: heart icon, "Waiting for
your other half", the "Your invite code" label, the generated code, and the
"Share this code with your partner…" helper text, above the usual join
field and Sign out.

Confirmed on a real device (2026-08-28, main pair, via a `pair_trips` row
inserted directly in SQL since the app's own save-time validation refuses
a past trip date): with a trip dated 10 days in the past and an
anniversary both present, HeroCard shows the anniversary branch ("29
days" / "together" / "since July 30, 2026"), not the trip. Confirms the
`showTrip` guard (`daysToTrip >= 0`) correctly falls through to the
`else if (anniversary)` branch rather than rendering stale trip data.

One mixup worth noting for next time: this pair (`dereksalanga@gmail.com`
/ `dereksalanga+partner@gmail.com`) is one of several joined pairs left
over from earlier throwaway test accounts in this session. A first
attempt at finding "the" pair via `where user_b is not null limit 1`
happened to land correctly, but was second-guessed and reverted before
being confirmed against `auth.users` — costing a redo. Matching against
`auth.users.email` first is the reliable way to find the right `pair_id`
when multiple test pairs exist.

Confirmed on a real device (2026-08-28, two fresh accounts paired
specifically for this check, since the main pair had already posted for
the day): letting the recording run without manually stopping it, it
auto-stopped right at 30s — the native `recordAsync({ maxDuration: 30 })`
cap, not just the JS-side countdown pill display. The caption step's text
("thank u") shows correctly on the "You" card in the `revealed` phase.
Still open on the video-daily-question bullet: `RETIRED_REMINDER_IDS`
cleanup, which needs a device that had the old two-reminder version
scheduled before this feature's merge.

Confirmed on a real device (2026-08-28, main pair, 9 synthetic `clips`
rows seeded across August via SQL): Monthly Summary's stats tiles and
calendar grid render correctly against multi-day data, and month
navigation between an empty month (July, "No clips this month", disabled
button) and the populated one (August) works, including the `>` button
correctly disabling once back on the current month.

One real finding from this pass, not a test artifact: the screen's stats
undercounted by exactly one day, and a synthetic day-10 partner-only clip
was invisible in the grid — because `MonthlySummaryScreen`'s fetch is a
plain `clips` select, so it's subject to the same `has_own_clip()` RLS
that gates `RecordScreen`'s reveal. Unlike that reveal, which just delays
until you post, a past day can never be retroactively posted to, so a day
where only your partner posted and you didn't is permanently excluded
from your own Monthly Summary. Verified this was the cause (not a UI bug)
by checking the rows existed in the database via a direct `select`, then
confirming the one row Monthly Summary dropped was exactly the one
`has_own_clip()` would reject. Discussed with the user; decided to accept
this as consistent with the app's existing reveal-gating philosophy
rather than fix it — see "Monthly Summary feature" in CLAUDE.md.

Not exercised this pass: the reel's end-of-queue behavior, since the
seeded rows had fake `storage_path` values with no real video to
actually play through to the end.
