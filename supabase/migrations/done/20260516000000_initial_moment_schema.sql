-- momment. initial Supabase schema
-- Service brand is momment.; MOM is reserved for token/symbol terms such as MOM Energy.
-- User-generated posts/comments keep original text forever and store natural language translations separately.

create extension if not exists pgcrypto;

do $$
begin
  create type public.supported_language as enum ('ko', 'en', 'es');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.event_status as enum ('draft', 'open', 'resolved', 'disputed', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.post_type as enum ('analysis', 'evidence', 'signal', 'room_note');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.content_visibility as enum ('public', 'subscribers_only', 'paid_room', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.translation_status as enum ('pending', 'translated', 'needs_review', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.translation_job_status as enum ('queued', 'processing', 'completed', 'failed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.translation_batch_status as enum ('draft', 'running', 'completed', 'failed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text,
  avatar_url text,
  bio text,
  preferred_language public.supported_language not null default 'ko',
  trust_score numeric not null default 0,
  mom_energy numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, handle, display_name, avatar_url, preferred_language)
  values (
    new.id,
    'user_' || substr(replace(new.id::text, '-', ''), 1, 10),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    'ko'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_profile_after_auth_user_insert on auth.users;
create trigger create_profile_after_auth_user_insert
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  address text not null,
  chain_id integer,
  wallet_type text not null check (wallet_type in ('thirdweb_in_app', 'external', 'tookwallet')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique(address, chain_id)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text not null,
  description text,
  category text,
  source_platform text,
  source_url text,
  external_market_id text,
  original_language public.supported_language not null default 'ko',
  status public.event_status not null default 'open',
  resolution text,
  starts_at timestamptz,
  ends_at timestamptz,
  resolved_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create table if not exists public.event_translations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  language public.supported_language not null,
  title text not null,
  description text,
  status public.translation_status not null default 'translated',
  translated_by text not null default 'system',
  model text,
  source_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, language)
);

drop trigger if exists event_translations_set_updated_at on public.event_translations;
create trigger event_translations_set_updated_at
before update on public.event_translations
for each row execute function public.set_updated_at();

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  prediction_label text not null,
  confidence integer check (confidence >= 0 and confidence <= 100),
  rationale text,
  mom_energy_used numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, user_id)
);

drop trigger if exists predictions_set_updated_at on public.predictions;
create trigger predictions_set_updated_at
before update on public.predictions
for each row execute function public.set_updated_at();

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  submitted_by uuid references public.profiles(id),
  url text not null,
  title text,
  publisher text,
  published_at timestamptz,
  captured_at timestamptz,
  content_hash text,
  metadata_hash text,
  screenshot_url text,
  ai_confidence numeric,
  status text not null default 'submitted' check (status in ('submitted', 'verified', 'rejected', 'disputed')),
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  type public.post_type not null default 'analysis',
  visibility public.content_visibility not null default 'public',
  original_language public.supported_language not null default 'ko',
  original_title text,
  original_body text not null,
  original_hash text,
  translation_status public.translation_status not null default 'pending',
  like_count integer not null default 0,
  comment_count integer not null default 0,
  share_count integer not null default 0,
  view_count integer not null default 0,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_event_created_at_idx on public.posts(event_id, created_at desc);
create index if not exists posts_user_created_at_idx on public.posts(user_id, created_at desc);

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create table if not exists public.post_original_versions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  version integer not null,
  original_language public.supported_language not null,
  original_title text,
  original_body text not null,
  original_hash text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(post_id, version)
);

create table if not exists public.post_translations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  source_version integer not null default 1,
  language public.supported_language not null,
  title text,
  body text not null,
  status public.translation_status not null default 'translated',
  provider text not null default 'llm',
  model text,
  source_hash text,
  quality_score numeric,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(post_id, source_version, language)
);

create index if not exists post_translations_lookup_idx on public.post_translations(post_id, language);

drop trigger if exists post_translations_set_updated_at on public.post_translations;
create trigger post_translations_set_updated_at
before update on public.post_translations
for each row execute function public.set_updated_at();

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  original_language public.supported_language not null default 'ko',
  original_body text not null,
  original_hash text,
  translation_status public.translation_status not null default 'pending',
  like_count integer not null default 0,
  reply_count integer not null default 0,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_post_created_at_idx on public.comments(post_id, created_at asc);
create index if not exists comments_parent_created_at_idx on public.comments(parent_comment_id, created_at asc);

drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

create table if not exists public.comment_original_versions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  version integer not null,
  original_language public.supported_language not null,
  original_body text not null,
  original_hash text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(comment_id, version)
);

create table if not exists public.comment_translations (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  source_version integer not null default 1,
  language public.supported_language not null,
  body text not null,
  status public.translation_status not null default 'translated',
  provider text not null default 'llm',
  model text,
  source_hash text,
  quality_score numeric,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(comment_id, source_version, language)
);

create index if not exists comment_translations_lookup_idx on public.comment_translations(comment_id, language);

