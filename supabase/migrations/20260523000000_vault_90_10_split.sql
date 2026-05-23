-- =============================================================================
-- momment. Vault 90/10 Split
-- =============================================================================
-- Changes:
--   1. Vault distributable = vault_usd × 0.90 (for user distribution)
--   2. Operations reserve  = vault_usd × 0.10 (AI models, servers, etc.)
--   3. Rate now based on distributable, not total vault
--   4. get_mom_rate() updated accordingly
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Update get_mom_rate() to use 90% of vault for rate calc
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_mom_rate()
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vault_revenue numeric;
  v_total_withdrawn numeric;
  v_vault_usd numeric;
  v_distributable_usd numeric;
  v_total_supply numeric;
  v_rate numeric;
  c_distribution_pct numeric := 0.90;  -- 90% to users
BEGIN
  -- Total revenue in vault
  SELECT COALESCE(SUM(gross_amount * vault_share_rate), 0)
  INTO v_vault_revenue
  FROM public.platform_revenue_ledger
  WHERE status = 'posted';

  -- Total withdrawn (completed + processing)
  SELECT COALESCE(SUM(usd_amount), 0)
  INTO v_total_withdrawn
  FROM public.withdrawal_requests
  WHERE status IN ('completed', 'processing');

  -- Net vault balance
  v_vault_usd := GREATEST(v_vault_revenue - v_total_withdrawn, 0);

  -- Distributable portion (90%)
  v_distributable_usd := v_vault_usd * c_distribution_pct;

  -- Total MOM supply
  SELECT COALESCE(SUM(mom_energy), 0)
  INTO v_total_supply
  FROM public.profiles
  WHERE mom_energy > 0;

  -- Calculate rate based on distributable (not total vault)
  IF v_total_supply > 0 THEN
    v_rate := v_distributable_usd / v_total_supply;
  ELSE
    v_rate := 0;
  END IF;

  RETURN GREATEST(v_rate, 0.001);  -- MIN_RATE floor: 1 MOM = $0.001
END;
$$;

COMMENT ON FUNCTION public.get_mom_rate() IS
'Returns the current dynamic MOM rate: (vault_usd × 0.90) / total_mom_supply. 90% is distributable to users, 10% reserved for operations. Floor: $0.001.';


-- ─────────────────────────────────────────────────────────────
-- 2. Update platform_vault_overview with 90/10 columns
-- ─────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.platform_vault_overview;

CREATE OR REPLACE VIEW public.platform_vault_overview AS
WITH vault AS (
  SELECT
    COALESCE(SUM(gross_amount * vault_share_rate) FILTER (WHERE status = 'posted'), 0) AS total_revenue_usd,
    COALESCE(COUNT(*) FILTER (WHERE status = 'posted'), 0)::integer AS posted_entry_count,
    MAX(updated_at) AS updated_at
  FROM public.platform_revenue_ledger
),
withdrawals AS (
  SELECT
    COALESCE(SUM(usd_amount) FILTER (WHERE status IN ('completed', 'processing')), 0) AS total_withdrawn_usd,
    COALESCE(SUM(usd_amount) FILTER (WHERE status IN ('queued', 'processing')), 0) AS pending_withdrawal_usd
  FROM public.withdrawal_requests
),
supply AS (
  SELECT COALESCE(SUM(mom_energy), 0) AS total_mom_supply
  FROM public.profiles
  WHERE mom_energy > 0
)
SELECT
  GREATEST(vault.total_revenue_usd - withdrawals.total_withdrawn_usd, 0)::numeric AS vault_usd,
  -- 90/10 split
  ROUND(GREATEST(vault.total_revenue_usd - withdrawals.total_withdrawn_usd, 0) * 0.90, 2)::numeric AS distributable_usd,
  ROUND(GREATEST(vault.total_revenue_usd - withdrawals.total_withdrawn_usd, 0) * 0.10, 2)::numeric AS operations_usd,
  90::integer AS distribution_pct,
  10::integer AS operations_pct,
  -- Supply & rate
  supply.total_mom_supply::numeric AS total_mom_supply,
  GREATEST(
    CASE WHEN supply.total_mom_supply > 0
      THEN GREATEST(vault.total_revenue_usd - withdrawals.total_withdrawn_usd, 0) * 0.90 / supply.total_mom_supply
      ELSE 0.001
    END,
    0.001
  )::numeric AS current_rate,
  -- Withdrawal tracking
  withdrawals.total_withdrawn_usd::numeric AS total_withdrawn_usd,
  withdrawals.pending_withdrawal_usd::numeric AS pending_withdrawal_usd,
  vault.posted_entry_count,
  vault.updated_at,
  -- Legacy compat
  GREATEST(vault.total_revenue_usd - withdrawals.total_withdrawn_usd, 0)::numeric AS cumulative_energy,
  0::numeric AS monthly_energy,
  withdrawals.total_withdrawn_usd::numeric AS distributed_energy,
  date_trunc('month', now())::date AS current_month,
  (date_trunc('month', now()) + interval '1 month')::date AS next_distribution_date
FROM vault
CROSS JOIN withdrawals
CROSS JOIN supply;

GRANT SELECT ON public.platform_vault_overview TO anon, authenticated;

COMMENT ON VIEW public.platform_vault_overview IS
'Public vault stats with 90/10 split: vault_usd (total), distributable_usd (90% for users), operations_usd (10% for platform ops). Rate = distributable_usd / total_supply.';

COMMIT;
