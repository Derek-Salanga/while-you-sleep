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

2026-09-05: **reactions work on device.** Tapping an emoji on
`ClipViewScreen` records it, it renders on the Timeline card, changing it
replaces rather than accumulating, and tapping the current one clears it.
The partner's reaction shows alongside your picker. Confirmed by the user
after PR 2.2 landed on a branch, running the dev client on both the iPhone
and the Pixel 7 emulator.

Two items from that PR's test plan are **not** separately confirmed, because
neither is reachable by ordinary use:

- **Reveal gating on reactions.** `clip_reactions_select_visible_clips`
  reuses `clips_select_pair_members`' predicate through the joined clip row,
  so a reaction on a clip you can't see yet should be invisible. Reaching
  that state needs a day where the partner has posted and you have not, plus
  a reaction from them on their own clip — the same fresh-day requirement
  that leaves the story-ring gray case unverified. Correct by construction;
  worth confirming in SQL under impersonation rather than waiting for the
  day to arrive.
- **Reel mode.** The row is driven by `activeClipId`, the same value the
  caption row already follows, so it changes per clip in a Monthly Summary
  queue. Not exercised in this pass.

Worth noting what the schema buys: because the primary key is
`(clip_id, user_id)`, "the reactions on a clip" is at most one per person,
so there is no aggregation anywhere in the client — the Timeline card just
filters the flat list by `clip_id` and renders what's left. A counts-based
design would have needed a grouped query per card.

2026-09-05 (follow-up): the two items left open above are now both confirmed.

**Reveal gating on reactions holds.** Verified in SQL rather than on device,
since the state it needs — the partner has posted on a date you have not —
is unreachable through ordinary use. A synthetic clip from the partner on a
free date, plus a reaction of theirs on it, then read back while
impersonating the other account in a rolled-back transaction:

```sql
begin;
select set_config('request.jwt.claims',
  '{"sub":"<your-uuid>","role":"authenticated"}', true);
set local role authenticated;
select count(*) from clip_reactions;   -- returns 0
rollback;
```

0 rows, as designed: `clip_reactions_select_visible_clips` reuses
`clips_select_pair_members`' predicate through the joined clip row, so a
reaction is exactly as visible as the clip it sits on. A membership-only
policy would have returned 1 here and quietly revealed that the partner had
posted and reacted.

Note the insert fires `notify_partner_of_clip`, so this test also sends a
real push — expected, not a symptom.

**Reel mode confirmed on device.** In a Monthly Summary queue the emoji row
resets per clip rather than carrying the previous clip's selection, because
it keys off `activeClipId` — the same value the caption row already follows.

Arc 2's client half is now fully verified. Remaining in the arc: the
reaction push (PR 2.3).

2026-09-05 (follow-up 2): **reaction pushes work, including every guard.**
Confirmed on device against the live project after applying
`notify_sender_of_reaction()`:

- Reacting from the other device delivers one quiet push, and tapping it
  opens that clip directly
- Changing the reaction delivers a second push — the trigger is
  `after insert or update` precisely because `useSetReaction` upserts on the
  primary key, so a change arrives as an UPDATE and is a real new reaction