drop trigger if exists comment_translations_set_updated_at on public.comment_translations;
create trigger comment_translations_set_updated_at
before update on public.comment_translations
for each row execute function public.set_updated_at();

create table if not exists public.translation_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid,
  content_type text not null check (content_type in ('event', 'post', 'comment')),
  content_id uuid not null,
  source_version integer not null default 1,
  source_language public.supported_language not null,
  target_language public.supported_language not null,
  status public.translation_job_status not null default 'queued',
  priority integer not null default 100,
  provider text not null default 'openai',
  model text,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  error_message text,
  scheduled_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(content_type, content_id, source_version, target_language)
);

create index if not exists translation_jobs_queue_idx
on public.translation_jobs(status, priority asc, next_attempt_at asc, created_at asc)
where status in ('queued', 'failed');

create index if not exists translation_jobs_batch_idx
on public.translation_jobs(batch_id, status);

drop trigger if exists translation_jobs_set_updated_at on public.translation_jobs;
create trigger translation_jobs_set_updated_at
before update on public.translation_jobs
for each row execute function public.set_updated_at();

create table if not exists public.translation_batches (
  id uuid primary key default gen_random_uuid(),
  status public.translation_batch_status not null default 'draft',
  target_languages public.supported_language[] not null default array['ko','en','es']::public.supported_language[],
  content_types text[] not null default array['post','comment'],
  min_created_at timestamptz,
  max_created_at timestamptz,
  limit_count integer not null default 500,
  job_count integer not null default 0,
  completed_count integer not null default 0,
  failed_count integer not null default 0,
  provider text not null default 'openai',
  model text,
  created_by uuid references public.profiles(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists translation_batches_set_updated_at on public.translation_batches;
create trigger translation_batches_set_updated_at
before update on public.translation_batches
for each row execute function public.set_updated_at();

alter table public.translation_jobs
drop constraint if exists translation_jobs_batch_id_fkey;

alter table public.translation_jobs
add constraint translation_jobs_batch_id_fkey
foreign key (batch_id) references public.translation_batches(id) on delete set null;

create or replace function public.enqueue_missing_translations_for_post(target_post_id uuid)
returns integer
language plpgsql
as $$
declare
  inserted_count integer;
begin
  insert into public.translation_jobs (
    content_type,
    content_id,
    source_version,
    source_language,
    target_language,
    priority
  )
  select
    'post',
    posts.id,
    1,
    posts.original_language,
    language_code,
    100
  from public.posts
  cross join unnest(enum_range(null::public.supported_language)) as language_code
  where posts.id = target_post_id
    and language_code <> posts.original_language
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.enqueue_missing_translations_for_comment(target_comment_id uuid)
returns integer
language plpgsql
as $$
declare
  inserted_count integer;
begin
  insert into public.translation_jobs (
    content_type,
    content_id,
    source_version,
    source_language,
    target_language,
    priority
  )
  select
    'comment',
    comments.id,
    1,
    comments.original_language,
    language_code,
    120
  from public.comments
  cross join unnest(enum_range(null::public.supported_language)) as language_code
  where comments.id = target_comment_id
    and language_code <> comments.original_language
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  type text not null,
  energy numeric not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.reward_pools (
  id uuid primary key default gen_random_uuid(),
  period_start timestamptz not null,
  period_end timestamptz not null,
  total_revenue_usdc numeric not null default 0,
  reward_rate numeric not null default 0,
  reward_amount_usdc numeric generated always as (total_revenue_usdc * reward_rate) stored,
  merkle_root text,
  status text not null default 'draft' check (status in ('draft', 'calculated', 'published', 'claimable', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.reward_allocations (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.reward_pools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  contribution_energy numeric not null default 0,
  contribution_ratio numeric not null default 0,
  reward_usdc numeric not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'claimable', 'paid', 'rejected')),
  tx_hash text,
  created_at timestamptz not null default now(),
  unique(pool_id, user_id)
);

create or replace function public.seed_post_original_version()
returns trigger
language plpgsql
as $$
begin
  insert into public.post_original_versions (
    post_id,
    version,
    original_language,
    original_title,
    original_body,
    original_hash,
    created_by
  )
  values (
    new.id,
    1,
    new.original_language,
    new.original_title,
    new.original_body,
    new.original_hash,
    new.user_id
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists seed_post_original_version_after_insert on public.posts;
create trigger seed_post_original_version_after_insert
after insert on public.posts
for each row execute function public.seed_post_original_version();

create or replace function public.seed_comment_original_version()
returns trigger
language plpgsql
as $$
begin
  insert into public.comment_original_versions (
    comment_id,
    version,
    original_language,
    original_body,
    original_hash,
    created_by
  )
  values (
    new.id,
    1,
    new.original_language,
    new.original_body,
    new.original_hash,
    new.user_id
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists seed_comment_original_version_after_insert on public.comments;
create trigger seed_comment_original_version_after_insert
after insert on public.comments
for each row execute function public.seed_comment_original_version();

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.events enable row level security;
alter table public.event_translations enable row level security;
alter table public.predictions enable row level security;
alter table public.evidence enable row level security;
alter table public.posts enable row level security;
alter table public.post_original_versions enable row level security;
alter table public.post_translations enable row level security;
alter table public.comments enable row level security;
alter table public.comment_original_versions enable row level security;
alter table public.comment_translations enable row level security;
alter table public.translation_jobs enable row level security;
alter table public.translation_batches enable row level security;
alter table public.contributions enable row level security;
alter table public.reward_pools enable row level security;
alter table public.reward_allocations enable row level security;

drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable"
on public.profiles for select
using (true);

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "users can read their own wallets" on public.wallets;
create policy "users can read their own wallets"
on public.wallets for select
using (auth.uid() = user_id);

drop policy if exists "users can manage their own wallets" on public.wallets;
create policy "users can manage their own wallets"
on public.wallets for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "events are publicly readable" on public.events;
create policy "events are publicly readable"
on public.events for select
using (status <> 'archived');

drop policy if exists "event translations are publicly readable" on public.event_translations;
create policy "event translations are publicly readable"
on public.event_translations for select
using (true);

drop policy if exists "predictions are publicly readable" on public.predictions;
create policy "predictions are publicly readable"
on public.predictions for select
using (true);

drop policy if exists "users can insert their own predictions" on public.predictions;
create policy "users can insert their own predictions"
on public.predictions for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update their own predictions" on public.predictions;
create policy "users can update their own predictions"
on public.predictions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "evidence is publicly readable" on public.evidence;
create policy "evidence is publicly readable"
on public.evidence for select
using (true);

drop policy if exists "users can submit evidence" on public.evidence;
create policy "users can submit evidence"
on public.evidence for insert
with check (auth.uid() = submitted_by);

drop policy if exists "public posts are readable" on public.posts;
create policy "public posts are readable"
on public.posts for select
using (visibility = 'public' and is_deleted = false);

drop policy if exists "users can insert their own posts" on public.posts;
create policy "users can insert their own posts"
on public.posts for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update their own posts" on public.posts;
create policy "users can update their own posts"
on public.posts for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "public post originals are readable" on public.post_original_versions;
create policy "public post originals are readable"
on public.post_original_versions for select
using (
  exists (
    select 1 from public.posts
    where posts.id = post_original_versions.post_id
      and posts.visibility = 'public'
      and posts.is_deleted = false
  )
);

drop policy if exists "public post translations are readable" on public.post_translations;
create policy "public post translations are readable"
on public.post_translations for select
using (
  exists (
    select 1 from public.posts
    where posts.id = post_translations.post_id
      and posts.visibility = 'public'
      and posts.is_deleted = false
  )
);

drop policy if exists "public comments are readable" on public.comments;
create policy "public comments are readable"
on public.comments for select
using (
  is_deleted = false and exists (
    select 1 from public.posts
    where posts.id = comments.post_id
      and posts.visibility = 'public'
      and posts.is_deleted = false
  )
);

drop policy if exists "users can insert their own comments" on public.comments;
create policy "users can insert their own comments"
on public.comments for insert
with check (auth.uid() = user_id);

drop policy if exists "users can update their own comments" on public.comments;
create policy "users can update their own comments"
on public.comments for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "public comment originals are readable" on public.comment_original_versions;
create policy "public comment originals are readable"
on public.comment_original_versions for select
using (
  exists (
    select 1
    from public.comments
    join public.posts on posts.id = comments.post_id
    where comments.id = comment_original_versions.comment_id
      and comments.is_deleted = false
      and posts.visibility = 'public'
      and posts.is_deleted = false
  )
);

drop policy if exists "public comment translations are readable" on public.comment_translations;
create policy "public comment translations are readable"
on public.comment_translations for select
using (
  exists (
    select 1
    from public.comments
    join public.posts on posts.id = comments.post_id
    where comments.id = comment_translations.comment_id
      and comments.is_deleted = false
      and posts.visibility = 'public'
      and posts.is_deleted = false
  )
);

drop policy if exists "users can read own translation jobs" on public.translation_jobs;
create policy "users can read own translation jobs"
on public.translation_jobs for select
using (
  exists (
    select 1 from public.posts
    where translation_jobs.content_type = 'post'
      and posts.id = translation_jobs.content_id
      and posts.user_id = auth.uid()
  )
  or exists (
    select 1 from public.comments
    where translation_jobs.content_type = 'comment'
      and comments.id = translation_jobs.content_id
      and comments.user_id = auth.uid()
  )
);

drop policy if exists "translation batches are not publicly readable" on public.translation_batches;
create policy "translation batches are not publicly readable"
on public.translation_batches for select
using (false);

drop policy if exists "contributions are publicly readable" on public.contributions;
create policy "contributions are publicly readable"
on public.contributions for select
using (true);

drop policy if exists "reward pools are publicly readable" on public.reward_pools;
create policy "reward pools are publicly readable"
on public.reward_pools for select
using (true);

drop policy if exists "users can read their reward allocations" on public.reward_allocations;
create policy "users can read their reward allocations"
on public.reward_allocations for select
using (auth.uid() = user_id);
