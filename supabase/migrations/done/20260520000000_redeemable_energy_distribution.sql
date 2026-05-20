-- Redeemable energy system: vault distribution + withdrawal requests
-- Adds redeemable_energy to profiles, distribution history, and withdrawal request flow.

-- 1. Add redeemable_energy column to profiles
alter table public.profiles
add column if not exists redeemable_energy numeric not null default 0;

-- 2. Distribution history table
create table if not exists public.vault_distributions (
  id uuid primary key default gen_random_uuid(),
  distribution_month date not null,
  total_vault_energy numeric not null default 0,
  distribution_rate numeric not null default 0.5
    check (distribution_rate >= 0 and distribution_rate <= 1),
  distributed_energy numeric not null default 0,
  recipient_count integer not null default 0,
  status text not null default 'completed'
    check (status in ('draft', 'running', 'completed', 'cancelled')),
  distributed_by uuid references public.profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(distribution_month)
);

alter table public.vault_distributions enable row level security;

drop policy if exists "vault distributions are publicly readable" on public.vault_distributions;
create policy "vault distributions are publicly readable"
on public.vault_distributions for select using (true);

-- 3. Per-user distribution allocations
create table if not exists public.vault_distribution_allocations (
  id uuid primary key default gen_random_uuid(),
  distribution_id uuid not null references public.vault_distributions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_energy_at_snapshot numeric not null default 0,
  share_ratio numeric not null default 0,
  allocated_energy numeric not null default 0,
  created_at timestamptz not null default now(),
  unique(distribution_id, user_id)
);

alter table public.vault_distribution_allocations enable row level security;

drop policy if exists "users can read their own allocations" on public.vault_distribution_allocations;
create policy "users can read their own allocations"
on public.vault_distribution_allocations for select
using (auth.uid() = user_id);

-- 4. Withdrawal requests table
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  energy_amount numeric not null check (energy_amount >= 1000),
  usdc_amount numeric not null generated always as (energy_amount / 100) stored,
  wallet_address text not null,
  chain text not null default 'polygon',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'processing', 'completed', 'rejected')),
  tx_hash text,
  admin_note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists withdrawal_requests_set_updated_at on public.withdrawal_requests;
create trigger withdrawal_requests_set_updated_at
before update on public.withdrawal_requests
for each row execute function public.set_updated_at();

alter table public.withdrawal_requests enable row level security;

drop policy if exists "users can read their own withdrawals" on public.withdrawal_requests;
create policy "users can read their own withdrawals"
on public.withdrawal_requests for select
using (auth.uid() = user_id);

drop policy if exists "users can insert withdrawal requests" on public.withdrawal_requests;
create policy "users can insert withdrawal requests"
on public.withdrawal_requests for insert
with check (auth.uid() = user_id);

-- 5. Distribute vault energy to users based on activity share
create or replace function public.distribute_vault_energy(
  p_distribution_rate numeric default 0.5,
  p_min_energy numeric default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', now())::date;
  v_vault_energy numeric;
  v_distributable numeric;
  v_total_user_energy numeric;
  v_recipient_count integer;
  v_dist_id uuid;
begin
  -- Get current vault energy
  select coalesce(cumulative_energy, 0)
  into v_vault_energy
  from public.platform_vault_overview;

  if v_vault_energy <= 0 then
    return jsonb_build_object('error', 'no_vault_energy', 'vault_energy', 0);
  end if;

  v_distributable := v_vault_energy * p_distribution_rate;

  -- Get total user energy (only users with minimum threshold)
  select coalesce(sum(mom_energy), 0), count(*)
  into v_total_user_energy, v_recipient_count
  from public.profiles
  where mom_energy >= p_min_energy;

  if v_total_user_energy <= 0 or v_recipient_count = 0 then
    return jsonb_build_object('error', 'no_eligible_users');
  end if;

  -- Create distribution record
  insert into public.vault_distributions (
    distribution_month,
    total_vault_energy,
    distribution_rate,
    distributed_energy,
    recipient_count
  ) values (
    v_month,
    v_vault_energy,
    p_distribution_rate,
    v_distributable,
    v_recipient_count
  )
  on conflict (distribution_month) do update set
    total_vault_energy = excluded.total_vault_energy,
    distribution_rate = excluded.distribution_rate,
    distributed_energy = excluded.distributed_energy,
    recipient_count = excluded.recipient_count
  returning id into v_dist_id;

  -- Allocate to each eligible user + credit redeemable_energy
  insert into public.vault_distribution_allocations (
    distribution_id, user_id, user_energy_at_snapshot, share_ratio, allocated_energy
  )
  select
    v_dist_id,
    p.id,
    p.mom_energy,
    p.mom_energy / v_total_user_energy,
    round((p.mom_energy / v_total_user_energy) * v_distributable, 2)
  from public.profiles p
  where p.mom_energy >= p_min_energy
  on conflict (distribution_id, user_id) do update set
    user_energy_at_snapshot = excluded.user_energy_at_snapshot,
    share_ratio = excluded.share_ratio,
    allocated_energy = excluded.allocated_energy;

  -- Credit redeemable_energy to each user
  update public.profiles p
  set
    redeemable_energy = redeemable_energy + sub.allocated_energy,
    updated_at = now()
  from (
    select user_id, allocated_energy
    from public.vault_distribution_allocations
    where distribution_id = v_dist_id
  ) sub
  where p.id = sub.user_id;

  return jsonb_build_object(
    'success', true,
    'distribution_id', v_dist_id,
    'vault_energy', v_vault_energy,
    'distributed', v_distributable,
    'recipients', v_recipient_count,
    'month', v_month
  );
end;
$$;

revoke all on function public.distribute_vault_energy(numeric, numeric) from public;
grant execute on function public.distribute_vault_energy(numeric, numeric) to service_role;

-- 6. Submit withdrawal request (user-facing)
create or replace function public.request_withdrawal(
  p_energy_amount numeric,
  p_wallet_address text,
  p_chain text default 'polygon'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_redeemable numeric;
  v_pending_total numeric;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_energy_amount < 1000 then
    raise exception 'minimum_1000_energy_required';
  end if;

  -- Check available redeemable balance
  select redeemable_energy into v_current_redeemable
  from public.profiles where id = v_user_id;

  -- Subtract pending withdrawals
  select coalesce(sum(energy_amount), 0) into v_pending_total
  from public.withdrawal_requests
  where user_id = v_user_id
    and status in ('pending', 'approved', 'processing');

  if (v_current_redeemable - v_pending_total) < p_energy_amount then
    raise exception 'insufficient_redeemable_energy';
  end if;

  insert into public.withdrawal_requests (
    user_id, energy_amount, wallet_address, chain
  ) values (
    v_user_id, p_energy_amount, p_wallet_address, p_chain
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

grant execute on function public.request_withdrawal(numeric, text, text) to authenticated;

comment on function public.distribute_vault_energy(numeric, numeric) is
'Admin-only: distribute vault energy to users proportionally based on their mom_energy. Creates redeemable_energy credits.';

comment on function public.request_withdrawal(numeric, text, text) is
'User-facing: submit a withdrawal request to convert redeemable_energy to USDC. Minimum 1000 MOM Energy ($10).';
