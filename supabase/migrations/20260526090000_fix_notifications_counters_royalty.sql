-- Migration: Fix comment notifications, post counters, and author royalty
-- 1. Comment notification trigger
-- 2. Atomic comment_count trigger
-- 3. Author royalty for posts without attention_cluster_id

/* ──────────────────────────────────────────────────────────
   1. COMMENT NOTIFICATION TRIGGER
   Creates a notification when someone comments on your post
   ────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.handle_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_post_author_id uuid;
  v_post_title text;
  v_commenter_name text;
BEGIN
  -- Get post author
  SELECT user_id, COALESCE(original_title, LEFT(original_body, 40))
  INTO v_post_author_id, v_post_title
  FROM public.posts
  WHERE id = NEW.post_id AND is_deleted = false;

  -- Don't notify if post not found or self-comment
  IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get commenter display name
  SELECT COALESCE(display_name, handle, 'user')
  INTO v_commenter_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Insert notification
  INSERT INTO public.notifications (user_id, type, actor_id, reference_id, reference_type, title, href)
  VALUES (
    v_post_author_id,
    'comment',
    NEW.user_id,
    NEW.post_id,
    'post',
    v_commenter_name || '님이 댓글을 남겼습니다',
    '/posts/' || NEW.post_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS comment_notification_after_insert ON public.comments;
CREATE TRIGGER comment_notification_after_insert
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_comment_notification();


/* ──────────────────────────────────────────────────────────
   2. ATOMIC COMMENT COUNT TRIGGERS
   Increment/decrement posts.comment_count via DB trigger
   ────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.handle_comment_count_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET comment_count = comment_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET comment_count = GREATEST(0, comment_count - 1)
    WHERE id = OLD.post_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle soft delete (is_deleted toggled)
    IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
      UPDATE public.posts
      SET comment_count = GREATEST(0, comment_count - 1)
      WHERE id = NEW.post_id;
    ELSIF OLD.is_deleted = true AND NEW.is_deleted = false THEN
      UPDATE public.posts
      SET comment_count = comment_count + 1
      WHERE id = NEW.post_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS comment_count_after_insert ON public.comments;
CREATE TRIGGER comment_count_after_insert
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_comment_count_change();

DROP TRIGGER IF EXISTS comment_count_after_delete ON public.comments;
CREATE TRIGGER comment_count_after_delete
  AFTER DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_comment_count_change();

DROP TRIGGER IF EXISTS comment_count_after_update ON public.comments;
CREATE TRIGGER comment_count_after_update
  AFTER UPDATE OF is_deleted ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_comment_count_change();


/* ──────────────────────────────────────────────────────────
   3. POST VIEW COUNT RPC
   Called from post detail page to increment view_count
   ────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.record_post_view(target_post_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.posts
  SET view_count = view_count + 1
  WHERE id = target_post_id AND is_deleted = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


/* ──────────────────────────────────────────────────────────
   4. FIX AUTHOR ROYALTY FOR POSTS WITHOUT ATTENTION CLUSTER
   Move author royalty logic before the attention_cluster_id guard
   ────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.handle_comment_attention_energy()
RETURNS TRIGGER AS $$
DECLARE
  target_cluster_id uuid;
  v_post_author_id uuid;
  v_account_age interval;
  energy_delta numeric := 1.0;
BEGIN
  -- Get post info
  SELECT posts.attention_cluster_id, posts.user_id
  INTO target_cluster_id, v_post_author_id
  FROM public.posts
  WHERE posts.id = NEW.post_id AND posts.is_deleted = false;

  -- Post not found
  IF v_post_author_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check commenter account age
  SELECT (now() - created_at) INTO v_account_age
  FROM public.profiles WHERE id = NEW.user_id;

  -- ── AUTHOR ROYALTY (runs regardless of attention_cluster_id) ──
  IF v_post_author_id IS NOT NULL AND v_post_author_id != NEW.user_id
     AND v_account_age >= INTERVAL '24 hours' THEN
    -- Reset daily counter if new day
    UPDATE public.profiles
    SET daily_author_royalty = CASE WHEN daily_royalty_date = CURRENT_DATE THEN daily_author_royalty ELSE 0 END,
        daily_royalty_date = CURRENT_DATE
    WHERE id = v_post_author_id;

    -- Grant royalty if under daily cap (40 MOM)
    IF (SELECT daily_author_royalty FROM public.profiles WHERE id = v_post_author_id) < 40 THEN
      UPDATE public.profiles
      SET mom_energy = mom_energy + 0.2,
          daily_author_royalty = CASE WHEN daily_royalty_date = CURRENT_DATE THEN daily_author_royalty + 0.2 ELSE 0.2 END,
          daily_royalty_date = CURRENT_DATE, updated_at = now()
      WHERE id = v_post_author_id;

      -- Log to ledger if attention cluster exists
      IF target_cluster_id IS NOT NULL THEN
        INSERT INTO public.attention_activity_ledger (cluster_id, user_id, activity_type, mom_energy, metadata)
        VALUES (target_cluster_id, v_post_author_id, 'author_royalty', 0.2,
          jsonb_build_object('comment_id', NEW.id, 'commenter_id', NEW.user_id));
      END IF;
    END IF;
  END IF;

  -- ── ATTENTION ENERGY (only for posts with attention_cluster_id) ──
  IF target_cluster_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Grant energy to commenter
  IF v_account_age >= INTERVAL '24 hours' THEN
    PERFORM public.apply_attention_energy_delta(target_cluster_id, NEW.user_id, energy_delta, 'comment');
  END IF;

  -- Builder royalty
  IF v_account_age >= INTERVAL '24 hours' THEN
    DECLARE
      v_builder_id uuid;
      v_builder_age interval;
    BEGIN
      SELECT created_by INTO v_builder_id
      FROM public.attention_clusters WHERE id = target_cluster_id;

      IF v_builder_id IS NOT NULL AND v_builder_id != NEW.user_id THEN
        SELECT (now() - created_at) INTO v_builder_age
        FROM public.profiles WHERE id = v_builder_id;

        IF v_builder_age >= INTERVAL '24 hours' THEN
          UPDATE public.profiles
          SET daily_builder_royalty = CASE WHEN daily_royalty_date = CURRENT_DATE THEN daily_builder_royalty ELSE 0 END,
              daily_royalty_date = CURRENT_DATE
          WHERE id = v_builder_id;

          IF (SELECT daily_builder_royalty FROM public.profiles WHERE id = v_builder_id) < 80 THEN
            UPDATE public.profiles
            SET mom_energy = mom_energy + 0.1,
                daily_builder_royalty = CASE WHEN daily_royalty_date = CURRENT_DATE THEN daily_builder_royalty + 0.1 ELSE 0.1 END,
                daily_royalty_date = CURRENT_DATE, updated_at = now()
            WHERE id = v_builder_id;

            INSERT INTO public.attention_activity_ledger (cluster_id, user_id, activity_type, mom_energy, metadata)
            VALUES (target_cluster_id, v_builder_id, 'builder_royalty', 0.1,
              jsonb_build_object('comment_id', NEW.id, 'commenter_id', NEW.user_id));
          END IF;
        END IF;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
