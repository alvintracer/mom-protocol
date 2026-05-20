-- =============================================================================
-- momment. Economy v2 Phase 2: Donations, CR Tiers, Rate History
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Unify Donations to use MOM Energy (25/25/50 split like sponsorships)
-- ─────────────────────────────────────────────────────────────

-- 1a. Update or Create attention_donations table
CREATE TABLE IF NOT EXISTS public.attention_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id uuid NOT NULL REFERENCES public.attention_clusters(id) ON DELETE CASCADE,
  donor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  legacy_amount_krw numeric,
  bid_amount numeric NOT NULL DEFAULT 0,
  bid_currency text NOT NULL DEFAULT 'MOM',
  builder_reward numeric NOT NULL DEFAULT 0,
  contributor_pool numeric NOT NULL DEFAULT 0,
  burn_amount numeric NOT NULL DEFAULT 0,
  attention_score_boost numeric NOT NULL DEFAULT 0,
  energy_granted numeric NOT NULL DEFAULT 0,
  donor_message text,
  is_anonymous boolean NOT NULL DEFAULT false,
  payment_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Safely try to rename amount_krw if it existed from an older migration
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'attention_donations' AND column_name = 'amount_krw') THEN
    ALTER TABLE public.attention_donations RENAME COLUMN amount_krw TO legacy_amount_krw;
    ALTER TABLE public.attention_donations ALTER COLUMN legacy_amount_krw DROP NOT NULL;
  END IF;
END $$;

-- 1b. Add total_donation_mom to attention_clusters
ALTER TABLE public.attention_clusters ADD COLUMN IF NOT EXISTS total_donation_mom numeric NOT NULL DEFAULT 0;

-- 1c. Update submit_attention_donation RPC
DROP FUNCTION IF EXISTS public.submit_attention_donation(uuid, numeric, text, boolean);

