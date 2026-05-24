-- Add finalized_at column to aio_assertions (referenced by finalize_aio_assertion RPC)
alter table public.aio_assertions
  add column if not exists finalized_at timestamptz;
