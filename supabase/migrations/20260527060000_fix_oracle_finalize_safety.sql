-- Fix: finalize_aio_assertion should only allow finalization when aggregate_verdict = 'supports'
-- Prevents wrong outcomes from being confirmed when LLM consensus is refute/insufficient/ambiguous

create or replace function public.finalize_aio_assertion(
  target_assertion_id uuid,
  outcome text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_assertion public.aio_assertions%rowtype;
  target_cluster public.attention_clusters%rowtype;
  reward_amount numeric := 0;
begin
  -- 1. Lock assertion
  select * into target_assertion 
  from public.aio_assertions 
  where id = target_assertion_id 
  for update;

  if target_assertion.id is null then
    raise exception 'assertion_not_found';
  end if;

  if target_assertion.status = 'finalized' then
    raise exception 'assertion_already_finalized';
  end if;

  -- SAFETY: Only allow finalization when LLM consensus supports the claim
  if target_assertion.status != 'challenge_period' then
    raise exception 'assertion_not_in_challenge_period: current status is %', target_assertion.status;
  end if;

  if target_assertion.aggregate_verdict is null or target_assertion.aggregate_verdict != 'supports' then
    raise exception 'cannot_finalize_without_support: aggregate_verdict is %', coalesce(target_assertion.aggregate_verdict, 'null');
  end if;

  -- 2. Find the associated attention cluster to calculate 5% reward
  select * into target_cluster 
  from public.attention_clusters 
  where canonical_event_id = target_assertion.event_id 
  limit 1;

  if target_cluster.id is null then
    -- fallback: look up via attention_sources
    select c.* into target_cluster
    from public.attention_clusters c
    join public.attention_sources s on s.cluster_id = c.id
    where s.event_id = target_assertion.event_id
    limit 1;
  end if;

  -- Calculate reward (5% of attention score, min 10 MOM)
  if target_cluster.id is not null then
    reward_amount := target_cluster.attention_score * 0.05;
  end if;

  if reward_amount < 10.0 then
    reward_amount := 10.0;
  end if;

  -- 3. Update assertion status
  update public.aio_assertions
  set
    status = 'finalized',
    finalized_outcome = outcome,
    finalized_at = now(),
    updated_at = now()
  where id = target_assertion_id;

  -- 4. Reward the proposer with MOM Energy and Trust Score
  update public.profiles
  set
    mom_energy = mom_energy + reward_amount,
    trust_score = trust_score + 0.5,
    updated_at = now()
  where id = target_assertion.proposer_id;
end;
$$;
