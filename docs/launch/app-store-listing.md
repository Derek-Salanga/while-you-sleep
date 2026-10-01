# App Store Connect listing — While You Sleep (v1.0.0)

Source facts checked against: `CLAUDE.md`, `app.json`, `supabase/schema.sql`,
`App.tsx`, `src/screens/*`, `src/screens/SettingsScreen.tsx` (`AI_DISCLOSURE`),
on 2026-09-30. Character counts below are computed from the exact string
shown, not estimated. No em dashes anywhere in listing copy.

## Name (limit 30)

```
While You Sleep
```

15 / 30 characters.

## Subtitle (limit 30)

```
For couples apart, together
```

28 / 30 characters.

## Promotional text (limit 170)

```
A daily video for the person you miss most. One question, thirty seconds, every day. Post yours, then watch theirs. Private, just the two of you.
```

145 / 170 characters.

## Description (limit 4000, aim ~1500)

```
While You Sleep is a private video diary built for couples living in different time zones.

Every day, you and your partner each get the same question. You answer it with a short video clip, thirty seconds or less, plus an optional caption. You only see your partner's answer for that day once you've posted your own, so it's always a trade, never a feed to scroll.

It's built around the strange rhythm of being apart: the moment you're awake and thinking of them, they're probably asleep. A clip waiting for them when they wake up is the whole idea.

What's inside:

- A daily shared question, answered on video
- Reveal only after you've both posted
- Reactions on each other's clips
- A running count of days together, from your anniversary
- A countdown to your next trip to see each other
- Private nicknames, just for how you two talk
- A shared pet that reflects how consistently you're both showing up
- Pause mode for a trip, a busy week, or just a break
- A Monthly Summary: stats, a calendar, and your month's clips played back
- A home screen widget
- Light and dark themes

Optional AI summaries:
If you turn it on, each of your clips gets a short title, summary, and mood, generated from the audio, and you both get a warm weekly recap by email. It's off by default, clearly explained before you turn it on, and only processes your own clips.

While You Sleep doesn't have a public profile, a feed, or followers. It's one pair, one question a day, and the small, steady proof that you're both still showing up for each other.
```

1540 / 4000 characters.

## Keywords (limit 100, comma-separated, no spaces after commas)

```
ldr,long distance relationship,video diary,daily journal,partner,countdown,anniversary,timezone
```

95 / 100 characters. Does not repeat "while", "you", "sleep" (Name) or
"for", "couples", "apart", "together" (Subtitle).

## Category suggestions

- **Primary: Lifestyle.** The app is a personal/relationship ritual (a daily
  diary and set of relationship-tracking tools — anniversary, trip countdown,
  pet), not a photo/video editing tool or a public social network.
- **Secondary: Social Networking.** There's a pairing/invite mechanic and
  reactions between two people, which is the closest fit even though the
  app is deliberately closed (no feed, no discovery, no strangers).

[CONFIRM: Apple's exact category list and whether "Lifestyle" vs. "Social
Networking" should be swapped as primary/secondary is ultimately a judgment
call made in App Store Connect at submission time — the reasoning above is
sound but not a guarantee of how Apple will index it in search.]

## Age rating questionnaire

Answered from what's actually in the code (`supabase/schema.sql`, `src/`),
not from how the app is marketed:

- **Unrestricted web access:** No. The app has no in-app browser and no
  outbound links to arbitrary web content.
- **User-generated content:** Yes — each clip's video, optional caption,
  and the private nickname you set for your partner are all user-authored.
  But: there is no public posting, no feed, no discovery, and no content
  visible to anyone outside your own pair. The only other user a person can
  ever reach is the one specific partner they paired with via a shared
  invite code (`pairs`/`join_pair_by_code` in `supabase/schema.sql`) —
  there is no mechanism to contact, browse, or be contacted by a stranger.
- **In-app communication with other users:** Limited to reactions
  (`clip_reactions`) and clips/captions exchanged with your one paired
  partner. No chat, no comments, no open messaging.
