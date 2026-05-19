-- =============================================================================
-- Ad Bidding & Attention Sponsorship System
-- Two distinct ad buying tracks:
--   1) General Ad Bids: bid for generic slots across the platform
--   2) Attention Sponsorships: sponsor specific attention clusters (premium)
--
-- Both contribute to platform energy economics.
-- =============================================================================

-- Extend activity type for ad/sponsorship revenue
DO $$
BEGIN
  BEGIN
    ALTER TYPE public.attention_activity_type ADD VALUE IF NOT EXISTS 'ad_revenue';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TYPE public.attention_activity_type ADD VALUE IF NOT EXISTS 'sponsorship';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;


-- ══════════════════════════════════════════════════════════════
-- 1. GENERAL AD BIDS
-- Users/advertisers bid on generic platform slots (feed, sidebar).
-- Highest bidder wins the slot for the given period.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ad_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES auth.users(id),
  -- Bid details
  position TEXT NOT NULL,             -- feed_top, feed_mid, sidebar, etc.
  bid_amount NUMERIC NOT NULL CHECK (bid_amount > 0),
  bid_currency TEXT NOT NULL DEFAULT 'MOM' CHECK (bid_currency IN ('MOM', 'KRW', 'USD')),
  -- Duration
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  duration_days INTEGER GENERATED ALWAYS AS (
    GREATEST(EXTRACT(EPOCH FROM (ends_at - starts_at))::INTEGER / 86400, 1)
  ) STORED,
  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'active', 'outbid', 'expired', 'rejected')),
  -- Energy allocation: platform takes a % as energy
  platform_energy_earned NUMERIC NOT NULL DEFAULT 0,
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_bids_position_active
  ON ad_bids(position, status, bid_amount DESC)
  WHERE status IN ('approved', 'active');

CREATE INDEX IF NOT EXISTS idx_ad_bids_bidder
  ON ad_bids(bidder_id, created_at DESC);

ALTER TABLE public.ad_bids ENABLE ROW LEVEL SECURITY;

-- Bidders can see their own bids
DROP POLICY IF EXISTS "own bids readable" ON public.ad_bids;
CREATE POLICY "own bids readable"
  ON public.ad_bids FOR SELECT
  USING (bidder_id = auth.uid());

-- Public: see active winning bids (for transparency)
DROP POLICY IF EXISTS "active bids publicly readable" ON public.ad_bids;
CREATE POLICY "active bids publicly readable"
  ON public.ad_bids FOR SELECT
  USING (status = 'active');


