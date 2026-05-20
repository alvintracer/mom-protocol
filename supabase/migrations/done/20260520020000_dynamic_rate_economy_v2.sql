-- =============================================================================
-- momment. Economy v2: Dynamic Rate + User-Initiated Withdrawals
-- =============================================================================
-- Key changes:
--   1. Dynamic rate: $/MOM = vault_usd / total_mom_supply
--   2. User-initiated withdrawal with 5% spread (replaces monthly distribution)
--   3. Ad bids: 100% burn (MOM destroyed, rate ↑)
--   4. Sponsorship: 25% builder + 25% contributors + 50% burn
--   5. Remove redeemable_energy (users withdraw from mom_energy directly)
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 0. Rebuild withdrawal_requests (columns must exist before functions)
-- ─────────────────────────────────────────────────────────────

-- 0a. Drop the GENERATED column first (cannot be altered, must be dropped)
--     usdc_amount was: GENERATED ALWAYS AS (energy_amount / 100) STORED
ALTER TABLE public.withdrawal_requests
  DROP COLUMN IF EXISTS usdc_amount;

-- 0b. Add new columns (IF NOT EXISTS so re-running is safe)
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS mom_amount numeric;

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS rate_at_request numeric;

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS usd_amount numeric;

-- spread: use DEFAULT 0.05 first, then make NOT NULL safe for existing rows
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS spread numeric DEFAULT 0.05;

-- Backfill any NULL spread values before adding NOT NULL constraint
UPDATE public.withdrawal_requests SET spread = 0.05 WHERE spread IS NULL;

ALTER TABLE public.withdrawal_requests
  ALTER COLUMN spread SET NOT NULL;

ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS wallet_id uuid REFERENCES public.wallets(id);

-- 0c. Migrate data from energy_amount → mom_amount (if old column still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'withdrawal_requests'
      AND column_name = 'energy_amount'
  ) THEN
    -- Copy energy_amount data to mom_amount where not already populated
    UPDATE public.withdrawal_requests
    SET mom_amount = energy_amount
    WHERE mom_amount IS NULL AND energy_amount IS NOT NULL;

    -- Backfill usd_amount and rate_at_request for migrated rows
    -- Old system: 1 MOM = $0.01 (100 MOM = $1)
    UPDATE public.withdrawal_requests
    SET rate_at_request = 0.01,
        usd_amount = ROUND(mom_amount * 0.01 * 0.95, 2)  -- apply 5% spread retroactively
    WHERE rate_at_request IS NULL AND mom_amount IS NOT NULL;
  END IF;
END $$;

-- 0d. Drop old columns
ALTER TABLE public.withdrawal_requests DROP COLUMN IF EXISTS energy_amount;
ALTER TABLE public.withdrawal_requests DROP COLUMN IF EXISTS wallet_address;
ALTER TABLE public.withdrawal_requests DROP COLUMN IF EXISTS chain;
ALTER TABLE public.withdrawal_requests DROP COLUMN IF EXISTS admin_note;
ALTER TABLE public.withdrawal_requests DROP COLUMN IF EXISTS reviewed_by;
ALTER TABLE public.withdrawal_requests DROP COLUMN IF EXISTS reviewed_at;
ALTER TABLE public.withdrawal_requests DROP COLUMN IF EXISTS completed_at;

-- 0e. Migrate old status values BEFORE changing the constraint
UPDATE public.withdrawal_requests SET status = 'queued'  WHERE status = 'pending';
UPDATE public.withdrawal_requests SET status = 'failed'  WHERE status = 'rejected';
UPDATE public.withdrawal_requests SET status = 'failed'  WHERE status = 'approved';  -- edge case

-- 0f. Replace status CHECK constraint
ALTER TABLE public.withdrawal_requests
  DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check;

-- Also drop the original inline CHECK if it has a different auto-generated name
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.withdrawal_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.withdrawal_requests DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_status_check
  CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'));

-- 0g. Drop the old v1 request_withdrawal function (different signature)
DROP FUNCTION IF EXISTS public.request_withdrawal(numeric, text, text);

-- 0h. Drop old distribute_vault_energy (no longer used in v2)
DROP FUNCTION IF EXISTS public.distribute_vault_energy(numeric, numeric);

-- 0i. Rebuild vault overview instead of CREATE OR REPLACE renaming columns.
--     PostgreSQL does not allow CREATE OR REPLACE VIEW to rename existing
--     output columns (old first column: cumulative_energy, new first column:
--     vault_usd). Drop/recreate is safe here because grants/comments are
--     restored later in this migration.
DROP VIEW IF EXISTS public.platform_vault_overview;

