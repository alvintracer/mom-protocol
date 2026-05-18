-- momment. AIO adaptive Multi-LLM metadata.
-- Adds the explicit insufficient_evidence verdict and aggregate metadata fields
-- used by the Gemini/GPT first-pass + Claude tie-breaker Edge Function.
-- Run after: 20260517090000_aio_challenge_mvp_guardrails.sql

do $$
begin
  begin
    alter type public.aio_verdict add value if not exists 'insufficient_evidence';
  exception when others then null;
  end;
end $$;

alter table public.aio_assertions
add column if not exists aggregate_metadata jsonb not null default '{}'::jsonb;

alter table public.aio_challenges
add column if not exists aggregate_metadata jsonb not null default '{}'::jsonb;

comment on column public.aio_assertions.aggregate_metadata is
  'AIO aggregate verification metadata such as consensus_method, provider_count, tie_breaker_called, confidence threshold, and provider verdict summary.';

comment on column public.aio_challenges.aggregate_metadata is
  'AIO challenge aggregate verification metadata such as consensus_method, provider_count, tie_breaker_called, confidence threshold, and provider verdict summary.';

