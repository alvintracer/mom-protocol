-- =============================================================================
-- Ad Network Placements — admin-managed ad scripts (Adsterra, AdSense, etc.)
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.ad_network_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  network_name TEXT NOT NULL,                   -- e.g. 'adsterra', 'adsense', 'carbon'
  unit_name TEXT NOT NULL,                      -- e.g. 'Popunder_1', 'SocialBar_1'
  unit_type TEXT NOT NULL DEFAULT 'script',     -- 'script', 'native_banner', 'popunder', 'social_bar'
  
  -- Where to place
  position TEXT NOT NULL DEFAULT 'sidebar',     -- 'sidebar', 'feed_top', 'feed_mid', 'feed_bottom', 'popunder', 'social_bar', 'global'
  
  -- The actual ad code
  script_code TEXT NOT NULL,                    -- Raw HTML/script code to inject
  
  -- Control
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,          -- Higher = shown first
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_network_active ON public.ad_network_placements(is_active, position);

-- RLS: only authenticated can read (for rendering), admin manages via API
ALTER TABLE public.ad_network_placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_network_placements_public_read" ON public.ad_network_placements;
CREATE POLICY "ad_network_placements_public_read"
  ON public.ad_network_placements FOR SELECT
  USING (true);

-- ─── Seed Adsterra units ───

INSERT INTO public.ad_network_placements (network_name, unit_name, unit_type, position, script_code, is_active, priority, notes)
VALUES
  (
    'adsterra', 'Popunder_1', 'popunder', 'global',
    '<script src="https://pl29536567.effectivecpmnetwork.com/62/0f/3b/620f3bb02c0646a09722ed31494477c1.js"></script>',
    true, 10,
    'Adsterra Popunder — loads globally once per session'
  ),
  (
    'adsterra', 'SocialBar_1', 'social_bar', 'global',
    '<script src="https://pl29536568.effectivecpmnetwork.com/85/e9/2c/85e92cab49bc762ed44dc644934de40e.js"></script>',
    true, 10,
    'Adsterra Social Bar — floating bar'
  ),
  (
    'adsterra', 'NativeBanner_1', 'native_banner', 'sidebar',
    '<script async="async" data-cfasync="false" src="https://pl29536569.effectivecpmnetwork.com/7aad2734dc4529e990fea0bb3ad3949d/invoke.js"></script><div id="container-7aad2734dc4529e990fea0bb3ad3949d"></div>',
    true, 5,
    'Adsterra Native Banner — sidebar placement'
  )
ON CONFLICT DO NOTHING;

COMMIT;
