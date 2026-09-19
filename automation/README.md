# AI automation layer

n8n Cloud workflows implementing the AI automation layer described in
[`docs/ai-automation-plan.md`](../docs/ai-automation-plan.md): per-clip
title/summary/mood extraction and a weekly recap email. External to the
app itself — nothing in `src/` calls n8n directly; Postgres does, via
`net.http_post` in `supabase/schema.sql`.

## Architecture

```
clip inserted (sender opted in)
  -> clips_queue_ai trigger -> queue_clip_for_ai()
  -> POST to n8n webhook
       |
       v
Clip AI Processing (clip-ai-processing.json)
  Webhook -> Edit Fields -> sign clip URL -> AssemblyAI transcribe
  -> poll until done -> write transcript to Storage
  -> Gemini extraction -> PATCH clips (ai_title/ai_summary/ai_mood/ai_status)
       |
       | any risky node's error output
       v
Handle AI Failure (handle-ai-failure.json)
  PATCH clips ai_status='failed' + Telegram alert

Weekly Recap (weekly-recap.json)  -- runs on its own schedule, not chained
  Sunday 20:00 UTC -> get_weekly_recap_batch() -> drop empty pairs
  -> Gemini recap letter -> Resend x2 (one email per partner)
  -> error output -> Telegram alert
```

## Credentials required

None of these values are in the committed JSON — re-enter them after
importing. Two different mechanisms are in play, matching how these
workflows are actually built (not the cleaner all-credentials design in
the plan doc — see "Deviations from the plan" below):

**Proper n8n credentials** (create these in n8n's Credentials manager,
then re-select them on the relevant node):
- **Telegram Bot** (`telegramApi`) — bot token from BotFather. Used by
  the "Send a text message" node in both `handle-ai-failure.json` and
  `weekly-recap.json`. Also needs a **Chat ID** entered directly on the
  node (your Telegram numeric user ID, from `@userinfobot`).
- **Header Auth** — used by the Webhook trigger in
  `clip-ai-processing.json`. Name: `X-Webhook-Secret`, value: whatever
  you set `n8n_webhook_secret` to in Supabase Vault (see below).

**Literal placeholder values** — every other secret is a plain node
parameter, not an n8n credential. Search each imported workflow for
these placeholder strings and replace them:
- `<SUPABASE_SERVICE_ROLE_KEY>` — Supabase dashboard → Settings → API
  (the `service_role`/secret key, **not** the anon/publishable one).
  Same value as the `service_role_key` Vault secret. Appears as both
  `apikey` and `Authorization: Bearer <...>` headers, several times
  across all three workflows.
- `<ASSEMBLYAI_API_KEY>` — assemblyai.com dashboard. `clip-ai-processing.json`
  only, sent as a bare `Authorization` header (no `Bearer` prefix — that's
  AssemblyAI's own scheme, not a mistake).
- `<GEMINI_API_KEY>` — Google AI Studio (aistudio.google.com). Sent as
  `x-goog-api-key`. `clip-ai-processing.json` and `weekly-recap.json`.
- `<RESEND_API_KEY>` — resend.com dashboard. `weekly-recap.json` only,
  `Authorization: Bearer <...>`.
- `<YOUR_TELEGRAM_CHAT_ID>` — same numeric ID as the Telegram credential
  above, but entered as a literal value on the "Send a text message"
  node's Chat ID field (Telegram nodes don't take chat ID as part of the
  credential itself).

**Required Supabase Vault secrets** (SQL editor, one-time):
```sql
select vault.create_secret('<random-secret>', 'n8n_webhook_secret',
  'Shared secret for the clip-ai n8n webhook');
```
`service_role_key` should already exist from `cleanup_orphaned_clip_files`'
setup (see `supabase/schema.sql`).

## Re-import instructions

1. In n8n, **Workflows → Import from File** (or paste the JSON) for each
   of the three files. Import `handle-ai-failure.json` first — the other
   two reference it by workflow ID via "Execute Workflow" nodes, and
   n8n needs it to exist to resolve that reference cleanly.
2. Re-create the two proper credentials above, then re-select them on
   the Webhook and Telegram nodes (a fresh import won't have them
   selected).
3. Find-and-replace the five placeholder strings above with real values,
   directly in each node's parameters.
4. Point `queue_clip_for_ai()` at the real webhook URL (see the comment
   in `supabase/schema.sql` — deliberately not committed, since the
   real n8n subdomain isn't either).
5. **Publish** each workflow. Publishing `weekly-recap.json` also
   activates its schedule — it'll fire for real the next Sunday 20:00 UTC.

## Deviations from the plan

- **Extraction runs on Gemini (`gemini-3.6-flash`), not Claude Haiku.**
  Anthropic Console billing rejected every card on hand mid-build. The
  plan's original Claude design is the intended default — swapping back
  is a single-node change (different URL, headers, and body shape;
  see `docs/ai-automation-plan.md`'s "Extraction call" section for both
  versions) once billing is sorted, not a redesign.
- **Secrets are literal node values, not n8n credentials**, for the four
  keys listed above. This started as a debugging workaround (n8n's
  "Custom Auth" JSON credential editor was silently mangling pasted
  values on iPad) and was never migrated back. Functionally identical,
  just less clean than the credential vault — worth tidying up
  eventually, not urgent.
- **No separate "Split Out" node in `weekly-recap.json`.** The plan's
  step list included one defensively; n8n's HTTP Request node already
  auto-splits a top-level JSON array response into one item per array
  element, so it wasn't needed.

## Testing

See `docs/testing-log.md`'s 2026-09-16 through 2026-09-19 entries for the
full verification history — every workflow here has been run against the
live Supabase project, including deliberate-break tests confirming the
error-handling paths.
