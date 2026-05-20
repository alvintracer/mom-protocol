-- Oracle Assertion 제출 시 5 MOM Energy 검증 비용 차감
-- 검증 확정(finalize) 시 보상을 받으므로, 제출 시에만 차감합니다.

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
begin
  -- 1. Auth check
  if caller_id is null then
    raise exception 'not_authenticated';
  end if;

  -- 2. Check caller's MOM Energy balance
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

  -- 3. Deduct verification cost
  update public.profiles
  set
    mom_energy = mom_energy - verification_cost,
    updated_at = now()
  where id = caller_id;

  -- 4. Insert assertion
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

grant execute on function public.submit_aio_assertion(uuid, uuid, text, text, public.supported_language) to authenticated;
revoke all on function public.submit_aio_assertion(uuid, uuid, text, text, public.supported_language) from public;

comment on function public.submit_aio_assertion is
'Submits an AIO assertion with 5 MOM Energy verification cost. Deducts energy from caller, creates assertion. Returns assertion ID.';
