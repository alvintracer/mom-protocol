-- Comment outcome selection + outcome counts RPC

-- 1. Add selected_outcome to comments
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS selected_outcome TEXT;

-- 2. RPC to get outcome counts (posts + comments combined)
CREATE OR REPLACE FUNCTION public.get_outcome_counts(p_cluster_id UUID)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT outcome, SUM(cnt)::integer AS count FROM (
      -- Posts
      SELECT selected_outcome AS outcome, COUNT(*)::integer AS cnt
      FROM posts
      WHERE attention_cluster_id = p_cluster_id
        AND selected_outcome IS NOT NULL AND is_deleted = false
      GROUP BY selected_outcome
      UNION ALL
      -- Comments on those posts
      SELECT c.selected_outcome AS outcome, COUNT(*)::integer AS cnt
      FROM comments c
      JOIN posts p ON c.post_id = p.id
      WHERE p.attention_cluster_id = p_cluster_id
        AND c.selected_outcome IS NOT NULL AND c.is_deleted = false
      GROUP BY c.selected_outcome
    ) combined
    GROUP BY outcome
  ) t;
  RETURN COALESCE(result, '[]'::json);
END;
$$;
