-- =============================================================================
-- Ad Campaigns: self-serve ad system + impression/click tracking
-- Supports: platform-managed campaigns, per-attention scoped ads,
--           position targeting, and AdSense fallback metrics
-- =============================================================================

-- ── Ad Campaigns ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID REFERENCES auth.users(id),  -- NULL = platform-managed
  advertiser_name TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  image_url TEXT,
  destination_url TEXT NOT NULL,
  cta_label TEXT,
  -- Targeting
  positions TEXT[] NOT NULL DEFAULT '{sidebar}',  -- feed_top, feed_mid, feed_bottom, sidebar, attention_top, attention_sidebar
  cluster_id UUID REFERENCES public.attention_clusters(id) ON DELETE SET NULL,
  -- Scheduling
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,               -- NULL = no end date
  -- Budget & billing
  budget_type TEXT NOT NULL DEFAULT 'free' CHECK (budget_type IN ('free', 'cpm', 'cpc', 'flat')),
  budget_amount NUMERIC DEFAULT 0,
  spent_amount NUMERIC NOT NULL DEFAULT 0,
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'rejected')),
  priority INTEGER NOT NULL DEFAULT 0,  -- higher = shown first
  -- Audit
  impression_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_active
  ON ad_campaigns(status, priority DESC, starts_at);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_cluster
  ON ad_campaigns(cluster_id) WHERE cluster_id IS NOT NULL;

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad campaigns are publicly readable" ON public.ad_campaigns;
CREATE POLICY "ad campaigns are publicly readable"
  ON public.ad_campaigns FOR SELECT
  USING (status = 'active');

-- ── Ad Impressions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  cluster_id UUID REFERENCES public.attention_clusters(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_campaign
  ON ad_impressions(campaign_id, created_at DESC);

ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "impressions insertable by anyone" ON public.ad_impressions;
CREATE POLICY "impressions insertable by anyone"
  ON public.ad_impressions FOR INSERT
  WITH CHECK (true);

-- ── Ad Clicks ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ad_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  cluster_id UUID REFERENCES public.attention_clusters(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_clicks_campaign
  ON ad_clicks(campaign_id, created_at DESC);

ALTER TABLE public.ad_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clicks insertable by anyone" ON public.ad_clicks;
CREATE POLICY "clicks insertable by anyone"
  ON public.ad_clicks FOR INSERT
  WITH CHECK (true);

-- ── Auto-increment counters via triggers ───────────────────────
CREATE OR REPLACE FUNCTION public.increment_ad_impression_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ad_campaigns
  SET impression_count = impression_count + 1, updated_at = now()
  WHERE id = NEW.campaign_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ad_impression_counter ON public.ad_impressions;
CREATE TRIGGER ad_impression_counter
  AFTER INSERT ON public.ad_impressions
  FOR EACH ROW EXECUTE FUNCTION public.increment_ad_impression_count();

CREATE OR REPLACE FUNCTION public.increment_ad_click_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ad_campaigns
  SET click_count = click_count + 1, updated_at = now()
  WHERE id = NEW.campaign_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ad_click_counter ON public.ad_clicks;
CREATE TRIGGER ad_click_counter
  AFTER INSERT ON public.ad_clicks
  FOR EACH ROW EXECUTE FUNCTION public.increment_ad_click_count();

-- ── Campaign performance view ──────────────────────────────────
CREATE OR REPLACE VIEW public.ad_campaign_performance AS
SELECT
  c.id,
  c.advertiser_name,
  c.title,
  c.status,
  c.positions,
  c.budget_type,
  c.budget_amount,
  c.spent_amount,
  c.impression_count,
  c.click_count,
  CASE
    WHEN c.impression_count > 0
    THEN ROUND((c.click_count::numeric / c.impression_count) * 100, 2)
    ELSE 0
  END AS ctr_percent,
  c.starts_at,
  c.ends_at,
  c.created_at
FROM public.ad_campaigns c
ORDER BY c.created_at DESC;