-- 0j. Allow cluster_id to be NULL in attention_activity_ledger
--     (ad bids are platform-wide, not cluster-specific)
ALTER TABLE public.attention_activity_ledger
  ALTER COLUMN cluster_id DROP NOT NULL;


-- ─────────────────────────────────────────────────────────────
-- 1. Get current MOM rate ($/MOM)
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
  v_total_supply numeric;
  v_rate numeric;
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

  -- Total MOM supply
  SELECT COALESCE(SUM(mom_energy), 0)
  INTO v_total_supply
  FROM public.profiles
  WHERE mom_energy > 0;

  -- Calculate rate with floor
  IF v_total_supply > 0 THEN
    v_rate := v_vault_usd / v_total_supply;
  ELSE
    v_rate := 0;
  END IF;

  RETURN GREATEST(v_rate, 0.001);  -- MIN_RATE floor: 1 MOM = $0.001
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mom_rate() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_mom_rate() IS
'Returns the current dynamic MOM rate: vault_usd / total_mom_supply, with a floor of $0.001.';


-- ─────────────────────────────────────────────────────────────
-- 2. Vault overview for public display ($/MOM based)
-- ─────────────────────────────────────────────────────────────

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
  supply.total_mom_supply::numeric AS total_mom_supply,
  GREATEST(
    CASE WHEN supply.total_mom_supply > 0
      THEN GREATEST(vault.total_revenue_usd - withdrawals.total_withdrawn_usd, 0) / supply.total_mom_supply
      ELSE 0.001
    END,
    0.001
  )::numeric AS current_rate,
  withdrawals.total_withdrawn_usd::numeric AS total_withdrawn_usd,
  withdrawals.pending_withdrawal_usd::numeric AS pending_withdrawal_usd,
  vault.posted_entry_count,
  vault.updated_at,
  -- Legacy compat (kept for existing UI during transition)
  GREATEST(vault.total_revenue_usd - withdrawals.total_withdrawn_usd, 0)::numeric AS cumulative_energy,
  0::numeric AS monthly_energy,
  withdrawals.total_withdrawn_usd::numeric AS distributed_energy,
  date_trunc('month', now())::date AS current_month,
  (date_trunc('month', now()) + interval '1 month')::date AS next_distribution_date
FROM vault
CROSS JOIN withdrawals
CROSS JOIN supply;


-- ─────────────────────────────────────────────────────────────
-- 3. New request_withdrawal() with dynamic rate + spread + limits
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
  v_daily_total numeric;
  v_monthly_total numeric;
  v_vault_usd numeric;
  v_platform_daily numeric;
  v_request_id uuid;
  -- Limits
  c_min_mom numeric := 1000;        -- min 1,000 MOM per withdrawal
  c_daily_limit numeric := 50000;   -- 50,000 MOM / day / user
  c_monthly_limit numeric := 200000; -- 200,000 MOM / month / user
  c_vault_daily_pct numeric := 0.10; -- max 10% of vault per day (platform-wide)
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_mom_amount < c_min_mom THEN
    RAISE EXCEPTION 'minimum_withdrawal_1000_mom'
      USING DETAIL = format('Minimum withdrawal is %s MOM', c_min_mom);
  END IF;

  -- Get current rate
  v_rate := public.get_mom_rate();
  v_usd_amount := ROUND(p_mom_amount * v_rate * (1 - v_spread), 2);

  IF v_usd_amount <= 0 THEN
    RAISE EXCEPTION 'withdrawal_amount_too_small';
  END IF;

  -- Check user balance (row lock to prevent race conditions)
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

  -- Check daily limit (user, rolling 24h)
  SELECT COALESCE(SUM(mom_amount), 0) INTO v_daily_total
  FROM public.withdrawal_requests
  WHERE user_id = v_user_id
    AND status IN ('queued', 'processing', 'completed')
    AND created_at >= now() - interval '24 hours';

  IF (v_daily_total + p_mom_amount) > c_daily_limit THEN
    RAISE EXCEPTION 'daily_withdrawal_limit_exceeded'
      USING DETAIL = format('Daily limit: %s MOM, Already used: %s MOM', c_daily_limit, v_daily_total);
  END IF;

  -- Check monthly limit (user, rolling 30 days)
  SELECT COALESCE(SUM(mom_amount), 0) INTO v_monthly_total
  FROM public.withdrawal_requests
  WHERE user_id = v_user_id
    AND status IN ('queued', 'processing', 'completed')
    AND created_at >= now() - interval '30 days';

  IF (v_monthly_total + p_mom_amount) > c_monthly_limit THEN
    RAISE EXCEPTION 'monthly_withdrawal_limit_exceeded'
      USING DETAIL = format('Monthly limit: %s MOM, Already used: %s MOM', c_monthly_limit, v_monthly_total);
  END IF;

  -- Check platform-wide daily vault limit
  SELECT vault_usd INTO v_vault_usd
  FROM public.platform_vault_overview;

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
    'status', 'queued'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, uuid) TO authenticated;

