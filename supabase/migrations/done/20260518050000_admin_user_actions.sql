-- Admin user action audit ledger.

create table if not exists public.admin_user_actions (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  action_type text not null check (
    action_type in (
      'mom_energy_adjustment',
      'profile_note',
      'profile_update'
    )
  ),
  mom_energy_delta numeric,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_user_actions_target_user_idx
on public.admin_user_actions(target_user_id, created_at desc);

alter table public.admin_user_actions enable row level security;

drop policy if exists "admin user actions are not directly public" on public.admin_user_actions;
create policy "admin user actions are not directly public"
on public.admin_user_actions for select
using (false);

comment on table public.admin_user_actions is
'Service-role audit log for admin user operations such as MOM Energy adjustments.';