CREATE OR REPLACE FUNCTION public.submit_attention_donation(
  p_cluster_id uuid,
  p_bid_amount numeric,
  p_message text DEFAULT null,
  p_is_anonymous boolean DEFAULT false,
  p_bid_currency text DEFAULT 'MOM'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_donor UUID := auth.uid();
  v_builder_id UUID;
  v_builder_reward NUMERIC;
  v_contributor_pool NUMERIC;
  v_burn_amount NUMERIC;
  v_attention_score_boost NUMERIC;
  v_donation_id UUID;
  v_new_attention_score NUMERIC;
  v_distributed_to_contributors NUMERIC := 0;
  v_contributor_count INTEGER := 0;
  v_cluster_total_energy NUMERIC;
  v_share NUMERIC;
  rec RECORD;
BEGIN
  IF v_donor IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF p_bid_amount < 10 THEN
    RAISE EXCEPTION 'minimum_donation_10_mom';
  END IF;

  -- Get builder
  SELECT created_by INTO v_builder_id
  FROM public.attention_clusters
  WHERE id = p_cluster_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cluster_not_found';
  END IF;

  -- Deduct MOM energy from donor
  IF p_bid_currency = 'MOM' THEN
    UPDATE public.profiles
    SET mom_energy = mom_energy - p_bid_amount, updated_at = now()
    WHERE id = v_donor AND mom_energy >= p_bid_amount;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'insufficient_mom_energy';
    END IF;
  END IF;

  -- Split: 25% builder, 25% contributors, 50% burn
  v_builder_reward := ROUND(p_bid_amount * 0.25, 2);
  v_contributor_pool := ROUND(p_bid_amount * 0.25, 2);
  v_burn_amount := p_bid_amount - v_builder_reward - v_contributor_pool;

  -- Attention score boost
  v_attention_score_boost := ROUND(p_bid_amount * 0.60, 2);

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
    AND al.user_id != v_donor;

  IF v_cluster_total_energy > 0 THEN
    -- Distribute to top 50 contributors by energy share
    FOR rec IN
      SELECT
        al.user_id,
        SUM(al.mom_energy) AS user_energy
      FROM public.attention_activity_ledger al
      WHERE al.cluster_id = p_cluster_id
        AND al.user_id IS NOT NULL
        AND al.user_id != v_donor
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

    v_burn_amount := v_burn_amount + (v_contributor_pool - v_distributed_to_contributors);
  ELSE
    v_burn_amount := v_burn_amount + v_contributor_pool;
  END IF;

  -- Insert donation record
  INSERT INTO public.attention_donations (
    cluster_id, donor_id, bid_amount, bid_currency,
    builder_reward, contributor_pool, burn_amount, attention_score_boost,
    donor_message, is_anonymous, payment_status
  )
  VALUES (
    p_cluster_id, v_donor, p_bid_amount, p_bid_currency,
    v_builder_reward, v_distributed_to_contributors, v_burn_amount, v_attention_score_boost,
    p_message, p_is_anonymous, 'paid'
  )
  RETURNING id INTO v_donation_id;

  -- Apply Attention Energy to cluster
  UPDATE public.attention_clusters
  SET attention_score = attention_score + v_attention_score_boost, updated_at = now()
  WHERE id = p_cluster_id
  RETURNING attention_score INTO v_new_attention_score;

  -- Log in activity ledger
  INSERT INTO public.attention_activity_ledger (
    cluster_id, user_id, activity_type, revenue_amount, revenue_currency, mom_energy, metadata
  )
  VALUES (
    p_cluster_id, v_donor, 'donation', p_bid_amount, p_bid_currency, v_attention_score_boost,
    jsonb_build_object(
      'donation_id', v_donation_id,
      'model', 'economy_v2_donation',
      'builder_reward', v_builder_reward,
      'contributor_pool', v_distributed_to_contributors,
      'contributor_count', v_contributor_count,
      'burned', v_burn_amount,
      'attention_score_boost', v_attention_score_boost,
      'is_anonymous', p_is_anonymous
    )
  );

  RETURN jsonb_build_object(
    'donation_id', v_donation_id,
    'builder_reward', v_builder_reward,
    'contributor_distribution', v_distributed_to_contributors,
    'contributor_count', v_contributor_count,
    'burned', v_burn_amount,
    'attention_score_boost', v_attention_score_boost,
    'new_attention_score', v_new_attention_score
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_attention_donation(uuid, numeric, text, boolean, text) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 2. Global Contributor Rankings View
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.platform_contributor_rankings AS
WITH user_energy AS (
  SELECT
    user_id,
    SUM(mom_energy) AS total_energy,
    COUNT(*) FILTER (WHERE activity_type = 'post') AS post_count,
    COUNT(*) FILTER (WHERE activity_type = 'comment') AS comment_count,
    COUNT(*) FILTER (WHERE activity_type = 'evidence') AS evidence_count,
    COUNT(*) FILTER (WHERE activity_type = 'share') AS share_count
  FROM public.attention_activity_ledger
  WHERE user_id IS NOT NULL
  GROUP BY user_id
)
SELECT
  ue.user_id,
  p.handle,
  p.display_name,
  p.avatar_url,
  ue.total_energy,
  ue.post_count,
  ue.comment_count,
  ue.evidence_count,
  ue.share_count,
  PERCENT_RANK() OVER (ORDER BY ue.total_energy DESC) AS percent_rank,
  ROW_NUMBER() OVER (ORDER BY ue.total_energy DESC) AS rank
FROM user_energy ue
JOIN public.profiles p ON p.id = ue.user_id;

GRANT SELECT ON public.platform_contributor_rankings TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────
-- 2b. Update donor rankings view to use bid_amount (MOM)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.attention_donor_rankings AS
SELECT
  d.cluster_id,
  d.donor_id AS user_id,
  p.handle,
  p.display_name,
  p.avatar_url,
  COUNT(*) AS donation_count,
  SUM(d.bid_amount) AS total_donated_mom,
  SUM(d.attention_score_boost) AS total_energy_granted,
  MAX(d.created_at) AS last_donated_at,
  ROW_NUMBER() OVER (
    PARTITION BY d.cluster_id
    ORDER BY SUM(d.bid_amount) DESC
  ) AS rank
FROM public.attention_donations d
JOIN public.profiles p ON p.id = d.donor_id
WHERE d.is_anonymous = false
  AND d.payment_status IN ('mock', 'paid')
GROUP BY d.cluster_id, d.donor_id, p.handle, p.display_name, p.avatar_url;

-- 2c. Update recalculate_attention_stats to use bid_amount
CREATE OR REPLACE FUNCTION public.recalculate_attention_stats(target_cluster_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_views integer;
  v_unique integer;
  v_donations numeric;
BEGIN
  SELECT COUNT(*), COUNT(DISTINCT COALESCE(user_id::text, session_id))
  INTO v_views, v_unique
  FROM public.attention_page_views
  WHERE cluster_id = target_cluster_id;

  SELECT COALESCE(SUM(bid_amount), 0)
  INTO v_donations
  FROM public.attention_donations
  WHERE cluster_id = target_cluster_id
    AND payment_status IN ('mock', 'paid');

  UPDATE public.attention_clusters
  SET
    total_view_count = COALESCE(v_views, 0),
    unique_visitor_count = COALESCE(v_unique, 0),
    total_donation_mom = COALESCE(v_donations, 0),
    updated_at = now()
  WHERE id = target_cluster_id;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 3. CR Tiers -> request_withdrawal spread and limits
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
  v_percent_rank numeric;
  v_spread numeric;
  v_usd_amount numeric;
  v_current_mom numeric;
  v_daily_total numeric;
  v_monthly_total numeric;
  v_vault_usd numeric;
  v_platform_daily numeric;
  v_request_id uuid;
  -- Limits
  c_min_mom numeric := 1000;
  c_daily_limit numeric := 50000;
  c_monthly_limit numeric := 200000;
  c_vault_daily_pct numeric := 0.10;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_mom_amount < c_min_mom THEN
    RAISE EXCEPTION 'minimum_withdrawal_1000_mom'
      USING DETAIL = format('Minimum withdrawal is %s MOM', c_min_mom);
  END IF;

  -- Determine user's global CR Tier
  SELECT percent_rank INTO v_percent_rank
  FROM public.platform_contributor_rankings
  WHERE user_id = v_user_id;

  IF v_percent_rank IS NOT NULL AND v_percent_rank <= 0.05 THEN
    v_spread := 0.03;       -- Gold
    c_monthly_limit := 500000;
  ELSIF v_percent_rank IS NOT NULL AND v_percent_rank <= 0.20 THEN
    v_spread := 0.04;       -- Silver
    c_monthly_limit := 300000;
  ELSE
    v_spread := 0.05;       -- Member
    c_monthly_limit := 200000;
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
    'status', 'queued',
    'applied_tier_limit', c_monthly_limit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, uuid) TO authenticated;

-- 3b. Refund withdrawal (for Admin cancellations)
CREATE OR REPLACE FUNCTION public.refund_withdrawal(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_amount numeric;
  v_status text;
BEGIN
  -- Get withdrawal details with lock
  SELECT user_id, mom_amount, status
  INTO v_user_id, v_amount, v_status
  FROM public.withdrawal_requests
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal_not_found';
  END IF;

  IF v_status NOT IN ('failed', 'cancelled') THEN
    RAISE EXCEPTION 'withdrawal_not_failed_or_cancelled';
  END IF;

  -- Refund MOM energy
  UPDATE public.profiles
  SET mom_energy = mom_energy + v_amount, updated_at = now()
  WHERE id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_withdrawal(uuid) TO service_role;


-- ─────────────────────────────────────────────────────────────
-- 4. Rate History Chart Table & Snapshot RPC
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.platform_rate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL UNIQUE,
  vault_usd numeric NOT NULL,
  total_mom_supply numeric NOT NULL,
  mom_rate numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_rate_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate history publicly readable" ON public.platform_rate_history;
CREATE POLICY "rate history publicly readable"
  ON public.platform_rate_history FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.snapshot_mom_rate()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate numeric;
  v_vault_usd numeric;
  v_total_supply numeric;
BEGIN
  -- Get current values from the view
  SELECT vault_usd, total_mom_supply, current_rate
  INTO v_vault_usd, v_total_supply, v_rate
  FROM public.platform_vault_overview;

  INSERT INTO public.platform_rate_history (
    snapshot_date, vault_usd, total_mom_supply, mom_rate
  ) VALUES (
    now()::date, v_vault_usd, v_total_supply, v_rate
  )
  ON CONFLICT (snapshot_date) DO UPDATE SET
    vault_usd = EXCLUDED.vault_usd,
    total_mom_supply = EXCLUDED.total_mom_supply,
    mom_rate = EXCLUDED.mom_rate,
    created_at = EXCLUDED.created_at;
END;
$$;

-- Allow anyone to trigger a snapshot (idempotent for the day)
GRANT EXECUTE ON FUNCTION public.snapshot_mom_rate() TO anon, authenticated, service_role;

-- Take an initial snapshot right now
SELECT public.snapshot_mom_rate();

COMMIT;