COMMENT ON FUNCTION public.request_withdrawal(numeric, uuid) IS
'User-facing: request withdrawal of MOM to USDC at dynamic rate with 5% spread. MOM is deducted immediately, USDC paid via batch processing.';


-- ─────────────────────────────────────────────────────────────
-- 4. Update submit_ad_bid() → 100% burn
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submit_ad_bid(
  p_campaign_id UUID,
  p_position TEXT,
  p_bid_amount NUMERIC,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_bid_currency TEXT DEFAULT 'MOM'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bidder UUID := auth.uid();
  v_current_high NUMERIC;
  v_bid_id UUID;
BEGIN
  IF v_bidder IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'invalid_date_range';
  END IF;

  -- Check current highest bid for this position/period
  SELECT COALESCE(MAX(bid_amount), 0)
  INTO v_current_high
  FROM public.ad_bids
  WHERE position = p_position
    AND status IN ('approved', 'active')
    AND starts_at < p_ends_at
    AND ends_at > p_starts_at;

  IF p_bid_amount <= v_current_high THEN
    RAISE EXCEPTION 'bid_too_low'
      USING DETAIL = format('Current high bid: %s', v_current_high);
  END IF;

  -- Deduct MOM energy from bidder → 100% BURN (no one receives it)
  IF p_bid_currency = 'MOM' THEN
    UPDATE public.profiles
    SET mom_energy = mom_energy - p_bid_amount, updated_at = now()
    WHERE id = v_bidder AND mom_energy >= p_bid_amount;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'insufficient_mom_energy';
    END IF;
  END IF;

  -- Mark overlapping bids as outbid
  UPDATE public.ad_bids
  SET status = 'outbid', updated_at = now()
  WHERE position = p_position
    AND status IN ('approved', 'active')
    AND starts_at < p_ends_at
    AND ends_at > p_starts_at
    AND bid_amount < p_bid_amount;

  -- Insert bid (platform_energy_earned = 0 since we burn 100%)
  INSERT INTO public.ad_bids (
    campaign_id, bidder_id, position, bid_amount, bid_currency,
    starts_at, ends_at, status, platform_energy_earned
  ) VALUES (
    p_campaign_id, v_bidder, p_position, p_bid_amount, p_bid_currency,
    p_starts_at, p_ends_at, 'approved', 0
  ) RETURNING id INTO v_bid_id;

  -- Activate campaign
  UPDATE public.ad_campaigns
  SET status = 'active', priority = p_bid_amount::INTEGER, updated_at = now()
  WHERE id = p_campaign_id;

  -- Log burn in activity ledger (cluster_id is NULL for platform-wide ads)
  INSERT INTO public.attention_activity_ledger (
    cluster_id, user_id, activity_type, revenue_amount, revenue_currency, mom_energy, metadata
  ) VALUES (
    NULL, v_bidder, 'ad_revenue', p_bid_amount, p_bid_currency, 0,
    jsonb_build_object(
      'bid_id', v_bid_id,
      'position', p_position,
      'type', 'general_ad',
      'burn_pct', 100,
      'burned_mom', p_bid_amount,
      'model', 'economy_v2'
    )
  );

  RETURN jsonb_build_object(
    'bid_id', v_bid_id,
    'status', 'approved',
    'burned_mom', p_bid_amount,
    'rate_effect', 'rate_increased',
    'outbid_previous', v_current_high > 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_ad_bid(UUID, TEXT, NUMERIC, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 5. Update submit_attention_sponsorship()
--    → 25% builder + 25% contributors + 50% burn
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submit_attention_sponsorship(
  p_cluster_id UUID,
  p_sponsor_name TEXT,
  p_sponsor_url TEXT,
  p_bid_amount NUMERIC,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_sponsor_tagline TEXT DEFAULT NULL,
  p_sponsor_logo_url TEXT DEFAULT NULL,
  p_sponsor_color TEXT DEFAULT NULL,
  p_bid_currency TEXT DEFAULT 'MOM'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sponsor UUID := auth.uid();
  v_builder_id UUID;
  v_builder_reward NUMERIC;
  v_contributor_pool NUMERIC;
  v_burn_amount NUMERIC;
  v_attention_score_boost NUMERIC;
  v_sponsor_id UUID;
  v_current_sponsor UUID;
  v_new_attention_score NUMERIC;
  v_distributed_to_contributors NUMERIC := 0;
  v_contributor_count INTEGER := 0;
  v_cluster_total_energy NUMERIC;
  v_share NUMERIC;
  rec RECORD;
BEGIN
  IF v_sponsor IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'invalid_date_range';
  END IF;

  IF p_bid_amount < 100 THEN
    RAISE EXCEPTION 'minimum_sponsorship_100_mom';
  END IF;

  -- Get builder
  SELECT created_by INTO v_builder_id
  FROM public.attention_clusters
  WHERE id = p_cluster_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cluster_not_found';
  END IF;

  -- Check if there's an active sponsor
  SELECT id INTO v_current_sponsor
  FROM public.attention_sponsorships
  WHERE cluster_id = p_cluster_id AND status = 'active'
  LIMIT 1;

  -- Deduct MOM energy from sponsor (100% leaves their account)
  IF p_bid_currency = 'MOM' THEN
    UPDATE public.profiles
    SET mom_energy = mom_energy - p_bid_amount, updated_at = now()
    WHERE id = v_sponsor AND mom_energy >= p_bid_amount;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'insufficient_mom_energy';
    END IF;
  END IF;

  -- Split: 25% builder, 25% contributors, 50% burn
  v_builder_reward := ROUND(p_bid_amount * 0.25, 2);
  v_contributor_pool := ROUND(p_bid_amount * 0.25, 2);
  v_burn_amount := p_bid_amount - v_builder_reward - v_contributor_pool; -- 50%

  -- Attention score boost (separate from MOM, visibility metric)
  v_attention_score_boost := ROUND(p_bid_amount * 0.60, 2);

  -- Expire current sponsor if exists
  IF v_current_sponsor IS NOT NULL THEN
    UPDATE public.attention_sponsorships
    SET status = 'expired', updated_at = now()
    WHERE id = v_current_sponsor;
  END IF;

  -- Insert sponsorship
  INSERT INTO public.attention_sponsorships (
    cluster_id, sponsor_id, sponsor_name, sponsor_logo_url, sponsor_tagline,
    sponsor_url, sponsor_color, bid_amount, bid_currency,
    starts_at, ends_at, energy_granted, status
  ) VALUES (
    p_cluster_id, v_sponsor, p_sponsor_name, p_sponsor_logo_url, p_sponsor_tagline,
    p_sponsor_url, p_sponsor_color, p_bid_amount, p_bid_currency,
    p_starts_at, p_ends_at, v_attention_score_boost, 'active'
  ) RETURNING id INTO v_sponsor_id;

  -- Boost attention cluster score (visibility, NOT MOM)
  UPDATE public.attention_clusters
  SET attention_score = attention_score + v_attention_score_boost, updated_at = now()
  WHERE id = p_cluster_id
  RETURNING attention_score INTO v_new_attention_score;

  -- 25% → Builder direct reward
  IF v_builder_id IS NOT NULL THEN
    UPDATE public.profiles
    SET mom_energy = mom_energy + v_builder_reward, updated_at = now()
    WHERE id = v_builder_id;
  ELSE
    -- No builder → add to burn
    v_burn_amount := v_burn_amount + v_builder_reward;
    v_builder_reward := 0;
  END IF;

  -- 25% → Distribute to contributors proportionally
  SELECT COALESCE(SUM(al.mom_energy), 0)
  INTO v_cluster_total_energy
  FROM public.attention_activity_ledger al
  WHERE al.cluster_id = p_cluster_id
    AND al.user_id IS NOT NULL
    AND al.user_id != v_sponsor;  -- sponsor doesn't get their own money back

  IF v_cluster_total_energy > 0 THEN
    -- Distribute to top 50 contributors by energy share
    FOR rec IN
      SELECT
        al.user_id,
        SUM(al.mom_energy) AS user_energy
      FROM public.attention_activity_ledger al
      WHERE al.cluster_id = p_cluster_id
        AND al.user_id IS NOT NULL
        AND al.user_id != v_sponsor
      GROUP BY al.user_id
      ORDER BY SUM(al.mom_energy) DESC
      LIMIT 50
    LOOP
      v_share := ROUND((rec.user_energy / v_cluster_total_energy) * v_contributor_pool, 2);
      IF v_share > 0 THEN
        UPDATE public.profiles
        SET mom_energy = mom_energy + v_share, updated_at = now()
        WHERE id = rec.user_id;

        v_distributed_to_contributors := v_distributed_to_contributors + v_share;
        v_contributor_count := v_contributor_count + 1;
      END IF;
    END LOOP;

    -- Any rounding remainder goes to burn
    v_burn_amount := v_burn_amount + (v_contributor_pool - v_distributed_to_contributors);
  ELSE
    -- No contributors → add to burn
    v_burn_amount := v_burn_amount + v_contributor_pool;
  END IF;

  -- Log in activity ledger
  INSERT INTO public.attention_activity_ledger (
    cluster_id, user_id, activity_type, revenue_amount, revenue_currency, mom_energy, metadata
  ) VALUES (
    p_cluster_id, v_sponsor, 'sponsorship', p_bid_amount, p_bid_currency, v_attention_score_boost,
    jsonb_build_object(
      'sponsorship_id', v_sponsor_id,
      'sponsor_name', p_sponsor_name,
      'model', 'economy_v2',
      'builder_reward', v_builder_reward,
      'contributor_pool', v_distributed_to_contributors,
      'contributor_count', v_contributor_count,
      'burned', v_burn_amount,
      'attention_score_boost', v_attention_score_boost
    )
  );

  RETURN jsonb_build_object(
    'sponsorship_id', v_sponsor_id,
    'status', 'active',
    'builder_reward', v_builder_reward,
    'contributor_distribution', v_distributed_to_contributors,
    'contributor_count', v_contributor_count,
    'burned', v_burn_amount,
    'attention_score_boost', v_attention_score_boost,
    'new_attention_score', v_new_attention_score,
    'replaced_previous', v_current_sponsor IS NOT NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_attention_sponsorship(
  UUID, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT
) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 6. Vault source mix view (keep for Rewards page)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.platform_vault_source_mix_current AS
WITH all_entries AS (
  SELECT
    source_type,
    SUM(gross_amount * vault_share_rate)::numeric AS usd_amount
  FROM public.platform_revenue_ledger
  WHERE status = 'posted'
  GROUP BY source_type
),
total AS (
  SELECT COALESCE(SUM(usd_amount), 0)::numeric AS total_usd
  FROM all_entries
)
SELECT
  all_entries.source_type,
  all_entries.usd_amount AS energy_amount,  -- legacy compat field name
  CASE
    WHEN total.total_usd > 0 THEN ROUND((all_entries.usd_amount / total.total_usd) * 100, 2)
    ELSE 0
  END AS percent
FROM all_entries
CROSS JOIN total
ORDER BY all_entries.usd_amount DESC;


-- ─────────────────────────────────────────────────────────────
-- 7. Helper: cancel withdrawal (refund MOM to user)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_withdrawal(
  p_withdrawal_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_withdrawal public.withdrawal_requests%rowtype;
BEGIN
  SELECT * INTO v_withdrawal
  FROM public.withdrawal_requests
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF v_withdrawal.id IS NULL THEN
    RAISE EXCEPTION 'withdrawal_not_found';
  END IF;

  -- Only the owner or service_role can cancel
  IF v_user_id IS NOT NULL AND v_withdrawal.user_id != v_user_id THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_withdrawal.status != 'queued' THEN
    RAISE EXCEPTION 'cannot_cancel_non_queued_withdrawal'
      USING DETAIL = format('Current status: %s', v_withdrawal.status);
  END IF;

  -- Refund MOM to user
  UPDATE public.profiles
  SET mom_energy = mom_energy + v_withdrawal.mom_amount, updated_at = now()
  WHERE id = v_withdrawal.user_id;

  -- Mark as cancelled
  UPDATE public.withdrawal_requests
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_withdrawal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_withdrawal(uuid) TO authenticated;

COMMENT ON FUNCTION public.cancel_withdrawal(uuid) IS
'User-facing: cancel a queued withdrawal request and refund MOM to user balance.';


-- ─────────────────────────────────────────────────────────────
-- 8. Drop redeemable_energy (no longer needed)
-- ─────────────────────────────────────────────────────────────

-- Users withdraw directly from mom_energy now, no intermediate step
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS redeemable_energy;


-- ─────────────────────────────────────────────────────────────
-- 9. Ensure RLS policies are correct for new schema
-- ─────────────────────────────────────────────────────────────

-- Ensure view grants are intact after recreation
GRANT SELECT ON public.platform_vault_overview TO anon, authenticated;
GRANT SELECT ON public.platform_vault_source_mix_current TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────
-- Done.
-- ─────────────────────────────────────────────────────────────

COMMENT ON VIEW public.platform_vault_overview IS
'Public vault stats: vault_usd, total_mom_supply, current_rate ($/MOM), and withdrawal totals. Economy v2.';

COMMIT;
