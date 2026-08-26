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
app.config.js                  Expo config, reads Supabase URL/key from .env
.env / .env.example            SUPABASE_URL, SUPABASE_ANON_KEY, EXPO_PUBLIC_SENTRY_DSN
src/
  lib/
    supabase.ts                Supabase client (reads via expo-constants)
    PairingContext.tsx         session + pair state, app-wide
  navigation/
    RootNavigator.tsx          gate: Auth -> Pairing -> Home (Timeline)
  screens/
    AuthScreen.tsx              email OTP sign-in (send code -> verify code)
    PairingScreen.tsx           create/join pair via invite code
    RecordScreen.tsx            camera capture + upload to Supabase Storage
    TimelineScreen.tsx          card feed of clips
    ClipViewScreen.tsx          expo-video playback, marks clip viewed
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

## Testing status (update this section as things get verified)

Confirmed working end-to-end:
- Email OTP sign-in (send code, receive via Resend, verify)
- Pairing screen loads
- Camera recording

Fixed but not yet re-confirmed:
- Upload (record -> Supabase Storage -> `clips` row) — was broken by
  the `expo-file-system` deprecation, fixed via the `/legacy` import,
  needs a fresh end-to-end test to confirm.

Not yet tested:
- Full two-user pairing (only the pairing screen loading has been
  tested, not two real accounts completing a pair)
- Timeline screen with real clip data
- Clip playback / viewed-status marking

## Explicitly out of scope for now

- Home screen widgets (day-counter, distance-counter) — needs a native
  config plugin (e.g. `@bacons/apple-targets`) outside the managed
  Expo workflow currently in use.
- Recap/highlight-reel generation, streak/mascot mechanic — deferred
  per the original project brief; not core-loop features.

## Working with this user

- iPad/Mac only, no dedicated dev machine. Give exact, copy-pasteable
  terminal commands. When a file needs multi-line edits, prefer giving
  the full corrected file content over a diff/patch description —
  manual patching in `nano` has caused duplicated content before.
- Prefers being told the reasoning behind a fix briefly, not just the
  fix itself.
