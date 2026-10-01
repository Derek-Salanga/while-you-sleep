# Privacy Policy — While You Sleep

**Effective date: September 30, 2026**

While You Sleep is a private video diary for two partners in a long-distance
relationship. This page explains what the app collects, why, who it's shared
with, and how to delete it. It's written in plain English on purpose — if
anything here is unclear, email us.

## Who we are

While You Sleep is an independent app made by **Derek Salanga**. For any
question about this policy or your data, contact:

**support@whileyousleep.app**

## What we collect

We only collect what the app needs to run. There are no ads, no ad or
analytics SDKs, and we never sell your data or use it for anyone else's
marketing.

- **Email address** — used to sign you in with a one-time 6-digit code. We
  don't store a password for normal accounts.
- **Display name** — a name you set for yourself, visible to your partner.
  Defaults to the part of your email before the "@" until you change it.
- **A private nickname for your partner** — the name *you* call your
  partner. This is visible only to you; your partner cannot read it.
- **Your daily video clips and captions** — a short video (up to 30
  seconds) answering each day's shared question, plus an optional short
  text caption. This is the core of the app.
- **Whether you've viewed a clip** — so the app knows what's new.
- **Shared relationship details** — an anniversary date, an upcoming "next
  visit" date and country, and the state of your shared virtual pet
  (including whether it's paused for a break). These are visible to both
  partners.
- **Reactions and favorites**: a single emoji you leave on a clip, and
  clips you mark as a favorite.
- **AI title, summary, and mood for a clip** — only created if you've
  turned on AI summaries (see below); only for your own clips.
- **A push-notification device token**, if you allow notifications — a
  technical address so we can tell your device "your partner posted," plus
  whether your device is iOS or Android.
- **Crash and error reports** — if the app crashes or hits an error, we
  collect technical details (error message, stack trace, device and app
  version) to fix bugs. This does not include your clips, captions, or
  messages.

We do **not** collect your location. The "trip country" is a country you
choose from a list — it's not read from your device's GPS.

**A reveal rule, not a data practice:** your partner can only see your
clip for a given day once they've posted their own clip for that day. This
is enforced by the database itself, not just the screen you see.

## How we use it

- Your email, to sign you in and, if you and your partner both opt in, to
  send a weekly recap.
- Your clips, captions, and the other shared details, to show them to you
  and your partner inside the app.
- Your device token, to send you a push notification when your partner
  posts or reacts. **Push notifications never include your clip or caption
  text** — they say only that your partner posted or reacted, by design,
  so a locked phone screen can't leak a reveal you haven't earned yet.
- Crash reports, to find and fix bugs.
- AI data (clip audio, transcript, caption), only if you've turned AI
  summaries on, to generate a title, summary, and mood for your own clip,
  and — only if **both** partners have it on — a weekly recap letter.

## Who we share it with

We use a small number of service providers to run the app. They process
data on our behalf to provide the service — not for their own purposes.

| Service | What it gets | Why |
|---|---|---|
| **Supabase** | Everything: your account, profile, clips (video files in private storage), captions, reactions, trips, anniversary, partner nickname, push token, pet state | Our entire backend — database, file storage, and sign-in |
| **Resend** | Your email address, and the 6-digit sign-in code | Delivers the sign-in email (custom SMTP on top of Supabase) |
| **Expo push service** | Your device's push token, and a short notification title/body with no clip content | Routes the notification to your device |
| **Apple (APNs) / Google (FCM)** | Your device's push token, via Expo | The platform services that actually deliver the push to your phone |
| **Sentry** | Crash reports: error messages, stack traces, device and app version | Helps us find and fix bugs. We have not turned on Sentry's optional setting to attach your IP address or other personal identifiers, so it only receives technical crash data by default |
| **n8n (automation service)** | Your clip's video file, caption, and basic clip metadata (date, duration) — **only if you turned AI summaries on** | Runs the AI pipeline described below |
| **AssemblyAI** | The clip's video file (via a short-lived signed link) | Transcribes the clip's audio to text |
| **Google Gemini** | The transcript and your caption (and, for the weekly recap, both partners' titles/summaries/moods for the week) | Writes the clip's title/summary/mood, and the weekly recap letter |
| **Telegram** | Operational failure alerts for the AI pipeline: an error message, which can include a short-lived signed link to the clip in question | Lets the developer know when something in the AI pipeline breaks, so it can be fixed. This is an operator alert, not part of processing your clip, and goes to the developer only |

We do not share your data with anyone else, and we don't sell it.

## AI features and consent

AI summaries are **off by default** and are turned on per person, not per
couple — one partner can have it on while the other doesn't.

When you turn it on, the app shows you exactly what happens before you
confirm:

> "When on, each clip you record is processed by n8n (our automation
> service): AssemblyAI transcribes the video file, and Google Gemini turns
> the transcript and your caption into a title, summary and mood. Only
> your own clips are sent. If you both turn this on, Gemini also writes a
> weekly recap that Resend emails to you both."

Turning AI summaries on requires you to confirm that message explicitly.
Turning it off needs no confirmation and takes effect immediately for new
clips (a clip already mid-processing may finish; clips already summarized
keep their summary).

The weekly recap email only goes out if **both** partners in a pair have
AI summaries turned on, and only includes days both of you actually
posted on (the same "reveal" rule as the rest of the app) — it can't spoil
an entry by email before it would ever unlock for you in the app.

## Retention

We keep your data for as long as your account exists, with two
exceptions:

- **Transcripts** are not stored long-term. They're kept in a private
  storage area for about 7 days, then automatically deleted by a nightly
  cleanup job.
- **Video files for a clip that's no longer referenced by any row** (for
  example, a re-recorded clip's old file) are swept up and removed by a
  nightly cleanup job, generally within a day or two.

## Deletion

You can delete your account at any time, in the app: **Settings → Account
→ Delete account.**

Deleting your account:

- Deletes your sign-in and profile immediately.
- **Deletes your entire pair's shared history** — both partners' clips,
  captions, reactions, trip, anniversary, and pet — because that history
  belongs to the pairing, not to one person alone.
- **Purges the video files from storage immediately** as part of the same
  action, not left to the nightly cleanup job.
- **Does not delete your partner's account.** Your partner keeps their own
  login and profile; they lose the shared history described above, and
  the app will prompt them to pair again the next time they open it.

This cannot be undone. There is no account recovery after deletion.

## Children

While You Sleep is not directed to children under 13, and we do not
knowingly collect data from anyone under 13. The app does not currently
include an age-verification step or age gate of any kind — sign-in is by
email only. If you believe a child has used the app or provided us data,
contact us and we will delete it.

## Security

- Your video clips live in **private** cloud storage. They're never
  publicly accessible; the app only ever loads them through short-lived
  signed URLs.
- Every table in our database is protected by row-level security rules
  enforced by the server itself — not just the app's screens — so one
  pair's data cannot be read by anyone outside that pair, including your
  own partner's otherwise-unrevealed clip for a given day.
- Your private nickname for your partner and your push-notification token
  are restricted so that even your partner cannot read them through the
  app or a direct request.
- Data is transmitted over encrypted (HTTPS) connections.

No method of storage or transmission is 100% secure, so we can't
guarantee absolute security.

Our hosting and sign-in providers keep standard server logs (such as IP
addresses) for security and reliability, under their own privacy policies.

## Your rights

You can see your data in the app and delete it at any time via account
deletion above. For anything else, such as a copy of your data, email us
and we'll help directly.

We don't claim any specific legal framework (such as GDPR or CCPA) applies
to this app; the rights above are simply what we can and will honor for
anyone who asks, regardless of where you live.

## Changes to this policy

If we change this policy, we'll update the effective date above. If a
change is significant, we'll also surface it inside the app.

## Contact

Questions about this policy or your data: **support@whileyousleep.app**
