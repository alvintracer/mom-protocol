-- =============================================================================
-- Enable RLS on bookmarks table and create policies
-- =============================================================================

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Users can read their own bookmarks
CREATE POLICY "bookmarks_select_own" ON public.bookmarks
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own bookmarks
CREATE POLICY "bookmarks_insert_own" ON public.bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own bookmarks
CREATE POLICY "bookmarks_delete_own" ON public.bookmarks
  FOR DELETE USING (auth.uid() = user_id);