- Clearing a reaction sends **nothing** (DELETE isn't covered by the trigger)
- Reacting to your own clip sends **nothing** (`recipient_id = new.user_id`)
- Reacting to a clip older than two days sends **nothing** (recency guard)

Four of those five are the *absence* of a push, which is the half that
actually matters: a notification arriving is obvious, one that shouldn't
arrive is only ever noticed as annoyance weeks later.

The recency guard is the one with a concrete motivation rather than a
theoretical one. Monthly Summary's "What you said" list makes a month of old
clips reachable in a single scroll, so without it, catching up on a backlog
would fire a push per reaction — thirty in a minute is easy to reach. With
it, the ceiling stays at one reaction push per person per day, which follows
from one clip per person per day and `clip_reactions`' primary key allowing
one reaction per person per clip.

**Arc 2 is complete.** Reactions exist end to end: schema with reveal-gated
RLS, the picker and Timeline chips, and the push — verified on both
platforms.

2026-09-06: **the pet scores identically for both partners**, including on a
day only one of them posted — the claim the whole server-side design exists
to make.

Verified against a naturally occurring case rather than a seeded one. Pair
`1980a65e` had a real partner-only day: on 2026-09-03 one partner posted and
the other did not, with nothing on 09-04 or 09-05. With
`last_scored_date` set to 09-02, `get_pet_state()` folds three days:

```
09-03  one posted   -2
09-04  nobody       -10
09-05  nobody       -10
                    -> 50 - 22 = 28
```

Both accounts returned **28**, called under impersonation in a rolled-back
transaction (the `rollback` also resets the score write, so the second call
starts from the same state as the first — no manual reset between them).

**What makes this a real test rather than a coincidence: the two hypotheses
predict different numbers.** Had the pet been computed the obvious way — from
the clips list the client can see — the partner who did *not* post on 09-03
would have scored that day as nobody-posted (−10 instead of −2) and returned
**20**. Any future change that moves scoring toward client-visible data will
show up as exactly that 28/20 split.

Two things worth knowing before re-running this:

- **A first-ever call scores nothing.** `last_scored_date` starts null and is
  then set to yesterday, so the loop body never runs and the score stays at
  50. Seeding clips without also setting `last_scored_date` back produces a
  confident-looking pass that proves nothing.
- **Pick the pair deliberately.** The account used on both test devices has
  no clips at all, so testing there would have been three days of pure decay
  — identical scores either way, and therefore no evidence.

2026-09-06 (follow-up): **the pet renders on Home and tracks its score.**
Editing `pair_pet.score` directly and switching tabs away and back moves the
mood as expected — the refetch-on-remount path (`unmountOnBlur` plus the
stock `staleTime: 0`) is what makes that work, with no manual refresh.

One trap when doing this by hand: `get_pet_state()` recomputes on every
read, so a manually set score is immediately overwritten by the fold unless
`last_scored_date` is moved forward too:

```sql
update pair_pet set score = 85, last_scored_date = current_date - 1;
```

Clearing the resting state is `update pair_pet set paused_until = null`
(any past date also works — the check is `paused_until >= today` — but null
is what the pause UI will write).

`withdrawn` is legible on a white card, confirmed on device. That question
was live because the earlier art faded the fill toward `*Tint`; the shipped
version uses fixed `secondary`/`primary` halves at every mood, so the whole
mood signal is carried by the eyes and mouth instead. **Consequence worth
remembering: the pet no longer visibly drains.** If "we've gone quiet" turns
out too subtle in real use, the fix is in the Home card — pass paler
`leftColor`/`rightColor` as the score drops — not in `SharedPet`.

**Home stays a plain `View`, not a ScrollView.** The pet card made five
blocks and the ScrollView was added defensively; on the devices in use it
fits with room to spare, so it went back out. The risk it guarded against is
a smaller screen than anything tested here.

2026-09-06 (follow-up 2): **pause mode works, and with it the whole
retention arc is built and on `main`.** Settings offers three presets, the
row reads back the date, Home shows the resting overlay, "Resume now" clears
it, and the daily reminder is cancelled while paused and returns on resume.

Three arcs, sixteen PRs, verified on both platforms:

- **Push** (#71–#75): the partner-posted notification, which is the app's
  only re-open trigger. Nothing had ever told you your partner posted.
- **Reactions** (#78–#81): a reply to a clip, with reveal-gated RLS and four
  push-suppression guards.
- **Pet + pause** (#82–#85): shared state that reframes a missed day as
  "it's hungry" rather than "you failed".

**What is still not verified**, and none of it is code that can be inspected
into confidence:

- The scoring constants (`+20 / −2 / −10`) are a feel judgement. They carry a
  `ponytail:` comment naming them as the tuning surface, and changing them is
  one SQL statement. Nobody has lived with the pet long enough to know
  whether the decline feels like a nudge or a nag.
- Clamping at 0 over a long idle run, and the asymmetric recovery (two good
  days undoing four idle ones). Both need a seeded date range.
- Whether any of it actually works. The app was abandoned once; that's the
  problem this arc exists to solve, and the only test is using it again.

**The deferred item stays deferred.** A lower-effort text/photo fallback on
days video isn't possible was argued both ways and left out on purpose: the
app was abandoned *while* the bar was high, but there's no evidence the bar
was why. Lowering it is a guess; the pet had evidence behind it. Revisit with
real usage data rather than before it.

2026-09-07: **the redrawn pet is confirmed on device** — it reads as a
sitting floppy-eared companion rather than the cloud-like blob it replaced,
and the `withdrawn` frown is clearly visible at the 72pt Home card size.

What actually fixed the silhouette was structural rather than a matter of
nicer curves, and is the thing to remember if this is ever redrawn again:
the previous body encoded the ears as **bumps in a single outline**, so they
rendered as side lumps no matter how they were shaped. Ears and paws are now
separate closed subpaths overlapping the body mass, so each carries its own
stroke. A belly patch sits under the body outline so it reads as fur rather
than a sticker.

Four iterations got there, each rasterised from the real path data through
headless Chrome (`--headless --screenshot` against a generated HTML page).
The first two looked reasonable as coordinates and terrible as pictures —
worth doing again rather than reasoning about bezier control points.

Symmetry is generated, not hand-matched: only the right half is authored and
the left is its reflection, with the curve chain walked backwards so control
points swap. `src/theme/petPaths.test.ts` enforces it — all 83 body points
mirror about x=50, and the path is absolute-commands-only, since a relative
command would silently break the reflection (a mirrored delta is not the
mirror of the point it lands on).

**The `withdrawn` frown is a deliberate reversal**, made by the user after
seeing three mouth options rendered side by side. Worth recording the
tension rather than burying it: the pet was chosen over a streak counter
because a streak resetting assigns blame, and a downturned mouth carries
that same message with a face on it, on the days someone was busiest. The
level mouth it replaced is kept in a comment beside it so this stays a
decision rather than something inherited.

2026-09-07: **the invite-code attempt ceiling works.** Verified in SQL under
impersonation, against the live project.

Two calls to `join_pair_by_code('AAA-AAA')` as the same user, differing only
in how many rows sat in `invite_attempts`:

- 11 seeded attempts in the last hour → raises from **line 19**,
  `Too many attempts. Try again later.`
- a cleared ledger → raises from **line 30**,
  `Invite code not found, already used, or expired`

The two different raise sites are the actual assertion. A single failing call
proves nothing — a bad code fails either way — so the control matters more
than the positive case here.

This is the change that closes the enumeration hole. The old generator gave
534 possible codes (6 words x 89 numbers), never expiring, and
`join_pair_by_code` was the unthrottled oracle you would test them against.
Widening the space to ~887 million is what makes guessing expensive; the
ceiling is what stops someone paying that cost anyway.

Two notes for whoever repeats this:

- **The Supabase SQL editor reports a raised exception as a failed query.**
  Both results above look like errors in the UI and are the expected
  outcome. Read the message and the line number, not the red banner.
- **Don't reach for a temp table to collect loop output.** The editor runs
  over a pooled connection, so a temp table created in one statement is not
  reliably visible to the next, and `authenticated`'s role-level
  `search_path` does not include `pg_temp` either. Seeding the ledger
  directly and making one call needs neither.

Still unverified on device: the invite UI itself (create / regenerate /
cancel, code format, expiry line), and the expired-OTP copy.

2026-09-07: **reaction burst confirmed on device**, after three rounds of
adjustment that only a device could settle.

Shipped as six emoji rising over half the screen in 1400ms, staggered 90ms,
spread 210px with a per-particle sine wander. That is a **deliberate reversal
of the original brief**, which asked to match the app's sub-300ms motion
(press-scale 100ms, Timeline entrance 180ms + up to 100ms stagger). The first
version honoured that — a single emoji, 260ms — and the user asked for
more once they'd seen it. Rising half a screen inside 300ms is a blur rather
than a rise, so the distance now sets the duration.

One real bug surfaced only because of the slower timing: **`withDelay` holds
the animation, not the view.** A staggered particle was already mounted at
`t = 0` — full opacity, zero offset — so it sat visibly parked at the bottom
of the screen until its delay elapsed. It was present at the original 60ms
stagger too, just brief enough to read as a flicker; at 90ms it was obvious.

Fixed with a second shared value that flips on when the delay ends and gates
opacity. Kept separate rather than folding the delay into the main timing by
animating from a negative lead, because that would stretch the out-quad
easing across the wait as well, easing the particles into their own delay.

Two placement notes worth keeping:

- The burst layer is a **full-screen sibling at the screen root**, not a
  child of the reaction row. Android clips absolutely positioned children
  that extend past their parent, and these travel half a screen out of it.
- Particles are keyed on the burst token so a replay remounts and restarts
  from zero, and only the last one reports completion, so the parent clears
  once rather than six times.

Not verified: how this reads on a physical iPhone. The emulator renders in
software, so six simultaneously animated views look choppier there than on
real hardware.

2026-09-07 (follow-up): **arc A verified on device**, closing the two items
left open when it merged.

**Invite UI.** Creating an invite produced `G2E-C8Y` — six characters, all
from the intended alphabet, none of them the ambiguous glyphs the rewrite
exists to avoid (`O 0 I 1 L`). That is the ~887 million space confirmed in
practice rather than on paper; the old generator's 534 values were the whole
reason `join_pair_by_code` was worth throttling. "Expires in 3 days" renders
under the code, **Get a new code** replaces it, and **Cancel invite**
withdraws it and returns the screen to its Create state.

**Expired OTP.** With the dashboard expiry temporarily dropped to 60s, a code
submitted after ~70 seconds now reads *"That code has expired"* rather than
*"Invalid code"* over Supabase's raw "Token has expired or is invalid". The
old copy sent people hunting for a typo in a code that was merely late.
Expiry restored to 900s afterwards.

Method note worth reusing: **temporarily lowering the dashboard OTP expiry to
60s turns a 15-minute wait into about two.** Nothing in the repo controls
that value, so this is the only way to exercise the branch at all.

Arc A is now fully verified: attempt ceiling (SQL, both directions), code
format and lifecycle (device), and expired-OTP copy (device).

2026-09-07 (follow-up 2): **the accessibility pass is confirmed on device.**
All six fixes render as intended: the record CTA's label is legible across
the whole gradient, HeroCard's halves each carry readable text, the unwatched
dot and destructive copy are a stronger red, borders are visible, and the
pet's face reads on its blue half. Nothing else moved.

Two of the six went through a round of "that passes but looks wrong", which
is the part worth recording:

**HeroCard.** The scrim was chosen up front and built, then rendered against
three alternatives — inset boxes, full-half, gradient, and none. All four
clear AA. Every scrim variant dims the day/night split the card exists to
show, and the inset boxes in particular read as panels pasted onto the card.
Shipped without a scrim: the left half deepens to `primaryDark` and keeps
white (5.20), the right keeps its orange and takes ink (8.95). That works
only because the small text is already segregated by half; if either half
ever has to carry the other's text colour, a scrim behind the text is the
way back.

**The record CTA label.** Dark text on the gradient reads as a large change,
and white was asked for back. Worth knowing before reversing it: the label is
16pt semibold, so it is WCAG *large* text and the bar is 3:1 rather than 4.5.
White can be kept, but only by paying for it — darkening the gradient's
orange end to `#D47F00` (3.07, and the day-orange becomes amber on the app's
most prominent element) or putting the label on a translucent pill (3.59, and
a button-shaped element inside a button). Ink was kept: it is the only option
that clears *body* contrast rather than relying on the large-text exemption,
and the only one that changes nothing but the text colour.

Method note: both decisions were settled by rendering the candidates through
headless Chrome and looking at them. The contrast numbers narrowed the field
to things that pass; they could not say which of those looked right, and in
both cases the shipped answer was not the one chosen from numbers alone.

2026-09-07 (follow-up 3): **dark mode works on device.** Confirmed after a
fresh EAS dev-client build — `app.json` is native config, so unpinning
`userInterfaceStyle` was the one rebuild in the whole plan.

The record CTA took three passes, and the sequence is the useful part:

1. Ink label on the blue→orange gradient. Cleared contrast comfortably
   (4.12 / 8.95) and looked wrong on device.
2. The diagnosis was not the label. Against the cream ground the gradient's
   orange end sits at 1.44:1, so the **button** dissolved into the page and
   lost its right edge; the dark label merely made that obvious. Deepening
   the end to `#CB7A00` fixed the edge and let the label go back to white.
   The first value tried, `#D47F00`, looked right and measured 2.89 against
   the background — under the 3:1 a UI boundary needs. The test caught it;
   the eye did not.
3. Still too dark. Replaced with a **solid fill whose hue flips with the
   theme** — deep blue on the day-lit theme, day-orange on the night one —
   so the thing you are meant to tap always stands off its ground. A blue
   button on a blue-black page is something you would have to hunt for.

That flip is applied throughout: primary buttons, the active tab icon,
links, the Appearance selector. Scoping it to the CTA alone would have left
an orange button above blue-tinted ones, which is the inconsistency it
exists to fix.

`accentYou` was renamed to `accent` as part of it, because the flip made the
old name a lie: in dark mode it is orange, which reads as "partner" if taken
literally. **The you/partner meaning did not move** — it lives on the
Timeline card edges, HeroCard's halves, the crossover heart and the pet, none
of which change with the theme. The rename separates the action colour from
the identity colours, which had been quietly conflated.

Not separately confirmed on this pass, all correct by construction: that
`ClipViewScreen` and the camera stay dark in both themes (they are pinned to
`media` and read no theme tokens at all), that the preference survives a
force-quit, and that System mode follows the OS. Worth a minute each.

The dark "partner" card fill (`#4E412C`) reads brown rather than warm. It
clears contrast and its 4pt edge carries the meaning, so it is left alone —
noted in case it grates in use.

2026-09-07 (follow-up 4): the two items left open after the dark-mode pass
are confirmed, and one flagged concern is withdrawn.

**`ClipViewScreen` and the camera stay dark in both themes.** They are pinned
to `media` and read no theme tokens at all, so this was correct by
construction — but it is the specific thing the whole `media` split exists to
guarantee, and it is worth having actually looked at. Before the migration
these screens built their dark surface from `colors.ink` as background and
`colors.surface` as text, which under a theme would have inverted them to
white-on-white.

**The dark "partner" card fill (`#4E412C`) is fine.** It was flagged as
reading brown rather than warm, from a render at roughly a third of the size
it appears on a phone. On a real screen it reads as intended. Recorded
because the flag was wrong, not the colour — a swatch in a comparison grid
and a card in a running app are different things, and the render was the
misleading one here.

Still not confirmed, both cheap: that the Appearance choice survives a
force-quit, and that System mode tracks the OS setting.

2026-09-08: **a dead end on the very first screen, fixed.** Going back from
the code stage via "Use a different email" left the numeric keyboard over
the email field. A number pad has no return key, so it could not be
dismissed, and an address cannot be typed on it — the only way out was
force-quitting the app.

Cause: both stages render an `<Input>` as the first child of a fragment in
the same position, so React reconciled them as one element and reused the
underlying native `TextInput`. `keyboardType` is read when that input
mounts; changing it on an already-mounted, focused one does not take.

Fixed with distinct keys, and the key then moved up to a wrapper on `stage`
so the whole subtree is rebuilt — structural rather than something a later
edit could undo by reordering children.

**The first attempt made it worse**, which is the part worth recording. It
also called `Keyboard.dismiss()` on the stage change, purely to stop the old
keyboard visibly changing type through the transition. That left the email
field completely uneditable — no typing, no backspace. Dismissing the
keyboard in the same tick the focused `TextInput` is being unmounted can
strand the input connection: the view remounts but never reacquires one, so
it renders normally and accepts nothing. Removing it fixed it; the keys were
always the whole fix.

Two things this says about the class of bug:

- It had been there since AuthScreen was written, and no theming or
  accessibility work touched it. It needed someone to walk the flow
  *backwards*, which nothing had.
- It is a complete dead end rather than an annoyance, on the first screen of
  the app. Someone hitting it force-quits, and there is no reason to assume
  they come back.

2026-09-08: **the invite-code enumeration oracle is closed**, and the rate
limit on the create path is confirmed on device — the eleventh create in an
hour is refused.

The hole: both paths that produced a code let the client choose it. The
insert policy on `pairs` constrained *who* a pair was for but not *what code*
it carried, and `regenerate_invite` took the code as an argument. Either one
answers "is this code live right now?", because the unique violation comes
straight back to the caller.

That defeated the attempt ceiling on `join_pair_by_code`. The ceiling assumes
guessing is blind; with an oracle you probe for free, build a list of codes
you know exist, and spend your ten attempts on certainties. And there is no
target to pick — you are fishing for any live invite, so the cost scales with
how many are outstanding rather than with the 887 million codes. Two users
and one invite: nothing to find. A few thousand users with a hundred live:
roughly 9M requests, which is days for a bot.

Generation moved into the database (`generate_invite_code`, `create_invite`,
and a single-argument `regenerate_invite`), which retry their own collisions
and never report one. The insert policy is dropped, so a pairs row can only
come from `create_invite`. The old two-argument `regenerate_invite` was
dropped rather than left alongside — leaving it would have kept the oracle
reachable by an older client or a direct RPC call.

**Half of this predates the invite work.** The client has always chosen the
code on insert; widening the space from 534 to ~887 million helped and did not
close it. Worth remembering as a shape: the size of a secret space does not
matter if something will tell you whether a guess was right.

`generateInviteCode` stays in `src/lib/inviteCode.ts` as the executable spec,
with tests that read `schema.sql` and assert the alphabet, the TTL default and
the six-character shape have not drifted from it. Two generators that are
allowed to disagree eventually will.

Verified: the three functions exist with the expected signatures, the old
two-argument form is gone, creating an invite works end to end with a
server-generated code, and the eleventh create in an hour is refused.

## 2026-09-16 — iOS "Days together" widget, real device

First native code in the project verified on hardware.

Installed the `preview` build on the test iPhone and added the widget from the
home screen. It renders **89 days together / since June 19, 2026**, which is
the correct count for that anniversary (11 + 31 + 31 + 16) and matches
HeroCard inside the app. Earlier the same day the same widget was verified on
the iPhone 16 Pro simulator at 817 days against the seeded test pair, along
with the shared container write itself
(`anniversaryDate => 2024-06-19` in
`Shared/AppGroup/<uuid>/Library/Preferences/group.com.whileyousleep.app.plist`).

Three failures on the way, none of which report themselves usefully:

1. **The iOS deployment target was too low for the native module.**
   `ExtensionStorage.podspec` requires iOS 16.4; at 15.1 `use_expo_modules!`
   dropped the pod silently, and `ExtensionStorage` fell back to the no-op
   stubs it ships for exactly that case. Every write was swallowed, so the app
   looked healthy and the widget sat empty. Raising the target to 16.4 fixed
   it and dropped iOS 15 support, which is the real price of this feature.
2. **`ios.appleTeamId` did not match the team the credentials belong to.**
   EAS prints the true team beside the certificate and profiles; trust that
   over anything typed from memory.
3. **A space in the widget target's `name`.** It produced an Xcode target
   called "Days together" while the plugin registered "Daystogether" with EAS,
   so EAS looked up a target that did not exist.

(2) and (3) both fail identically: the "Configure Xcode project" phase errors,
the server-side log file comes back empty (HTTP 200, 0 bytes), and the CLI
says only "Unknown error". Neither is findable from the failure itself, which
is why both are now written down in CLAUDE.md with one-line checks.

Also worth remembering: a dev client shows "Expected MIME-Type to be
'application/javascript' ... but got 'text/html'" when the Metro server it
remembers is gone — the HTML is that server's error page. It is not an app
bug, and no amount of rebuilding the app fixes it.

## 2026-09-16 — AI automation layer, step 2 (Postgres-side queue trigger)

First two steps of the AI automation build order (see
`docs/ai-automation-plan.md`), each tested in isolation before touching n8n.

**Per-partner opt-in toggle** confirmed on a real iPhone (EAS `development`
build, Metro over an `expo start --tunnel` connection since the phone and
dev machine were on different networks): flips instantly (optimistic
update), persists to `profiles.ai_enabled`, and survives a reload.

**The `clips_queue_ai` trigger** confirmed with a throwaway webhook.site URL
standing in for n8n, which didn't exist yet — isolates "does Postgres fire
correctly" from n8n entirely. Recording a clip with AI on produced a POST at
webhook.site with the correct JSON body (`clip_id`, `pair_id`, `sender_id`,
`storage_path`, `recorded_for_date`, `duration_seconds`) and the
`X-Webhook-Secret` header, and the clip's `ai_status` flipped to `pending`
in the `clips` table. `queue_clip_for_ai()`'s real webhook URL is
deliberately not committed (public portfolio repo) — set directly on the
live function via the SQL editor once Workflow 1 exists in n8n.

## 2026-09-17 — AI automation layer, steps 3-4 (full Workflow 1, end to end)

n8n Workflow 1 built and verified live, all the way through: Postgres trigger
→ n8n Webhook → Supabase signed URL → AssemblyAI transcription (poll loop) →
transcript written to the `transcripts` bucket → Gemini extraction →
`ai_title`/`ai_summary`/`ai_mood`/`ai_status` written back to the triggering
`clips` row. Confirmed via the SQL re-queue trick
(`select queue_clip_for_ai(id) from clips order by created_at desc limit 1;`)
against a real clip, checked in Supabase Studio.

Extraction is running on Gemini (`gemini-3.6-flash`), not Claude Haiku as
originally designed — Anthropic Console billing rejected every card on hand
mid-build. See the note in `docs/ai-automation-plan.md`'s Workflow 1 section;
swapping back to Claude once billing is sorted is a single-node change, not a
redesign.

Real bugs found and fixed while building, beyond the auth issues below:
- `queue_clip_for_ai()`'s webhook payload never included `caption_text`, which
  the extraction prompt needs — fixed in this same pass (see schema.sql).
- The `caption_text`/`duration_seconds` fields also had to be added to
  Workflow 1's first Edit Fields node, which only captured 5 of the 7 webhook
  fields.

Also confirmed empty-transcript handling end to end, not just in the prompt
design: a 2-second silent test clip transcribed to `""`, and Gemini correctly
fell back to a generic title ("A Quiet Moment") per the system prompt's
instruction, rather than inventing content.

**Real-device debugging detours this pass, worth remembering:**
- Supabase's newer `sb_secret_...` key format breaks when sent as
  `Authorization: Bearer <key>` on Storage endpoints — "Invalid Compact JWS",
  since Storage tries to decode it as a JWT. Fix: send it via a plain `apikey`
  header instead (or both headers, matching this project's existing pg_net
  calls). Confirmed directly from Postgres via `net.http_post` first, which
  is what proved the key/project were fine and the issue was n8n-side.
- n8n's Custom Auth credential (JSON-body credential editor) silently mangled
  a pasted key on iPad multiple times in a row with identical results;
  switching to plain literal header fields on the node (Send Headers toggle)
  resolved it immediately. Worth trying before spending more time on the JSON
  credential editor specifically on iOS.
- **Unpublished n8n edits do not affect the production webhook.** Several
  rounds of "identical error after a real fix" were actually caused by
  testing against `version 1` (the first Publish) while every subsequent
  change sat as an unpublished draft. The execution detail always shows which
  version actually ran — check that first before re-debugging a fix that
  didn't take.
- AssemblyAI deprecated `speech_model` (singular) for `speech_models` (plural
  array) since the plan was drafted; Gemini's `gemini-2.0-flash` was also
  already deprecated in favor of `gemini-3.6-flash`. Expect API drift like
  this on every external service in this plan — check the live error, not
  just the plan doc's example payloads.
- n8n's raw JSON body editor's own Fixed/Expression toggle did not reliably
  evaluate embedded `{{ }}` at the whole-box level on this n8n version; the
  per-field `fx` toggle (on individual "Using Fields Below" params, or a
  single "Raw" body field) was reliable every time. Preferred that pattern
  throughout once discovered.

## 2026-09-17 — AI automation layer, step 5 (failure handling)

The "Handle AI Failure" sub-workflow (a separate n8n workflow, called via
"When Executed by Another Workflow") is built and verified two ways:

**Standalone**, with manually-entered test input (a real `clip_id` +
`error_message: "test failure"`): the Supabase PATCH correctly flipped that
clip's `ai_status` to `'failed'`, and the Telegram send returned
`ok: true` with a real `message_id`.

**Wired into Workflow 1 for real**, via a deliberate break: temporarily
corrupting the Gemini API key header on `HTTP Request4` (the extraction
call), publishing, then re-queuing a real clip. Confirmed: `HTTP Request4`'s
error output correctly routed to its `Call 'Handle AI Failure'` node, that
clip's `ai_status` flipped to `'failed'` in Supabase, and the Telegram alert
arrived. Restoring the correct key and re-queuing again confirmed the happy
path still works (`ai_status = 'completed'`) — the break didn't leave
anything in a bad state.

Every risky node in Workflow 1 now routes to its own `Call 'Handle AI
Failure'` node — five in total, each a separate Execute Workflow node since
each needs its own `clip_id`/`error_message` mapping from its own position
in the chain. Two different mechanisms feed them: `HTTP Request`
(signed-URL), `HTTP Request1`/`HTTP Request2` (AssemblyAI submit+poll),
`HTTP Request4` (extraction), and `HTTP Request5` (write-back) each have
"On Error: Continue Using Error Output" set, so a thrown request exception
routes there directly. `If1`'s `status == "error"` branch is different — a
plain IF-node data branch on AssemblyAI's own response body (a successful
HTTP call reporting a business-logic failure), wired to its own Call node
rather than relying on any node-level error setting.

## 2026-09-18 — AI automation layer, step 6 (Timeline/ClipView UI)

`ai_title`/`ai_summary`/mood emoji rendering confirmed live on a real device
(dev client over the same tunnel Metro from earlier this pass): the
`2026-09-17` test clip (`ai_status = 'completed'`) shows its summary text and
a 😌 mood emoji on the Timeline card. That row's `ai_title` is `null` —
overwritten by a later re-queue test whose Gemini response came back missing
`title` despite the schema marking it required — so the title line correctly
renders nothing rather than breaking, confirming the per-field conditional
rendering handles a partially-populated row. Gemini's structured output not
reliably including every "required" field is a real gap worth remembering
(Claude's `strict: true` tool-use, the original design, wouldn't have this
problem) — not urgent to fix now since the UI already degrades gracefully,
but worth revisiting once Anthropic billing is sorted and extraction moves
back to Claude.

Not yet exercised on a real device this pass: the `ai_status === 'failed'`
Retry row (no failed clip was visible/tested in the app itself, only
confirmed at the database level in step 5), and `ai_title`/mood rendering on
a row that actually has a title.

**Follow-up, same day, after code review on PR #121:** two real findings
fixed and confirmed on-device. `ClipViewScreen` originally only showed the
mood emoji when `ai_title` was also present (unlike `TimelineScreen`'s
independent rendering) — exactly the case this pass's test clip hit (mood
present, title null). Reloading the app after the fix confirmed the emoji
now renders on that clip's ClipView screen. Also confirmed the Retry row's
`Pressable`, nested inside the card's own `Pressable`, does not
mis-propagate the tap into navigating to ClipView — standard RN
touch-responder behavior, but flagged by the review as unverified until now.

## 2026-09-19 — AI automation layer, step 7 (weekly recap data + cleanup cron)

Both pieces verified directly in the SQL editor, no n8n involved yet.

`cleanup_old_transcripts()`'s cron job registered correctly
(`cron.job` shows `cleanup-old-transcripts` at `43 4 * * *`, staggered 26
minutes after `cleanup-orphaned-clip-files` at `17 4 * * *`).

`get_weekly_recap_batch()` returned real, correct data on the live project's
five test pairs: all five came back (every one has at least one partner with
`ai_enabled = true`), but only one had a non-empty `entries` array — the pair
with a genuinely mutually-revealed, AI-processed day
(`2026-09-17`, `sender: "b"`, matching the earlier cross-account test in
step 3). The other four correctly returned `entries: []`, confirming the
mutual-reveal `exists()` check and the `ai_status = 'completed'` filter both
hold — a clip existing isn't enough on its own to appear in a recap.

## 2026-09-19 — AI automation layer, step 8 (n8n Workflow 2, weekly recap)

Built and published: Schedule Trigger (`0 20 * * 0`, workflow timezone
explicitly set to UTC) → `get_weekly_recap_batch()` → Filter (drops pairs
with empty `entries`) → Gemini recap letter → two parallel Resend sends, one
per partner. n8n auto-split the RPC's array response into one item per pair
on its own, so no separate "Split Out" node was needed, unlike the plan
doc's more cautious original step list.

**Happy path confirmed live**, twice: both partner inboxes received a real,
correctly personalized recap email referencing the actual entry from
2026-09-17 ("a single entry from Thursday... b shared a completely silent
moment..."), generated by Gemini from `get_weekly_recap_batch()`'s real
output (no `responseSchema` this time — free-form prose, unlike the
extraction call).

**Error handling confirmed live** via a deliberate break: corrupting the
Resend-to-partner-A node's `Authorization` header, publishing, and running a
full manual execute. The Telegram alert fired with the real Resend error
message, and critically, **partner B's email still sent successfully** —
confirming the two Resend nodes are genuinely independent parallel branches
off the Gemini node, not a chain where one failure blocks the other. All
four risky nodes (`get_weekly_recap_batch`, the Gemini call, both Resend
sends) route their error output to one shared Telegram alert node — simpler
than the clip-specific "Handle AI Failure" sub-workflow since there's no
single clip to mark failed here, matching the plan's own reasoning.

Publishing this workflow also activates its schedule — the real weekly
recap will fire this coming Sunday at 20:00 UTC with no further action
needed. Not yet observed: an actual scheduled (non-manual) firing.

## 2026-09-19 — AI automation layer, step 9 (export) — two real bugs found on code review

Code review of the exported workflow JSON (PR #124) found two real, live
bugs that had been running in production since they were introduced, both
now fixed. Neither was caught by the interactive testing in the 2026-09-16
through -18 entries above, because that testing checked "did processing
complete and populate *something*," not "does every field hold the value
it should."

**`caption_text`/`duration_seconds` never reached the extraction prompt.**
The 2026-09-16 entry (step 2/3) records adding these two fields to "the
original Edit Fields node" — they were actually added to **Edit Fields1**
(the second one, after AssemblyAI's poll) instead, an easy mix-up given the
near-identical names. Edit Fields1's versions also read `$json.body.*`,
which doesn't exist at that point in the chain (`$json` there is
AssemblyAI's response, not the webhook body), and nothing downstream reads
from Edit Fields1 for these two fields regardless — the extraction node
explicitly pulls from `$('Edit Fields')`, the first one, by name. Net
effect: every extraction call since step 4 first went live has sent an
empty caption and the literal text `"Duration: undefineds"`. Fixed by
moving the two fields to the actual first Edit Fields node and deleting the
dead copies.

**`ai_title` was never actually written back.** The **2026-09-18 entry's
diagnosis above is wrong** — the null title wasn't Gemini omitting a
schema-required field. The write-back Set node's title field was named
`=ai_field` instead of `ai_title` (a stray `=`, which puts n8n in
expression-name mode; with no `{{ }}` inside, it evaluates to the literal
string `"ai_field"`). The PATCH body reads `$json.ai_title`, always
undefined, so `ai_title` silently dropped out of every write via
`JSON.stringify`. Every clip processed by this workflow has a real
`ai_summary`/`ai_mood` but a permanently null `ai_title`, until this fix.
Two sibling fields (`ai_summary`, `clip_id`) had the same stray-`=`
malformation but coincidentally still worked, since their literal
expression text happened to equal the intended field name — cleaned up
too, for correctness rather than because they were broken.

**Both fixes confirmed live**, same day, applied directly to the actual n8n
workflow (not just the committed export) and verified one at a time via the
SQL re-queue trick:

- **Fix 1**: the first Edit Fields node's output now shows real
  `caption_text` (`"phew"`, matching the `clips` row) and the Gemini node's
  input carries it through correctly. `duration_seconds` still showed
  `null` — traced back to the source row itself genuinely having a null
  `duration_seconds` (confirmed via direct query), so this is the fix
  correctly passing through real null data, not a remaining bug.
- **Fix 2**: the "Edit Fields2" node's title field name box still literally
  read `ai_field` even after the intended fix — the rename hadn't actually
  been typed in yet (this node's name field has no separate `fx` toggle
  like the value fields, easy to think a value-field change covered it).
  Once corrected to `ai_title` and republished, a fresh re-queue produced a
  real, non-null `ai_title` on the `clips` row for the first time since
  this feature shipped.

**A second review pass on the same PR found two more gaps**, this time
traced back to the original plan doc's own step 11, which only listed
nodes 3, 4/5, 8, 10 for error handling — never the transcript-write step
(`HTTP Request3`) or the extraction-response parse (`Edit Fields2`). Either
failing left a clip stuck at `ai_status = 'pending'` forever: no retry
possible (`retry_ai_processing()` only accepts `'failed'`), and no failure
state visible in the app UI (which only renders for `'completed'`/`'failed'`).

Fixed and confirmed live the same day: added `Call 'Handle AI Failure'6`
(off `HTTP Request3`'s error output) and `'7` (off `Edit Fields2`'s).
Tested with the usual deliberate-break trick on `HTTP Request3` — corrupted
its Supabase header, re-queued, confirmed the Telegram alert fired and
`ai_status` flipped to `'failed'`, restored the key, re-queued again,
confirmed `ai_status` returned to `'completed'`. `Edit Fields2`'s branch
was verified by wiring alone, not a forced failure — there's no easy way
to make Gemini return malformed JSON in a 200 response on demand, and the
wiring is structurally identical to every other proven branch.

**A third review pass found one more gap**, different in kind from the
first two: the AssemblyAI poll loop (`Wait → HTTP Request2 → If → If1 →
back to Wait`) had no maximum iteration count or timeout. If AssemblyAI
ever hung in "queued"/"processing" and never explicitly returned
`completed` or `error`, the workflow would poll forever — same
stuck-at-`'pending'`-forever, unretryable dead end as the other two, just
caused by an unbounded business-logic loop rather than a missing `onError`
flag, so a node-by-node error-handling audit wouldn't have caught it.

Fixed by adding a self-referencing counter ("Increment Poll Count", using
`$('Increment Poll Count')` with a try/catch fallback for the first pass —
n8n has no built-in loop-iteration variable for a manually-wired cycle like
this one) and an IF node capping it at 24 attempts (2 minutes total)
before routing to `Handle AI Failure` instead of continuing to loop.
Confirmed non-disruptive on a real run: the new nodes executed cleanly
(green, no errors) even though this particular clip resolved on the first
poll and never actually took the loop-back path — so the counter itself
wasn't exercised by a real multi-poll run. Everything else (the `If2`
condition, the `Call 'Handle AI Failure'8` input mapping, the
self-reference name now matching the actual node name) was verified by
direct inspection instead, same standard as `Edit Fields2`'s branch above
— there's no practical way to force AssemblyAI into a multi-minute hang on
demand either.

**A fourth review pass on the poll-counter fix itself found three more real
bugs and one false alarm**, all fixed/resolved the same night:

- **"Increment Poll Count" silently dropped `id`/`status`/`text`.** n8n's
  Set node only outputs explicitly-assigned fields unless "Include Other
  Input Fields" is on — it wasn't. Every other Edit Fields node in this
  workflow works around the same limitation by explicitly re-deriving
  needed fields via `$('NodeName')` references instead, but that pattern
  doesn't fit here, since the very next poll needs AssemblyAI's `id`
  untouched. This was the most serious of the four: any clip needing more
  than one poll (i.e. most clips with real speech, not just an edge case)
  would have had its second poll request `.../v2/transcript/undefined`,
  404, and get incorrectly marked `'failed'` mid-processing. Fixed by
  turning the toggle on. Verified by direct config inspection (`Include
  Other Input Fields: All`) — the loop-back path still wasn't exercised by
  a real run, same limitation as testing the counter itself.
- **The AssemblyAI-error Telegram alert always showed "undefined."**
  `Call 'Handle AI Failure'5` (fired when AssemblyAI's poll response body
  itself says `status: "error"`) read `error_message` as
  `{{$json.error.message}}`, copied from the pattern used everywhere else
  — but AssemblyAI's `error` field is a plain string, not an object, so
  `.message` on it is always `undefined`. The clip still correctly got
  marked `'failed'`; only the alert's usefulness was degraded. Fixed with
  a type check: `{{ typeof $json.error === 'object' ? $json.error.message
  : $json.error }}`.
- **`If2`'s cap allowed 25 polls, not the documented 24** — an off-by-one
  (`poll_count <= 24` lets the 24th pass through and only catches the
  25th). Fixed by changing the operator to "is less than."
- **False alarm, not a bug**: the `Wait` node's exported `parameters: {}`
  looked like it meant the "5 second wait" claimed everywhere was never
  actually configured. Checked directly in n8n: it's genuinely set to
  5.00 seconds — that value just happens to match n8n's own schema
  default for this node type, so it's omitted from the export rather than
  being unset. No change needed.

The doc node-count ("eight" → "nine" `Call 'Handle AI Failure'` nodes,
after adding the poll-timeout branch) was also stale in both
`automation/README.md` and `CLAUDE.md` — corrected in the same pass.

**A fifth pass found one more**, the same "silently wrong forever" class:
the Gemini prompt concatenated `duration_seconds` with no null guard, so a
clip with a null duration (a real case — this pass's own test clip) sent
the literal text `"Duration: nulls"` to Gemini on every extraction. The
sibling `caption_text` on the same line already had a `|| ""` guard; this
one had been missed. Fixed with a ternary that renders `"Duration:
unknown"` instead, and confirmed live: the node's resolved request body
on a real re-queue now reads `"\nDuration: unknown"`.

Lower severity than the earlier finds — Gemini still produced a sensible
title/summary/mood with the garbage duration string, since it's a minor
detail in the prompt — but same class of bug, and cheap to fix.

**A sixth pass found four more**, all fixed same night:

- **The poll-counter's try/catch fallback masked its own failure mode.**
  The claim above that "n8n has no built-in loop-iteration variable" was
  wrong — `$runIndex` (0-based count of how many times the current node
  has run) does exactly this, natively, no self-reference or try/catch
  needed. Worse than just being the harder path: if the self-reference
  ever failed to resolve on a *later* pass (not just the first), the
  try/catch would silently fall back to `0` every time, `poll_count`
  would never exceed 1, `If2` would always be true, and the 24-attempt
  cap this whole fix exists for would quietly become a no-op — the exact
  unbounded loop being closed. Replaced with `{{ $runIndex + 1 }}`.
  Confirmed live: config shows the new expression, and a real re-queue
  still completes normally.
- **`Handle AI Failure`'s own PATCH node had no error handling**, and
  under n8n's execution order runs *before* the Telegram node. If
  Supabase itself is down — plausibly the same reason something upstream
  already failed — the PATCH throws, the sub-workflow halts, and the one
  alert this whole system exists to send never sends. Fixed with `On
  Error: Continue` (regular output, not error output) on that node.
- **`Call 'Handle AI Failure'7`'s alert also always said "undefined."**
  Same bug as the one already fixed on `'5`, just missed there because it
  comes from a Set node's error output (`{error: "<string>"}`) rather
  than an HTTP node's. Same type-guard fix applied.
- **A single transient poll failure permanently failed a clip that was
  seconds from finishing.** `HTTP Request2` (the AssemblyAI poll GET) had
  no retry, so one 5xx or network blip routed straight to
  `Handle AI Failure` regardless of how close the actual transcription
  was to done — and Retry then re-runs the whole pipeline, including a
  second AssemblyAI charge. Fixed by turning on "Retry On Fail."

Two more were documentation-only, not live bugs: the README's re-import
step claimed importing `handle-ai-failure.json` first was sufficient for
the nine `Execute Workflow` references to resolve — it isn't, since a
fresh import assigns a new workflow ID and each node still points at this
repo's original one; corrected to say each needs re-selecting after
import. And `weekly-recap.json` fires every pair's Gemini/Resend calls
concurrently with no batching, fine at n=1 but worth adding before a
second couple signs up — documented in `automation/README.md`'s
Deviations section rather than fixed now, since it's untestable at the
current scale.

**A seventh pass found no live-pipeline bugs** — the first pass with none,
a meaningful signal the workflow logic has converged. Four
consistency/robustness items instead: the plan doc and CLAUDE.md still
described the poll counter as the removed self-referencing version
(someone rebuilding from the plan would reintroduce the masked-failure
bug — corrected, with an explicit "do not rebuild it this way" note in
the plan); the README called the workflow "Clip AI Processing" while n8n
shows it as "AI Clip Tag Workflow" (corrected to match); and
`Call 'Handle AI Failure'4` was the only one of the nine Execute Workflow
nodes with "On Error: Continue Using Error Output" set, its error output
unconnected — so if it ever failed (e.g. not re-selected after a fresh
import), the error would be swallowed, the execution would show green,
and the clip would sit at `'pending'` with no alert. Reset to the default
"Stop Workflow" so it fails visibly like the other eight.

## 2026-09-21 — AI automation layer: in-app Retry and title rendering, real device

The two testing items left open after PR #124 merged, both closed on a
real iPhone (dev client over tunnel Metro, account `dereksalanga@gmail.com`).

**The in-app Retry row and `retry_ai_processing()` RPC.** Deliberately
failed one of that account's own clips (broke the Gemini key, re-queued
that specific clip by id, confirmed `ai_status = 'failed'`), then tapped
the Timeline card's "AI summary failed — Retry" row. It genuinely re-ran
the whole pipeline — a fresh n8n execution, fresh signed URL, new
AssemblyAI submission — twice, not a no-op. So the RPC's
`sender_id = auth.uid()` / `ai_status = 'failed'` gate and the app's
invalidate-on-success both work through the real client path, not just
the SQL re-queue trick used for every earlier recovery check.

It kept failing after the key was restored, which turned out to be a
**genuine, unrelated content error**: this particular clip (an old test
recording, caption "yeahh") has no audio track at all — AssemblyAI's poll
came back `status: "error"`, routed through `If1` → `Call 'Handle AI
Failure'5`, and the Telegram alert read "No audio stream found in the
file. File type is video/quicktime (ISO Media, Apple QuickTime movie…)".
That's the real AssemblyAI error text arriving intact, which doubles as
live confirmation of the `typeof` guard fix on `'5` from the fourth
review pass (it would have read `: undefined` before). Retry can't fix a file with no
audio, so this clip is correctly stuck at `failed` — but it exposes a UX
gap: the app keeps offering a Retry that can never succeed, with no way
to tell a transient failure from a permanent one. Accepted for now; an
`ai_error` column surfaced on the card, or a retry cap, would close it.

**`ai_title` rendering in the app.** Re-queued a different clip of the
same account with real audio (caption "fave"), watched it complete through
the write-back, pulled to refresh. The Timeline card shows all three AI
fields exactly as designed: title "Sharing a Favorite Moment" between the
sender name and date, 🥰 mood emoji top-right, and the summary ("A quiet
video clip is shared with a simple caption marking it as a favorite
moment.") below the caption. First time the title has been seen rendered
on a screen rather than in a database row — every earlier on-device pass
predated the `=ai_field` fix.

## 2026-09-21 — AI automation layer: `unprocessable` status and `ai_error`, real device

Closes the UX gap the entry above left open. Same iPhone, same account,
same two clips.

**Why a second status rather than a retry cap.** The no-audio clip's
failure came from one specific branch — AssemblyAI's own poll returning
`status: "error"` — and that is the only branch where the error is about
the file rather than our pipeline. So only `Call 'Handle AI Failure'5`
passes `ai_status: unprocessable`; every other error branch still defaults
to `failed`. **Refined on code review of PR #126:** that branch isn't
purely content errors either — AssemblyAI also returns `status: "error"`
for "Download error, unable to download <url>" (the signed URL is minted
with `expiresIn: 600`, so a queue backlog past ten minutes or a
cold-starting Supabase project produces it on a perfectly good clip) and
"Server error, developers have been alerted". Stamping those
`unprocessable` would lock a good clip out of Retry with hand SQL as the
only way back, and the card's "first sentence" would print the signed URL.
The node now decides by error text — `unprocessable` only on
`/audio|stream|unsupported|file type|codec/i`, `failed` otherwise. Not
exercised live (no way to make AssemblyAI produce a download error on
demand); the no-audio text still matches, which is the path that was. `retry_ai_processing()` already refused anything that isn't
`'failed'`, so the server-side half of "no Retry" came for free.

**Live SQL** (`ai_error` column, constraint swap, `queue_clip_for_ai`
clearing `ai_error` on re-queue): the verify query returned three `true`s,
including a `pg_proc.prosrc` check that the function replace actually
took.

**Permanent path.** Re-queued the no-audio clip ("yeahh"). The Timeline
card now reads "AI summary unavailable for this clip" with the reason on
one line beneath, and no Retry row. The reason was first shown in full
(two lines, trailing into "File type is video/quicktime (ISO Media…") —
the user called it too long, so it's cut to the first sentence: "No audio
stream found in the file".

**Transient path, and clear-on-requeue.** Broke the Gemini key on `HTTP
Request4`, published, re-queued the good clip ("fave"). The card showed
"AI summary failed — Retry" with Gemini's raw `401 - "{\n \"error\"…`
body under it. The user's read: "the error is weird from a users point
of view" — right, it's an HTTP body from our side and the user can't act
on it beyond Retry. So `ai_error` is now rendered only on the
unprocessable row, where it explains *why* Retry is missing. Restored the
key, published, tapped Retry: the card came back with a fresh title ("A
Moment with My Favorite"), 🥰, and summary, and no reason line — so the
re-queue cleared `ai_error` and the write-back completed.

Metro was run detached (`nohup npx expo start --dev-client --tunnel &
disown`) for this pass — the session's memory watchdog kills a foreground
background task between turns, which is the same harness snag recorded
under "EAS Build" in `CLAUDE.md`, just with a different fix.

## 2026-09-23 — Timeline card rework (#128), real device

iOS dev client against Metro, same Timeline viewed in dark then light theme
(Settings → Appearance), on the live test pair.

**Confirmed, both themes:** day headers (`SEP 17`, `SEP 16`, `SEP 12`) each
appear once, with both partners' SEP 17 cards grouped under one. Cards are
full width; the orange/blue left edge and fill both read in either theme.
Hierarchy reads as designed: muted name, caption ("yeahh", "fave") as the
largest text, then the muted AI block. A processed clip shows
`✦ A Moment with My Favorite 🥰` and a two-line summary; the partner's 🔥
reaction sits alone at header-right and can't be confused with the mood
emoji. The `unprocessable` clip keeps "AI summary unavailable for this clip /
No audio stream found in the file" with no Retry. The partner's clip with no
AI data is a compact name + caption card. Scrolling down does not
re-trigger the entrance motion.

HeroCard read 1386 days in the 12:00 screenshot and 1385 at 12:02 — local
midnight passed between them, and 1385 is the correct count from
2026-09-23 to 2030-07-09. Not a bug.

**Follow-up, same session:** the unwatched dot was seen leading the name on a
new clip (not screenshotted). The partner's private nickname was set to a
full 20 characters (`tqtqtwtqttqtqtqtqyqy`): it fits on one line beside the
🔥 with room to spare at iPhone width, so `numberOfLines`/`flexShrink` never
engage here. They remain the guard for narrower screens. Pull-to-refresh
does not re-trigger the entrance motion either.

**Not exercised:** the truncation path itself, and Android.

## 2026-09-23 — Timeline card, second pass: no names, 80% width, reaction colours

iOS dev client over a Metro tunnel, dark then light theme. Changes made
iteratively against the device, in this order:

1. **Name and caption removed from the card**, unavailable row italicised
   (`Inter_400Regular_Italic`, newly loaded — `fontStyle: 'italic'` isn't
   synthesised for a custom family on iOS). Seen on device: the italic row
   rendered correctly, but a watched clip with no AI output and no reaction
   was an empty coloured bar (SEP 12), and SEP 17's partner card was a bar
   with only a 🔥. The user asked for captions back.
2. **Width reverted to 80%**, yours right / theirs left. With names gone the
   side is the one ownership cue that isn't colour.
3. **Caption restored**, then **moved onto one row with the reactions**
   (dot, caption `flex: 1`, reactions). Seen: `fave 😂`, `yes ❤️`,
   `solo dev 😂`, `2 😂 🥺` all on one line, AI block below.
4. **Reaction circles** in the reactor's colour so two emoji on a card say
   who left which. Seen in light mode: on the partner's "2" card, 😂 on
   orange and 🥺 on blue.
5. **`edgePartner` changed to the brand orange** (`#FFC670`) in light mode,
   from `#CA7900`, at the user's request — it read too dark next to
   HeroCard. That drops the partner edge to ~1.44:1 against the cream, so
   the 3:1 assertion for it in `themes.test.ts` was removed deliberately.
   Applies to the Timeline edge and circles, Monthly Summary's pips and the
   secondary button border. Not looked at on device after this change.

**Dev-client snag worth keeping:** the launcher requested the tunnel bundle
over `http://…exp.direct` and failed with "Could not connect to development
server" while the tunnel log showed the phone's `/message` websocket
arriving and no bundle GET at all — iOS ATS blocks plain http to a
non-local host. Entering the `https://` URL manually (or the
`exp+while-you-sleep://expo-development-client/?url=https%3A%2F%2F…` deep
link) fixed it.

## 2026-09-23 — Monthly Summary: pages, icons, fixed layout

iOS dev client, dark theme, changes made iteratively against the device.

- "Favorite moments" and "What you said" moved off the summary onto their
  own page (`MonthListScreen`), reached from icon tiles; the summary no
  longer scrolls.
- Back arrow stops at the pair's first month (`pairs.created_at`).
- Grid became a real Sunday-first calendar with a weekday header. On
  device, August 2026 (1st on a Saturday) rendered as six rows with the 29th
  carrying both dots.
- Two shift bugs seen and fixed: the centred block moved between five- and
  six-week months (now always six rows), and every month change flashed
  zeros because the screen fetched per month and showed a spinner (now
  filtered from the cached `useClips` list, no spinner). Those two fixes
  were not re-checked on device before the PR.
- Month arrows were `‹ ›` text glyphs that sat low in their circles;
  replaced with SVG chevrons.
- Tab bar icons replaced with stroked line icons matching the new action
  row; the hand-drawn `theme/navIcons.ts` was deleted.

**Follow-up, same day, after #130 merged:** the user checked the three
remaining items on the phone and all looked right: switching August ↔
September with no layout shift or zero flash, light mode, and both list
pages. Still unexercised: the small-screen `ScrollView` fallback.

## 2026-09-23 — Home layout, trip editor page, HeroCard wrapping

iOS dev client, light theme. Home now reads: title and days-together line,
the trip as HeroCard, the pet, then "Today's question" pinned 18pt above the
tab bar. Tapping the trip card pushes `TripEditScreen` inside a new Home tab
stack; it had been an in-place form whose 216pt spinner pushed the rest of
Home off-screen.

Seen on device: the layout, and a long country ("British Indian Ocean
Territory") first truncating to "British Indian O…", then — after allowing
two lines — shifting the colour split off the heart, because `flex: 1`
halves widened with the padded, wrapped text. Fixed by fixing both halves at
50%, after which the split sat under the heart again.

A `// comment` left as bare JSX text after the in-place editor's ternary was
removed crashed Home with "Text strings must be rendered within a <Text>
component". Type-check and lint don't catch that — it's valid TSX.

Code review then fixed, not yet re-checked on device: the trip card is
disabled while its query loads (the form seeds once from the cache), Save
guards against double taps via `Button`'s `loading`, the Android date dialog
opens from a tappable row rather than being always mounted, the date line on
HeroCard may wrap too, notification taps to Home name `HomeMain`, and Home's
non-bouncing `ScrollView` fallback is back for small screens.

**Follow-up, after #133 merged:** the user checked the trip page on the
phone (iOS): opening it from the card, changing country and date, Save
updating Home, a past date rejected, and the back link. All good. Android's
tap-to-open date dialog and dark mode remain unchecked.

## 2026-09-23 — Shared BackLink and Android date-dialog change

#135 replaced four copied back links with `ui/BackLink` (plus a 12pt
`hitSlop`); #136 moved both Android date pickers to
`DateTimePickerAndroid.open()` from a tappable row, rendering the component
on iOS only. The user checked on iOS: all four back links, and both
spinners, unchanged. The Android side of #136 is still unverified — no
Android device in this pass.

## 2026-09-23 — The pet becomes a cat

Redrawn as a cat (right half written, then mirrored), rendered to a PNG
locally in all four moods before wiring it in. `petPaths.test.ts` now covers
every shape and caught a swapped whisker coordinate during drawing.

Code review then fixed, not yet seen on device: inner ears and belly split
per partner in theme-independent soft hues (the theme's `fillPartner` goes
dark brown in dark mode — "holes in the cat"); the Resting Z moved clear of
the right ear; the withdrawn frown now meets the nose line; the pet is sized
from its measured area rather than a fraction of the window (which would
have overflowed an iPhone SE).

## 2026-09-25 — Hand-drawn layered cat replaces the vector cat

The user drew the cat in Procreate as separate transparent 1024px layers
(body, head, both ears, tail, eyes open/closed), then flipped the palette to
the app's convention (orange left, blue right). Runtime copies at 260/520/780
live in `assets/cat/runtime`. `SharedPet` stacks them and animates with
Reanimated; the vector `petPaths.ts` and its symmetry test are gone.

Before committing: breathing and the tail sway were fixed-duration
`withRepeat` loops, now scheduled per cycle with random lengths; and the
motion kept running under the pushed trip editor, now stopped via
`useIsFocused()`. Type-check, lint and tests pass; not yet seen on device.

**Code review, same day, before merging:** blinks now cross-fade two mounted
eye images (a source swap could flash an eyeless frame on iOS); Reduce
Motion is read live via `AccessibilityInfo`; motion also stops when the app
is backgrounded; the head, ears and eyes breathe with the body; a mood
change eases back to rest instead of snapping. Noted, not changed: the
raster cat has one neutral face, so the per-mood faces — including the
user's deliberate `withdrawn` frown — are gone until mood face layers are
drawn.
