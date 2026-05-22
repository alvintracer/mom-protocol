-- ============================================================
-- Admin / Pinned Posts Feature
-- ============================================================

-- 1. Add is_pinned column to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

-- 2. Add admin_handle to identify the official momment. account
-- We use the handle 'user_24a90b1ffb' as the official account
-- No need for a separate admin table — just mark the user

-- 3. Create index for efficient pinned post queries
CREATE INDEX IF NOT EXISTS idx_posts_is_pinned ON public.posts (is_pinned) WHERE is_pinned = true;

-- 4. Grant the official account ability to pin (via RLS)
-- Only the official account can set is_pinned = true
CREATE OR REPLACE FUNCTION public.check_pin_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_handle text;
BEGIN
  -- Only check when is_pinned is being set to true
  IF NEW.is_pinned = true AND (OLD IS NULL OR OLD.is_pinned = false) THEN
    SELECT handle INTO v_handle FROM public.profiles WHERE id = NEW.user_id;
    IF v_handle IS DISTINCT FROM 'user_24a90b1ffb' THEN
      RAISE EXCEPTION 'Only the official momment. account can pin posts';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_pin_permission ON public.posts;
CREATE TRIGGER enforce_pin_permission
  BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.check_pin_permission();
