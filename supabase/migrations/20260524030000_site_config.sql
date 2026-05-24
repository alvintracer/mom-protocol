BEGIN;

CREATE TABLE IF NOT EXISTS public.site_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_config_public_read" ON public.site_config;
CREATE POLICY "site_config_public_read"
  ON public.site_config FOR SELECT USING (true);

-- Seed defaults
INSERT INTO public.site_config (key, value) VALUES
  ('feed_ad_interval', '{"feed": 5, "board": 10}')
ON CONFLICT (key) DO NOTHING;

COMMIT;
