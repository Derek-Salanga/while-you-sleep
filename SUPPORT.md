# While You Sleep — Support

## What is While You Sleep?

While You Sleep is a private video diary for two partners in a
long-distance relationship. Each day, you both answer the same question
with a short video clip (up to 30 seconds) and an optional caption. You
only get to see your partner's clip for a day once you've posted your own
for that day. There's also reactions, a shared "next trip" plan, your
anniversary date, nicknames, a shared pet that reflects how you're both
doing, and an iOS home screen widget showing your days together.

It's built for exactly two people. There's no public feed, no followers,
and no one outside your pair can ever see your clips.

## How to pair with your partner

1. One of you opens the app and creates an invite from the pairing
   screen. This gives you a short invite code.
2. Share that code with your partner however you'd like (text, call, in
   person).
3. Your partner enters the code on their pairing screen to join.

An invite code expires after a few days if it isn't used — if yours has
expired, just create a new one.

## Frequently asked questions

### I didn't get my sign-in code

- Check your spam/junk folder — the code comes from our email provider
  and can land there, especially the first time.
- **Codes expire in 15 minutes.** If it's been longer than that, go back
  and request a new one rather than trying the old code.
- Double-check you typed your email correctly on the sign-in screen.
- Still nothing after a few minutes and a spam-folder check? Email us at
  the address below and we'll look into it.

### I can't see my partner's clip for today

This is by design, not a bug: **you can only see your partner's clip for a
day once you've posted your own clip for that day.** Record and send
yours, and theirs will unlock right away if they've already posted.

The "day" is based on **UTC time, not your local time zone.** If you're
near a time-zone boundary (for example, late at night or very early
morning), today's question might turn into tomorrow's a few hours before
or after your own local midnight. If a clip you expect to see still isn't
there, check that you've actually posted for the day the app currently
thinks it is, not just "today" by your own clock.

### How do I turn AI summaries on or off?

Go to **Settings → AI summaries**. This is off by default and is per
person — your partner's setting doesn't affect yours.

- **Turning it on** sends each new clip you record to our automation
  pipeline (n8n → AssemblyAI → Google Gemini) to generate a title,
  summary, and mood for that clip. The app shows you exactly which
  services are involved and asks you to confirm before turning it on.
- **Turning it off** stops any *new* clip from being sent (a clip already
  in progress may still finish this one time). Clips you already have
  summaries for keep them.
- If **both** of you have it on, you'll also get a weekly recap email
  summarizing the week — this only includes days you both actually
  posted on, so it never spoils something you haven't unlocked in the app
  yet.

### What happens to my partner's data if I delete my account?

Deleting your account (**Settings → Account → Delete account**) deletes
*your* sign-in immediately, and also deletes your **entire pair's shared
history** — both of your clips, captions, reactions, trip, anniversary,
and shared pet. This is because that history belongs to the two of you
together, not to one person alone.

Your partner **keeps their own login and profile** — they are not
deleted. The next time they open the app, they'll be prompted to pair
again, since the previous pairing and its shared history are gone.

This cannot be undone, so make sure you both understand the consequence
before deleting.

### I'm not getting notifications

A few things to check:

- Make sure notifications are allowed for the app in your device's system
  settings.
- Push notifications only work on a real build of the app installed on a
  device — they are not available in a simulator or in a bare development
  preview without push credentials configured.
- Notifications deliberately contain no clip or caption content (just
  "your partner posted" or a reaction emoji) — if you're expecting to see
  the actual clip text in a notification, that's by design, not a missing
  feature.
- If you recently signed into a new device, give it a moment after your
  first sign-in — your device needs to register once before pushes can
  reach it.
- Still nothing after checking the above? Email us and let us know your
  platform (iOS/Android) and roughly when you last saw a notification
  work.

## Contact

Still stuck, or something above doesn't match what you're seeing? Email
us at:

**support@whileyousleepapp.com**
