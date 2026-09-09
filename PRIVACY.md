# Privacy Policy — While You Sleep

**Last updated: September 9, 2026**

While You Sleep is a private, video-first daily diary app for two people in a
relationship. This policy explains what the app collects, why, who it is
shared with, and how you can delete it. It is written to be read, not to cover
every conceivable case in legal language — if anything here is unclear, contact
us (see the end).

## Who we are

While You Sleep is an independent, personal project. The person responsible for
the app and the data it holds ("we") can be reached at **dereksalanga@gmail.com**.

## What we collect, and why

We only collect what the app needs to work. There are no ads, no advertising
identifiers, no analytics or tracking SDKs, and we never sell your data or share
it for anyone else's marketing.

- **Your email address** — used to sign you in. We sign you in with a one-time
  6-digit code sent to your email; we do not store a password.
- **Your name in the app** — a display name you can set (it defaults to the
  part of your email before the "@" until you change it), and, separately, a
  private nickname you can give your partner. Your display name is visible to
  your partner. The private nickname you set *for* your partner is visible only
  to you.
- **Your daily video clips and their captions** — the core of the app. Each day
  you record a short video (capped at 30 seconds) answering a shared question,
  with an optional short text caption. These are stored so your partner can
  watch them, and so you can both look back at them.
- **Shared relationship details you enter** — an anniversary date, an upcoming
  "next visit" date and the country you'll meet in, and the state of your shared
  virtual pet. These are shared between you and your partner.
- **Reactions** — an emoji you leave on your partner's clip.
- **A device notification token** — if you allow notifications, we store a token
  that identifies your device so we can send you a push when your partner posts
  or reacts. We also store whether the device is iOS or Android.
- **Crash and error diagnostics** — if the app hits an error or crashes, we
  collect technical diagnostic information (such as the error and device/app
  details) to fix bugs, through Sentry. This does not include your clips,
  captions, or messages.

We do **not** collect your location. The "meeting country" is a country you pick
from a list yourself — it is not derived from GPS or your device location.

## What your partner can and cannot see

The app is built so that a day's clip is only revealed to your partner once they
have also posted their own clip for that same day. This "reveal after you post"
rule is enforced at the database level, not just in the app screens. Your
partner can see your shared content: your clips, captions, reactions, display
name, and the shared relationship details above. Your partner **cannot** see the
private nickname you set for them, or your device notification token.

## Who else your data is shared with

We use a small number of service providers ("processors") to run the app. They
process data on our behalf to provide the service, not for their own purposes:

- **Supabase** — hosts the app's database, file storage (your video clips), and
  sign-in. This is the entire backend; your clips and account data live here.
- **Resend** — sends the sign-in code to your email address.
- **Expo** — relays push notifications to your device.
- **Apple Push Notification service (APNs)** and **Google Firebase Cloud
  Messaging (FCM)** — the platform services that actually deliver a push
  notification to an iPhone or Android device. A notification we send is routed
  through these to reach your device.
- **Sentry** — receives crash and error diagnostics.

We share data with these providers only as needed to operate the app. We do not
share your data with anyone else.

## Device permissions

The app asks for these permissions, and only uses them for what their prompts
say:

- **Camera and microphone** — to record your daily video clip with sound. Only
  requested when you go to record.
- **Notifications** — to remind you to post and to tell you when your partner
  posts or reacts.
- **Photo library** (iOS) — only if you choose to save a clip.

## How your data is stored and protected

- Your video clips are kept in a **private** storage area that only you and your
  partner can read. They are not publicly accessible.
- Access to every piece of data is restricted by row-level security rules on the
  server, so one pair's data cannot be read by anyone outside that pair.
- Data is transmitted over encrypted (HTTPS) connections.

No method of storage or transmission is ever 100% secure, so we cannot guarantee
absolute security.

## Retention and deletion

We keep your data for as long as your account exists.

You can delete your account at any time from **Settings → Account → Delete
account**, inside the app. Deleting your account permanently removes your
account, your profile, and the clips and captions you have shared — **including
your partner's copy of your shared history**, because that history belongs to
the pair, not to one person. Your partner keeps their own login. This cannot be
undone.

Deleted video files are removed from storage as part of the deletion. A routine
background process also cleans up any leftover files.

## Children

While You Sleep is not directed to children under 13, and we do not knowingly
collect data from children under 13. If you believe a child has provided us data,
contact us and we will delete it.

## Your rights

Depending on where you live, you may have rights to access, correct, or delete
your personal data. You can delete your own data at any time using the in-app
account deletion above. For any other request, contact us at the email below.

## Changes to this policy

If we change this policy, we will update the "Last updated" date above. Material
changes will be reflected in the app.

## Contact

Questions about this policy or your data: **dereksalanga@gmail.com**.
