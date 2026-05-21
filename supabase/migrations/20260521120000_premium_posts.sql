-- =============================================================================
-- Premium Post feature: paid content gating with energy
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Add premium columns to posts table
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS premium_energy_cost NUMERIC DEFAULT NULL;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS premium_unlock_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS premium_total_earned NUMERIC NOT NULL DEFAULT 0;


-- ─────────────────────────────────────────────────────────────
-- 2. post_unlocks table — tracks which users unlocked which posts
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.post_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  energy_paid NUMERIC NOT NULL,
  author_earned NUMERIC NOT NULL,
  burn_amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS post_unlocks_post_idx ON public.post_unlocks(post_id);
CREATE INDEX IF NOT EXISTS post_unlocks_user_idx ON public.post_unlocks(user_id);

ALTER TABLE public.post_unlocks ENABLE ROW LEVEL SECURITY;

-- Anyone can see unlocks (to check if current user has unlocked)
CREATE POLICY "unlocks_select_own" ON public.post_unlocks
  FOR SELECT USING (user_id = auth.uid());

-- Inserts only via RPC (security definer)
CREATE POLICY "unlocks_insert_via_rpc" ON public.post_unlocks
  FOR INSERT WITH CHECK (false);


-- ─────────────────────────────────────────────────────────────
-- 3. unlock_premium_post RPC — 85% to author, 15% burned
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.unlock_premium_post(p_post_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_post RECORD;
  v_author_share NUMERIC;
  v_burn_amount NUMERIC;
  v_unlock_id UUID;
BEGIN
  -- Auth check
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Get post with lock
  SELECT id, user_id, is_premium, premium_energy_cost
  INTO v_post
  FROM public.posts
  WHERE id = p_post_id AND is_deleted = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'post_not_found';
  END IF;

  IF NOT v_post.is_premium THEN
    RAISE EXCEPTION 'post_is_not_premium';
  END IF;

  IF v_user_id = v_post.user_id THEN
    RAISE EXCEPTION 'cannot_unlock_own_post';
  END IF;

  -- Already unlocked?
  IF EXISTS (SELECT 1 FROM public.post_unlocks WHERE post_id = p_post_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'already_unlocked';
  END IF;

  -- Calculate split: 85% author, 15% burn
  v_author_share := ROUND(v_post.premium_energy_cost * 0.85, 2);
  v_burn_amount := v_post.premium_energy_cost - v_author_share;

  -- Deduct from reader
  UPDATE public.profiles
  SET mom_energy = mom_energy - v_post.premium_energy_cost, updated_at = now()
  WHERE id = v_user_id AND mom_energy >= v_post.premium_energy_cost;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_mom_energy';
  END IF;

  -- Credit author (85%)
  UPDATE public.profiles
  SET mom_energy = mom_energy + v_author_share, updated_at = now()
  WHERE id = v_post.user_id;

  -- Record unlock
  INSERT INTO public.post_unlocks (post_id, user_id, energy_paid, author_earned, burn_amount)
  VALUES (p_post_id, v_user_id, v_post.premium_energy_cost, v_author_share, v_burn_amount)
  RETURNING id INTO v_unlock_id;

  -- Update post stats
  UPDATE public.posts
  SET premium_unlock_count = premium_unlock_count + 1,
      premium_total_earned = premium_total_earned + v_author_share
  WHERE id = p_post_id;

  RETURN jsonb_build_object(
    'unlock_id', v_unlock_id,
    'energy_paid', v_post.premium_energy_cost,
    'author_earned', v_author_share,
    'burned', v_burn_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_premium_post(UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 4. get_post_detail_secure — server-side body truncation
--    Returns full body only if:
--      a) post is not premium, OR
--      b) caller is the author, OR
--      c) caller has unlocked
--    Otherwise: returns first 150 chars + "…"
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_post_detail_secure(p_post_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_post RECORD;
  v_is_unlocked BOOLEAN := false;
  v_can_view BOOLEAN := false;
  v_body TEXT;
  v_title TEXT;
BEGIN
  SELECT *
  INTO v_post
  FROM public.posts
  WHERE id = p_post_id AND is_deleted = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'post_not_found');
  END IF;

  -- Determine access
  IF NOT v_post.is_premium THEN
    v_can_view := true;
  ELSIF v_user_id IS NOT NULL AND v_user_id = v_post.user_id THEN
    v_can_view := true;
  ELSIF v_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.post_unlocks
    WHERE post_id = p_post_id AND user_id = v_user_id
  ) THEN
    v_can_view := true;
    v_is_unlocked := true;
  END IF;

  -- Truncate body if no access
  IF v_can_view THEN
    v_body := v_post.original_body;
    v_title := v_post.original_title;
  ELSE
    v_body := LEFT(v_post.original_body, 150);
    v_title := v_post.original_title;
  END IF;

  -- Increment view count
  UPDATE public.posts
  SET view_count = view_count + 1
  WHERE id = p_post_id;

  RETURN jsonb_build_object(
    'id', v_post.id,
    'user_id', v_post.user_id,
    'event_id', v_post.event_id,
    'attention_cluster_id', v_post.attention_cluster_id,
    'parent_post_id', v_post.parent_post_id,
    'repost_of_post_id', v_post.repost_of_post_id,
    'post_kind', v_post.post_kind,
    'selected_outcome', v_post.selected_outcome,
    'type', v_post.type,
    'visibility', v_post.visibility,
    'original_language', v_post.original_language,
    'original_title', v_title,
    'original_body', v_body,
    'link_title', v_post.link_title,
    'link_url', v_post.link_url,
    'link_image_url', v_post.link_image_url,
    'link_description', v_post.link_description,
    'media_items', v_post.media_items,
    'original_hash', v_post.original_hash,
    'translation_status', v_post.translation_status,
    'like_count', v_post.like_count,
    'comment_count', v_post.comment_count,
    'share_count', v_post.share_count,
    'view_count', v_post.view_count + 1,
    'is_deleted', v_post.is_deleted,
    'created_at', v_post.created_at,
    'updated_at', v_post.updated_at,
    'is_premium', v_post.is_premium,
    'premium_energy_cost', v_post.premium_energy_cost,
    'premium_unlock_count', v_post.premium_unlock_count,
    'premium_total_earned', v_post.premium_total_earned,
    'is_unlocked', v_is_unlocked,
    'can_view_full', v_can_view
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_post_detail_secure(UUID) TO anon, authenticated;


COMMIT;
