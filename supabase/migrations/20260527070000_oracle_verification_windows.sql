-- Fix: submit_aio_assertion should enforce verification window timing
-- Only allow assertion submission after event deadline (events.ends_at)
-- Builder-only window for first 12h, then open window for next 12h

create or replace function public.submit_aio_assertion(
  p_event_id uuid,
  p_rule_id uuid,
  p_claim_text text,
  p_asserted_outcome text,
  p_original_language public.supported_language default 'ko'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_energy numeric;
  verification_cost numeric := 5.0;
  new_assertion_id uuid;
  event_end_time timestamptz;
  target_rule public.attention_rules%rowtype;
  builder_window_sec int;
  open_window_sec int;
  builder_id uuid;
  builder_end_time timestamptz;
  open_end_time timestamptz;
begin
  -- 1. Auth check
  if caller_id is null then
    raise exception 'not_authenticated';
  end if;

  -- 2. Fetch rule and event deadline
  select * into target_rule
  from public.attention_rules
  where id = p_rule_id;

  if target_rule.id is null then
    raise exception 'rule_not_found';
  end if;

  -- Get event deadline
  select ends_at into event_end_time
  from public.events
  where id = p_event_id;

  -- 3. Enforce verification window timing (only if event has deadline)
  if event_end_time is not null then
    -- Must be past event deadline
    if now() < event_end_time then
      raise exception 'event_not_ended: verification opens after event deadline';
    end if;

    -- Calculate verification windows from oracle_config
    builder_window_sec := coalesce(
      (target_rule.oracle_config->>'builder_verification_window_seconds')::int,
      43200  -- 12 hours default
    );
    open_window_sec := coalesce(
      (target_rule.oracle_config->>'open_verification_window_seconds')::int,
      43200  -- 12 hours default
    );

    builder_end_time := event_end_time + (builder_window_sec || ' seconds')::interval;
    open_end_time := builder_end_time + (open_window_sec || ' seconds')::interval;

    -- Find the builder (attention cluster creator)
    select c.created_by into builder_id
    from public.attention_clusters c
    where c.canonical_event_id = p_event_id
    limit 1;

    -- During builder window, only builder can submit
    if now() < builder_end_time then
      if caller_id != coalesce(builder_id, '00000000-0000-0000-0000-000000000000'::uuid) then
        raise exception 'builder_verification_window: only the builder can submit during this period';
      end if;
    elsif now() >= open_end_time then
      -- Past all windows
      raise exception 'verification_window_closed: both verification windows have expired';
    end if;
    -- else: we're in open window, anyone can submit
  end if;

  -- 4. Check caller's MOM Energy balance
  select mom_energy into caller_energy
  from public.profiles
  where id = caller_id
  for update;

  if caller_energy is null then
    raise exception 'profile_not_found';
  end if;

  if caller_energy < verification_cost then
    raise exception 'insufficient_mom_energy';
  end if;

  -- 5. Deduct verification cost
  update public.profiles
  set
    mom_energy = mom_energy - verification_cost,
    updated_at = now()
  where id = caller_id;

  -- 6. Insert assertion
  insert into public.aio_assertions (
    event_id,
    rule_id,
    proposer_id,
    claim_text,
    asserted_outcome,
    original_language,
    bond_amount,
    bond_currency,
    status
  )
  values (
    p_event_id,
    p_rule_id,
    caller_id,
    p_claim_text,
    p_asserted_outcome,
    p_original_language,
    verification_cost,
    'MOM_POINT',
    'submitted'
  )
  returning id into new_assertion_id;

  return new_assertion_id;
end;
$$;
