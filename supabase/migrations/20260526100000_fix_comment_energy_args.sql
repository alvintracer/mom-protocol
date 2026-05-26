-- Hotfix: Fix apply_attention_energy_delta call argument order
-- The previous migration had wrong arg order (numeric, text) instead of (activity_type, numeric)

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
