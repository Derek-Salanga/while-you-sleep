-- While You Sleep — MVP schema
-- Run this in the Supabase SQL editor, or via `supabase db push`.

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- 20 chars mirrors the TextInput's maxLength in SettingsScreen.tsx --
  -- kept here too so the limit holds for any write that isn't that form.
  display_name text not null default 'Anonymous' check (char_length(display_name) <= 20),
  timezone text,
  created_at timestamptz not null default now()
);

create table if not exists pairs (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid references auth.users (id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

-- The daily clip IS the daily question's answer (see "Video daily
-- question" in CLAUDE.md) -- caption_text is an optional short text
-- note alongside the required video, not a separate answer mechanism.
-- daily_answers below is no longer written to; kept for historical rows.
create table if not exists clips (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  duration_seconds int,
  recorded_for_date date not null,
  caption_text text,
  viewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (pair_id, sender_id, recorded_for_date)
);

-- No longer written to as of the video daily question merge -- kept so
-- historical rows aren't lost. See the comment on `clips` above.
create table if not exists daily_answers (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  answered_for_date date not null,
  answer_text text not null,
  created_at timestamptz not null default now(),
  unique (pair_id, user_id, answered_for_date)
);

-- Helper: is the given user part of the given pair?
create or replace function is_pair_member(pair_row pairs, uid uuid)
returns boolean
language sql
stable
as $$
  select uid = pair_row.user_a or uid = pair_row.user_b;
$$;

alter table profiles enable row level security;
alter table pairs enable row level security;
alter table clips enable row level security;
alter table daily_answers enable row level security;

-- Profiles: users can read/write only their own profile, and can also
-- read (not write) their paired partner's profile -- needed to show a
-- partner's nickname on Home/Timeline/Settings.
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);
create policy "profiles_select_pair_partner" on profiles
  for select using (
    exists (
      select 1 from pairs p
      where is_pair_member(p, auth.uid()) and is_pair_member(p, profiles.id)
    )
  );
create policy "profiles_upsert_own" on profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- Pairs: a user can only see pairs they're already a member of. Joining
-- an open pair by invite code is NOT done via a client SELECT+UPDATE --
-- that would require a policy exposing every open (user_b is null) pair
-- to every authenticated user, which lets anyone enumerate all pending
-- invite codes and claim a stranger's pair without ever knowing their
-- code. Joining goes through join_pair_by_code() below instead, a
-- security definer function that looks up the exact code server-side
-- and is the only path that can ever set user_b.
create policy "pairs_select_own" on pairs
  for select using (
    auth.uid() = user_a or auth.uid() = user_b
  );
create policy "pairs_insert_self_as_a" on pairs
  for insert with check (auth.uid() = user_a);

-- Deliberately no client-side UPDATE policy on pairs. The app never
-- updates a pairs row directly -- creating one is an insert
-- (PairingScreen.tsx), and joining is the security definer
-- join_pair_by_code() below, which atomically claims an open pair by
-- exact invite code. A generic "member can update" policy with no
-- `with check` would let any pair member rewrite invite_code or
-- reassign user_a/user_b via a direct API call, bypassing that
-- function's "only if unclaimed, only by exact code" invariant
-- entirely -- there's no legitimate use for it, so it's removed
-- rather than tightened.

-- Joins an open pair by exact invite code. security definer so it can
-- look up a not-yet-joined pair (by code, not by scanning every open
-- pair) and claim it atomically without needing a broad SELECT/UPDATE
-- policy exposed to the client -- see the comment on pairs' policies
-- above for why that would be a vulnerability.
create or replace function join_pair_by_code(code text)
returns pairs
language plpgsql
security definer
set search_path = public
as $$
declare
  joined_pair pairs;
begin
  update pairs
  set user_b = auth.uid()
  where invite_code = code
    and user_b is null
  returning * into joined_pair;

  if joined_pair is null then
    raise exception 'Invite code not found or already claimed';
  end if;

  return joined_pair;
end;
$$;

-- Helper: does the current user already have their own clip for this
-- pair/date? Same security definer reasoning as has_own_daily_answer
-- below -- an inline subquery on clips within its own select policy
-- would recurse.
create or replace function has_own_clip(
  target_pair_id uuid,
  target_date date
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from clips
    where pair_id = target_pair_id
      and sender_id = auth.uid()
      and recorded_for_date = target_date
  );
$$;

-- Clips: pair members can always see their own clip; they can see their
-- partner's clip for a given date only once they've posted their own for
-- that same date -- the clip IS the daily question's answer now (see
-- comment on the clips table above), so it gets the same "reveal after
-- you've answered" gating daily_answers has below.
create policy "clips_select_pair_members" on clips
  for select using (
    exists (
      select 1 from pairs p
      where p.id = clips.pair_id and is_pair_member(p, auth.uid())
    )
    and (
      auth.uid() = clips.sender_id
      or has_own_clip(clips.pair_id, clips.recorded_for_date)
    )
  );
