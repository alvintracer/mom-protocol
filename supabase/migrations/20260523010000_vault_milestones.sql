-- =============================================================================
-- momment. Vault Milestones + USD-based Withdrawal Limits
-- =============================================================================
-- 1. vault_milestones config table
-- 2. get_vault_milestone() helper
-- 3. Updated request_withdrawal() with milestone-based limits (USD)
-- 4. Initial capital $720 via manual_adjustment
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Vault milestones configuration
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vault_milestones (
  id serial PRIMARY KEY,
  tier_name text NOT NULL UNIQUE,
  tier_emoji text NOT NULL DEFAULT '🔒',
  vault_threshold_usd numeric NOT NULL,
  max_withdrawal_pct numeric NOT NULL DEFAULT 0,      -- % of user's energy
  max_monthly_usd numeric NOT NULL DEFAULT 0,          -- monthly cap in USD
  min_withdrawal_usd numeric NOT NULL DEFAULT 5,       -- minimum per withdrawal in USD
  is_fully_open boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insert milestone tiers
INSERT INTO public.vault_milestones (tier_name, tier_emoji, vault_threshold_usd, max_withdrawal_pct, max_monthly_usd, min_withdrawal_usd, is_fully_open, sort_order) VALUES
  ('locked',      '🔒', 0,       0,    0,       0,  false, 0),
  ('seed',        '🟡', 10000,   5,    100,     5,  false, 1),
  ('early',       '🟠', 50000,   10,   500,     5,  false, 2),
  ('growth',      '🔵', 100000,  20,   2000,    5,  false, 3),
  ('scale',       '🟣', 500000,  35,   10000,   5,  false, 4),
  ('mature',      '💎', 1000000, 50,   30000,   5,  false, 5),
  ('established', '⭐', 5000000, 75,   100000,  5,  false, 6),
  ('open',        '🏆', 7500000, 100,  0,       5,  true,  7)
ON CONFLICT (tier_name) DO UPDATE SET
  vault_threshold_usd = EXCLUDED.vault_threshold_usd,
  max_withdrawal_pct = EXCLUDED.max_withdrawal_pct,
  max_monthly_usd = EXCLUDED.max_monthly_usd,
  min_withdrawal_usd = EXCLUDED.min_withdrawal_usd,
  is_fully_open = EXCLUDED.is_fully_open,
  sort_order = EXCLUDED.sort_order;

GRANT SELECT ON public.vault_milestones TO anon, authenticated;

COMMENT ON TABLE public.vault_milestones IS
'Vault milestone tiers controlling withdrawal limits. As vault grows, users can withdraw larger % of their energy.';


-- ─────────────────────────────────────────────────────────────
-- 2. Get current vault milestone tier
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_vault_milestone()
RETURNS public.vault_milestones
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vault_usd numeric;
  v_milestone public.vault_milestones%rowtype;
BEGIN
  SELECT vault_usd INTO v_vault_usd
  FROM public.platform_vault_overview;

  SELECT * INTO v_milestone
  FROM public.vault_milestones
  WHERE vault_threshold_usd <= COALESCE(v_vault_usd, 0)
  ORDER BY vault_threshold_usd DESC
  LIMIT 1;

  RETURN v_milestone;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vault_milestone() TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────
-- 3. Updated request_withdrawal() with milestone-based limits
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_mom_amount numeric,
  p_wallet_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rate numeric;
  v_spread numeric := 0.05;
  v_usd_amount numeric;
  v_current_mom numeric;
  v_daily_total_mom numeric;
  v_monthly_total_usd numeric;
  v_vault_usd numeric;
  v_platform_daily numeric;
  v_request_id uuid;
  v_milestone public.vault_milestones%rowtype;
  v_max_withdrawable_mom numeric;
  -- Hard limits (always enforced)
  c_max_mom_per_tx numeric := 50000;
  c_daily_limit_mom numeric := 100000;
  c_vault_daily_pct numeric := 0.10;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Get current milestone
  v_milestone := public.get_vault_milestone();

  -- Check if withdrawals are locked
  IF v_milestone.max_withdrawal_pct <= 0 THEN
    RAISE EXCEPTION 'withdrawals_locked'
      USING DETAIL = format('Vault must reach $%s to unlock withdrawals. Current tier: %s',
        (SELECT vault_threshold_usd FROM public.vault_milestones WHERE sort_order = 1), v_milestone.tier_name);
  END IF;

  -- Get current rate
  v_rate := public.get_mom_rate();
  v_usd_amount := ROUND(p_mom_amount * v_rate * (1 - v_spread), 2);

  -- USD-based minimum withdrawal check
  IF v_usd_amount < v_milestone.min_withdrawal_usd THEN
    RAISE EXCEPTION 'minimum_withdrawal_usd'
      USING DETAIL = format('Minimum withdrawal is $%s USD. Your amount: $%s', v_milestone.min_withdrawal_usd, v_usd_amount);
  END IF;

  IF v_usd_amount <= 0 THEN
    RAISE EXCEPTION 'withdrawal_amount_too_small';
  END IF;

  -- Hard per-tx limit
  IF p_mom_amount > c_max_mom_per_tx THEN
    RAISE EXCEPTION 'max_per_transaction_exceeded'
      USING DETAIL = format('Maximum per transaction: %s MOM', c_max_mom_per_tx);
  END IF;

  -- Check user balance (row lock)
  SELECT mom_energy INTO v_current_mom
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_current_mom IS NULL THEN
    RAISE EXCEPTION 'user_profile_not_found';
  END IF;

  IF v_current_mom < p_mom_amount THEN
    RAISE EXCEPTION 'insufficient_mom_energy'
      USING DETAIL = format('Available: %s MOM, Requested: %s MOM', v_current_mom, p_mom_amount);
  END IF;

  -- Milestone-based percentage limit (unless fully open)
  IF NOT v_milestone.is_fully_open THEN
    v_max_withdrawable_mom := ROUND(v_current_mom * (v_milestone.max_withdrawal_pct / 100.0), 2);

    -- Check how much user already withdrew this month (in MOM)
    -- We track the remaining budget by subtracting already-withdrawn
    -- For simplicity, we check cumulative monthly MOM vs allowed %
    IF p_mom_amount > v_max_withdrawable_mom THEN
      RAISE EXCEPTION 'milestone_percentage_exceeded'
        USING DETAIL = format('Current tier "%s" allows up to %s%% of your energy (%s MOM). Requested: %s MOM',
          v_milestone.tier_name, v_milestone.max_withdrawal_pct, v_max_withdrawable_mom, p_mom_amount);
    END IF;
  END IF;

  -- Monthly USD cap (unless fully open)
  IF NOT v_milestone.is_fully_open AND v_milestone.max_monthly_usd > 0 THEN
    SELECT COALESCE(SUM(usd_amount), 0) INTO v_monthly_total_usd
    FROM public.withdrawal_requests
    WHERE user_id = v_user_id
      AND status IN ('queued', 'processing', 'completed')
      AND created_at >= date_trunc('month', now());

    IF (v_monthly_total_usd + v_usd_amount) > v_milestone.max_monthly_usd THEN
      RAISE EXCEPTION 'monthly_usd_limit_exceeded'
        USING DETAIL = format('Monthly limit for tier "%s": $%s. Already used: $%s',
          v_milestone.tier_name, v_milestone.max_monthly_usd, v_monthly_total_usd);
    END IF;
  END IF;

  -- Daily MOM limit (user, rolling 24h)
  SELECT COALESCE(SUM(mom_amount), 0) INTO v_daily_total_mom
  FROM public.withdrawal_requests
  WHERE user_id = v_user_id
    AND status IN ('queued', 'processing', 'completed')
    AND created_at >= now() - interval '24 hours';

  IF (v_daily_total_mom + p_mom_amount) > c_daily_limit_mom THEN
    RAISE EXCEPTION 'daily_withdrawal_limit_exceeded'
      USING DETAIL = format('Daily limit: %s MOM. Already used: %s MOM', c_daily_limit_mom, v_daily_total_mom);
  END IF;

  -- Platform-wide daily vault limit
  SELECT vault_usd INTO v_vault_usd FROM public.platform_vault_overview;

  SELECT COALESCE(SUM(usd_amount), 0) INTO v_platform_daily
  FROM public.withdrawal_requests
  WHERE status IN ('queued', 'processing', 'completed')
    AND created_at >= now() - interval '24 hours';

  IF (v_platform_daily + v_usd_amount) > (COALESCE(v_vault_usd, 0) * c_vault_daily_pct) THEN
    RAISE EXCEPTION 'platform_daily_limit_exceeded'
      USING DETAIL = 'Platform-wide daily withdrawal limit (10% of vault) reached';
  END IF;

  -- Deduct MOM from user immediately
  UPDATE public.profiles
  SET mom_energy = mom_energy - p_mom_amount, updated_at = now()
  WHERE id = v_user_id;

  -- Create withdrawal request
  INSERT INTO public.withdrawal_requests (
    user_id, mom_amount, rate_at_request, usd_amount, spread, wallet_id, status
  ) VALUES (
    v_user_id, p_mom_amount, v_rate, v_usd_amount, v_spread,
    p_wallet_id, 'queued'
  ) RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'withdrawal_id', v_request_id,
    'mom_amount', p_mom_amount,
    'rate', v_rate,
    'spread_pct', v_spread * 100,
    'usd_amount', v_usd_amount,
    'status', 'queued',
    'tier', v_milestone.tier_name,
    'max_pct', v_milestone.max_withdrawal_pct,
    'monthly_cap_usd', v_milestone.max_monthly_usd
  );
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 4. Seed initial capital $720 as manual_adjustment
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.platform_revenue_ledger (source_type, gross_amount, vault_share_rate, status, metadata)
SELECT 'manual_adjustment', 720, 1.0, 'posted',
  '{"description": "Initial seed capital for momment. vault testnet"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_revenue_ledger
  WHERE source_type = 'manual_adjustment'
    AND gross_amount = 720
    AND metadata->>'description' = 'Initial seed capital for momment. vault testnet'
);

COMMIT;
