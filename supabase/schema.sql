-- While You Sleep — MVP schema
-- Run this in the Supabase SQL editor, or via `supabase db push`.

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Anonymous',
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

-- Profiles: users can read/write only their own profile.
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);
create policy "profiles_upsert_own" on profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- Pairs: a user can see/create pairs they belong to, or an open invite
-- (user_b is null) so they can look up and join by code.
create policy "pairs_select_member_or_open" on pairs
  for select using (
    auth.uid() = user_a or auth.uid() = user_b or user_b is null
  );
create policy "pairs_insert_self_as_a" on pairs
  for insert with check (auth.uid() = user_a);
create policy "pairs_update_join" on pairs
  for update using (user_b is null or auth.uid() = user_a or auth.uid() = user_b);

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
  location text,
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
