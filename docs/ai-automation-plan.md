# AI automation layer for While You Sleep

## Context

While You Sleep's diary entries are `clips` rows (one video per partner per day, `storage_path` in the private `clips` bucket). The app has no AI features today. The goal is an n8n Cloud automation layer, external to the app, that: (1) auto-generates a title/summary/mood for each clip from its audio, opt-in per partner, and (2) sends a warm weekly recap email to both partners via Resend (already configured as Supabase's custom SMTP, though this new email goes through Resend's own API directly, not through Supabase Auth's SMTP path). This is a portfolio project with a public repo, so the design keeps secrets out of git and documents cleanly.

Four decisions were made before finalizing this:
1. **Opt-in is per-partner, not per-couple** — each person's own clips are only queued for AI processing if *they* turned it on. A couple where one partner has it on and the other doesn't is a normal, supported state, not an edge case to special-case.
2. **The weekly recap only includes mutually-revealed days** (both partners posted that day) — consistent with the app's existing reveal-gating everywhere else (Timeline, Monthly Summary), and avoids the recap spoiling an entry by email before it would ever unlock in-app.
3. **Mood is a fixed 10-value enum**: `joyful, loving, calm, nostalgic, excited, stressed, sad, tired, grateful, neutral`.
4. **Transcripts are not persisted in Postgres.** Per the ask for "available for download for about a week, not kept in the database forever" — the recommended approach (detailed below) is a private Supabase Storage bucket with a nightly age-based cleanup cron, mirroring the existing `cleanup_orphaned_clip_files` pattern. Zero new columns for this; the transcript's path is fully derivable from `pair_id`/`clip_id`, and it's readable straight from the Supabase Studio Storage browser within the week — no app UI needed.

Existing precedents this design deliberately reuses rather than reinventing: the `AFTER INSERT ... security definer` trigger shape and Vault-secret + `net.http_post` idiom from `notify_partner_of_clip()`; the Vault-secret + `net.http_delete` + nightly `pg_cron` idiom from `cleanup_orphaned_clip_files()`; the narrow client-facing `security definer` RPC shape from `mark_clip_viewed()`; and the "plain `.update()` when RLS already expresses the permission, RPC only when it can't" rule the app's mutation hooks already follow.

---

## Schema changes (one `schema.sql` addition, no new migrations dir — this repo has none)

