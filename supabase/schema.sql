-- While You Sleep — MVP schema
-- Run this in the Supabase SQL editor, or via `supabase db push`.

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- 15 chars mirrors the TextInput's maxLength in SettingsScreen.tsx --
  -- kept here too so the limit holds for any write that isn't that form.
  display_name text not null default 'Anonymous' check (char_length(display_name) <= 15),
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

create table if not exists clips (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references pairs (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  duration_seconds int,
  recorded_for_date date not null,
  viewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (pair_id, sender_id, recorded_for_date)
);

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
create policy "pairs_update_members_only" on pairs
  for update using (auth.uid() = user_a or auth.uid() = user_b);

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

-- Clips: only visible to/writable by the two members of the pair.
create policy "clips_select_pair_members" on clips
  for select using (
    exists (
      select 1 from pairs p
      where p.id = clips.pair_id and is_pair_member(p, auth.uid())
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
create policy "clips_update_pair_members" on clips
  for update using (
    exists (
      select 1 from pairs p
      where p.id = clips.pair_id and is_pair_member(p, auth.uid())
    )
  );

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
