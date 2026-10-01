# App Privacy ("nutrition label") — While You Sleep (v1.0.0)

Answered from what the code actually does, checked 2026-09-30 against
`supabase/schema.sql`, `src/`, `App.tsx`, `app.json`, and `package.json`.
Nothing here is answered from how the app is marketed — only from what's
actually collected and sent.

**Tracking: No, everywhere.** Confirmed by
`grep -rni "tracking|idfa|advertis" src app.json package.json` — zero
matches. There is no ad SDK, no IDFA/AdSupport usage, and no cross-app/
cross-site tracking of any kind. Every row below answers "Used for
tracking? No."

## Data types collected

| Apple data type | Collected? | Linked to user? | Used for tracking? | Purpose(s) |
|---|---|---|---|---|
| Contact Info → Email Address | Yes | Yes | No | App Functionality (Supabase Auth email OTP sign-in; also the two hardcoded App Review demo addresses use a password instead of the code) |
| User Content → Photos or Videos | Yes | Yes | No | App Functionality (the daily clip itself, `clips.storage_path` in Supabase Storage, is the core feature) |
| User Content → Audio Data | Yes | Yes | No | App Functionality. The clip's audio track is also sent to AssemblyAI for transcription, but only if the sender opted into AI summaries (`profiles.ai_enabled`) — see "Third-party sharing" below |
| User Content → Other User Content | Yes | Yes | No | App Functionality (caption text, partner nicknames, reactions, AI-generated title/summary/mood which are derived from the user's own clip) |
| Identifiers → User ID | Yes | Yes | No | App Functionality (Supabase `auth.uid()`, used throughout for pairing and Row Level Security) |
| Identifiers → Device ID | Yes | Yes | No | App Functionality only. This is the Expo push token (`push_tokens` table, keyed by `user_id`), used solely to deliver the partner-posted / reaction / reminder notifications this app already sends. Rows older than 60 days are deleted by a cleanup job (`supabase/schema.sql`) |
| Diagnostics → Crash Data | Yes | No | No | App Functionality (crash/error reporting via Sentry, `@sentry/react-native`, no-op if `EXPO_PUBLIC_SENTRY_DSN` is unset) |
| Diagnostics → Performance Data | Not collected | — | — | `Sentry.init({ dsn: sentryDsn })` in `App.tsx` passes no `tracesSampleRate` or performance/tracing integration, so performance monitoring is not enabled |
| Diagnostics → Other Diagnostic Data | Yes (minimal) | No | No | App Functionality. Sentry's default JS-exception/breadcrumb capture; no custom diagnostic events are added in this codebase |
| Usage Data | Not collected | — | — | No analytics SDK of any kind is present (no Amplitude/Segment/Firebase Analytics/etc. in `package.json`) |
| Location | Not collected | — | — | No location permission is requested; no `expo-location` or similar dependency exists. The trip countdown's "country" field (`pair_trips`) is free-text/picker input the user types, not device location |
| Contacts | Not collected | — | — | No contacts permission or dependency |
| Health & Fitness | Not collected | — | — | No HealthKit or related dependency |
| Financial Info / Payment Info | Not collected | — | — | No payments, in-app purchases, or financial SDK in this codebase |
| Browsing History | Not collected | — | — | No in-app browser, no web tracking |
| Purchases | Not collected | — | — | No StoreKit / in-app purchase code in this codebase |

### Why Crash Data is marked "Linked to user? No"

`App.tsx` calls `Sentry.init({ dsn: sentryDsn })` only — no options object
beyond the DSN. Specifically:

- `Sentry.setUser(...)` is never called anywhere in `src/` or `App.tsx`, so
  no app-level user ID, email, or nickname is ever attached to a Sentry
  event.
- `sendDefaultPii` is not set, which defaults to `false`, so Sentry's SDK
  does not automatically attach IP address or other default-PII fields
  either.

So while Sentry necessarily sees device/OS metadata and stack traces (and
Sentry's infrastructure may log the originating IP at the transport level,
outside this app's control), the app itself does not link a crash report
to a specific user identity. Marked "No" on that basis.

## Data NOT collected (explicit)

- Location (precise or coarse)
- Contacts
- Health & Fitness data
- Financial / payment info
- Browsing history
- Purchase history
- Search history
- Sensitive info (e.g. race, sexual orientation, religion) — none is asked for or inferred
- Advertising/tracking identifiers of any kind

## Third-party data sharing (AI summaries, opt-in only)

When a user turns on **AI summaries** (Settings), the in-app disclosure
(`AI_DISCLOSURE` in `src/screens/SettingsScreen.tsx`) names every service
involved, and the same text is shown again as a confirmation before the
toggle takes effect:

- **n8n Cloud** runs the automation pipeline.
- **AssemblyAI** receives the full video file to transcribe it.
- **Google Gemini** receives the transcript and caption and writes the
  title/summary/mood (and, if both partners are opted in, the weekly
  recap).
- **Resend** sends the weekly recap email.

This is "data shared with third parties for app functionality," scoped to
an explicit, per-partner, opt-in feature — off by default
(`profiles.ai_enabled` defaults to `false`; a one-time server-side reset on
2026-09-28 set every existing account back to off so everyone re-consents
through the disclosure). Only the account's own clips are ever sent; a
couple where one partner is opted in and the other isn't is a normal,
supported state. The weekly recap additionally requires **both** partners
opted in before it's generated.

One more destination exists but is **not** user data sharing: Telegram
receives operator alerts when the AI pipeline fails, which can include a
signed clip URL in the error text. This is infrastructure/operator
alerting (the developer's own monitoring), not a service the user's data
is routed to as part of using the app, and should be covered in the
privacy policy's narrative text rather than as its own nutrition-label row.

## Privacy Manifest (`PrivacyInfo.xcprivacy`)

- `app.json` has **no** `ios.privacyManifests` entry — confirmed by
  `grep -n -i "privacyManifest" app.json` (no match). Nothing in this repo
  currently declares required-reason API usage for the privacy manifest.
- This project has no `ios/` directory (Expo managed workflow / EAS
  Build), so the manifest Apple actually checks is the one assembled at
  build time from this app's own declarations plus whatever each native
  module (including Expo's own modules) ships in its own
  `PrivacyInfo.xcprivacy`. A missing or incomplete manifest fails App
  Store submission with a specific "missing required reason API" error
  from Apple, not a silent pass, so this is unlikely to proceed unnoticed
  through `eas build` — but it should still be resolved deliberately rather
  than discovered at submission time.
- **Known required-reason API usage in this codebase:**
  - **UserDefaults** — confirmed. `targets/widget/widgets.swift` reads
    `UserDefaults(suiteName: "group.com.whileyousleep.app")` to share data
    (the anniversary date) from the app into the home-screen widget via the
    App Group. This needs reason code `CA92.1` ("accessing UserDefaults
    from within an app group, to access data shared between the app and
    an app extension").
- **Likely but not confirmed from this repo alone**, since several Expo
  SDK modules commonly touch these APIs internally (`expo-file-system`,
  `expo-font`, `expo-notifications`, `expo-camera`, `expo-video`):
  - File timestamp APIs
  - System boot time APIs
  - Disk space APIs

[CONFIRM: the three "likely but not confirmed" required-reason categories
above need verification against the actual compiled privacy manifest —
either by running `eas build` and checking Apple's App Store Connect
processing report for a missing-reason-API rejection, or by inspecting
each installed Expo module's own `PrivacyInfo.xcprivacy` under
`node_modules/<module>/ios/`. This document does not guess which exact
modules declare which reason codes — that's a build-time check, not
something greppable from this JS/TS source tree.]