- **Reporting / blocking:** Checked the code directly — **neither exists**.
  There is no report table, no block/mute mechanism, and no moderation RPC
  anywhere in `supabase/schema.sql` or `src/`. The app's safety model is
  entirely "no stranger can ever reach you" (closed, mutually-invited pairs
  only) rather than "moderate what strangers post." `delete_own_account()`
  is the only account-level control a user has, and it cascades through the
  whole shared pair (see App Review notes below).
- **Mature/suggestive themes, violence, horror, profanity, alcohol/tobacco/
  drug use, gambling, contests:** No — none of these are features of the
  app itself. (User-authored video could theoretically contain anything,
  same as any camera app, but the app doesn't provide, suggest, or
  moderate for such content.)

[CONFIRM: the resulting numeric age band (e.g. 4+ vs. a higher band) is
Apple's own determination from the submitted questionnaire. Apps with
user-generated content and user-to-user interaction are sometimes expected
to show report/block affordances under App Review Guideline 1.2, even when
closed to strangers like this one. Worth a deliberate decision before
submission: answer the questionnaire honestly as above and accept whatever
band results, or add a minimal block/report-to-support path first. Not
guessed here.]

## App Review notes (paste into App Store Connect → App Review Information → Notes)

```
While You Sleep normally signs in with a one-time code emailed to the user
(no passwords for real accounts). Since App Review can't receive that
email, the demo account below uses a password instead:

Email: appreview@whileyousleepapp.com
Password: [PASSWORD IN SIGN-IN FIELD]

To sign in: enter the email above, tap Continue, then enter the password
when the password field appears (this account is specifically allow-listed
to skip the emailed code).

This demo account is already paired with a partner demo account, and we
post a clip from the partner for the current day before every review
submission. Recording and sending your own clip for today will immediately
reveal the partner's clip for that same day. This is the app's core
mechanic: you only see your partner's answer for a given day after posting
your own.

AI summaries (Settings → AI summaries) are off by default and fully
opt-in. Turning the toggle on shows a disclosure naming every third-party
service involved (n8n, AssemblyAI, Google Gemini, Resend) before anything
is sent, and only the account's own clips are ever processed.

Account deletion is at Settings → Account → Delete account. Please note
before testing it: this account is paired, and deleting either side of a
pair cascades through the shared data (clips, trip, anniversary) for both
accounts, not just the one deleted. If you delete it during review, we'll
need to recreate and re-pair both demo accounts before the next review
pass.
```

## Support / Privacy / Marketing URLs

- Support URL: `https://github.com/Derek-Salanga/while-you-sleep/blob/main/SUPPORT.md`
- Privacy Policy URL: `https://github.com/Derek-Salanga/while-you-sleep/blob/main/PRIVACY.md`
  (the same file the app's Settings → Account → Privacy Policy row opens)
- Marketing URL: optional, not set for v1.0.0.

Both resolve once PR #150 merges. A whileyousleepapp.com page can replace
them later; App Store Connect lets you change these URLs without a new build.

## Screenshot plan

Six screens, in this order (the order App Store Connect displays them in,
first screenshot is what most shoppers see first):

1. **Home** — the shared pet, "N days together," and the next-trip
   countdown. Caption: "The small ways you stay close"
2. **Record (camera + today's question)** — the question overlay while
   framing the shot. Caption: "One question. Thirty seconds. Every day."
3. **Revealed** — your clip and your partner's side by side right after
   posting. Caption: "Post yours, then see theirs"
4. **Timeline** — the running feed of past days' clips and reactions.
   Caption: "A running diary of the days apart"
5. **Monthly Summary** — the calendar grid, stats, and reel entry point.
   Caption: "Watch the month back, together"
6. **Settings** — nickname, anniversary, AI summaries toggle with its
   disclosure visible. Caption: "Nicknames, countdowns, your story"

Required sizes: as of 2026, Apple's App Store Connect accepts a single
mandatory iPhone screenshot set captured on a **6.9" display** (e.g.
iPhone 16 Pro Max / 17 Pro Max class device, 1320 x 2868 px portrait) and
generates the smaller device sizes from it automatically. `app.json` sets
`"supportsTablet": false`, so no iPad screenshot set is needed.

[CONFIRM: screenshot size requirements are something Apple has changed
more than once in recent years. Verify the current mandatory set and exact
pixel dimensions in App Store Connect's Media Manager at upload time rather
than trusting this document alone.]
