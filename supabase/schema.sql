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