```sql
-- === AI automation: per-partner opt-in ===
alter table profiles
  add column ai_enabled boolean not null default false;
-- Per-partner: each person's own clips are only queued for AI processing if
-- they've turned it on for themselves. No new RLS policy needed --
-- profiles_update_own already lets you write your own row.

-- === AI automation: per-clip result fields ===
alter table clips
  add column ai_status text check (ai_status is null or ai_status in ('pending', 'completed', 'failed')),
  add column ai_title text,
  add column ai_summary text,
  add column ai_mood text check (
    ai_mood is null or ai_mood in (
      'joyful', 'loving', 'calm', 'nostalgic', 'excited',
      'stressed', 'sad', 'tired', 'grateful', 'neutral'
    )
  );
-- ai_status null = never queued (sender had AI off). No new clips RLS
-- policy: n8n writes these back with the service_role key, which bypasses
-- RLS -- same reason cleanup_orphaned_clip_files needs no clips policy.
-- clips_update_own_as_sender is untouched.

-- === Shared "queue for processing" helper -- not client-callable ===
create or replace function queue_clip_for_ai(target_clip_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clip_row clips;
  webhook_secret text;
begin
  select * into clip_row from clips where id = target_clip_id;
  if clip_row is null then
    raise exception 'Clip not found';
  end if;

  select decrypted_secret into webhook_secret
    from vault.decrypted_secrets where name = 'n8n_webhook_secret';

  if webhook_secret is null then
    raise warning 'Vault secret "n8n_webhook_secret" not found -- AI processing skipped for clip %', target_clip_id;
    return;
  end if;

  update clips set ai_status = 'pending' where id = target_clip_id;

  perform net.http_post(
    url := 'https://<your-subdomain>.app.n8n.cloud/webhook/clip-ai',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', webhook_secret
    ),
    body := jsonb_build_object(
      'clip_id', clip_row.id,
      'pair_id', clip_row.pair_id,
      'sender_id', clip_row.sender_id,
      'storage_path', clip_row.storage_path,
      'recorded_for_date', clip_row.recorded_for_date,
      'duration_seconds', clip_row.duration_seconds
    )
  );
end;
$$;

revoke all on function queue_clip_for_ai(uuid) from public, anon, authenticated;

-- === Trigger: queue on insert, only if the sender opted in ===
create or replace function queue_ai_on_clip_insert() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  sender_opted_in boolean;
begin
  select ai_enabled into sender_opted_in from profiles where id = new.sender_id;
  if coalesce(sender_opted_in, false) then
    perform queue_clip_for_ai(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists clips_queue_ai on clips;
create trigger clips_queue_ai
  after insert on clips  -- insert only, same reasoning as clips_notify_partner:
  for each row execute function queue_ai_on_clip_insert();  -- an upsert re-record must not re-queue

-- === Client-facing retry RPC ===
create or replace function retry_ai_processing(target_clip_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clip_row clips;
begin
  select * into clip_row from clips where id = target_clip_id;
  if clip_row is null then
    raise exception 'Clip not found';
  end if;
  if clip_row.sender_id != auth.uid() then
    raise exception 'Can only retry your own clip';
  end if;
  if clip_row.ai_status != 'failed' then
    raise exception 'Clip is not in a failed state';
  end if;
  perform queue_clip_for_ai(target_clip_id);
end;
$$;

grant execute on function retry_ai_processing(uuid) to authenticated;

-- === Transcript storage: private bucket, no schema column ===
-- Path is deterministic: <pair_id>/<clip_id>.txt -- no new column needed to
-- reference it. n8n writes with the service_role key; read it from the
-- Supabase Studio Storage browser within the retention window. No app code
-- ever touches this bucket.
insert into storage.buckets (id, name, public)
  values ('transcripts', 'transcripts', false)
  on conflict (id) do nothing;

create or replace function cleanup_old_transcripts(retention interval default interval '7 days')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  project_url text := 'https://lgzcvryexckjrwlipenr.supabase.co';
  service_key text;
  obj record;
  deleted int := 0;
begin
  select decrypted_secret into service_key
    from vault.decrypted_secrets where name = 'service_role_key';
  if service_key is null then
    raise exception 'Vault secret "service_role_key" not found';
  end if;

  for obj in
    select o.name from storage.objects o
    where o.bucket_id = 'transcripts' and o.created_at < now() - retention
      and o.name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.txt$'
    order by o.created_at
    limit 200
  loop
    perform net.http_delete(
      url := project_url || '/storage/v1/object/transcripts/' || obj.name,
      headers := jsonb_build_object('Authorization', 'Bearer ' || service_key, 'apikey', service_key)
    );
    deleted := deleted + 1;
  end loop;
  return deleted;
end;
$$;

revoke all on function cleanup_old_transcripts(interval) from public, anon, authenticated;

select cron.schedule(
  'cleanup-old-transcripts', '43 4 * * *',
  $cron$ select public.cleanup_old_transcripts(); $cron$
);

-- === Weekly recap data, one call for n8n's schedule workflow ===
-- Mutual-reveal-gated: a day only counts if BOTH partners posted that day.
-- Only returns pairs where at least one partner opted in.
create or replace function get_weekly_recap_batch(
  week_start date default (current_date - interval '7 days')::date
)
returns table (
  pair_id uuid,
  partner_a_email text,
  partner_b_email text,
  entries jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    ua.email,
    ub.email,
    coalesce(jsonb_agg(
      jsonb_build_object(
        'date', c.recorded_for_date,
        'sender', case when c.sender_id = p.user_a then 'a' else 'b' end,
        'title', c.ai_title,
        'summary', c.ai_summary,
        'mood', c.ai_mood
      ) order by c.recorded_for_date, c.sender_id
    ) filter (where c.id is not null), '[]'::jsonb) as entries
  from pairs p
  join auth.users ua on ua.id = p.user_a
  left join auth.users ub on ub.id = p.user_b
  join profiles pa on pa.id = p.user_a
  left join profiles pb on pb.id = p.user_b
  left join clips c
    on c.pair_id = p.id
   and c.recorded_for_date >= week_start
   and c.recorded_for_date < week_start + 7
   and c.ai_status = 'completed'
   and exists ( -- mutual reveal: someone else also posted that day
     select 1 from clips c2
     where c2.pair_id = p.id
       and c2.recorded_for_date = c.recorded_for_date
       and c2.sender_id != c.sender_id
   )
  where p.user_b is not null
    and (coalesce(pa.ai_enabled, false) or coalesce(pb.ai_enabled, false))
  group by p.id, ua.email, ub.email;
$$;

revoke all on function get_weekly_recap_batch(date) from public, anon, authenticated;
```

