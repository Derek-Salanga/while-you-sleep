# While You Sleep

A private, video-first daily diary app for long-distance couples. Each
partner drops a short daily clip; the other unlocks and watches it.

## MVP scope (this scaffold)

1. **Pairing** — create or join a pair via a short invite code (`PairingScreen`)
2. **Record/upload** — capture a daily video clip and upload it (`RecordScreen`)
3. **Timeline** — scrollable card feed of past clips from both partners, with
   an unwatched indicator (`TimelineScreen`) and a playback screen (`ClipViewScreen`)

Deferred (per project brief): recap/highlight-reel generation, streak/mascot
mechanic, home screen widgets (native module work, not in this scaffold).

## Getting started

```bash
npm install
```

### 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/schema.sql` to create tables, RLS
   policies, and storage policies.
3. In Storage, create a **private** bucket named `clips`:
   ```sql
   insert into storage.buckets (id, name, public) values ('clips', 'clips', false);
   ```
4. Copy your project URL and anon key into `app.json` under `expo.extra`:
   ```json
   "extra": {
     "supabaseUrl": "https://your-project.supabase.co",
     "supabaseAnonKey": "your-anon-key"
   }
   ```
   Don't commit real keys — `app.json` is a placeholder file here; consider
   moving these to `app.config.js` + `.env` with `expo-constants` once you're
   past prototyping, especially if this repo becomes public.

### 2. Auth

This scaffold assumes Supabase Auth is already wired up for sign-in
(magic link or OAuth) — add a sign-in screen ahead of `PairingScreen` in
`RootNavigator.tsx` before running. `PairingContext` will pick up the
session automatically once a user signs in.

### 3. Run

```bash
npx expo start
```

Per the project's mobile-app-strategy notes: this runs fine from the Expo Go
app for day-to-day iteration; use EAS Build or Codemagic for cloud iOS builds
(no local Mac needed until final App Store submission).

## Project structure

```
App.tsx                        entry point
app.json                       Expo config, icon, permissions
src/
  lib/
    supabase.ts                Supabase client
    PairingContext.tsx         session + pair state, app-wide
  navigation/
    RootNavigator.tsx          pairing gate -> main stack
  screens/
    PairingScreen.tsx          create/join pair
    RecordScreen.tsx           camera capture + upload
    TimelineScreen.tsx         card feed of clips
    ClipViewScreen.tsx         video playback, marks viewed
  theme/
    colors.ts                  palette from the app icon spec
    typography.ts              Fraunces + Inter pairing
  types/
    index.ts                   shared data models
supabase/
  schema.sql                   tables, RLS, storage policies
assets/
  icon-1024.png                app icon (from prior step)
```

## Notes / next steps

- `duration_seconds` on `clips` is currently unset on upload — wire up
  `expo-av`'s status callback if you want it populated.
- One clip per sender per pair per day is enforced via a unique constraint
  (`pair_id, sender_id, recorded_for_date`) plus `upsert` on insert.
- Home screen widgets need a native config plugin
  (e.g. `@bacons/apple-targets`) in a bare or prebuild workflow — out of
  scope for this managed-Expo scaffold.