create policy "clips_insert_own_as_sender" on clips
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from pairs p
      where p.id = clips.pair_id and is_pair_member(p, auth.uid())
    )
  );

-- Update is scoped to the sender's own row, not "any pair member" --
-- useUploadClip's upsert (onConflict: pair_id,sender_id,recorded_for_date)
-- becomes a Postgres INSERT ... ON CONFLICT DO UPDATE whenever a row
-- already exists for that day, and that DO UPDATE branch needs an UPDATE
-- policy same as any other update. Scoping it to the sender preserves
-- that "the upsert always overwrites in place" design (see the comment
-- on `clips` above) for your *own* clip, while still preventing a
-- partner from rewriting the other's clip content (caption,
-- storage_path, even recorded_for_date) via a direct API call, which the
-- old blanket "any pair member" policy allowed. The recipient's one
-- legitimate write -- marking a clip viewed -- goes through
-- mark_clip_viewed() below instead, a narrow security definer function
-- rather than a second broad policy, matching join_pair_by_code()'s
-- pattern above of using a function for a write RLS can't scope tightly
-- enough on its own.
create policy "clips_update_own_as_sender" on clips
  for update using (
    auth.uid() = sender_id
    and exists (
      select 1 from pairs p
      where p.id = clips.pair_id and is_pair_member(p, auth.uid())
    )
  )
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from pairs p
      where p.id = clips.pair_id and is_pair_member(p, auth.uid())
    )
  );
create or replace function mark_clip_viewed(target_clip_id uuid)
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

  if not exists (
    select 1 from pairs p
    where p.id = clip_row.pair_id and is_pair_member(p, auth.uid())
  ) then
    raise exception 'Not a member of this clip''s pair';
  end if;

  if clip_row.sender_id = auth.uid() then
    raise exception 'Cannot mark your own clip as viewed';
  end if;

  update clips set viewed_at = coalesce(viewed_at, now())
  where id = target_clip_id;
end;
$$;

-- Helper: does the current user already have their own answer for this
-- pair/date? Used by the select policy below to gate seeing the
-- partner's row on having answered yourself. This has to be a
-- `security definer` function rather than an inline subquery on
-- daily_answers within its own policy — a policy that queries its own
-- table directly re-triggers that same policy on the subquery's rows,
-- which Postgres refuses to evaluate ("infinite recursion detected in
-- policy for relation"). A security definer function runs as its owner
-- (the table owner, when created via the SQL editor), and table owners
-- are exempt from their own table's RLS by default, so the lookup
-- inside it is a plain read instead of recursing back into the policy.
create or replace function has_own_daily_answer(
  target_pair_id uuid,
  target_date date
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from daily_answers
    where pair_id = target_pair_id
      and user_id = auth.uid()
      and answered_for_date = target_date
  );
$$;

-- Daily answers: pair members can always see their own row; they can see
-- their partner's row for a given date only once they've submitted their
-- own for that same date — this is what actually enforces the "reveal
-- after you've answered" mechanic (the client only decides how to
-- display it, so the reveal has to be a data-level rule, not just UI).
-- No update/delete policy — answers are final once submitted (unlike
-- clips, which does allow an update, e.g. for setting viewed_at).
create policy "daily_answers_select_own_or_after_answering" on daily_answers
  for select using (
    exists (
      select 1 from pairs p
      where p.id = daily_answers.pair_id and is_pair_member(p, auth.uid())
    )
    and (
      auth.uid() = daily_answers.user_id
      or has_own_daily_answer(daily_answers.pair_id, daily_answers.answered_for_date)
    )
  );
create policy "daily_answers_insert_own_as_user" on daily_answers
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from pairs p
      where p.id = daily_answers.pair_id and is_pair_member(p, auth.uid())
    )
  );

