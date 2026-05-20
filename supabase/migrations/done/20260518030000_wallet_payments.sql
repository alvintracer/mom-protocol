-- Wallet connection enhancements + payments table for NOWPayments integration

-- Add label column to wallets if not exists
alter table public.wallets
add column if not exists label text;

-- Create payments table for NOWPayments-based MOM Energy purchases
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'nowpayments' check (provider in ('nowpayments')),
  provider_payment_id text,
  provider_invoice_id text,
  amount_fiat numeric not null default 0,
  fiat_currency text not null default 'USD',
  pay_currency text,
  pay_amount numeric,
  mom_energy_amount numeric not null default 0,
  status text not null default 'pending' check (
    status in ('pending', 'confirming', 'confirmed', 'sending', 'finished', 'failed', 'refunded', 'expired')
  ),
  callback_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_provider_payment_id_idx on public.payments(provider_payment_id);
create index if not exists payments_status_idx on public.payments(status);

-- RLS for payments
alter table public.payments enable row level security;

drop policy if exists "users can read their own payments" on public.payments;
create policy "users can read their own payments"
on public.payments for select
using (auth.uid() = user_id);

-- Only service role can insert/update payments (via API route / IPN webhook)
-- No insert/update policy for authenticated users

-- Updated_at trigger for payments
drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

-- Function to credit MOM Energy when payment is confirmed
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

  -- Credit MOM Energy to user
  update public.profiles
  set
    mom_energy = mom_energy + target_payment.mom_energy_amount,
    updated_at = now()
  where id = target_payment.user_id;
end;
$$;

comment on table public.payments is
'Tracks NOWPayments-based crypto purchases of MOM Energy. Only the API/service role inserts rows; users can read their own.';

comment on function public.credit_mom_energy_for_payment(uuid) is
'Service-only function to credit MOM Energy after a NOWPayments payment reaches "finished" status.';
