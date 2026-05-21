-- =============================================================================
-- Add content_format column to posts for rich text support
-- =============================================================================

BEGIN;

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS content_format TEXT NOT NULL DEFAULT 'plain';

-- Update get_post_detail_secure to include content_format
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
    -- For HTML content, strip tags then truncate
    IF v_post.content_format = 'html' THEN
      v_body := LEFT(regexp_replace(v_post.original_body, '<[^>]+>', '', 'g'), 150);
    ELSE
      v_body := LEFT(v_post.original_body, 150);
    END IF;
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
    'can_view_full', v_can_view,
    'content_format', v_post.content_format
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_post_detail_secure(UUID) TO anon, authenticated;

COMMIT;
