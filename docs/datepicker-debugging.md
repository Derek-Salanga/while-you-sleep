# Date picker: six real-device bug rounds (resolved)

How both date pickers ended up in their current configuration. The current
state and the reusable lesson are in
[CLAUDE.md](../CLAUDE.md#date-picker-setup) — this file is the debugging
history behind them.

Both date pickers (trip on Home, anniversary in Settings) went through six
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
