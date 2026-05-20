-- Remove Trust Score check from AIO challenge submission.
-- Trust Score concept is deprecated; MOM Energy alone gates all actions.

create or replace function public.submit_aio_challenge(
  target_assertion_id uuid,
  counter_claim_text text,
  counter_outcome text default null,
  original_language public.supported_language default 'ko'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  challenger_profile public.profiles%rowtype;
  target_assertion public.aio_assertions%rowtype;
  challenge_id uuid;
  challenge_cost numeric := 25;
  minimum_mom_energy numeric := 100;
  minimum_account_age interval := interval '24 hours';
  max_daily_challenges integer := 5;
  recent_challenge_count integer;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if nullif(trim(counter_claim_text), '') is null then
    raise exception 'counter_claim_required';
  end if;

  select *
  into challenger_profile
  from public.profiles
  where id = current_user_id
  for update;

  if challenger_profile.id is null then
    raise exception 'profile_required';
  end if;

  if challenger_profile.created_at > now() - minimum_account_age then
    raise exception 'account_too_new';
  end if;

  -- Trust Score check removed (deprecated)

  if challenger_profile.mom_energy < minimum_mom_energy then
    raise exception 'mom_energy_too_low';
  end if;

  if challenger_profile.mom_energy < challenge_cost then
    raise exception 'challenge_cost_required';
  end if;

  select *
  into target_assertion
  from public.aio_assertions
  where id = target_assertion_id
  for update;

  if target_assertion.id is null then
    raise exception 'assertion_not_found';
  end if;

  if target_assertion.proposer_id = current_user_id then
    raise exception 'cannot_challenge_own_assertion';
  end if;

  if target_assertion.status not in ('challenge_period', 'challenged') then
    raise exception 'challenge_window_not_open';
  end if;

  if target_assertion.challenge_ends_at is not null and target_assertion.challenge_ends_at < now() then
    raise exception 'challenge_window_closed';
  end if;

  if exists (
    select 1
    from public.aio_challenges
    where assertion_id = target_assertion_id
      and challenger_id = current_user_id
      and status <> 'cancelled'
  ) then
    raise exception 'challenge_already_submitted';
  end if;

  select count(*)
  into recent_challenge_count
  from public.aio_challenges
  where challenger_id = current_user_id
    and created_at >= now() - interval '24 hours'
    and status <> 'cancelled';

  if recent_challenge_count >= max_daily_challenges then
    raise exception 'daily_challenge_limit_reached';
  end if;

  update public.profiles
  set
    mom_energy = greatest(mom_energy - challenge_cost, 0),
    updated_at = now()
  where id = current_user_id;

  insert into public.aio_challenges (
    assertion_id,
    challenger_id,
    counter_claim_text,
    counter_outcome,
    original_language,
    status,
    bond_amount,
    bond_currency,
    eligibility_snapshot
  )
  values (
    target_assertion_id,
    current_user_id,
    nullif(trim(counter_claim_text), ''),
    nullif(trim(counter_outcome), ''),
    original_language,
    'submitted',
    challenge_cost,
    'MOM_ENERGY',
    jsonb_build_object(
      'minimum_mom_energy', minimum_mom_energy,
      'minimum_account_age_hours', 24,
      'max_daily_challenges', max_daily_challenges,
      'challenger_mom_energy_before', challenger_profile.mom_energy,
      'challenge_cost', challenge_cost,
      'submitted_via', 'submit_aio_challenge'
    )
  )
  returning id into challenge_id;

  update public.aio_assertions
  set
    status = 'challenged',
    updated_at = now()
  where id = target_assertion_id;

  return challenge_id;
end;
$$;

-- Also remove Trust Score mutation from apply_aio_challenge_result
create or replace function public.apply_aio_challenge_result(
  target_challenge_id uuid,
  accepted boolean,
  result_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_challenge public.aio_challenges%rowtype;
  refund_amount numeric;
  reward_amount numeric;
begin
  select *
  into target_challenge
  from public.aio_challenges
  where id = target_challenge_id
  for update;

  if target_challenge.id is null then
    raise exception 'challenge_not_found';
  end if;

  if target_challenge.status in ('accepted', 'rejected', 'cancelled') then
    raise exception 'challenge_already_resolved';
  end if;

  refund_amount := target_challenge.bond_amount;
  reward_amount := target_challenge.bond_amount;

  if accepted then
    update public.aio_challenges
    set
      status = 'accepted',
      resolved_at = now(),
      resolution_note = result_note,
      updated_at = now()
    where id = target_challenge_id;

    -- Refund + reward MOM Energy only (Trust Score removed)
    update public.profiles
    set
      mom_energy = mom_energy + refund_amount + reward_amount,
      updated_at = now()
    where id = target_challenge.challenger_id;
  else
    update public.aio_challenges
    set
      status = 'rejected',
      resolved_at = now(),
      resolution_note = result_note,
      updated_at = now()
    where id = target_challenge_id;

    -- No penalty beyond lost bond (Trust Score removed)
  end if;
end;
$$;

comment on function public.submit_aio_challenge(uuid, text, text, public.supported_language) is
'Submits one AIO challenge after eligibility checks (MOM Energy only, Trust Score removed). Spends 25 MOM Energy as oracle-integrity bond.';

comment on function public.apply_aio_challenge_result(uuid, boolean, text) is
'Service/admin-only MVP resolver. Accepted challenges refund + reward MOM Energy; rejected challenges lose the spent bond. Trust Score mutation removed.';
