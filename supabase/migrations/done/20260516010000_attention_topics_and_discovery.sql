-- momment. attention discovery, topics, hashtags, and trend tracking.
-- Run after 20260516000000_initial_moment_schema.sql.

do $$
begin
  create type public.topic_kind as enum ('user_hashtag', 'ai_keyword', 'entity', 'category', 'source_platform');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.topic_target_type as enum ('attention', 'post', 'comment', 'source');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.discovery_section_kind as enum ('breaking', 'popular_topic', 'category', 'external_source', 'ending_soon');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind public.topic_kind not null,
  canonical_label text not null,
  labels jsonb not null default '{}',
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists topics_set_updated_at on public.topics;
create trigger topics_set_updated_at
before update on public.topics
for each row execute function public.set_updated_at();

create table if not exists public.content_topics (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  target_type public.topic_target_type not null,
  target_id uuid not null,
  source text not null check (source in ('user', 'llm', 'admin', 'system')),
  confidence numeric,
  model text,
  created_at timestamptz not null default now(),
  unique(topic_id, target_type, target_id, source)
);

create index if not exists content_topics_target_idx
on public.content_topics(target_type, target_id);

create index if not exists content_topics_topic_idx
on public.content_topics(topic_id, created_at desc);

create table if not exists public.attention_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  source_platform text not null,
  source_url text not null,
  external_market_id text,
  title text,
  probability numeric,
  volume_label text,
  liquidity_label text,
  starts_at timestamptz,
  ends_at timestamptz,
  rules_url text,
  resolver_address text,
  oracle_type text,
  raw_metadata jsonb not null default '{}',
  captured_at timestamptz not null default now()
);

create index if not exists attention_source_snapshots_event_idx
on public.attention_source_snapshots(event_id, captured_at desc);

create index if not exists attention_source_snapshots_source_idx
on public.attention_source_snapshots(source_platform, external_market_id);

create table if not exists public.discovery_sections (
  id uuid primary key default gen_random_uuid(),
  kind public.discovery_section_kind not null,
  title text not null,
  subtitle text,
  topic_id uuid references public.topics(id) on delete set null,
  category text,
  source_platform text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists discovery_sections_set_updated_at on public.discovery_sections;
create trigger discovery_sections_set_updated_at
before update on public.discovery_sections
for each row execute function public.set_updated_at();

create table if not exists public.discovery_section_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.discovery_sections(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete cascade,
  score numeric not null default 0,
  reason text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique(section_id, event_id, topic_id)
);

create index if not exists discovery_section_items_section_idx
on public.discovery_section_items(section_id, score desc, sort_order asc);

create table if not exists public.topic_trend_snapshots (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  window_start timestamptz not null,
  window_end timestamptz not null,
  post_count integer not null default 0,
  comment_count integer not null default 0,
  attention_count integer not null default 0,
  score numeric not null default 0,
  created_at timestamptz not null default now(),
  unique(topic_id, window_start, window_end)
);

create index if not exists topic_trend_snapshots_window_idx
on public.topic_trend_snapshots(window_end desc, score desc);

alter table public.topics enable row level security;
alter table public.content_topics enable row level security;
alter table public.attention_source_snapshots enable row level security;
alter table public.discovery_sections enable row level security;
alter table public.discovery_section_items enable row level security;
alter table public.topic_trend_snapshots enable row level security;

drop policy if exists "topics are publicly readable" on public.topics;
create policy "topics are publicly readable"
on public.topics for select
using (true);

drop policy if exists "content topics are publicly readable" on public.content_topics;
create policy "content topics are publicly readable"
on public.content_topics for select
using (true);

drop policy if exists "attention source snapshots are publicly readable" on public.attention_source_snapshots;
create policy "attention source snapshots are publicly readable"
on public.attention_source_snapshots for select
using (true);

drop policy if exists "discovery sections are publicly readable" on public.discovery_sections;
create policy "discovery sections are publicly readable"
on public.discovery_sections for select
using (is_active = true);

drop policy if exists "discovery section items are publicly readable" on public.discovery_section_items;
create policy "discovery section items are publicly readable"
on public.discovery_section_items for select
using (true);

drop policy if exists "topic trend snapshots are publicly readable" on public.topic_trend_snapshots;
create policy "topic trend snapshots are publicly readable"
on public.topic_trend_snapshots for select
using (true);
