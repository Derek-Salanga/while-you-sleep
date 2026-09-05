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

Confirmed on a real device (2026-08-28, UTC-7): notification permission
is granted, though under Expo Go in this dev setup — since this runs in
Expo Go rather than a standalone build, iOS groups the OS notification
permission under "Expo Go" in Settings, not under "While You Sleep". That
grouping is an Expo-Go-only artifact and won't reproduce once this moves
to an EAS Dev Client or a production build, where the app gets its own
Settings entry.

Confirmed the actual scheduling, not just the display math: temporarily
added a `console.log(await Notifications.getAllScheduledNotificationsAsync())`
at the end of `ensureDailyRemindersScheduled` (reverted immediately after),
reloaded the app while paired, and read the Metro log. It returned a real
`UNCalendarNotificationTrigger` with `hour: 13, minute: 0, repeats: true`
under identifier `daily-question-reminder` — exactly what 20:00 UTC should
translate to at UTC-7, confirming `utcTimeToLocal()`'s output is what
actually gets scheduled with the OS, not just computed and discarded.

Not exercised: the notification firing live at that time and tap routing
to Home, since that means either waiting for 13:00 local or advancing the
device clock (which would also perturb Supabase's JWT `iat` check and any
other now()-based logic, so not a shortcut worth taking).

