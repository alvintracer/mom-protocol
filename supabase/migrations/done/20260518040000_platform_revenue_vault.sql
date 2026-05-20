-- Platform revenue ledger and momment vault rollups.
-- All platform revenue that should feed the monthly vault is recorded here,
-- then exposed through aggregate views instead of client-side mock totals.

alter table public.payments
add column if not exists energy_credited_at timestamptz;

create table if not exists public.platform_revenue_ledger (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (
    source_type in (
      'nowpayments_energy_purchase',
      'adsense',
      'advertiser_direct',
      'creator_subscription',
      'attention_boost',
      'super_comment',
      'sponsor_campaign',
      'data_api',
      'manual_adjustment',
      'other'
    )
  ),
  source_id text,
  payment_id uuid references public.payments(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  gross_amount numeric not null default 0,
  currency text not null default 'USD',
  energy_amount numeric not null default 0,
  vault_share_rate numeric not null default 1 check (vault_share_rate >= 0 and vault_share_rate <= 1),
  vault_energy_amount numeric generated always as (energy_amount * vault_share_rate) stored,
  revenue_month date not null default date_trunc('month', now())::date,
  status text not null default 'posted' check (status in ('posted', 'pending', 'void')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists platform_revenue_ledger_payment_unique_idx
on public.platform_revenue_ledger(payment_id)
where payment_id is not null;

create index if not exists platform_revenue_ledger_month_idx
on public.platform_revenue_ledger(revenue_month, status);

create index if not exists platform_revenue_ledger_source_idx
on public.platform_revenue_ledger(source_type, revenue_month);

drop trigger if exists platform_revenue_ledger_set_updated_at on public.platform_revenue_ledger;
create trigger platform_revenue_ledger_set_updated_at
before update on public.platform_revenue_ledger
for each row execute function public.set_updated_at();

alter table public.platform_revenue_ledger enable row level security;

drop policy if exists "platform revenue ledger is not directly public" on public.platform_revenue_ledger;
create policy "platform revenue ledger is not directly public"
on public.platform_revenue_ledger for select
using (false);

create or replace view public.platform_vault_overview as
select
  coalesce(sum(vault_energy_amount) filter (where status = 'posted'), 0)::numeric as cumulative_energy,
  coalesce(
    sum(vault_energy_amount) filter (
      where status = 'posted'
        and revenue_month = date_trunc('month', now())::date
    ),
    0
  )::numeric as monthly_energy,
  coalesce(
    sum(vault_energy_amount) filter (
      where status = 'posted'
        and revenue_month < date_trunc('month', now())::date
    ),
    0
  )::numeric as distributed_energy,
  date_trunc('month', now())::date as current_month,
  (date_trunc('month', now()) + interval '1 month')::date as next_distribution_date,
  coalesce(count(*) filter (where status = 'posted'), 0)::integer as posted_entry_count,
  max(updated_at) as updated_at
from public.platform_revenue_ledger;

create or replace view public.platform_vault_source_mix_current as
with current_entries as (
  select
    source_type,
    sum(vault_energy_amount)::numeric as energy_amount
  from public.platform_revenue_ledger
  where status = 'posted'
    and revenue_month = date_trunc('month', now())::date
  group by source_type
),
total as (
  select coalesce(sum(energy_amount), 0)::numeric as total_energy
  from current_entries
)
select
  current_entries.source_type,
  current_entries.energy_amount,
  case
    when total.total_energy > 0 then round((current_entries.energy_amount / total.total_energy) * 100, 2)
    else 0
  end as percent
from current_entries
cross join total
order by current_entries.energy_amount desc;

grant select on public.platform_vault_overview to anon, authenticated;
grant select on public.platform_vault_source_mix_current to anon, authenticated;

create or replace function public.record_platform_revenue(
  p_source_type text,
  p_gross_amount numeric,
  p_currency text default 'USD',
  p_energy_amount numeric default null,
  p_vault_share_rate numeric default 1,
  p_source_id text default null,
  p_payment_id uuid default null,
  p_user_id uuid default null,
  p_revenue_month date default date_trunc('month', now())::date,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  normalized_energy numeric;
begin
  if p_gross_amount is null then
    raise exception 'gross_amount_required';
  end if;

  normalized_energy := coalesce(p_energy_amount, p_gross_amount * 100);

  insert into public.platform_revenue_ledger (
    source_type,
    source_id,
    payment_id,
    user_id,
    gross_amount,
    currency,
    energy_amount,
    vault_share_rate,
    revenue_month,
    metadata
  )
  values (
    p_source_type,
    p_source_id,
    p_payment_id,
    p_user_id,
    p_gross_amount,
    coalesce(nullif(upper(p_currency), ''), 'USD'),
    normalized_energy,
    coalesce(p_vault_share_rate, 1),
    coalesce(p_revenue_month, date_trunc('month', now())::date),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (payment_id) where payment_id is not null do update
  set
    source_type = excluded.source_type,
    source_id = excluded.source_id,
    user_id = excluded.user_id,
    gross_amount = excluded.gross_amount,
    currency = excluded.currency,
    energy_amount = excluded.energy_amount,
    vault_share_rate = excluded.vault_share_rate,
    revenue_month = excluded.revenue_month,
    status = 'posted',
    metadata = public.platform_revenue_ledger.metadata || excluded.metadata,
    updated_at = now()
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.record_platform_revenue(text, numeric, text, numeric, numeric, text, uuid, uuid, date, jsonb) from public;
grant execute on function public.record_platform_revenue(text, numeric, text, numeric, numeric, text, uuid, uuid, date, jsonb) to service_role;

create or replace function public.credit_mom_energy_for_payment(
  target_payment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_payment public.payments%rowtype;
begin
  select *
  into target_payment
  from public.payments
  where id = target_payment_id
  for update;

  if target_payment.id is null then
    raise exception 'payment_not_found';
  end if;

  if target_payment.status <> 'finished' then
    raise exception 'payment_not_finished';
  end if;

  if target_payment.energy_credited_at is null then
    update public.profiles
    set
      mom_energy = mom_energy + target_payment.mom_energy_amount,
      updated_at = now()
    where id = target_payment.user_id;

    update public.payments
    set energy_credited_at = now()
    where id = target_payment.id;
  end if;

  perform public.record_platform_revenue(
    'nowpayments_energy_purchase',
    target_payment.amount_fiat,
    target_payment.fiat_currency,
    target_payment.mom_energy_amount,
    1,
    coalesce(target_payment.provider_payment_id, target_payment.provider_invoice_id),
    target_payment.id,
    target_payment.user_id,
    date_trunc('month', coalesce(target_payment.updated_at, target_payment.created_at))::date,
    jsonb_build_object(
      'provider', target_payment.provider,
      'provider_payment_id', target_payment.provider_payment_id,
      'provider_invoice_id', target_payment.provider_invoice_id,
      'pay_currency', target_payment.pay_currency,
      'pay_amount', target_payment.pay_amount
    )
  );
end;
$$;

comment on table public.platform_revenue_ledger is
'Append-only-ish platform revenue ledger. NOWPayments, AdSense, direct advertiser deposits, and manual revenue entries are normalized into MOM Energy for momment vault rollups.';

comment on view public.platform_vault_overview is
'Public aggregate vault stats derived from platform_revenue_ledger.';

comment on view public.platform_vault_source_mix_current is
'Public current-month vault source mix derived from platform_revenue_ledger.';

comment on function public.record_platform_revenue(text, numeric, text, numeric, numeric, text, uuid, uuid, date, jsonb) is
'Service-only helper for recording platform revenue into the momment vault ledger. Defaults to 1 USD = 100 MOM Energy when energy_amount is omitted.';

-- Backfill finished NOWPayments rows into the vault ledger without re-crediting users.
insert into public.platform_revenue_ledger (
  source_type,
  source_id,
  payment_id,
  user_id,
  gross_amount,
  currency,
  energy_amount,
  vault_share_rate,
  revenue_month,
  metadata,
  created_at,
  updated_at
)
select
  'nowpayments_energy_purchase',
  coalesce(provider_payment_id, provider_invoice_id),
  id,
  user_id,
  amount_fiat,
  fiat_currency,
  mom_energy_amount,
  1,
  date_trunc('month', updated_at)::date,
  jsonb_build_object(
    'provider', provider,
    'provider_payment_id', provider_payment_id,
    'provider_invoice_id', provider_invoice_id,
    'backfilled', true
  ),
  created_at,
  updated_at
from public.payments
where status = 'finished'
on conflict (payment_id) where payment_id is not null do nothing;
