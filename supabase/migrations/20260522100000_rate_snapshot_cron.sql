-- ============================================================
-- Daily Rate Snapshot Cron Job
-- Runs snapshot_mom_rate() every day at 00:05 UTC
-- ============================================================

-- Enable pg_cron extension (Supabase has this available)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily snapshot at 00:05 UTC
SELECT cron.schedule(
  'daily-rate-snapshot',        -- job name
  '5 0 * * *',                  -- every day at 00:05 UTC
  $$SELECT public.snapshot_mom_rate()$$
);

-- Backfill missing dates (5/21, 5/22) from current vault data
DO $$
DECLARE
  v_rate numeric;
  v_vault_usd numeric;
  v_total_supply numeric;
  d date;
BEGIN
  SELECT vault_usd, total_mom_supply, current_rate
  INTO v_vault_usd, v_total_supply, v_rate
  FROM public.platform_vault_overview;

  FOR d IN SELECT generate_series('2026-05-21'::date, CURRENT_DATE, '1 day')::date
  LOOP
    INSERT INTO public.platform_rate_history (
      snapshot_date, vault_usd, total_mom_supply, mom_rate
    ) VALUES (
      d, v_vault_usd, v_total_supply, v_rate
    )
    ON CONFLICT (snapshot_date) DO NOTHING;
  END LOOP;
END;
$$;