-- Pair trips: a single shared "next visit" date per pair. Either partner
-- can read, set, or overwrite it — no reveal-gating (unlike
-- daily_answers), no per-day rows (unlike clips). Absence of a row means
-- no date is set yet; the client upserts on pair_id to set/edit it.
create table if not exists pair_trips (
  pair_id uuid primary key references pairs (id) on delete cascade,
  target_date date not null,
  country_code text, -- ISO 3166-1 alpha-2, e.g. 'JP' -- see src/data/countries.ts
  set_by uuid not null references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table pair_trips enable row level security;

create policy "pair_trips_select_pair_members" on pair_trips
  for select using (
    exists (
      select 1 from pairs p
      where p.id = pair_trips.pair_id and is_pair_member(p, auth.uid())
    )
  );

create policy "pair_trips_insert_pair_members" on pair_trips
  for insert with check (
    auth.uid() = set_by
    and exists (
      select 1 from pairs p
      where p.id = pair_trips.pair_id and is_pair_member(p, auth.uid())
    )
  );

create policy "pair_trips_update_pair_members" on pair_trips
  for update using (
    exists (
      select 1 from pairs p
      where p.id = pair_trips.pair_id and is_pair_member(p, auth.uid())
    )
  )
  with check (
    auth.uid() = set_by
    and exists (
      select 1 from pairs p
      where p.id = pair_trips.pair_id and is_pair_member(p, auth.uid())
    )
  );

-- Pair anniversary: a single shared "together since" date per pair,
-- separate from pair_trips (distinct feature, set from Settings rather
-- than from the Home trip card). Same either-partner read/write shape,
-- no reveal-gating.
create table if not exists pair_anniversary (
  pair_id uuid primary key references pairs (id) on delete cascade,
  anniversary_date date not null,
  set_by uuid not null references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table pair_anniversary enable row level security;

create policy "pair_anniversary_select_pair_members" on pair_anniversary
  for select using (
    exists (
      select 1 from pairs p
      where p.id = pair_anniversary.pair_id and is_pair_member(p, auth.uid())
    )
  );

create policy "pair_anniversary_insert_pair_members" on pair_anniversary
  for insert with check (
    auth.uid() = set_by
    and exists (
      select 1 from pairs p
      where p.id = pair_anniversary.pair_id and is_pair_member(p, auth.uid())
    )
  );

create policy "pair_anniversary_update_pair_members" on pair_anniversary
  for update using (
    exists (
      select 1 from pairs p
      where p.id = pair_anniversary.pair_id and is_pair_member(p, auth.uid())
    )
  )
  with check (
    auth.uid() = set_by
    and exists (
      select 1 from pairs p
      where p.id = pair_anniversary.pair_id and is_pair_member(p, auth.uid())
    )
  );

-- Account deletion. security definer so it can reach auth.users, which the
-- client role can't touch directly.
--
-- WHY NOT AN EDGE FUNCTION OR THE VAULT PATTERN. Deleting an auth user is
-- usually done through the Admin API, which needs the service_role key --
-- either from an Edge Function or, following cleanup_orphaned_clip_files
-- below, from pg_net with the key out of Vault. Neither is needed: the key
-- is only required to reach the Admin API *over HTTP*, and a security
-- definer function owned by postgres can delete the row directly. Verified
-- on this project 2026-08-29.
--
-- The Vault pattern would in fact be the wrong choice here. It works for
-- the cleanup job precisely because that job is unattended and self-healing
-- -- pg_net is fire-and-forget, so a failure just gets retried tomorrow. A
-- user tapping "Delete account" needs a synchronous yes/no, which pg_net
-- structurally cannot give. Note also that cleanup_orphaned_clip_files
-- revokes execute from `authenticated`; making a function that holds a
-- service key client-callable would invert the one property keeping it safe.
--
-- Takes no arguments on purpose. The target is always auth.uid(), so there
-- is no parameter a caller could point at somebody else's account.
--
-- EVERYTHING CASCADES. Every FK in this file is `on delete cascade`, so
-- this also removes: the caller's profiles row; the pairs row they belong
-- to (via user_a/user_b); and through that pair -- clips, daily_answers,
-- pair_trips and pair_anniversary, *including the partner's*. The partner
-- keeps their login and profile and loses everything shared. Their running
-- app won't notice until relaunched -- nothing refetches the pair once it's
-- complete -- so until then they see a stale tab bar over what looks like a
-- fresh empty pairing, and recording fails on RLS. That's accepted rather
-- than blocked (blocking would
-- mean building an unpair feature first), so AccountSettingsScreen's
-- confirmation names the consequence explicitly.
--
-- Storage IS handled here, unlike the row cascade, because nothing else
-- would do it promptly. cleanup_orphaned_clip_files below would eventually
-- find these files -- they become textbook orphans -- but not for 24-48h:
-- its grace period exists to protect an in-flight upload (the file is
-- written before its row), which has nothing to do with a deleted account,
-- whose rows are never coming back. That lag is fine for a free-tier
-- quota sweep and not fine for "delete my account". The nightly job stays
-- as the backstop for anything the requests below fail to remove.
create or replace function delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Same non-secret project URL as cleanup_orphaned_clip_files below.
  project_url text := 'https://lgzcvryexckjrwlipenr.supabase.co';
  service_key text;
  obj record;
begin
  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name = 'service_role_key';

  -- Purge the pair's clip files up front, while the pairs row still exists
  -- to find them by -- the delete below cascades it away.
  --
  -- Server-side, not from the client, because the client physically cannot
  -- enumerate these: clips_select_pair_members hides a partner's clip on any
  -- date the caller didn't post one, so a client-driven purge would silently
  -- skip exactly those files. Matched on the storage prefix rather than
  -- joining clips for the same reason -- the prefix is the pair, and every
  -- object under it belongs to this pairing.
  --
  -- A missing Vault secret degrades rather than blocks: the account is still
  -- deleted and cleanup_orphaned_clip_files sweeps the files on its next run.
  -- Refusing to delete an account because a storage credential is absent
  -- would be the worse failure.
  if service_key is null then
    raise warning 'delete_own_account: no Vault service_role_key; leaving clip files for the nightly cleanup job';
  else
    for obj in
      select o.name
      from storage.objects o
      join pairs p on p.id::text = (storage.foldername(o.name))[1]
      where o.bucket_id = 'clips'
        and (p.user_a = auth.uid() or p.user_b = auth.uid())
        -- Anchored so a crafted object name can't traverse out of the bucket
        -- when interpolated into the URL below. The storage INSERT policy
        -- only checks the *first* path segment, so a name like
        -- `<pair-id>/../../other` would satisfy it; this won't match it.
        -- Optional extension covers rows written before storage_path went
        -- extensionless (see the comment on `clips`).
        and o.name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/\d{4}-\d{2}-\d{2}(\.[A-Za-z0-9]{2,4})?$'
    loop
      perform net.http_delete(
        url => project_url || '/storage/v1/object/clips/' || obj.name,
        headers => jsonb_build_object(
          'Authorization', 'Bearer ' || service_key,
          'apikey', service_key
        )
      );
    end loop;
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

-- Unlike cleanup_orphaned_clip_files, this one IS meant to be called by the
-- client -- safe because it takes no arguments and only ever targets
-- auth.uid().
grant execute on function delete_own_account() to authenticated;

-- Private partner nickname: the name YOU give your partner, visible only
-- to you. Distinct from profiles.display_name, which is self-set and which
-- your partner can read via profiles_select_pair_partner.
--
-- WHY THIS ISN'T A COLUMN ON `profiles`. RLS is row-level, so any column
-- added there is covered by profiles_select_pair_partner too -- your
-- partner could read it with a direct REST call no matter what the app's
-- own select asks for. Column-level grants can't express "only on your own
-- row" either: they're per-role, not per-row. A separate table whose only
-- select policy is `auth.uid() = owner_id` is the one shape that actually
-- makes it private.
--
-- Keyed on owner_id, not pair_id: the nickname belongs to the person who
-- set it, not to the pairing, so it shouldn't survive into a re-pairing
-- with someone else. It cascades with the owner's auth.users row.
--
-- 20 chars mirrors profiles.display_name's constraint, so a nickname and
-- the name it falls back to can never render at different widths. The
-- lower bound is load-bearing: SettingsScreen deletes the row on a blank
-- save (that's how you clear a nickname), so an empty string should never
-- be storable in the first place.
create table if not exists partner_nicknames (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  updated_at timestamptz not null default now()
);

alter table partner_nicknames enable row level security;

-- Deliberately no partner-read policy, unlike every other table in this
-- file. Privacy from the partner IS the feature -- adding one to "be
-- consistent" would delete the whole point.
create policy "partner_nicknames_select_own" on partner_nicknames
  for select using (auth.uid() = owner_id);

-- insert + update + delete because the client upserts on owner_id and
-- deletes the row to clear the nickname.
create policy "partner_nicknames_insert_own" on partner_nicknames
  for insert with check (auth.uid() = owner_id);
create policy "partner_nicknames_update_own" on partner_nicknames
  for update using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
create policy "partner_nicknames_delete_own" on partner_nicknames
  for delete using (auth.uid() = owner_id);

-- Verify the privacy claim rather than trusting it. As partner A, with a
-- nickname row set, run this signed in as partner B -- it must return 0.
-- If it ever returns 1, a select policy has been added that shouldn't be.
--   select count(*) from partner_nicknames where owner_id <> auth.uid();

-- Expo push tokens, one row per device. Written by registerPushToken()
-- on every launch; read only by the server-side trigger that sends a push
-- when a partner posts.
--
-- WHY THIS ISN'T A COLUMN ON `profiles`, same reasoning as
-- partner_nicknames above: profiles_select_pair_partner makes every column
-- on that table readable by your partner, and column-level grants can't
-- express "only on your own row". A push token is a device address --
-- anyone holding it plus the Expo project id can send arbitrary
-- notifications to that device. Low stakes inside a pair, but there is no
-- reason to expose it, and the sending trigger is security definer so it
-- never needed a partner-read policy in the first place.
--
-- Keyed on (user_id, token) rather than user_id alone so one account can
-- hold several devices; the trigger sends to all of them, and Expo's push
-- API takes an array. A rotated token simply inserts another row -- see
-- the stale-row prune in notify_partner_of_clip() for how dead ones leave.
create table if not exists push_tokens (
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table push_tokens enable row level security;

-- Deliberately no partner-read policy, exactly like partner_nicknames.
create policy "push_tokens_select_own" on push_tokens
  for select using (auth.uid() = user_id);

-- insert + update because the client upserts on (user_id, token) every
-- launch to refresh updated_at; delete so a user can drop their own rows.
create policy "push_tokens_insert_own" on push_tokens
  for insert with check (auth.uid() = user_id);
create policy "push_tokens_update_own" on push_tokens
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "push_tokens_delete_own" on push_tokens
  for delete using (auth.uid() = user_id);

-- Verify the privacy claim rather than trusting it, same as
-- partner_nicknames. Signed in as the partner, this must return 0.
--   select count(*) from push_tokens where user_id <> auth.uid();

-- Reactions: one emoji per person per clip. Posting was one-directional
-- until now -- you record, they watch, nothing comes back.
--
-- The primary key IS the design. With exactly two people in a pair, a
-- "reaction" is just the single emoji the other one left, so there are no
-- counts to aggregate, no lists to paginate and no ordering to decide.
-- Tapping a different emoji upserts; tapping the same one deletes. If this
-- ever became a group product the PK is what would have to change first.
--
-- VISIBILITY MIRRORS `clips`, NOT JUST PAIR MEMBERSHIP. The obvious policy
-- -- "you're in the pair, you can read it" -- leaks the reveal: on a day you
-- haven't posted, clips_select_pair_members already hides your partner's
-- clip, but a pair-membership-only reactions policy would still let you see
-- that they reacted to something, and to what. So the predicate below is
-- clips_select_pair_members' own, applied through the joined clip row.
--
-- has_own_clip() is already security definer, which is what makes this
-- legal to call from a policy at all -- an inline subquery over clips here
-- would recurse through clips' own select policy. Same reason that function
-- exists in the first place.
create table if not exists clip_reactions (
  clip_id uuid not null references clips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (clip_id, user_id)
);

alter table clip_reactions enable row level security;

create policy "clip_reactions_select_visible_clips" on clip_reactions
  for select using (
    exists (
      select 1 from clips c
      join pairs p on p.id = c.pair_id
      where c.id = clip_reactions.clip_id
        and is_pair_member(p, auth.uid())
        and (
          c.sender_id = auth.uid()
          or has_own_clip(c.pair_id, c.recorded_for_date)
        )
    )
  );

-- Writes are your own row only, and only against a clip you can actually
-- see -- otherwise you could react to a clip the reveal is still hiding
-- from you, and the row would pop into existence the moment you posted.
create policy "clip_reactions_insert_own" on clip_reactions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from clips c
      join pairs p on p.id = c.pair_id
      where c.id = clip_reactions.clip_id
        and is_pair_member(p, auth.uid())
        and (
          c.sender_id = auth.uid()
          or has_own_clip(c.pair_id, c.recorded_for_date)
        )
    )
  );

-- update for changing your mind, delete for taking it back (that's what
-- tapping the same emoji again does). Both own-row-only; no visibility
-- re-check needed, since a row can only exist if insert already passed one.
create policy "clip_reactions_update_own" on clip_reactions
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "clip_reactions_delete_own" on clip_reactions
  for delete using (auth.uid() = user_id);

-- Verify the reveal actually holds, rather than trusting the policy reads
-- right. As the partner, on a date you have NOT posted, with a reaction of
-- theirs in the table, this must return 0:
--   select count(*) from clip_reactions;

-- Sends the partner a push when a clip lands. This is the app's only
-- re-open trigger: the daily local reminder nudges you to post, but until
-- now nothing told you your partner had.
--
-- WHY A TRIGGER + pg_net RATHER THAN AN EDGE FUNCTION. Same pattern as
-- cleanup_orphaned_clip_files and delete_own_account -- no extra deploy
-- surface, no second secrets store, and the payload is one JSON POST.
-- Move to an Edge Function only when the ticket response actually needs
-- reading (see the token prune below), not for tidiness.
--
-- WHY NOT FROM THE CLIENT. It would have to read the partner's token,
-- which means a partner-read policy on push_tokens, which is the one thing
-- that table is shaped to avoid.
--
-- pg_net is fire-and-forget, so a dropped push is simply lost -- unlike
-- cleanup_orphaned_clip_files, this is not self-healing. Accepted: the
-- failure mode is "you find out when you next open the app", which is
-- exactly today's behaviour, and the daily local reminder is an
-- independent backstop. Responses land in net._http_response (pruned
-- after 6h); nothing reads them.
--
-- AFTER INSERT ONLY, deliberately. useUploadClip upserts on
-- (pair_id, sender_id, recorded_for_date), so a same-day re-record fires
-- an UPDATE -- which must not re-notify.
create or replace function notify_partner_of_clip() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  recipient_id uuid;
  recipient_tokens text[];
  sender_name text;
begin
  -- Whichever half of the pair didn't send it.
  select case when p.user_a = new.sender_id then p.user_b else p.user_a end
    into recipient_id
    from pairs p
   where p.id = new.pair_id;

  -- Null while an invite is still unclaimed: there's no partner yet.
  if recipient_id is null then
    return new;
  end if;

  select array_agg(t.token) into recipient_tokens
    from push_tokens t
   where t.user_id = recipient_id;

  -- No registered device -- e.g. they've only ever run this in Expo Go, or
  -- declined the notification permission.
  if recipient_tokens is null then
    return new;
  end if;

  -- Same resolution order as usePartnerName() in the client: the
  -- recipient's own private nickname for the sender wins, then the
  -- sender's self-set display_name. These must not drift apart -- a push
  -- that names them differently from the app reads as a different person.
  select coalesce(
           (select n.nickname from partner_nicknames n
             where n.owner_id = recipient_id),
           (select pr.display_name from profiles pr
             where pr.id = new.sender_id),
           'Your partner'
         )
    into sender_name;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    -- No Authorization header: Expo's push API is unauthenticated unless
    -- the account turns on Enhanced Security, which would need an access
    -- token out of Vault the way the service_role key already is.
    body := jsonb_build_object(
      'to', to_jsonb(recipient_tokens),
      'title', sender_name || ' posted',
      -- DELIBERATELY NOT new.caption_text. The recipient may not have
      -- posted yet, in which case clips_select_pair_members hides this row
      -- from them entirely -- putting its text on their lock screen would
      -- walk straight past has_own_clip() and defeat the reveal.
      'body', 'Tap to see today''s answer',
      'data', jsonb_build_object(
        'type', 'partner-posted',
        'date', new.recorded_for_date
      )
    )
  );

  -- ponytail: prune dead tokens by age, not by reading Expo's tickets.
  -- pg_net is fire-and-forget so the DeviceNotRegistered receipt is
  -- unreachable from here; a live device re-upserts updated_at on every
  -- launch, so 60 days without one means the install is gone. Read the
  -- receipts instead -- which means moving this to an Edge Function -- only
  -- if dead tokens ever actually cost something.
  delete from push_tokens where updated_at < now() - interval '60 days';

  return new;
end;
$$;

-- No revoke needed here, unlike cleanup_orphaned_clip_files: Postgres
-- refuses to call a trigger function directly ("trigger functions can only
-- be called as triggers"), so the default grant to public is inert.

-- drop-then-create rather than `if not exists`, which create trigger has
-- no form of -- this keeps the file re-runnable.
drop trigger if exists clips_notify_partner on clips;
create trigger clips_notify_partner
  after insert on clips
  for each row execute function notify_partner_of_clip();

-- Tells you when your partner reacts to something you posted. Same shape as
-- notify_partner_of_clip above; the differences are all guards.
--
-- IS THIS NOISY? No, and the arithmetic settles it rather than taste: one
-- clip per person per day, and clip_reactions' primary key allows one
-- reaction per person per clip, so the hard ceiling is one reaction push per
-- person per day.
--
-- The ceiling only holds for *recent* clips, which is what the recency
-- guard below is for. Monthly Summary's caption list makes a month of old
-- clips reachable in one scroll, and someone catching up could otherwise
-- fire thirty pushes in a minute.
--
-- Notifies the clip's SENDER, not "the other half of the pair". Those are
-- the same person in practice, but reacting to your own clip is permitted by
-- RLS, and self-notifying would be absurd -- hence the explicit guard.
create or replace function notify_sender_of_reaction() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  recipient_id uuid;
  clip_date date;
  recipient_tokens text[];
  reactor_name text;
begin
  select c.sender_id, c.recorded_for_date
    into recipient_id, clip_date
    from clips c
   where c.id = new.clip_id;

  if recipient_id is null or recipient_id = new.user_id then
    return new;  -- clip gone, or you reacted to your own
  end if;

  -- Recency guard. Reacting to something from last month is a nice thing to
  -- find in the app, not a reason to buzz a phone.
  if clip_date < current_date - 2 then
    return new;
  end if;

  select array_agg(t.token) into recipient_tokens
    from push_tokens t
   where t.user_id = recipient_id;

  if recipient_tokens is null then
    return new;
  end if;

  -- Same resolution order as usePartnerName(), matching
  -- notify_partner_of_clip: the recipient's private nickname for the
  -- reactor, then the reactor's own display_name.
  select coalesce(
           (select n.nickname from partner_nicknames n
             where n.owner_id = recipient_id),
           (select pr.display_name from profiles pr
             where pr.id = new.user_id),
           'Your partner'
         )
    into reactor_name;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'to', to_jsonb(recipient_tokens),
      'title', reactor_name || ' reacted ' || new.emoji,
      'body', 'To your clip from ' || to_char(clip_date, 'Mon FMDD'),
      -- Lower-importance channel than partner-posted: a reaction is a warm
      -- signal, not a call to action. Android needs the channel to exist on
      -- the device (see notifications.ts); iOS ignores this field.
      'channelId', 'reactions',
      'sound', null,
      -- Routes straight to the clip rather than to Record, unlike
      -- partner-posted. Safe here: you can only be reacted to on a clip you
      -- sent, and clips_select_pair_members always shows you your own.
      'data', jsonb_build_object('type', 'reaction', 'clipId', new.clip_id)
    )
  );

  return new;
