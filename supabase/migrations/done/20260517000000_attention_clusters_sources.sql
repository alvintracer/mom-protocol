-- momment. attention clusters, imported sources, merge queue, and attribution ledger.
-- Run after:
-- 1) 20260516000000_initial_moment_schema.sql
-- 2) 20260516010000_attention_topics_and_discovery.sql
-- 3) 20260516020000_aio_protocol.sql

do $$
begin
  create type public.attention_cluster_status as enum ('active', 'reviewing', 'merged', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.attention_source_type as enum ('native', 'polymarket', 'kalshi', 'manifold', 'predictit', 'news', 'official', 'other');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.attention_merge_status as enum ('pending', 'accepted', 'rejected', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.attention_activity_type as enum ('post', 'comment', 'boost', 'ad', 'subscription', 'evidence', 'share', 'source_create', 'source_import', 'merge');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.attention_clusters (
  id uuid primary key default gen_random_uuid(),
  canonical_event_id uuid references public.events(id) on delete set null,
  slug text unique,
  title text not null,
  description text,
  category text,
  original_language public.supported_language not null default 'ko',
  status public.attention_cluster_status not null default 'active',
  source_count integer not null default 0,
  post_count integer not null default 0,
  comment_count integer not null default 0,
  attention_score numeric not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attention_clusters_category_idx
on public.attention_clusters(category, status, created_at desc);

drop trigger if exists attention_clusters_set_updated_at on public.attention_clusters;
create trigger attention_clusters_set_updated_at
before update on public.attention_clusters
for each row execute function public.set_updated_at();

create table if not exists public.attention_sources (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.attention_clusters(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  source_type public.attention_source_type not null,
  source_platform text not null,
  source_url text,
  canonical_url text,
  external_market_id text,
  title text not null,
  description text,
  rules_text text,
  oracle_type text,
  resolver_address text,
  resolution_source_url text,
  reference_signal_label text,
  reference_signal numeric,
  starts_at timestamptz,
  ends_at timestamptz,
  raw_metadata jsonb not null default '{}',
  imported_by uuid references public.profiles(id),
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_type, canonical_url),
  unique(source_type, external_market_id)
);

create index if not exists attention_sources_cluster_idx
on public.attention_sources(cluster_id, created_at desc);

create index if not exists attention_sources_platform_idx
on public.attention_sources(source_type, source_platform, created_at desc);

drop trigger if exists attention_sources_set_updated_at on public.attention_sources;
create trigger attention_sources_set_updated_at
before update on public.attention_sources
for each row execute function public.set_updated_at();

create table if not exists public.attention_merge_candidates (
  id uuid primary key default gen_random_uuid(),
  source_cluster_id uuid references public.attention_clusters(id) on delete cascade,
  source_id uuid references public.attention_sources(id) on delete cascade,
  candidate_cluster_id uuid not null references public.attention_clusters(id) on delete cascade,
  match_score numeric not null default 0,
  match_reason text,
  signals jsonb not null default '{}',
  status public.attention_merge_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_cluster_id is not null or source_id is not null)
);

create index if not exists attention_merge_candidates_candidate_idx
on public.attention_merge_candidates(candidate_cluster_id, status, match_score desc);

create index if not exists attention_merge_candidates_source_cluster_idx
on public.attention_merge_candidates(source_cluster_id, status);

drop trigger if exists attention_merge_candidates_set_updated_at on public.attention_merge_candidates;
create trigger attention_merge_candidates_set_updated_at
before update on public.attention_merge_candidates
for each row execute function public.set_updated_at();

create table if not exists public.attention_aliases (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.attention_clusters(id) on delete cascade,
  alias text not null,
  language public.supported_language,
  source text not null default 'system' check (source in ('user', 'llm', 'admin', 'system', 'external')),
  created_at timestamptz not null default now(),
  unique(cluster_id, alias)
);

create index if not exists attention_aliases_alias_idx
on public.attention_aliases(alias);

create table if not exists public.attention_source_ledger (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.attention_sources(id) on delete cascade,
  cluster_id uuid not null references public.attention_clusters(id) on delete cascade,
  creator_id uuid references public.profiles(id),
  pre_merge_post_count integer not null default 0,
  pre_merge_comment_count integer not null default 0,
  pre_merge_revenue_weight numeric not null default 0,
  pre_merge_energy_weight numeric not null default 0,
  merge_snapshot_at timestamptz,
  created_at timestamptz not null default now(),
  unique(source_id)
);

create table if not exists public.attention_activity_ledger (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.attention_clusters(id) on delete cascade,
  source_id uuid references public.attention_sources(id) on delete set null,
  user_id uuid references public.profiles(id),
  activity_type public.attention_activity_type not null,
  revenue_amount numeric not null default 0,
  revenue_currency text,
  mom_energy numeric not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists attention_activity_ledger_cluster_idx
on public.attention_activity_ledger(cluster_id, created_at desc);

create index if not exists attention_activity_ledger_user_idx
on public.attention_activity_ledger(user_id, created_at desc);

create table if not exists public.attention_synergy_allocations (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.attention_clusters(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  total_synergy_revenue numeric not null default 0,
  total_synergy_energy numeric not null default 0,
  allocation_method text not null default 'source_activity_weighted',
  allocated_to_user_id uuid references public.profiles(id),
  allocated_to_source_id uuid references public.attention_sources(id),
  allocation_ratio numeric not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (allocated_to_user_id is not null or allocated_to_source_id is not null)
);

create index if not exists attention_synergy_allocations_cluster_period_idx
on public.attention_synergy_allocations(cluster_id, period_start, period_end);

alter table public.attention_clusters enable row level security;
alter table public.attention_sources enable row level security;
alter table public.attention_merge_candidates enable row level security;
alter table public.attention_aliases enable row level security;
alter table public.attention_source_ledger enable row level security;
alter table public.attention_activity_ledger enable row level security;
alter table public.attention_synergy_allocations enable row level security;

drop policy if exists "attention clusters are publicly readable" on public.attention_clusters;
create policy "attention clusters are publicly readable"
on public.attention_clusters for select
using (status in ('active', 'reviewing', 'merged'));

drop policy if exists "users can create attention clusters" on public.attention_clusters;
create policy "users can create attention clusters"
on public.attention_clusters for insert
with check (auth.uid() = created_by);

drop policy if exists "users can update own attention clusters" on public.attention_clusters;
create policy "users can update own attention clusters"
on public.attention_clusters for update
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

drop policy if exists "attention sources are publicly readable" on public.attention_sources;
create policy "attention sources are publicly readable"
on public.attention_sources for select
using (true);

drop policy if exists "users can create attention sources" on public.attention_sources;
create policy "users can create attention sources"
on public.attention_sources for insert
with check (auth.uid() = imported_by);

drop policy if exists "attention merge candidates are publicly readable" on public.attention_merge_candidates;
create policy "attention merge candidates are publicly readable"
on public.attention_merge_candidates for select
using (status = 'pending');

drop policy if exists "users can create attention merge candidates" on public.attention_merge_candidates;
create policy "users can create attention merge candidates"
on public.attention_merge_candidates for insert
with check (auth.uid() = created_by);

drop policy if exists "attention aliases are publicly readable" on public.attention_aliases;
create policy "attention aliases are publicly readable"
on public.attention_aliases for select
using (true);

drop policy if exists "source ledger is publicly readable" on public.attention_source_ledger;
create policy "source ledger is publicly readable"
on public.attention_source_ledger for select
using (true);

drop policy if exists "activity ledger is publicly readable" on public.attention_activity_ledger;
create policy "activity ledger is publicly readable"
on public.attention_activity_ledger for select
using (true);

drop policy if exists "synergy allocations are publicly readable" on public.attention_synergy_allocations;
create policy "synergy allocations are publicly readable"
on public.attention_synergy_allocations for select
using (true);

drop policy if exists "users can create events" on public.events;
create policy "users can create events"
on public.events for insert
with check (auth.uid() = created_by);

create or replace function public.normalize_attention_url(input_url text)
returns text
language sql
immutable
as $$
  select nullif(lower(regexp_replace(trim(input_url), '/+$', '')), '');
$$;

create or replace function public.slugify_attention(input_text text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input_text, 'attention')), '[^a-z0-9가-힣]+', '-', 'g'));
$$;

create or replace function public.create_native_attention(
  title text,
  description text default null,
  category text default null,
  resolution_criteria text default null,
  ends_at timestamptz default null,
  original_language public.supported_language default 'ko',
  merge_target_cluster_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  new_event_id uuid;
  target_cluster_id uuid;
  new_source_id uuid;
  clean_title text;
  generated_slug text;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  clean_title := nullif(trim(title), '');
  if clean_title is null then
    raise exception 'title_required';
  end if;

  generated_slug := public.slugify_attention(clean_title) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.events (
    slug,
    title,
    description,
    category,
    source_platform,
    original_language,
    status,
    resolution,
    ends_at,
    created_by
  )
  values (
    generated_slug,
    clean_title,
    description,
    category,
    'momment.',
    original_language,
    'draft',
    resolution_criteria,
    ends_at,
    current_user_id
  )
  returning id into new_event_id;

  if merge_target_cluster_id is null then
    insert into public.attention_clusters (
      canonical_event_id,
      slug,
      title,
      description,
      category,
      original_language,
      status,
      created_by
    )
    values (
      new_event_id,
      generated_slug,
      clean_title,
      description,
      category,
      original_language,
      'active',
      current_user_id
    )
    returning id into target_cluster_id;
  else
    target_cluster_id := merge_target_cluster_id;
  end if;

  insert into public.attention_sources (
    cluster_id,
    event_id,
    source_type,
    source_platform,
    title,
    description,
    rules_text,
    oracle_type,
    ends_at,
    raw_metadata,
    imported_by
  )
  values (
    target_cluster_id,
    new_event_id,
    'native',
    'momment.',
    clean_title,
    description,
    resolution_criteria,
    'aio_native',
    ends_at,
    jsonb_build_object('mode', 'create'),
    current_user_id
  )
  returning id into new_source_id;

  insert into public.attention_source_ledger (source_id, cluster_id, creator_id, pre_merge_energy_weight)
  values (new_source_id, target_cluster_id, current_user_id, 1)
  on conflict (source_id) do nothing;

  insert into public.attention_activity_ledger (cluster_id, source_id, user_id, activity_type, mom_energy, metadata)
  values (target_cluster_id, new_source_id, current_user_id, 'source_create', 5, jsonb_build_object('mode', 'create'));

  insert into public.attention_aliases (cluster_id, alias, language, source)
  values (target_cluster_id, clean_title, original_language, 'user')
  on conflict do nothing;

  insert into public.attention_rules (
    event_id,
    title,
    question,
    resolution_criteria,
    source_requirements,
    oracle_config,
    status,
    created_by
  )
  values (
    new_event_id,
    clean_title,
    clean_title,
    coalesce(nullif(trim(resolution_criteria), ''), 'AIO evidence and official sources are required for final resolution.'),
    jsonb_build_object('mode', 'aio_native', 'min_sources', 1),
    jsonb_build_object('oracle_mode', 'aio_native'),
    'draft',
    current_user_id
  )
  on conflict (event_id) do nothing;

  update public.attention_clusters
  set source_count = (
    select count(*) from public.attention_sources
    where cluster_id = target_cluster_id
  )
  where id = target_cluster_id;

  return target_cluster_id;
end;
$$;

create or replace function public.import_attention_source(
  source_url text,
  source_platform text,
  title text,
  description text default null,
  category text default null,
  rules_text text default null,
  oracle_type text default null,
  resolver_address text default null,
  external_market_id text default null,
  reference_signal numeric default null,
  reference_signal_label text default null,
  ends_at timestamptz default null,
  raw_metadata jsonb default '{}'::jsonb,
  merge_target_cluster_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  clean_title text;
  normalized_url text;
  source_kind public.attention_source_type;
  new_event_id uuid;
  target_cluster_id uuid;
  new_source_id uuid;
  generated_slug text;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  normalized_url := public.normalize_attention_url(source_url);
  if normalized_url is null then
    raise exception 'source_url_required';
  end if;

  clean_title := coalesce(nullif(trim(title), ''), source_platform || ' attention');
  generated_slug := public.slugify_attention(clean_title) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  source_kind := case lower(coalesce(source_platform, 'other'))
    when 'polymarket' then 'polymarket'::public.attention_source_type
    when 'kalshi' then 'kalshi'::public.attention_source_type
    when 'manifold' then 'manifold'::public.attention_source_type
    when 'predictit' then 'predictit'::public.attention_source_type
    when 'news' then 'news'::public.attention_source_type
    when 'official' then 'official'::public.attention_source_type
    else 'other'::public.attention_source_type
  end;

  if merge_target_cluster_id is null then
    insert into public.events (
      slug,
      title,
      description,
      category,
      source_platform,
      source_url,
      external_market_id,
      status,
      resolution,
      ends_at,
      created_by
    )
    values (
      generated_slug,
      clean_title,
      description,
      category,
      source_platform,
      normalized_url,
      external_market_id,
      'draft',
      rules_text,
      ends_at,
      current_user_id
    )
    returning id into new_event_id;

    insert into public.attention_clusters (
      canonical_event_id,
      slug,
      title,
      description,
      category,
      status,
      created_by
    )
    values (
      new_event_id,
      generated_slug,
      clean_title,
      description,
      category,
      'active',
      current_user_id
    )
    returning id into target_cluster_id;
  else
    target_cluster_id := merge_target_cluster_id;
  end if;

  insert into public.attention_sources (
    cluster_id,
    event_id,
    source_type,
    source_platform,
    source_url,
    canonical_url,
    external_market_id,
    title,
    description,
    rules_text,
    oracle_type,
    resolver_address,
    reference_signal,
    reference_signal_label,
    ends_at,
    raw_metadata,
    imported_by
  )
  values (
    target_cluster_id,
    new_event_id,
    source_kind,
    source_platform,
    source_url,
    normalized_url,
    external_market_id,
    clean_title,
    description,
    rules_text,
    oracle_type,
    resolver_address,
    reference_signal,
    reference_signal_label,
    ends_at,
    coalesce(raw_metadata, '{}'::jsonb),
    current_user_id
  )
  on conflict (source_type, canonical_url) do update
  set
    cluster_id = excluded.cluster_id,
    title = excluded.title,
    description = excluded.description,
    rules_text = excluded.rules_text,
    oracle_type = excluded.oracle_type,
    resolver_address = excluded.resolver_address,
    reference_signal = excluded.reference_signal,
    reference_signal_label = excluded.reference_signal_label,
    ends_at = excluded.ends_at,
    raw_metadata = excluded.raw_metadata,
    updated_at = now()
  returning id into new_source_id;

  insert into public.attention_source_ledger (source_id, cluster_id, creator_id, pre_merge_energy_weight)
  values (new_source_id, target_cluster_id, current_user_id, 1)
  on conflict (source_id) do nothing;

  insert into public.attention_activity_ledger (cluster_id, source_id, user_id, activity_type, mom_energy, metadata)
  values (target_cluster_id, new_source_id, current_user_id, 'source_import', 3, jsonb_build_object('platform', source_platform));

  insert into public.attention_aliases (cluster_id, alias, source)
  values (target_cluster_id, clean_title, 'external')
  on conflict do nothing;

  update public.attention_clusters
  set source_count = (
    select count(*) from public.attention_sources
    where cluster_id = target_cluster_id
  )
  where id = target_cluster_id;

  return target_cluster_id;
end;
$$;

grant execute on function public.create_native_attention(text, text, text, text, timestamptz, public.supported_language, uuid) to authenticated;
grant execute on function public.import_attention_source(text, text, text, text, text, text, text, text, text, numeric, text, timestamptz, jsonb, uuid) to authenticated;
