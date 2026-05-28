-- Comment likes table + toggle RPC

-- 1. Create comment_likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment
  ON comment_likes(comment_id);

CREATE INDEX IF NOT EXISTS idx_comment_likes_user
  ON comment_likes(user_id, comment_id);

-- 2. Add like_count to comments if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'comments' AND column_name = 'like_count'
  ) THEN
    ALTER TABLE public.comments ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 3. Toggle comment like RPC
CREATE OR REPLACE FUNCTION public.toggle_comment_like(target_comment_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_exists BOOLEAN;
  v_new_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Check if already liked
  SELECT EXISTS(
    SELECT 1 FROM public.comment_likes
    WHERE user_id = v_user_id AND comment_id = target_comment_id
  ) INTO v_exists;

  IF v_exists THEN
    -- Unlike
    DELETE FROM public.comment_likes
    WHERE user_id = v_user_id AND comment_id = target_comment_id;

    UPDATE public.comments
    SET like_count = GREATEST(0, like_count - 1)
    WHERE id = target_comment_id
    RETURNING like_count INTO v_new_count;

    RETURN json_build_object('liked', false, 'like_count', COALESCE(v_new_count, 0));
  ELSE
    -- Like
    INSERT INTO public.comment_likes (user_id, comment_id)
    VALUES (v_user_id, target_comment_id);

    UPDATE public.comments
    SET like_count = like_count + 1
    WHERE id = target_comment_id
    RETURNING like_count INTO v_new_count;

    RETURN json_build_object('liked', true, 'like_count', COALESCE(v_new_count, 0));
  END IF;
END;
$$;

-- 4. RLS policies
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comment_likes_select" ON public.comment_likes
  FOR SELECT USING (true);

CREATE POLICY "comment_likes_insert" ON public.comment_likes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "comment_likes_delete" ON public.comment_likes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