end;
$$;

-- INSERT OR UPDATE, unlike the clips trigger. useSetReaction upserts on the
-- primary key, so changing your mind is an UPDATE -- and that is a real new
-- reaction worth hearing about, not a duplicate of one already sent.
-- Clearing a reaction is a DELETE and is deliberately silent.
drop trigger if exists clip_reactions_notify_sender on clip_reactions;
create trigger clip_reactions_notify_sender
  after insert or update on clip_reactions
  for each row execute function notify_sender_of_reaction();

-- Storage: private "clips" bucket, one folder per pair, readable only by
-- the two paired users. Create the bucket via the dashboard or:
-- insert into storage.buckets (id, name, public) values ('clips', 'clips', false);

create policy "clip_files_pair_members_read" on storage.objects
  for select using (
    bucket_id = 'clips'
    and exists (
      select 1 from pairs p
      where p.id::text = (storage.foldername(name))[1]
        and is_pair_member(p, auth.uid())
    )
  );

create policy "clip_files_pair_members_write" on storage.objects
  for insert with check (
    bucket_id = 'clips'
    and exists (
      select 1 from pairs p
      where p.id::text = (storage.foldername(name))[1]
        and is_pair_member(p, auth.uid())
    )
  );

-- Supabase Storage's upsert:true upload path (useUploadClip's "always
-- overwrites in place" design -- see the comment on `clips` above) needs
-- both an INSERT and an UPDATE policy to actually overwrite an existing
-- object; without this, re-uploading to an already-used storage_path
-- (a same-day re-record, or a retry after a partial upload failure)
-- fails with a permissions error instead of overwriting.
create policy "clip_files_pair_members_update" on storage.objects
  for update using (
    bucket_id = 'clips'
    and exists (
      select 1 from pairs p
      where p.id::text = (storage.foldername(name))[1]
        and is_pair_member(p, auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- Storage cleanup: orphaned clip files
-- ---------------------------------------------------------------------
--
-- WHY THIS ISN'T A DELETE TRIGGER ON `clips`.
--
-- `storage.objects` is metadata only -- the actual bytes live in the S3
-- backend, and only the Storage API deletes both. Supabase's docs are
-- explicit: "Deleting objects via a SQL query will not remove the object
-- from the bucket and will result in the object being orphaned." So a
-- trigger doing `delete from storage.objects` is worse than doing
-- nothing: the blob survives *and* loses the metadata row the Storage
-- API needs to ever find it again. Native cascade-on-row-delete is still
-- an open feature request, not a supported feature.
--
-- A trigger *can* work by calling the Storage API over HTTP (pg_net),
-- but it's the wrong tool here for a structural reason: the orphans this
-- app produces mostly don't come from DELETEs.
--   1. `clips` has no DELETE policy, so no client can delete a clip.
--   2. Rows do vanish via `on delete cascade` when a pair or an
--      auth.users row goes -- no app code runs there.
--   3. Until the useUploadClip fix that landed with this section, a
--      re-record on a different platform changed the path's extension
--      (.mov on iOS, .mp4 on Android) and orphaned the old file *with
--      the row still present*. No DELETE ever fires for that one.
--
-- So cleanup is reconciliation, not a delete hook: re-derive the orphan
-- set from current state on a schedule. That covers all three cases,
-- is idempotent, and self-heals -- a request that fails tonight is
-- simply re-found and retried tomorrow, because the file is still
-- orphaned. A fire-and-forget trigger gets one shot and no retry.
--
-- SETUP (one-time, live project -- see "Storage cleanup" in CLAUDE.md):
--   1. Enable `pg_net` and `pg_cron` (Dashboard -> Database ->
--      Extensions), or run the create extension statements below.
--   2. Store a server-side API key in Vault. Use a **secret key**
--      (`sb_secret_...`, Settings -> API Keys), NOT the legacy
--      `service_role` JWT -- legacy keys are deleted late 2026, and this
--      job would then fail silently (see "Errors are not surfaced" in
--      CLAUDE.md). The Vault secret's *name* stays `service_role_key`
--      either way; that string is just what the lookup below matches.
--      Run this ONCE with the real key, from the SQL editor -- never
--      commit the key:
--        select vault.create_secret(
--          '<sb_secret_...>',
--          'service_role_key',
--          'Storage API auth for cleanup_orphaned_clip_files'
--        );

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Deletes every object in the `clips` bucket with no matching
-- clips.storage_path. Returns how many deletions it queued.
--
-- `grace_period` is a safety margin, not a tuning knob: a file is
-- uploaded before its row is inserted, so a just-uploaded file is
-- briefly a legitimate orphan. A day is far longer than that window and
-- costs nothing, since orphans aren't urgent.
--
-- ponytail: one HTTP request per orphan -- net.http_delete takes no
-- body, so the Storage API's batch form (DELETE /object/clips with a
-- {"prefixes": [...]} body) isn't reachable from pg_net. max_deletions
-- caps a single run; if that limit is ever actually hit, move this to an
-- Edge Function that can batch, rather than raising the cap.
create or replace function cleanup_orphaned_clip_files(
  grace_period interval default interval '1 day',
  max_deletions int default 200
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  -- The project's public URL -- already client-visible by design (it
  -- ships in the app alongside the anon key), so it isn't a secret.
  project_url text := 'https://lgzcvryexckjrwlipenr.supabase.co';
  service_key text;
  orphan record;
  queued int := 0;
begin
  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name = 'service_role_key';

  if service_key is null then
    raise exception
      'Vault secret "service_role_key" not found -- see setup step 2 in schema.sql';
  end if;

  for orphan in
    select o.name
    from storage.objects o
    where o.bucket_id = 'clips'
      and o.created_at < now() - grace_period
      and not exists (
        select 1 from public.clips c where c.storage_path = o.name
      )
      -- Same anchoring as delete_own_account: the name goes straight into a
      -- URL below, and the storage INSERT policy only constrains the first
      -- path segment, so `<pair-id>/../../other` would pass it. A name that
      -- doesn't match is skipped rather than requested -- meaning a
      -- malformed one is never swept, which is the right way round: this
      -- job exists to reclaim quota, not to act on paths it can't vouch for.
      and o.name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/\d{4}-\d{2}-\d{2}(\.[A-Za-z0-9]{2,4})?$'
    order by o.created_at
    limit max_deletions
  loop
    -- No URL-encoding needed: paths are `<uuid>/<uuid>/<YYYY-MM-DD>`,
    -- and the slashes are meant to stay literal path separators.
    perform net.http_delete(
      url => project_url || '/storage/v1/object/clips/' || orphan.name,
      headers => jsonb_build_object(
        'Authorization', 'Bearer ' || service_key,
        'apikey', service_key
      )
    );
    queued := queued + 1;
  end loop;

  return queued;
end;
$$;

-- security definer + a service_role key means this must never be
-- callable from the client. Postgres grants EXECUTE to public on new
-- functions by default, so revoking is not optional.
revoke all on function cleanup_orphaned_clip_files(interval, int)
  from public, anon, authenticated;

-- Nightly, off the hour to avoid the top-of-hour crowd. cron.schedule
-- upserts by job name, so re-running this file doesn't duplicate it.
-- Results land in cron.job_run_details; the HTTP responses land in
-- net._http_response, which pg_net prunes after 6 hours on its own.
select cron.schedule(
  'cleanup-orphaned-clip-files',
  '17 4 * * *',
  $cron$ select public.cleanup_orphaned_clip_files(); $cron$
);