Confirmed on a real device (2026-08-28, main pair): after an RLS audit
(triggered by deciding whether the leaked Supabase anon key needed
rotating — it didn't, since the audit is what actually mattered) fixed
three gaps in `schema.sql` — an exploitable `pairs` update policy, a
`clips` update policy broader than the app uses, and a missing
`storage.objects` UPDATE policy — watching a clip through
`mark_clip_viewed()`'s new RPC path still clears the unwatched dot with
no error, confirming the swap from a raw table update didn't break the
live viewed-marking flow. The `clips_update_own_as_sender` policy and the
`storage.objects` UPDATE policy remain unverified on-device, since
there's no re-record-after-send path in the current UI to exercise them.

Confirmed on a real device (2026-08-29, PR #53): the Account Settings
sub-screen. The email no longer appears on the main Settings screen and
reads correctly on the sub-screen; `Account ›` pushes with **the tab bar
still visible**, which is the whole reason it's a stack nested inside the
Settings tab rather than a push on the root stack; `‹ Settings` returns.
Sign-out confirmation works in both directions — Cancel is a genuine
no-op, Sign out lands on `AuthScreen`.

Also confirmed the two things the nesting put at risk. Tabbing away from
Account and back reopens **Settings**, not the sub-screen, so
`unmountOnBlur: true` still tears the whole nested stack down on blur as
it did the single screen. And the anniversary spinner still opens and
saves — worth checking explicitly, since `unmountOnBlur` exists partly to
stop a native `DateTimePicker` lingering in the background
(`MainTabs.tsx`), and this PR inserted a navigator between the tab and the
screen that owns it. Nickname editing also unaffected.

Confirmed on a real device (2026-08-29, PRs #54–#57): four changes from the
UX batch, tested together on one build with all four branches merged, then
merged individually.

**Cold-start gate (#57).** Force-quit and reopen on a paired account with a
stored session now goes straight to MainTabs. Previously `RootNavigator`
gated only on `AuthContext`'s `loading`, which means just "the auth session
hasn't resolved yet", so it flipped false while the pair query was still in
flight and an already-paired user got a flash of PairingScreen.

**Timeline card colour (#55).** The `*Soft` fills plus a 4pt left edge read
as distinct at a glance. The cards were already colour-coded — the `*Tint`
values they used sit ~4% off `background`, so the feed read as one column of
white cards.

**Private partner nickname (#56).** Renders for the person who set it,
`Your name` still edits `display_name`, blank-on-save clears it. The privacy
claim was checked two ways, because the app not *showing* a value and the
database not *serving* it are different claims: signed in as the second
account the nickname is absent from Timeline/Home/StoryRings, and at the RLS
layer, impersonating the partner inside a transaction, `rows_visible = 0`
and `rows_leaked = 0`.

Worth recording how that check has to be run: **the Supabase SQL editor
bypasses RLS**, and `auth.uid()` is null there, so running the verify query
directly returns 0 no matter what the policies say — a false pass. It only
means something wrapped in `begin; select set_config('request.jwt.claims',
…); set local role authenticated; … rollback;`. The query also uses
`is distinct from` rather than `<>` on purpose: with `<>`, a null
`auth.uid()` (failed impersonation) makes every comparison null, no rows
match, and you get 0 again — a silent false pass in exactly the case where
the test is broken. Confirming `acting_as` is non-null is part of the check,
not a formality; it also proves a nickname row existed at all, so the
assertion wasn't vacuous.

**Pairing auto-refresh (#54).** Two devices, two previously unpaired
accounts: created an invite on A, left A foregrounded and untouched, joined
from B, and A moved to MainTabs on its own within ~5s. That is specifically
the case `useFocusEffect` could never catch — PairingScreen is the only
mounted screen at that point, so it never blurs and re-focuses, and the
creator previously sat there until the app was backgrounded and reopened.
A manual refresh passing would not have tested anything.

Not exercised: `MonthlySummaryScreen`'s `if (!pair)` guard fix, also in #57.
MainTabs only mounts once a pair exists, so the path isn't reachable from
the UI — it's a correctness fix, not an observed bug.

Confirmed on a real device (2026-08-29, PR #59): account deletion, on a
throwaway pair (`+partner3` / `+poll`) created for the #54 poll test, with a
real clip recorded from each side first so the cascade had something to
cascade.

Both alerts fire and Cancel at either step aborts with nothing deleted;
confirming lands on AuthScreen. In SQL afterwards the `auth.users` row, the
`pairs` row and the `clips` rows were all gone — one `delete from
auth.users` reaching all of it through the FK chain, with no service_role
key, no Edge Function and no Vault involved. The privilege question that
decided the whole design was settled first, against a throwaway account
inside a rolled-back transaction impersonating an `authenticated` user, so
it tested the client's real path rather than the SQL editor's privileged
one.

**The partner's running app does not notice.** It was described in the plan
and the PR as "lands back on PairingScreen", which is wrong while the app is
open: nothing refetches `['pair', userId]` once a pair is complete —
`refreshPair` is only called from PairingScreen, `usePair`'s
`refetchInterval` returns false for a complete pair, `PairProvider` mounts
at the app root so `unmountOnBlur` never remounts it, and there is no
`focusManager`/`AppState` wiring. Confirmed on device: the partner keeps a
stale pair and a tab bar over what looks like a fresh empty pairing, and
only routes to PairingScreen after a force-quit and relaunch, which was
verified. Accepted rather than fixed; wiring `focusManager` to `AppState`
is the fix and belongs in its own PR.

Storage was deliberately not touched by the delete path. Immediately after,
both clip objects were still in the bucket under the deleted pair's prefix —
correct, since `storage.objects` isn't reachable by FK and the nightly
`cleanup_orphaned_clip_files` re-derives orphans instead. Worth noting the
timing precisely, because it is easy to read as a failure: the files were
created ~08:46 UTC on 2026-08-29, and the job's grace period is
`created_at < now() - interval '1 day'`, so the 2026-08-30 04:17 run skips
them and **2026-08-31 04:17 is the first run that will sweep them**. Still
present on the 30th is expected. That sweep is the one part of this PR still
unverified.

Confirmed on a real device (2026-08-29, PR #61): account deletion now purges
the clip files itself instead of leaving them to the nightly job.

Fresh throwaway pair with a clip recorded from each side, so the bucket held
two objects under the pair's prefix. Deleting one account from the app left
zero within seconds, and `net._http_response` showed two 200s — pg_net is
fire-and-forget, so checking that table is the only way to know the requests
were accepted rather than merely queued. Both files went, including the
partner's, which is the half a client-driven purge could never have reached:
`clips_select_pair_members` hides a partner's clip on any date the caller
didn't post one, so the client cannot enumerate those paths at all.

The name guard added to both functions was validated against real data before
relying on it — every one of the ten most recent objects in the bucket matched
`^<uuid>/<uuid>/<YYYY-MM-DD>(.ext)?$`, including day-old rows. Worth doing
first: too strict a pattern would have silently matched nothing, and the
symptom (files not disappearing) is indistinguishable from the feature simply
not being deployed.

Which it wasn't, at first — `create or replace` was run against both functions
and neither took on the first attempt. Checking `body_len` or eyeballing the
editor isn't enough to tell; `select prosrc like '%http_delete%'` on `pg_proc`
is what actually distinguishes the new body from the old one-liner, and it's
worth running after any live function replace in this project.

Still pending: the two orphans from the earlier 2026-08-29 deletion, which
predate this change and depend on the nightly sweep — first eligible run is
2026-08-31 04:17 UTC. That run is also what verifies the name guard on the
cleanup path, since only the delete path has been exercised so far.

Confirmed on a real device (2026-08-29, PR #62): Home and Settings read
through the react-query cache instead of local state.

Repeated Home <-> Timeline and Settings <-> Home tab switches now show the
real trip, anniversary and days-together line immediately, with no flash of
"Plan your next visit" or "Not set", and Home's unanswered dot no longer
appears on a day already posted. A cold start still shows one flash, which is
expected -- there's no cached value yet -- and is not what this fixed.

Also confirmed the side effect that came free with the shared cache: saving a
trip on Home updates HeroCard on the Timeline tab with no manual refresh. The
old `setTrip(data)` wrote to local state only, so HeroCard waited for its own
remount.

The framing this started from was "a loading state -- I'm not sure where".
The audit found the opposite of a missing loading state: both screens held
fetched rows in useState initialised to null while unmountOnBlur remounted
them on every tab visit, so they rendered falsy defaults *as though they were
loaded data*. A spinner or skeleton would have been the wrong fix for a flash
of wrong content. The right one deleted 52 lines.

Confirmed on the live project (2026-08-29): `cleanup_orphaned_clip_files`,
including the object-name guard added in #61. A manual run with
`grace_period` set to 0 swept 9 orphans in a single pass — every one
returning 200 in `net._http_response` — and the bucket afterwards held 4
objects with 0 orphans. That covers the guard on the cleanup path, which #61's
device test had not exercised: only the delete path fired there.

Two reading errors on the way to that conclusion, both from the same cause.
`select ... from net._http_response order by created desc limit 5` truncated
the history, which made the 04:17 nightly run look like 3 deletions when it
was 9, and hid the 9-deletion manual run entirely. That in turn made two
already-swept files look like they had vanished by an unexplained mechanism.
Query that table with a limit well above the number of deletions you expect,
or the window itself becomes the misleading part.

Worth keeping separate as claims: a `cleanup_orphaned_clip_files` run
returning 0 means only that it found nothing to act on. It is not evidence the
job works — a too-strict name guard would also return 0, and the two are
indistinguishable from outside. Only a run that actually deletes something
verifies the path.

2026-08-29: Added Jest (`jest-expo` preset) and ported `src/lib/date.test.ts`
from a standalone `node` script into real Jest tests, wired into CI
(`npm test`, added as a step in `.github/workflows/ci.yml` alongside
`tsc`/`lint`/`format:check`). All 11 assertions pass under `TZ=UTC`,
`TZ=America/Los_Angeles`, and `TZ=Asia/Tokyo` (`npm test` loops all three,
since Node/V8 read `TZ` once per process rather than reliably picking up a
mid-run change). This closes a real, pre-existing gap: the old standalone
script's assertions — covering the UTC/local day-boundary split, the
`utcTimeToLocal` round-trip, and DST/leap-year cases in `daysBetween` — were
correct but had zero regression protection, since CI never ran them. Also
dropped `tsconfig.json`'s `exclude: ["**/*.test.ts"]`: it existed only
because the standalone script needed Node's native ESM resolver (hence the
explicit `.ts` extension import), which no longer applies once the file runs
through Jest's own transform. `tsc --noEmit`, lint, and format:check all
still pass with the new files in place. This is the first slice of the
"add a test framework" arc — component tests and Postgres/RLS testing are
separate, later pieces, not covered here.

2026-08-29: EAS Build pipeline stood up. `eas login` (account `fretz143`),
`eas init` linked `extra.eas.projectId` in `app.json`. First
`eas build --profile development-simulator --platform ios` failed: the
`@sentry/react-native` Expo config plugin runs `sentry-cli` during the
native build to auto-upload source maps, and with no Sentry org/project
configured anywhere in the repo it failed the whole build rather than
degrading gracefully — a correction to the plan's assumption that a missing
Sentry build config only costs symbolication quality. Fixed by setting
`SENTRY_DISABLE_AUTO_UPLOAD: "true"` in each `eas.json` build profile's
`env`. Retried build succeeded, confirming the full pipeline (login,
project link, profile config, cloud build) end to end. Not yet installed
on the simulator or checked for native Sentry crash capture — that's the
next step.

Installing that iOS build locally hit a separate blocker: this Mac
(`iMac21,1`, M1, macOS 15.3.1) needs Xcode for the Simulator, and the App
Store's Xcode 27 requires macOS 26.2, which isn't installed. Hardware
supports macOS 26 fine, so this is just sequencing, not a real constraint —
either update macOS, or install an older Xcode (16.x) compatible with
15.3.1 directly from developer.apple.com/download/all/ (works with any
Apple ID, no paid Developer Program needed) to unblock Simulator testing
without an OS upgrade.

Android `preview` build (`eas build --profile preview --platform android`)
succeeded on the first try — the Sentry env fix from the iOS build applied
to all profiles already, so no repeat of that failure. No Apple/Xcode
dependency at all for this one. Neither build has been installed/run yet.

2026-09-01: Installed Xcode 16.4 directly (developer.apple.com/download/all/)
rather than waiting on a macOS upgrade — this Mac's hardware (`iMac21,1`, M1)
supports macOS 26 fine, but there was no reason to do a multi-GB OS upgrade
just to unblock Simulator testing today. Two setup snags, both one-time and
unrelated to the app itself: the downloaded Xcode.app was sitting in
`~/Downloads` and needed moving to `/Applications` plus `sudo xcode-select -s`
before `xcodebuild`/`simctl` worked, and `open -a Simulator` failed with
"unable to find application named 'Simulator'" until
`lsregister -f <path to Simulator.app>` re-indexed it with Launch Services
(a manually-moved app isn't auto-registered the way an installer would).

Installed the `development-simulator` build via `eas build:run --platform ios
--simulator "iPhone 16 Pro"` — needed the target simulator already booted
first (`xrun simctl boot`, the run failed with a `CoreSimulator` "Unable to
lookup in current state: Shutdown" error otherwise). Confirmed installed via
`simctl listapps` and a screenshot: app icon correct, launches into
expo-dev-client's own launcher screen (expected — that's what a Dev Client
build shows with no Metro server to connect to yet).

Connected it to a local Metro (`npx expo start --dev-client`) via
`simctl openurl` with an `exp+while-you-sleep://expo-development-client/?url=`
deep link. First attempt only registered the server in the launcher's list
(green dot, didn't auto-navigate); terminating the app and re-sending the
same deep link cold-started it straight into a system "Open in While You
Sleep?" confirmation instead, which needed a real tap — `simctl` has no tap
synthesis, and AppleScript/System Events UI automation timed out (likely a
stuck Accessibility permission prompt for Terminal, not investigated
further). Had the user tap it directly rather than fighting automation
permissions.

Metro itself got killed twice by the harness between conversation turns
before the tap happened — this session runs as a background job, and a
long-lived process backgrounded from inside it doesn't reliably survive
between turns. Not a project issue; fixed by having the user run
`npx expo start --dev-client` in their own terminal instead.

Once connected: **first confirmation of any of this app running outside
Expo Go.** Screenshot showed the real Home screen against a live paired
session — "10 days together with derek" line, Today's question card,
trip countdown card (flag, date, day count, "until we see each other
again"), Fraunces/Inter fonts and the gradient card all rendering
correctly. Native Sentry crash capture, splash timing, and press-scale
feel are still unverified but no longer structurally blocked — genuinely
testable now. Android build (from 2026-08-29) still not installed/tested.

2026-09-01: First Android run ever, on a Pixel 7 / API 34 emulator (Android
SDK wasn't installed on this machine at all — Android Studio, command-line
tools, OpenJDK, platform-tools, build-tools and an arm64 system image all
installed from scratch this session). Two findings, one cosmetic-adjacent
and one a real bug.

**BlurView works.** The frosted prompt card renders correctly with
`dimezisBlurView` on Android — one of the two long-standing "anything on
Android" unknowns, closed. Camera preview also renders, though only after
fixing the AVD: `hw.camera.front=none` by default, so the front-facing
camera the Record screen defaults to had no feed and showed pure black.
Set to `emulated` in `~/.android/avd/wys-test.avd/config.ini`, which needs
a full emulator restart (not just an app relaunch) to take effect. That's
an emulator config issue, not an app one.

**Real bug: recording failed with "Missing permissions:
android.permission.RECORD_AUDIO".** `RecordScreen` only ever requested
camera permission (`useCameraPermissions`), never microphone
(`useMicrophonePermissions` — a separate hook in expo-camera). iOS never
surfaced this; Android rejects `recordAsync` outright. `RECORD_AUDIO` was
already declared correctly in `app.json`'s `android.permissions`, so the
manifest was never the problem. Confirmed via
`adb shell dumpsys package com.whileyousleep.app`: `CAMERA` carried the
`USER_SET` flag (prompted and granted by the user) while `RECORD_AUDIO`
did not — proof the OS was never asked, rather than asked and denied.
That flag distinction is the useful diagnostic here; "granted=false" alone
doesn't tell you which.

Fixed by gating the screen on both permissions and requesting both. The
two requests are awaited **in sequence**, not fired together: Android
shows one runtime permission dialog at a time and silently drops a second
request made while one is in flight, so the naive version would have
granted only the camera and looked like the same bug.

A false start worth recording: the first fix attempt appeared to change
nothing, because the installed APK was the **`preview` build, which has
its JS bundled in** and does not load from Metro — so no amount of
`expo start` was ever going to deliver the fix to it. The give-away was
that the app opened straight into the real UI instead of a dev-client
launcher screen, plus `pm list packages` showing Expo Go wasn't even
installed. Validated the fix in Expo Go instead (`npx expo start --go`):
the combined gate prompts for camera and microphone, and recording then
succeeds. An Android `development` (dev client) build was started in
parallel so future Android JS changes can hot-reload over Metro rather
than needing a rebuild.

Also unblocked downstream testing on the existing preview build without
waiting on that, via `adb shell pm grant com.whileyousleep.app
android.permission.RECORD_AUDIO` — useful for exercising capture/upload/
playback while a build is in flight, though it deliberately bypasses the
prompt and so proves nothing about the fix itself.

Non-issue, logged so it isn't re-investigated: Expo Go on Android logs
`expo-notifications: Android Push notifications (remote notifications)
functionality provided by expo-notifications was removed from Expo Go with
the release of SDK 53`. This app uses local notifications only —
`notifications.ts` calls `requestPermissionsAsync`,
`setNotificationChannelAsync` and `scheduleNotificationAsync`, and no push
token API anywhere — so the warning is Expo Go's, fired at module init
regardless of usage. Expected to be absent in the dev build; worth a
glance when confirming that build.

2026-09-02: Android verification pass on the standalone `preview` APK (Pixel 7
emulator, API 34), which closed every remaining Android unknown in one sitting.
The `development` (dev client) build started this morning was still sitting in
the EAS queue, so it was never used — the preview build turned out to be the
better instrument anyway, because its JS is bundled in and it therefore needs
no Metro, and Metro is the thing that keeps getting killed between turns in a
background session. Everything below predates the `RECORD_AUDIO` fix, so none
of it depended on that commit; `RECORD_AUDIO` was force-granted via
`adb shell pm grant` as noted in the 2026-09-01 entry.

Verified: recording with the 30s countdown auto-cap, the caption step, Send and
upload, arrival at the `revealed` phase with the caption on the "You" card,
Timeline (HeroCard, story rings, nickname labels, "Today" label, the coloured
left edges), and Home. All match iOS.

Extensionless `storage_path` served as `video/mp4` **plays on Android**. Worth
recording how this was checked, because the first attempt gave a false
negative: two screenshots three seconds apart were byte-identical, which looks
exactly like a stuck first frame. It wasn't — the clip was ~5s and had simply
finished before the first screenshot, since the viewer had been open ten
seconds by then. Re-opening it and sampling four frames at one-second intervals
gave four distinct images, which is real decode. Sample during playback, not
after it.

`ExpoVideo` logs "Current activity does not support picture-in-picture" roughly
every 200ms while the viewer is open. Nothing in `src/` or `app.json` mentions
picture-in-picture and playback is unaffected, so this is log noise from
expo-video's config plugin defaults, not a fault. Logged so it isn't chased.

The daily reminder fires and routes on Android. `dumpsys notification` showed a
delivered record — tag `daily-question-reminder`, channel `daily-reminders`,
"Today's question is up" / "Record your video answer before your partner does."
— presented under the real app name "While You Sleep", not "Expo Go" as it
does on iOS in Expo Go. Tapping it opened the app on Home. Its `when` was 08:41
local, which is *not* 20:00 UTC and initially looked like a scheduling bug; it
is instead an alarm that elapsed while the emulator was suspended and was
delivered on resume. The scheduling itself is correct, and `dumpsys alarm`
proves it directly: a pending `RTC_WAKEUP` for `com.whileyousleep.app` tagged
`expo.modules.notifications.NOTIFICATION_EVENT` with
`origWhen=2026-09-02 13:00:00.000`, and 13:00 local at UTC-7 is exactly 20:00
UTC. `dumpsys alarm` is the thing to read here, not the delivered notification's
timestamp.

The `expo-notifications` "Android Push notifications ... removed from Expo Go"
warning is **absent** from a cold start of the standalone build, and appeared as
an on-screen error toast in Expo Go on the same emulator ten minutes later —
side-by-side proof it is Expo Go's, as predicted on 2026-09-01. Note the first
check of this was invalid: logcat had been cleared while the app was already
running, so module init had long since happened and the absence proved nothing.
It needed a force-stop, a fresh `logcat -c`, then a relaunch.

The native Sentry SDK is compiled into this build — `io.sentry.react.*` view
managers register at startup and `io.sentry.auto-init read: false` shows
auto-init off with the JS `Sentry.init` driving it. That is presence, not
capture: no native crash was thrown, so native crash reporting is still
unconfirmed.

Two defects found, both platform-independent and both fixed in this branch:

1. The `review` phase drew the close ✕ on top of the "Add a caption?" heading.
   The close button is absolutely positioned at `top: insets.top + 12` and is
   40 tall, while the review layout started its normal-flow content at
   `paddingTop: insets.top + 20`. The camera phase makes exactly this
   allowance for the same button (`promptCard`'s `left: 64`, with a comment
   saying why); the review phase never got the equivalent. Now `insets.top +
   64`, which leaves the content 12 below the button's bottom edge regardless
   of device or density. Not an Android bug — it would overlap on iOS too;
   Android is just where somebody finally looked at that screen.
2. The subtitle read `Optional -- goes alongside your clip.`, rendering a
   literal double hyphen on screen. Reworded to `Optional, goes alongside your
   clip.` rather than inserting an em dash, per the em-dash ban.

The fixed review phase was **not** re-screenshotted on device. Reaching it needs
a day this account hasn't posted on, and the only route to that was rolling the
emulator's clock past the UTC boundary — which does work (it served a different
prompt, "What made today different from yesterday?", independently confirming
the daily question rolls with the shared UTC day) but invalidated the stored
Supabase session mid-recording, dropping the app to AuthScreen with "Failed to
ensure profile: new row violates row-level security". That is the clock jump's
doing, not a product bug, though it does show the app's behaviour when a
session can't be refreshed. Only the Expo Go instance lost its session; the
standalone build's survived, verified by relaunching it afterwards. The clock
was restored via `settings put global auto_time 1`. The fix's correctness is
arithmetic rather than observed: content starts 12 below the button's bottom
edge by construction, and `tsc`/eslint pass.

Also found, not fixed: `clips.caption_text` is rendered **only** on the
same-day `revealed` card. It appears in `src/types/index.ts` and nowhere else
in `src/` — neither `TimelineScreen` nor `ClipViewScreen` reads it — so from
the next day onward the text half of "answer in both video and text" is stored
and never shown again. Confirmed it really is persisted, not just held in
component state: the caption survived into a completely fresh Expo Go instance
with its own storage. Where it should surface is a design call, so it was left
for the user to decide.

2026-09-02 (follow-up): `clips.caption_text` is now rendered on the Timeline
card too, under the date, per the user's call on the open question above.
`useClips` already selects `*`, so the row carried the column all along and no
query changed. Deliberately not truncated — `ClipViewScreen` still doesn't
render it, so an ellipsis would put the rest of a long caption out of reach.
No empty-string guard is needed either: `useUploadClip` writes
`caption.trim() || null`, so the column is null or a non-empty trimmed string.

Not verified on device. The standalone `preview` APK has its JS bundled in and
so can't show the change, and the Expo Go instance on that emulator is signed
out — collateral from the clock experiment above, and signing back in needs an
emailed OTP. `tsc`, eslint and `npm test` pass. To see it: sign in to Expo Go
on the emulator against `npx expo start --go`, then open the Timeline — today's
clip carries the caption "android test caption".

2026-09-02 (follow-up 2): `caption_text` now also renders in `ClipViewScreen`,
above the existing date line and below the video, per the user's follow-up ask.
`useClip` already returns the whole row, so again no query change. The caption
sits above the date because the caption is content and the date is metadata,
and since `VideoView` is `flex: 1` a long caption shrinks the player rather than
being clipped. In reel (`queue`) mode it swaps per clip along with the row.

This also retired the reason `TimelineScreen`'s caption was left untruncated —
that comment said no other screen rendered the column, which stopped being true
here — so it now reads that both surfaces show the same text in full. Still
unverified on device for the same reason as the previous entry: bundled JS in
the preview APK, and a signed-out Expo Go. `tsc`, eslint and `npm test` pass.

2026-09-02 (follow-up 3): captions added to `MonthlySummaryScreen` as a "What
you said" list below the reel button, per the user's follow-up ask. That screen
had no per-clip list at all — stats, the dot grid and the reel button — so this
is a new section rather than a field added to an existing row. Placed below the
button so a long month doesn't push the primary CTA off screen, filtered to
clips that carry text so an empty month renders nothing, and left non-tappable
to match the grid cells around it. Its inline query already selected `*`, so
again no query change. Names resolve through `usePartnerName()`, the same ladder
Timeline uses.

Note this list inherits the screen's existing reveal-gating: a partner's caption
on a day you never posted is invisible here for exactly the reason their clip is
(`has_own_clip()`), which is consistent rather than a new gap.

The "watch this month's clips" reel already picked captions up from the previous
entry's `ClipViewScreen` change, since the reel is that screen in `queue` mode.
Still unverified on device, same two reasons: bundled JS in the preview APK, and
a signed-out Expo Go. `tsc`, eslint and `npm test` pass.

2026-09-02 (follow-up 4): the Monthly Summary caption rows are now tappable,
per the user's follow-up ask, reversing the non-tappable call in the previous
entry. Each row navigates to `ClipView` with `clipId` and deliberately **no**
`queue`, so it plays that one clip with manual controls and no auto-advance —
the reel button above remains the only thing that plays the month through, and
the two entry points into `ClipViewScreen` stay distinct. Uses the screen's
existing `styles.pressed` for press feedback, same as its other buttons.
Unverified on device for the same two reasons as the previous entries.

2026-09-02 (follow-up 5): the user verified all four caption surfaces on
Android — RecordScreen's same-day `revealed` card, the Timeline card,
`ClipViewScreen`, and Monthly Summary's "What you said" list. This supersedes
the "unverified on device" notes closing follow-ups 1 through 4, which were
written when the preview APK's bundled JS and a signed-out Expo Go left no way
to see the changes from this session.

Two items from those same commits are **not** covered by that pass and stay
unverified, rather than being swept in with them:

- The `review` phase's `insets.top + 64` fix, which stops the close ✕ landing
  on the "Add a caption?" heading. Reaching that phase needs a day you haven't
  posted on. Still correct by construction, still never looked at after the fix.
- Tapping a Monthly Summary caption row through to `ClipView`. The rows render;
  whether the tap navigates was not exercised.

2026-09-02 (follow-up 6): the Android `development` (dev client) build, queued
at 08:44 and finished 10:10, is installed on the Pixel 7 emulator and running
the working tree's JS over Metro. `adb install -r` updated it in place over the
`preview` APK — the signing keys matched, so no uninstall was needed and the
logged-in Supabase session survived. The dev launcher discovered
`http://10.0.2.2:8081` on its own (with `adb reverse tcp:8081 tcp:8081` set) and
bundled 2056 modules in 2.1s.

`eas fingerprint:compare --build-id <id>` returned a match against the local
directory beforehand: the build was made from `55e79b9` and the tree was three
commits ahead at `f8687d0`, but those commits touched only `src/**` and docs, so
the native fingerprint was unchanged and no rebuild was warranted. That command
is the cheap way to settle "do I need to rebuild" without guessing.

Confirmed while there: **tapping a Monthly Summary caption row opens that clip**
in `ClipView`, playing with its caption above the date — the second of the two
items left unverified by the user's own pass. The "What you said" list also
renders the partner's caption alongside the user's, which incidentally shows
reveal-gating passing on a day both people posted. This also proves the dev
client is genuinely serving the working tree rather than a baked-in bundle: the
list is an unreleased change relative to the commit the build was made from.

Two emulator traps hit for real, both worth not repeating:

- `lsof -ti tcp:8081 | xargs kill -9`, intended for a stale Metro, **killed the
  emulator** — with `adb reverse` in place the emulator process holds a socket
  on that port. Kill Metro by PID instead.
- After restarting, the emulator **restored a day-old quick-boot snapshot**,
  silently undoing the install: `lastUpdateTime` reverted to 09-01 and the 118MB
  preview APK was back in place of the 212MB dev client. The symptom was the app
  rendering normally while Metro's log showed it had never served a bundle — if
  that combination ever shows up again, check `lastUpdateTime` before debugging
  anything else. Re-installing after boot fixed it; `-no-snapshot-load` avoids it.

Still unverified from this session's commits: the `review` phase's
`insets.top + 64` close-button fix, which needs a day the account hasn't posted
on to reach.

2026-09-03: **the iOS push credential chain works end to end** — the first
`push_tokens` row landed from a real iPhone:
`platform = ios`, `token = ExponentPushToken[qlfsC2LxByBm…]`.

That single row is the payoff for a chain that had never been exercised
before, and every link in it was a separate thing that could have silently
failed: Apple Developer Program enrollment (cleared 2026-09-02), the APNs
`.p8` key EAS generated inside the Apple account, the ad-hoc provisioning
profile, the `aps-environment` entitlement, the device UDID being in that
profile, and `extra.eas.projectId` resolving so `getExpoPushTokenAsync`
knows which project's credentials to mint against.

Sequence that produced it, in case it needs repeating:

- `eas device:create` → scanned the QR on the iPhone → installed the config
  profile. The success page is a green check on an otherwise near-blank
  page; `eas device:list --apple-team-id MNVC2KTN7C` confirmed the UDID
  registered.
- `eas build --profile development --platform ios`. The two lines that
  matter in its output are `✔ Synced capabilities: Enabled: Push
  Notifications` and `Provisioned devices - iPhone (UDID: …)`. Without the
  first, the binary silently never receives push.
- The build wrote `ITSAppUsesNonExemptEncryption: false` into `app.json`
  itself — an export-compliance declaration, not something to revert.
- Installed by opening the **build page** on the iPhone, not the `.ipa`
  URL. A raw `.ipa` won't install; the page wraps it in the
  `itms-services` manifest iOS requires for ad-hoc distribution.
- Launched against Metro (`npx expo start --dev-client`), granted the
  notification prompt, and the row appeared.

Notably this build was made from a commit that predates
`registerPushToken` entirely — the dev client served it from Metro, the
same property already recorded for the Android dev client.

Firebase/FCM was set up the same day for the Android half (project
`while-you-sleep`, Spark plan, app registered as `com.whileyousleep.app`).
Not yet exercised — no Android build has been made since
`googleServicesFile` was added, so the Android token path is still
unproven.

Still unverified in the push arc: notification tap routing on a real tap
(the logic has unit coverage; nothing sends a `partner-posted` payload
until the clip trigger is applied), and the trigger itself.

2026-09-03 (follow-up): **the push arc works end to end on iOS.**
`notify_partner_of_clip()` and its trigger applied to the live project
(`tgenabled = 'O'`), a clip inserted as the partner, and the notification
arrived on the iPhone — tapping it opened `RecordScreen`.

That single tap closes three things at once: the trigger fires on INSERT and
resolves the recipient as the half of the pair that didn't send; pg_net's
POST to `exp.host` returned `{"data":[{"status":"ok","id":…}]}`; and
`routeForNotification`'s `partner-posted` branch routes correctly on a real
payload, which was explicitly left unverified when PR #72 merged.

Tested with a **synthetic insert**, not a recorded clip:

```sql
insert into clips (pair_id, sender_id, storage_path, recorded_for_date, caption_text)
values ('<pair>', '<partner>', 'trigger-test',
        (select coalesce(min(recorded_for_date), current_date) - 1 from clips),
        'THIS TEXT MUST NOT APPEAR IN THE PUSH');
```

The date subquery matters: `clips` is unique on
`(pair_id, sender_id, recorded_for_date)`, and both today and yesterday were
already taken, so a hardcoded date collides. One day before the oldest clip
can't. `storage_path` is fake, so deleting the row afterwards orphans
nothing.

The caption string is a deliberate trap, and **it did not appear in the
notification** — confirmed on the device, not just by reading the SQL. The
push body is fixed copy and must never carry `caption_text`, since the
recipient may not have posted that day and `clips_select_pair_members` would
be hiding that row from them; a lock-screen preview would walk straight past
`has_own_clip()`. Anything that later makes this body dynamic has to re-run
this check.

Worth knowing for future debugging: a `200` in `net._http_response` is
**Expo accepting** the message, not APNs delivering it. Those are separate
failures — an `ok` with no notification points at Focus/Do Not Disturb or the
app's iOS notification settings, not at the trigger.

Two incidental findings:

- The iPad can't run the dev client: its UDID isn't in the provisioning
  profile, and `app.json` has no `scheme`, so the dev-client deep link has
  nothing to open. Registering it means another `eas device:create` plus a
  full rebuild — not worth it for a second test account, since a partner
  device only needs to insert a `clips` row and never needs push at all.
- Recording on the iPad (Expo Go) raised "Recording failed", though a row
  still landed for that day. Not diagnosed — the alert's second line was not
  captured. Unrelated to the push arc.

2026-09-04: **the Android push token path works** — `push_tokens` now holds a
row with `platform = 'android'` alongside the iOS one, both under the same
`user_id`. That closes the FCM half of the push arc and, incidentally,
creates the first two-device account the trigger's `to: [array]` fan-out has
ever had to serve.

Getting there cost an hour to **the quick-boot snapshot trap for the second
time** (first hit 2026-09-02). Worth writing down properly, because it
disguises itself as an application bug:

The emulator silently restored a 09-01 snapshot, reverting the dev client
install. Everything downstream was a symptom of running the wrong binary:
`getExpoPushTokenAsync` threw, `registerPushToken` hit its catch and returned,
and no row appeared — which reads exactly like a broken FCM configuration.

The give-away in logcat was
`W FirebaseApp: Default FirebaseApp failed to initialize because no default
options were found`, which is correct behaviour for an APK built before
`googleServicesFile` was added, and says nothing at all about whether the
current config is right.

**The fast diagnostic is the APK, not the logs:**

```bash
adb shell dumpsys package com.whileyousleep.app | grep lastUpdateTime
P=$(adb shell pm path com.whileyousleep.app | sed 's/package://' | tr -d '\r')
adb shell ls -l "$P" | awk '{print $5}'
```

The dev client is ~221 MB and the old `preview` APK ~118 MB, so the size alone
settles it in one command. A reverted `lastUpdateTime` confirms it.

Two things that misled the debugging and are worth avoiding next time:

- **`adb logcat` keeps a buffer across boots.** Firebase failures dated 09-01
  were read as current. Always `adb logcat -c` before reproducing, then
  relaunch — and check the PID against `adb shell pidof <package>`, since
  system processes emit `FirebaseApp` warnings of their own.
- **Verifying the install immediately isn't enough.** `lastUpdateTime` read
  correctly right after `adb install -r`, then reverted later when the
  snapshot loaded. Re-check it after any emulator restart, before trusting
  anything observed on the device.

`adb reverse tcp:8081 tcp:8081` also cleared itself repeatedly — after killing
Metro, and again after the emulator restarted. If the dev client can't find
the server, re-check `adb reverse --list` before assuming anything worse.

Starting the emulator as
`emulator -avd wys-test -no-snapshot-load` avoids the whole class of problem;
a cold boot reads the real disk image, and the install survived it intact.

**Multi-device fan-out confirmed in the same pass.** With one account holding
both an iOS and an Android token, a single clip insert delivered to both
devices, and `net._http_response` carried one response with two tickets:

```json
{"data":[{"status":"ok","id":"01a06f51-183c-…"},{"status":"ok","id":"01a06f51-1801-…"}]}
```

That is the `to: [array]` path in `notify_partner_of_clip()` working as
designed — `array_agg` collects every token for the recipient and Expo fans
out server-side, so one pg_net request covers any number of the recipient's
devices. It also confirms the ticket count tracks the token count, which is
the cheapest way to spot a stale row: more tickets than the recipient has
real devices means `push_tokens` is carrying dead entries.

With this, **the whole push arc is verified end to end on both platforms** —
credential chains, token registration, the insert trigger, payload contents,
tap routing, and fan-out.