-- ══════════════════════════════════════════════════════════════
-- 2. ATTENTION SPONSORSHIPS
-- Sponsors claim a dedicated "Sponsored by" badge on an attention
-- cluster. Different format: richer branding, exclusive placement.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.attention_sponsorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_id UUID NOT NULL REFERENCES public.attention_clusters(id) ON DELETE CASCADE,
  sponsor_id UUID NOT NULL REFERENCES auth.users(id),
  -- Sponsor branding
  sponsor_name TEXT NOT NULL,
  sponsor_logo_url TEXT,
  sponsor_tagline TEXT,                  -- e.g. "Powered by Samsung"
  sponsor_url TEXT NOT NULL,             -- click destination
  sponsor_color TEXT,                    -- brand accent color (hex)
  -- Bid
  bid_amount NUMERIC NOT NULL CHECK (bid_amount > 0),
  bid_currency TEXT NOT NULL DEFAULT 'MOM' CHECK (bid_currency IN ('MOM', 'KRW', 'USD')),
  -- Duration
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  -- How much energy flows to the attention
  energy_granted NUMERIC NOT NULL DEFAULT 0,
  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'active', 'expired', 'rejected', 'cancelled')),
  -- Audit
  impression_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active sponsor per attention at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsorship_active_cluster
  ON attention_sponsorships(cluster_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_sponsorship_sponsor
  ON attention_sponsorships(sponsor_id, created_at DESC);

ALTER TABLE public.attention_sponsorships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sponsorships publicly readable" ON public.attention_sponsorships;
CREATE POLICY "sponsorships publicly readable"
  ON public.attention_sponsorships FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "sponsors can manage own" ON public.attention_sponsorships;
CREATE POLICY "sponsors can manage own"
  ON public.attention_sponsorships FOR ALL
  USING (sponsor_id = auth.uid());


-- ══════════════════════════════════════════════════════════════
-- 3. BIDDING RPCs
-- ══════════════════════════════════════════════════════════════

-- 3a. Submit a general ad bid
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
  v_platform_energy NUMERIC;
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
    RAISE EXCEPTION 'bid_too_low:current_high=%', v_current_high;
  END IF;

  -- Platform takes 20% as energy
  v_platform_energy := ROUND(p_bid_amount * 0.20, 2);

  -- Deduct MOM energy from bidder (if MOM currency)
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

  -- Insert bid
  INSERT INTO public.ad_bids (
    campaign_id, bidder_id, position, bid_amount, bid_currency,
    starts_at, ends_at, status, platform_energy_earned
  ) VALUES (
    p_campaign_id, v_bidder, p_position, p_bid_amount, p_bid_currency,
    p_starts_at, p_ends_at, 'approved', v_platform_energy
  ) RETURNING id INTO v_bid_id;

  -- Activate campaign
  UPDATE public.ad_campaigns
  SET status = 'active', priority = p_bid_amount::INTEGER, updated_at = now()
  WHERE id = p_campaign_id;

  -- Log platform energy
  INSERT INTO public.attention_activity_ledger (
    cluster_id, user_id, activity_type, revenue_amount, revenue_currency, mom_energy, metadata
  ) VALUES (
    NULL, v_bidder, 'ad_revenue', p_bid_amount, p_bid_currency, v_platform_energy,
    jsonb_build_object(
      'bid_id', v_bid_id,
      'position', p_position,
      'type', 'general_ad',
      'platform_cut_pct', 20
    )
  );

  RETURN jsonb_build_object(
    'bid_id', v_bid_id,
    'status', 'approved',
    'platform_energy_earned', v_platform_energy,
    'outbid_previous', v_current_high > 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_ad_bid(UUID, TEXT, NUMERIC, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;


-- 3b. Submit an attention sponsorship bid
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
  v_attention_energy NUMERIC;
  v_platform_energy NUMERIC;
  v_sponsor_id UUID;
  v_current_sponsor UUID;
  v_new_attention_score NUMERIC;
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

  -- Check if there's an active sponsor
  SELECT id INTO v_current_sponsor
  FROM public.attention_sponsorships
  WHERE cluster_id = p_cluster_id AND status = 'active'
  LIMIT 1;

  -- Deduct MOM energy from sponsor
  IF p_bid_currency = 'MOM' THEN
    UPDATE public.profiles
    SET mom_energy = mom_energy - p_bid_amount, updated_at = now()
    WHERE id = v_sponsor AND mom_energy >= p_bid_amount;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'insufficient_mom_energy';
    END IF;
  END IF;

  -- Energy split: 60% → attention cluster, 20% → platform, 20% → builder
  v_attention_energy := ROUND(p_bid_amount * 0.60, 2);
  v_platform_energy  := ROUND(p_bid_amount * 0.20, 2);
  -- remaining 20% goes to cluster builder (via contribution ratio)

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
    p_starts_at, p_ends_at, v_attention_energy, 'active'
  ) RETURNING id INTO v_sponsor_id;

  -- Boost attention cluster energy
  UPDATE public.attention_clusters
  SET attention_score = attention_score + v_attention_energy, updated_at = now()
  WHERE id = p_cluster_id
  RETURNING attention_score INTO v_new_attention_score;

  -- Log in activity ledger
  INSERT INTO public.attention_activity_ledger (
    cluster_id, user_id, activity_type, revenue_amount, revenue_currency, mom_energy, metadata
  ) VALUES (
    p_cluster_id, v_sponsor, 'sponsorship', p_bid_amount, p_bid_currency, v_attention_energy,
    jsonb_build_object(
      'sponsorship_id', v_sponsor_id,
      'sponsor_name', p_sponsor_name,
      'attention_energy_pct', 60,
      'platform_energy_pct', 20,
      'builder_reward_pct', 20,
      'type', 'attention_sponsorship'
    )
  );

  -- Grant builder their 20% cut
  UPDATE public.profiles
  SET mom_energy = mom_energy + ROUND(p_bid_amount * 0.20, 2), updated_at = now()
  WHERE id = (SELECT created_by FROM public.attention_clusters WHERE id = p_cluster_id);

  RETURN jsonb_build_object(
    'sponsorship_id', v_sponsor_id,
    'status', 'active',
    'attention_energy_granted', v_attention_energy,
    'platform_energy', v_platform_energy,
    'builder_reward', ROUND(p_bid_amount * 0.20, 2),
    'new_attention_score', v_new_attention_score,
    'replaced_previous', v_current_sponsor IS NOT NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_attention_sponsorship(
  UUID, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT
) TO authenticated;


-- ══════════════════════════════════════════════════════════════
-- 4. SPONSORSHIP IMPRESSION / CLICK TRACKING
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.record_sponsorship_impression(p_sponsorship_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.attention_sponsorships
  SET impression_count = impression_count + 1, updated_at = now()
  WHERE id = p_sponsorship_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_sponsorship_impression(UUID) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.record_sponsorship_click(p_sponsorship_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.attention_sponsorships
  SET click_count = click_count + 1, updated_at = now()
  WHERE id = p_sponsorship_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_sponsorship_click(UUID) TO authenticated, anon;


-- ══════════════════════════════════════════════════════════════
-- 5. BIDDING ANALYTICS VIEWS
-- ══════════════════════════════════════════════════════════════

-- Active bids per slot
CREATE OR REPLACE VIEW public.ad_bid_leaderboard AS
SELECT
  b.position,
  b.bidder_id,
  p.display_name AS bidder_name,
  b.bid_amount,
  b.bid_currency,
  b.starts_at,
  b.ends_at,
  b.status,
  c.title AS campaign_title,
  ROW_NUMBER() OVER (
    PARTITION BY b.position
    ORDER BY b.bid_amount DESC
  ) AS rank
FROM public.ad_bids b
JOIN public.profiles p ON p.id = b.bidder_id
JOIN public.ad_campaigns c ON c.id = b.campaign_id
WHERE b.status IN ('approved', 'active');

-- Active sponsorships overview
CREATE OR REPLACE VIEW public.attention_sponsorship_overview AS
SELECT
  s.id,
  s.cluster_id,
  ac.title AS attention_title,
  ac.slug AS attention_slug,
  s.sponsor_name,
  s.sponsor_tagline,
  s.sponsor_url,
  s.bid_amount,
  s.bid_currency,
  s.energy_granted,
  s.impression_count,
  s.click_count,
  CASE
    WHEN s.impression_count > 0
    THEN ROUND((s.click_count::NUMERIC / s.impression_count) * 100, 2)
    ELSE 0
  END AS ctr_percent,
  s.starts_at,
  s.ends_at,
  s.status,
  s.created_at
FROM public.attention_sponsorships s
JOIN public.attention_clusters ac ON ac.id = s.cluster_id
ORDER BY s.created_at DESC;
