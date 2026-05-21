-- =============================================================================
-- Add INSERT policy for content_topics (user-selected topics)
-- Add RLS policy for topics INSERT (upsert from auto-tag API)
-- =============================================================================

BEGIN;

-- Allow authenticated users to insert their own topic links
DROP POLICY IF EXISTS "users can tag their own posts" ON public.content_topics;
CREATE POLICY "users can tag their own posts"
ON public.content_topics FOR INSERT
TO authenticated
WITH CHECK (
  source = 'user'
  AND target_type = 'post'
  AND EXISTS (
    SELECT 1 FROM public.posts
    WHERE id = target_id AND user_id = auth.uid()
  )
);

COMMIT;