**One-time manual step** (like `service_role_key` already is): `select vault.create_secret('<random-secret>', 'n8n_webhook_secret', 'Shared secret for the clip-ai n8n webhook');`

Test `get_weekly_recap_batch` directly in the SQL editor against seeded multi-day data before wiring n8n to it — it's the trickiest query here.

---

## Webhook setup & payload shape

- Postgres → n8n: `POST https://<subdomain>.app.n8n.cloud/webhook/clip-ai`, header `X-Webhook-Secret: <value>`, body:
  ```json
  {
    "clip_id": "uuid", "pair_id": "uuid", "sender_id": "uuid",
    "storage_path": "text", "recorded_for_date": "YYYY-MM-DD",
    "duration_seconds": 30
  }
  ```
- Auth is verified **inside n8n**, not by a separate IF node: n8n's Webhook node has a built-in "Header Auth" authentication mode — configure one n8n credential holding the expected header name/value, and n8n rejects any request that doesn't match before the workflow body runs at all.

---

## n8n Workflow 1: per-upload processing (node by node)

1. **Webhook** (trigger, POST, Header Auth as above).
2. **Edit Fields** — pull `clip_id`, `pair_id`, `sender_id`, `storage_path`, `recorded_for_date`, `caption_text`, `duration_seconds` into workflow variables.
3. **HTTP Request** — Supabase Storage sign: `POST {SUPABASE_URL}/storage/v1/object/sign/clips/{{storage_path}}`, header `Authorization: Bearer {{service_role_key}}` (n8n credential), body `{"expiresIn": 600}` → `signedURL`.
4. **HTTP Request** — AssemblyAI submit: `POST https://api.assemblyai.com/v2/transcript`, header `Authorization: {{assemblyai_key}}`, body `{"audio_url": "{{signedURL}}", "language_detection": true, "speech_model": "universal"}` (confirm exact code-switching param names against AssemblyAI's current docs at build time — their API evolves). Response includes a transcript `id`.
5. **Wait** (5s) → **HTTP Request** GET `.../transcript/{{id}}` → **IF** `status == "completed"` continue / `status == "error"` throw / else loop back to Wait, **bounded**: an "Increment Poll Count" Set node (`{{ $runIndex + 1 }}` — n8n's built-in per-node run counter — with "Include Other Input Fields" on so AssemblyAI's `id` survives the loop-back) plus an IF node (`poll_count < 24`, i.e. exactly 24 polls, 2 minutes total) routing to Handle AI Failure instead of looping forever. Originally unbounded — found on code review 2026-09-19, see step 11's note. **Do not** rebuild this as a self-reference (`$('Increment Poll Count')` with a try/catch fallback) — that was the first version, and a failed self-reference silently resets the count to 0 every pass, making the cap a no-op. (AssemblyAI's webhook-callback option is a viable later optimization to avoid polling; polling keeps this a single linear workflow, easier to build and test incrementally now.)
6. **Edit Fields** — extract `text` (may be an empty string — no speech is a valid case, not a failure).
7. **HTTP Request** — write transcript to Storage: `PUT {SUPABASE_URL}/storage/v1/object/transcripts/{{pair_id}}/{{clip_id}}.txt`, service_role key, `Content-Type: text/plain`, body = transcript text.
8. **HTTP Request** — extraction call (see prompt below; **built against Gemini, not Claude** — see note below).
9. **Edit Fields** — parse the model's structured JSON output into `title`/`summary`/`mood`.
10. **HTTP Request** — write back: `PATCH {SUPABASE_URL}/rest/v1/clips?id=eq.{{clip_id}}`, service_role key, body `{"ai_title": ..., "ai_summary": ..., "ai_mood": ..., "ai_status": "completed"}`.
11. **On each risky node (3, 4/5, 7, 8, 9, 10):** set "On Error: Continue using error output" and wire the error output to an **Execute Workflow** node calling the shared **Handle AI Failure** sub-workflow (below), passing `clip_id` and the error message. This list originally omitted steps 7 (transcript write) and 9 (parsing the extraction response) — a real gap, since a failure in either left a clip stuck at `ai_status = 'pending'` forever with no way to retry (`retry_ai_processing()` only accepts `'failed'`). Found on code review 2026-09-19, fixed the same day — see `docs/testing-log.md`.

