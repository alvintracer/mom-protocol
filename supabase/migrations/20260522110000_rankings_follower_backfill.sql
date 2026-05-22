-- ============================================================
-- Update contributor rankings view to include follower_count
-- Backfill 5/21 rate history with 5/20 values
-- ============================================================

-- 1. Update the view to include follower_count from profiles
DROP VIEW IF EXISTS public.platform_contributor_rankings;
CREATE VIEW public.platform_contributor_rankings AS
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
  p.follower_count,
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

-- 2. Backfill 5/21 with 5/20 data
INSERT INTO public.platform_rate_history (snapshot_date, vault_usd, total_mom_supply, mom_rate)
SELECT '2026-05-21'::date, vault_usd, total_mom_supply, mom_rate
FROM public.platform_rate_history
WHERE snapshot_date = '2026-05-20'
ON CONFLICT (snapshot_date) DO NOTHING;
