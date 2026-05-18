-- momment. AIO protocol schema.
-- Run after:
-- 1) 20260516000000_initial_moment_schema.sql
-- 2) 20260516010000_attention_topics_and_discovery.sql
--
-- AIO is the momment. equivalent of market rules + optimistic oracle resolution:
-- Attention Rules define what can be resolved, AIO Assertions submit claims,
-- Evidence Lite captures proof, Multi-LLM verifies, challenges can dispute,
-- and final resolutions can later be sealed on chain.

do $$
begin
  create type public.aio_rule_status as enum ('draft', 'active', 'locked', 'retired');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.aio_assertion_status as enum (
    'draft',
    'submitted',
    'evidence_captured',
    'llm_verified',
    'challenge_period',
    'challenged',
    'finalized',
    'rejected',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.aio_verdict as enum ('supports', 'refutes', 'ambiguous', 'invalid_evidence');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.aio_challenge_status as enum (
    'submitted',
    'evidence_captured',
    'llm_verified',
    'accepted',
    'rejected',
    'escalated',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.aio_rule_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  category text,
  supported_outcomes text[] not null default array['yes', 'no', 'ambiguous'],
  default_challenge_period_seconds integer not null default 259200,
  default_min_evidence_count integer not null default 1,
  default_min_publisher_trust numeric not null default 0.1,
  default_bond_amount numeric not null default 0,
  default_bond_currency text not null default 'MOM_POINT',
  evidence_requirements jsonb not null default '{}',
  llm_policy jsonb not null default '{}',
  status public.aio_rule_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists aio_rule_templates_set_updated_at on public.aio_rule_templates;
create trigger aio_rule_templates_set_updated_at
before update on public.aio_rule_templates
for each row execute function public.set_updated_at();

create table if not exists public.attention_rules (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  template_id uuid references public.aio_rule_templates(id) on delete set null,
  title text not null,
  question text not null,
  resolution_criteria text not null,
  supported_outcomes text[] not null default array['yes', 'no', 'ambiguous'],
  evidence_requirements jsonb not null default '{}',
  source_requirements jsonb not null default '{}',
  challenge_period_seconds integer not null default 259200,
  min_evidence_count integer not null default 1,
  min_publisher_trust numeric not null default 0.1,
  bond_amount numeric not null default 0,
  bond_currency text not null default 'MOM_POINT',
  oracle_config jsonb not null default '{}',
  prompt_version text,
  prompt_hash text,
  status public.aio_rule_status not null default 'draft',
  locked_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id)
);

create index if not exists attention_rules_event_idx on public.attention_rules(event_id);

drop trigger if exists attention_rules_set_updated_at on public.attention_rules;
create trigger attention_rules_set_updated_at
before update on public.attention_rules
for each row execute function public.set_updated_at();

create table if not exists public.publisher_registry (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  publisher_name text not null,
  tier integer not null default 4,
  trust_weight numeric not null default 0.1,
  country_code text,
  category text,
  is_official_source boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists publisher_registry_set_updated_at on public.publisher_registry;
create trigger publisher_registry_set_updated_at
before update on public.publisher_registry
for each row execute function public.set_updated_at();

create table if not exists public.aio_assertions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  rule_id uuid not null references public.attention_rules(id) on delete cascade,
  proposer_id uuid not null references public.profiles(id) on delete cascade,
  claim_text text not null,
  asserted_outcome text not null,
  original_language public.supported_language not null default 'ko',
  status public.aio_assertion_status not null default 'submitted',
  bond_amount numeric not null default 0,
  bond_currency text not null default 'MOM_POINT',
  evidence_bundle_hash text,
  llm_bundle_hash text,
  aggregate_verdict public.aio_verdict,
  aggregate_confidence numeric,
  challenge_ends_at timestamptz,
  finalized_outcome text,
  onchain_tx_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aio_assertions_event_idx on public.aio_assertions(event_id, created_at desc);
create index if not exists aio_assertions_status_idx on public.aio_assertions(status, created_at asc);

drop trigger if exists aio_assertions_set_updated_at on public.aio_assertions;
create trigger aio_assertions_set_updated_at
before update on public.aio_assertions
for each row execute function public.set_updated_at();

create table if not exists public.aio_evidence_items (
  id uuid primary key default gen_random_uuid(),
  assertion_id uuid not null references public.aio_assertions(id) on delete cascade,
  submitted_by uuid references public.profiles(id) on delete set null,
  url text not null,
  canonical_url text,
  title text,
  publisher text,
  publisher_domain text,
  publisher_trust_weight numeric,
  published_at timestamptz,
  captured_at timestamptz not null default now(),
  content_hash text,
  metadata_hash text,
  screenshot_url text,
  thumbnail_url text,
  capture_node_signature text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists aio_evidence_items_assertion_idx on public.aio_evidence_items(assertion_id);
create index if not exists aio_evidence_items_domain_idx on public.aio_evidence_items(publisher_domain);

create table if not exists public.aio_llm_verifications (
  id uuid primary key default gen_random_uuid(),
  assertion_id uuid not null references public.aio_assertions(id) on delete cascade,
  evidence_item_id uuid references public.aio_evidence_items(id) on delete cascade,
  model_id text not null,
  provider text not null,
  prompt_version text not null,
  prompt_hash text not null,
  input_hash text not null,
  output_hash text not null,
  full_trace_uri text,
  verdict public.aio_verdict not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 100),
  reasoning_summary text,
  raw_output jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists aio_llm_verifications_assertion_idx
on public.aio_llm_verifications(assertion_id);

create table if not exists public.aio_challenges (
  id uuid primary key default gen_random_uuid(),
  assertion_id uuid not null references public.aio_assertions(id) on delete cascade,
  challenger_id uuid not null references public.profiles(id) on delete cascade,
  counter_claim_text text not null,
  counter_outcome text,
  original_language public.supported_language not null default 'ko',
  status public.aio_challenge_status not null default 'submitted',
  bond_amount numeric not null default 0,
  bond_currency text not null default 'MOM_POINT',
  evidence_bundle_hash text,
  llm_bundle_hash text,
  aggregate_verdict public.aio_verdict,
  aggregate_confidence numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aio_challenges_assertion_idx on public.aio_challenges(assertion_id);

drop trigger if exists aio_challenges_set_updated_at on public.aio_challenges;
create trigger aio_challenges_set_updated_at
before update on public.aio_challenges
for each row execute function public.set_updated_at();

create table if not exists public.aio_resolutions (
  id uuid primary key default gen_random_uuid(),
  assertion_id uuid not null references public.aio_assertions(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  final_outcome text not null,
  resolution_text text not null,
  resolution_hash text,
  evidence_bundle_hash text,
  llm_bundle_hash text,
  challenge_summary jsonb not null default '{}',
  resolved_by text not null default 'aio_protocol',
  onchain_tx_hash text,
  finalized_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(assertion_id)
);

create index if not exists aio_resolutions_event_idx on public.aio_resolutions(event_id);

alter table public.aio_rule_templates enable row level security;
alter table public.attention_rules enable row level security;
alter table public.publisher_registry enable row level security;
alter table public.aio_assertions enable row level security;
alter table public.aio_evidence_items enable row level security;
alter table public.aio_llm_verifications enable row level security;
alter table public.aio_challenges enable row level security;
alter table public.aio_resolutions enable row level security;

drop policy if exists "aio rule templates are publicly readable" on public.aio_rule_templates;
create policy "aio rule templates are publicly readable"
on public.aio_rule_templates for select
using (status = 'active');

drop policy if exists "attention rules are publicly readable" on public.attention_rules;
create policy "attention rules are publicly readable"
on public.attention_rules for select
using (status in ('active', 'locked', 'retired'));

drop policy if exists "users can create attention rules" on public.attention_rules;
create policy "users can create attention rules"
on public.attention_rules for insert
with check (auth.uid() = created_by);

drop policy if exists "publisher registry is publicly readable" on public.publisher_registry;
create policy "publisher registry is publicly readable"
on public.publisher_registry for select
using (true);

drop policy if exists "aio assertions are publicly readable" on public.aio_assertions;
create policy "aio assertions are publicly readable"
on public.aio_assertions for select
using (true);

drop policy if exists "users can submit their own aio assertions" on public.aio_assertions;
create policy "users can submit their own aio assertions"
on public.aio_assertions for insert
with check (auth.uid() = proposer_id);

drop policy if exists "aio evidence is publicly readable" on public.aio_evidence_items;
create policy "aio evidence is publicly readable"
on public.aio_evidence_items for select
using (true);

drop policy if exists "users can submit aio evidence" on public.aio_evidence_items;
create policy "users can submit aio evidence"
on public.aio_evidence_items for insert
with check (auth.uid() = submitted_by);

drop policy if exists "aio llm verifications are publicly readable" on public.aio_llm_verifications;
create policy "aio llm verifications are publicly readable"
on public.aio_llm_verifications for select
using (true);

drop policy if exists "aio challenges are publicly readable" on public.aio_challenges;
create policy "aio challenges are publicly readable"
on public.aio_challenges for select
using (true);

drop policy if exists "users can submit their own aio challenges" on public.aio_challenges;
create policy "users can submit their own aio challenges"
on public.aio_challenges for insert
with check (auth.uid() = challenger_id);

drop policy if exists "aio resolutions are publicly readable" on public.aio_resolutions;
create policy "aio resolutions are publicly readable"
on public.aio_resolutions for select
using (true);