### Extraction call (step 8)

**Built against Gemini (`gemini-3.6-flash`), not Claude, as of 2026-09-17.** The
original design below (Claude Haiku, tool-use for structured output) is the
intended shape and the one to switch back to first — this deviated only
because Anthropic Console billing rejected every card on hand mid-build, with
no free tier to fall back on for testing. Gemini's `responseSchema` JSON mode
does the same structured-output job as Claude's tool-use; the actual n8n node
sends:

```json
{
  "systemInstruction": { "parts": [{ "text": "<same system prompt as below>" }] },
  "contents": [{ "role": "user", "parts": [{ "text": "Transcript: \"<transcript>\"\nCaption (may be empty): \"<caption_text>\"\nDuration: <duration_seconds>s" }] }],
  "generationConfig": {
    "responseMimeType": "application/json",
    "responseSchema": {
      "type": "OBJECT",
      "properties": {
        "title": { "type": "STRING" },
        "summary": { "type": "STRING" },
        "mood": { "type": "STRING", "enum": ["joyful", "loving", "calm", "nostalgic", "excited", "stressed", "sad", "tired", "grateful", "neutral"] }
      },
      "required": ["title", "summary", "mood"]
    }
  }
}
```
`POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`,
header `x-goog-api-key`. Response text (`candidates[0].content.parts[0].text`)
is a JSON *string*, unlike Claude's already-parsed tool input — needs one
`JSON.parse()` in the following Edit Fields node.

**Original design, intended default once billing is sorted:**

`POST https://api.anthropic.com/v1/messages`, headers `x-api-key`, `anthropic-version: 2023-06-01`.

**Model: `claude-haiku-4-5`.** Flagging this explicitly since it's a deliberate downgrade from Opus-tier: this is a high-volume (every opted-in clip, daily), low-complexity task (extract 3 short fields from a transcript under a couple hundred words) — exactly the shape that doesn't need Opus-tier reasoning, and Haiku 4.5 is $1/$5 per MTok vs. Opus 5's $5/$25. Swap the model in the HTTP node's body field if a standardized model choice is preferred instead.

```json
{
  "model": "claude-haiku-4-5",
  "max_tokens": 512,
  "tools": [{
    "name": "extract_clip_insights",
    "description": "Extract a title, one-sentence summary, and mood from a video diary transcript.",
    "strict": true,
    "input_schema": {
      "type": "object",
      "properties": {
        "title": { "type": "string", "description": "A short, warm title for this diary entry, 3-6 words, no quotation marks." },
        "summary": { "type": "string", "description": "One warm sentence, present tense, under 160 characters, summarizing what was said or shown." },
        "mood": { "type": "string", "enum": ["joyful", "loving", "calm", "nostalgic", "excited", "stressed", "sad", "tired", "grateful", "neutral"] }
      },
      "required": ["title", "summary", "mood"],
      "additionalProperties": false
    }
  }],
  "tool_choice": { "type": "tool", "name": "extract_clip_insights" },
  "system": "You are summarizing a private video diary entry between two long-distance partners. The speaker may mix English and Tagalog (Taglish) -- read across both naturally. If the transcript is empty or has no meaningful speech, base the title/summary on the caption text if one is given; if there's truly nothing to go on, use a gentle, generic title like \"A quiet moment\" and a summary noting there was no dialogue -- never invent content that wasn't said.",
  "messages": [{
    "role": "user",
    "content": "Transcript: \"{{transcript_text}}\"\nCaption (may be empty): \"{{caption_text}}\"\nDuration: {{duration_seconds}}s"
  }]
}
```

---

## n8n Workflow 2: weekly recap (node by node)

Set the **workflow's timezone to UTC** explicitly (n8n Cloud otherwise defaults to the account timezone).

