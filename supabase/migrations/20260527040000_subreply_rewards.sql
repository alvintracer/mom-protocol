-- Migration: Sub-reply rewards + parent comment notification
-- 1. Add 'comment_royalty' to attention_activity_type enum
-- 2. Update handle_comment_attention_energy to reward parent comment author on sub-replies
-- 3. Update handle_comment_notification to notify parent comment author on sub-replies

/* ──────────────────────────────────────────────────────────
   1. ADD 'comment_royalty' TO ENUM
   ────────────────────────────────────────────────────────── */
DO $$
BEGIN
  ALTER TYPE public.attention_activity_type ADD VALUE IF NOT EXISTS 'comment_royalty';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


/* ──────────────────────────────────────────────────────────
   2. UPDATE handle_comment_attention_energy
   Add sub-reply reward: 0.1 MOM to parent comment author
   ────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.handle_comment_attention_energy()
RETURNS TRIGGER AS $$
DECLARE
  target_cluster_id uuid;
  v_post_author_id uuid;
  v_account_age interval;
  energy_delta numeric := 1.0;
  v_parent_comment_author_id uuid;
  v_parent_author_age interval;
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
    UPDATE public.profiles
    SET daily_author_royalty = CASE WHEN daily_royalty_date = CURRENT_DATE THEN daily_author_royalty ELSE 0 END,
        daily_royalty_date = CURRENT_DATE
    WHERE id = v_post_author_id;

    IF (SELECT daily_author_royalty FROM public.profiles WHERE id = v_post_author_id) < 40 THEN
      UPDATE public.profiles
      SET mom_energy = mom_energy + 0.2,
          daily_author_royalty = CASE WHEN daily_royalty_date = CURRENT_DATE THEN daily_author_royalty + 0.2 ELSE 0.2 END,
          daily_royalty_date = CURRENT_DATE, updated_at = now()
      WHERE id = v_post_author_id;

      IF target_cluster_id IS NOT NULL THEN
        INSERT INTO public.attention_activity_ledger (cluster_id, user_id, activity_type, mom_energy, metadata)
        VALUES (target_cluster_id, v_post_author_id, 'author_royalty', 0.2,
          jsonb_build_object('comment_id', NEW.id, 'commenter_id', NEW.user_id));
      END IF;
    END IF;
  END IF;

  -- ── SUB-REPLY COMMENT ROYALTY ──
  -- If this comment is a sub-reply, reward the parent comment author 0.1 MOM
  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_comment_author_id
    FROM public.comments
    WHERE id = NEW.parent_comment_id AND is_deleted = false;

    IF v_parent_comment_author_id IS NOT NULL
       AND v_parent_comment_author_id != NEW.user_id THEN
      -- Check parent comment author account age
      SELECT (now() - created_at) INTO v_parent_author_age
      FROM public.profiles WHERE id = v_parent_comment_author_id;

      IF v_parent_author_age >= INTERVAL '24 hours' THEN
        UPDATE public.profiles
        SET mom_energy = mom_energy + 0.1,
            updated_at = now()
        WHERE id = v_parent_comment_author_id;

        IF target_cluster_id IS NOT NULL THEN
          INSERT INTO public.attention_activity_ledger (cluster_id, user_id, activity_type, mom_energy, metadata)
          VALUES (target_cluster_id, v_parent_comment_author_id, 'comment_royalty', 0.1,
            jsonb_build_object('comment_id', NEW.id, 'parent_comment_id', NEW.parent_comment_id, 'sub_reply_author_id', NEW.user_id));
        END IF;
      END IF;
    END IF;
  END IF;

  -- ── ATTENTION ENERGY (only for posts with attention_cluster_id) ──
  IF target_cluster_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Grant energy to commenter
  IF v_account_age >= INTERVAL '24 hours' THEN
    PERFORM public.apply_attention_energy_delta(
      target_cluster_id, NEW.user_id, 'comment', energy_delta,
      0, 1, jsonb_build_object('comment_id', NEW.id, 'post_id', NEW.post_id)
    );
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


/* ──────────────────────────────────────────────────────────
   3. UPDATE handle_comment_notification
   Also notify parent comment author when someone replies
   to their comment (sub-reply notification)
   ────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.handle_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_post_author_id uuid;
  v_post_title text;
  v_commenter_name text;
  v_parent_comment_author_id uuid;
BEGIN
  -- Get post author
  SELECT user_id, COALESCE(original_title, LEFT(original_body, 40))
  INTO v_post_author_id, v_post_title
  FROM public.posts
  WHERE id = NEW.post_id AND is_deleted = false;

  -- Get commenter display name
  SELECT COALESCE(display_name, handle, 'user')
  INTO v_commenter_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Notify post author (skip if post not found or self-comment)
  IF v_post_author_id IS NOT NULL AND v_post_author_id != NEW.user_id THEN
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
  END IF;

  -- Notify parent comment author for sub-replies
  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_comment_author_id
    FROM public.comments
    WHERE id = NEW.parent_comment_id AND is_deleted = false;

    -- Don't notify self, and don't duplicate if parent comment author = post author
    IF v_parent_comment_author_id IS NOT NULL
       AND v_parent_comment_author_id != NEW.user_id
       AND (v_post_author_id IS NULL OR v_parent_comment_author_id != v_post_author_id) THEN
      INSERT INTO public.notifications (user_id, type, actor_id, reference_id, reference_type, title, href)
      VALUES (
        v_parent_comment_author_id,
        'comment',
        NEW.user_id,
        NEW.post_id,
        'post',
        v_commenter_name || '님이 대댓글을 남겼습니다',
        '/posts/' || NEW.post_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
