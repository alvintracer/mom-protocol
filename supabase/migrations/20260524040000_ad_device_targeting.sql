BEGIN;

ALTER TABLE public.ad_network_placements
  ADD COLUMN IF NOT EXISTS device TEXT NOT NULL DEFAULT 'all';

COMMENT ON COLUMN public.ad_network_placements.device IS 'Target device: all, desktop, mobile';

COMMIT;