1. **Schedule Trigger** — cron `0 20 * * 0` (Sunday 20:00 UTC). Anchored to UTC for the same reason the daily reminder was moved to 20:00 UTC: it's the one clock both partners' devices already agree on, matching the app's existing UTC-day-boundary convention rather than any one partner's local Sunday. Same accepted tradeoff as that reminder — local send time varies by timezone.
2. **HTTP Request** — `POST {SUPABASE_URL}/rest/v1/rpc/get_weekly_recap_batch`, service_role key → array of `{pair_id, partner_a_email, partner_b_email, entries}`.
3. **Filter** — drop items where `entries.length == 0` (zero mutually-revealed, AI-processed days this week → no email; simplest handling of the "weeks with zero entries" edge case).
4. **Split In Batches** (or Loop Over Items) — one iteration per remaining pair.
5. **HTTP Request** — Claude recap call (see prompt below), once per pair.
6. **HTTP Request** ×2 — Resend send, one personalized call per partner (not one email to both `to:` addresses — reads warmer, and doesn't expose each partner's address to the other in the email headers): `POST https://api.resend.com/emails`, header `Authorization: Bearer {{resend_key}}`, body `{"from": "...", "to": "{{partner_a_email}}", "subject": "Your week together", "text": "{{letter}}"}` (and the mirrored call for partner B).
7. Error output of 2/5/6 → a lightweight Telegram alert (this workflow has no single clip row to mark failed, so it doesn't reuse the clip-specific sub-workflow — just alerts).

### Claude recap call (step 5)

**Model: `claude-sonnet-5`** — this one is low-volume (once a week per couple) and higher-value (the actual "warm letter" deliverable), so the extra prose quality over Haiku is worth it here.

```json
{
  "model": "claude-sonnet-5",
  "max_tokens": 1024,
  "system": "You write a short, warm weekly recap letter for a long-distance couple, based on summaries of the video diary entries they exchanged this week. Reference specific moments by title/summary where you can. Warm but not saccharine, no clichés, plain prose (no markdown, no em-dashes). 150-250 words. Sign off gently, no signature name.",
  "messages": [{
    "role": "user",
    "content": "This week's entries (JSON): {{entries}}"
  }]
}
```

---

## n8n Workflow 3: "Handle AI Failure" (shared sub-workflow)

Called via **Execute Workflow** from Workflow 1's error branches, given `clip_id` and an error message.

1. **Execute Workflow Trigger** — inputs `clip_id`, `error_message`.
2. **HTTP Request** — `PATCH {SUPABASE_URL}/rest/v1/clips?id=eq.{{clip_id}}`, service_role key, body `{"ai_status": "failed"}`.
3. **Telegram** (n8n's built-in node, bot token + chat ID as credentials) — `sendMessage`: `"AI processing failed for clip {{clip_id}}: {{error_message}}"`.

Set up a Telegram bot via BotFather if one doesn't already exist — that's a build-order step, not a design decision.

---

## Transcription provider recommendation

| | **AssemblyAI (recommended)** | OpenAI Whisper / gpt-4o-transcribe |
|---|---|---|
| Accepts a URL directly | Yes — `audio_url` on the submit call. n8n never downloads/re-uploads the video. | No — the endpoint requires multipart file upload; n8n would need an extra download-then-upload step. |
| Filipino/Taglish accuracy | Dedicated Tagalog support (multiple regional dialects documented), and their current Universal-3.5 Pro model explicitly targets code-switching detection — the best fit for mixed Tagalog/English speech among mainstream options. | Handles code-switching by picking one dominant language for the whole clip rather than true per-segment detection — a Taglish clip can come back partially mistranscribed or skewed toward whichever language it guessed as dominant. |
| Cost | ~$0.15–0.21/hour of audio (Universal-2 vs. Universal-3.5 Pro). At this app's volume (≤2× 30s clips/day/couple ≈ 30 min/month/couple), that's a few cents a month per couple — immaterial either way. | ~$0.36/hour (~$0.006/min). Cheaper per-minute in the abstract, irrelevant at this volume. |
| n8n workflow shape | Submit → poll (or webhook callback) → fetch text. | Single call, but needs the extra binary download/upload round-trip first. |

Worth a look later only if AssemblyAI's real-world Taglish accuracy underwhelms: Speechmatics (native code-switching model) or Gladia.

---

## App-side UI changes

- `src/types/index.ts`: add to `Profile`: `ai_enabled: boolean`. Add to `Clip`: `ai_status: 'pending' | 'completed' | 'failed' | null`, `ai_title: string | null`, `ai_summary: string | null`, `ai_mood: string | null`. No query changes needed — `useClips`/`useClip`/`useProfile` already `select('*')`.
- `src/hooks/mutations.ts`: add `useSetAiEnabled({userId, enabled})` — plain `.update()` on `profiles` (own row, existing `profiles_update_own` policy covers it — no RPC needed, matching the nickname-editing precedent), invalidates `['profile']`. Add `useRetryAiProcessing(clipId)` — `supabase.rpc('retry_ai_processing', ...)`, invalidates `['clips']`, mirroring `useMarkClipViewed`.
- `src/screens/SettingsScreen.tsx`: new row, "AI summaries" (or similar), using React Native's built-in `<Switch>` — this is a true binary preference, unlike Pause's date-range picker, so `Switch` is the right native fit rather than forcing it into the expand-to-edit-card pattern. Bound to `myProfile.ai_enabled`, calls `useSetAiEnabled`.
- `src/lib/aiMood.ts` (new, small): a plain object mapping each of the 10 mood strings to an emoji, imported by Timeline and ClipView.
- `src/screens/TimelineScreen.tsx`: when `ai_status === 'completed'`, render `ai_title` in the card header area and the mood emoji next to the existing reaction/unwatched badges in `cardHeaderRight`; render `ai_summary` below `caption_text` (same non-truncated style). When `ai_status === 'failed'` **and** you're the sender, render a small muted "AI summary failed — Retry" row calling `useRetryAiProcessing`. `ai_status === 'pending'`/`null` render nothing extra (no spinner needed for v1 — processing normally finishes well under a minute).
- `src/screens/ClipViewScreen.tsx`: same placement logic as `caption_text` — `ai_title`/`ai_summary` above the date line (content above metadata), mood emoji inline.

---

## What lives in the repo vs. in n8n

**In the repo** (public, portfolio-facing):
- `supabase/schema.sql` — all SQL above, appended to the existing single file.
- `automation/workflows/clip-ai-processing.json`, `weekly-recap.json`, `handle-ai-failure.json` — exported n8n workflow JSON. n8n's export strips actual credential values (only credential *names/references* remain), so these are safe to commit.
- `automation/README.md` — architecture summary, the list of required n8n credentials by name (Supabase Service Role, AssemblyAI API Key, Anthropic API Key, Resend API Key, Telegram Bot), the required Vault secret names, and re-import instructions.
- A new `CLAUDE.md` section documenting the shipped feature, written at implementation time in the same style as every other feature section (per the existing session checklist).

**Not in the repo**: n8n credential values, the Vault secret values, the live webhook URL's exact subdomain beyond a placeholder, Telegram bot token/chat ID.

---

## Build order (each step independently testable)

1. `profiles.ai_enabled` column + Settings toggle + `useSetAiEnabled`. Test: flip it in the app, confirm the column in Supabase Studio. No AI behavior involved yet.
2. Add the `clips` AI columns, the `transcripts` bucket, and the trigger/`queue_clip_for_ai`/`retry_ai_processing` SQL — but point the webhook URL at a throwaway `webhook.site` URL and any dummy Vault secret value. Record a clip with AI on → confirm the POST arrives at webhook.site with the right payload and `X-Webhook-Secret` header, and `ai_status` flips to `'pending'`. Isolates "does Postgres fire correctly" from n8n.
3. Build Workflow 1 through the transcript-write step only (Webhook → signed URL → AssemblyAI → write `.txt` to the `transcripts` bucket). Point the real webhook URL in. Test: record a clip, confirm the transcript file appears within ~30s and reads correctly.
4. Extend Workflow 1 with the Claude extraction + write-back. Test: same flow, confirm `ai_title`/`ai_summary`/`ai_mood`/`ai_status='completed'` populate.
5. Build the "Handle AI Failure" sub-workflow and wire it to each risky node's error output. Test by breaking one credential on purpose, confirming `ai_status='failed'` + a Telegram message, then confirm Retry in-app re-triggers it successfully.
6. Add the Timeline/ClipView UI (types, mood map, rendering, failed+Retry row). Test visually against the clips already processed above.
7. Add `get_weekly_recap_batch()` and `cleanup_old_transcripts()`/its cron. Test the RPC directly in the SQL editor against seeded multi-day data first.
8. Build Workflow 2. Test by manually running it in n8n (test-execute, not waiting for Sunday) against real RPC data; confirm both personalized emails arrive via Resend. Only then flip the Schedule Trigger active.
9. Export all three workflows to `/automation/workflows/`, write `/automation/README.md`, append the `CLAUDE.md` section.
