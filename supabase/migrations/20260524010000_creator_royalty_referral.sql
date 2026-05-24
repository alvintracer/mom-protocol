-- =============================================================================
-- momment. Creator Royalty + Referral System
-- =============================================================================
-- Adds:
--   1. Creator Royalty: passive income for attention builders & post authors
--   2. Referral: invite bonus + 60-day revenue share
--   3. Removes: challenge-related economy elements
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 0. Extend activity type enum
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  BEGIN ALTER TYPE public.attention_activity_type ADD VALUE IF NOT EXISTS 'builder_royalty'; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TYPE public.attention_activity_type ADD VALUE IF NOT EXISTS 'author_royalty'; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TYPE public.attention_activity_type ADD VALUE IF NOT EXISTS 'referral_bonus'; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TYPE public.attention_activity_type ADD VALUE IF NOT EXISTS 'referral_share'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 1. Referrals table
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bonus_paid BOOLEAN NOT NULL DEFAULT false,
  share_expires_at TIMESTAMPTZ NOT NULL,
  daily_shared_today NUMERIC NOT NULL DEFAULT 0,
  daily_shared_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_shared NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_id);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals publicly readable" ON public.referrals;
CREATE POLICY "referrals publicly readable"
  ON public.referrals FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────
-- 2. Profile columns for royalty tracking + referral
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS referral_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_builder_royalty NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_author_royalty NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_royalty_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Auto-generate referral code from handle on profiles that don't have one
UPDATE public.profiles
SET referral_code = COALESCE(handle, LEFT(id::TEXT, 8))
WHERE referral_code IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. Creator Royalty: modify post trigger
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_post_attention_energy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  energy_delta NUMERIC;
  activity attention_activity_type;
  v_builder_id UUID;
  v_builder_royalty NUMERIC;
  v_original_author_id UUID;
  v_author_royalty NUMERIC;
  v_account_age INTERVAL;
BEGIN
  IF new.attention_cluster_id IS NULL OR new.is_deleted THEN
    RETURN new;
  END IF;

  -- Determine base energy
  IF new.post_kind IN ('repost', 'quote') THEN
    energy_delta := 1.5;
    activity := 'share';
  ELSIF new.post_kind = 'reply' THEN
    energy_delta := 1;
    activity := 'comment';
  ELSE
    energy_delta := 2;
    activity := 'post';
  END IF;

  -- Apply base energy to actor (unchanged)
  PERFORM public.apply_attention_energy_delta(
    new.attention_cluster_id,
    new.user_id,
    activity,
    energy_delta,
    1, 0,
    jsonb_build_object('post_id', new.id, 'post_kind', new.post_kind)
  );

  -- ─── Creator Royalty ─────────────────────────

  -- Get attention builder
  SELECT created_by INTO v_builder_id
  FROM public.attention_clusters
  WHERE id = new.attention_cluster_id;

  -- Builder royalty (only if builder ≠ actor, account > 24h)
  IF v_builder_id IS NOT NULL AND v_builder_id != new.user_id THEN
    SELECT (now() - created_at) INTO v_account_age
    FROM public.profiles WHERE id = new.user_id;

    IF v_account_age >= INTERVAL '24 hours' THEN
      IF new.post_kind IN ('repost', 'quote') THEN
        v_builder_royalty := 0.2;
      ELSIF new.post_kind = 'reply' THEN
        v_builder_royalty := 0.1;
      ELSE
        v_builder_royalty := 0.4;
      END IF;

      -- Check daily cap (80 MOM)
      UPDATE public.profiles
      SET daily_builder_royalty = CASE
            WHEN daily_royalty_date = CURRENT_DATE THEN daily_builder_royalty
            ELSE 0
          END,
          daily_royalty_date = CURRENT_DATE
      WHERE id = v_builder_id;

      IF (SELECT daily_builder_royalty FROM public.profiles WHERE id = v_builder_id) < 80 THEN
        UPDATE public.profiles
        SET mom_energy = mom_energy + v_builder_royalty,
            daily_builder_royalty = CASE
              WHEN daily_royalty_date = CURRENT_DATE THEN daily_builder_royalty + v_builder_royalty
              ELSE v_builder_royalty
            END,
            daily_royalty_date = CURRENT_DATE,
            updated_at = now()
        WHERE id = v_builder_id;

        INSERT INTO public.attention_activity_ledger (cluster_id, user_id, activity_type, mom_energy, metadata)
        VALUES (new.attention_cluster_id, v_builder_id, 'builder_royalty', v_builder_royalty,
          jsonb_build_object('source_post_id', new.id, 'source_user_id', new.user_id, 'post_kind', new.post_kind));
      END IF;
    END IF;
  END IF;

  -- Author royalty for repost/quote (original author gets +0.3)
  IF new.post_kind IN ('repost', 'quote') AND new.parent_post_id IS NOT NULL THEN
    SELECT user_id INTO v_original_author_id
    FROM public.posts
    WHERE id = new.parent_post_id AND is_deleted = false;

    IF v_original_author_id IS NOT NULL AND v_original_author_id != new.user_id THEN
      v_author_royalty := 0.3;

      UPDATE public.profiles
      SET daily_author_royalty = CASE
            WHEN daily_royalty_date = CURRENT_DATE THEN daily_author_royalty
            ELSE 0
          END,
          daily_royalty_date = CURRENT_DATE
      WHERE id = v_original_author_id;

      IF (SELECT daily_author_royalty FROM public.profiles WHERE id = v_original_author_id) < 40 THEN
        UPDATE public.profiles
        SET mom_energy = mom_energy + v_author_royalty,
            daily_author_royalty = CASE
              WHEN daily_royalty_date = CURRENT_DATE THEN daily_author_royalty + v_author_royalty
              ELSE v_author_royalty
            END,
            daily_royalty_date = CURRENT_DATE,
            updated_at = now()
        WHERE id = v_original_author_id;

        INSERT INTO public.attention_activity_ledger (cluster_id, user_id, activity_type, mom_energy, metadata)
        VALUES (new.attention_cluster_id, v_original_author_id, 'author_royalty', v_author_royalty,
          jsonb_build_object('repost_id', new.id, 'reposter_id', new.user_id));
      END IF;
    END IF;
  END IF;

  -- ─── Referral Share (5% of actor's energy → referrer) ────
  PERFORM public.apply_referral_share(new.user_id, energy_delta, new.attention_cluster_id);

  RETURN new;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. Creator Royalty: modify comment trigger
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_comment_attention_energy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_cluster_id UUID;
  v_post_author_id UUID;
  v_builder_id UUID;
  v_account_age INTERVAL;
BEGIN
  SELECT posts.attention_cluster_id, posts.user_id
  INTO target_cluster_id, v_post_author_id
  FROM public.posts
  WHERE posts.id = new.post_id AND posts.is_deleted = false;

  IF target_cluster_id IS NULL OR new.is_deleted THEN
    RETURN new;
  END IF;

  -- Base energy to commenter (unchanged: +1.0)
  PERFORM public.apply_attention_energy_delta(
    target_cluster_id, new.user_id, 'comment', 1, 0, 1,
    jsonb_build_object('comment_id', new.id, 'post_id', new.post_id)
  );

  -- Account age check
  SELECT (now() - created_at) INTO v_account_age
  FROM public.profiles WHERE id = new.user_id;

  IF v_account_age >= INTERVAL '24 hours' THEN

    -- Post author royalty (+0.2, if author ≠ commenter)
    IF v_post_author_id IS NOT NULL AND v_post_author_id != new.user_id THEN
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

        INSERT INTO public.attention_activity_ledger (cluster_id, user_id, activity_type, mom_energy, metadata)
        VALUES (target_cluster_id, v_post_author_id, 'author_royalty', 0.2,
          jsonb_build_object('comment_id', new.id, 'commenter_id', new.user_id));
      END IF;
    END IF;

    -- Builder royalty (+0.1, if builder ≠ commenter)
    SELECT created_by INTO v_builder_id
    FROM public.attention_clusters WHERE id = target_cluster_id;

    IF v_builder_id IS NOT NULL AND v_builder_id != new.user_id THEN
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
          jsonb_build_object('comment_id', new.id, 'commenter_id', new.user_id));
      END IF;
    END IF;

  END IF;

  -- Referral share
  PERFORM public.apply_referral_share(new.user_id, 1.0, target_cluster_id);

  RETURN new;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5. Creator Royalty: modify reaction trigger
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_post_reaction_attention_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_cluster_id UUID;
  actor_user_id UUID;
  score_delta NUMERIC;
  v_post_author_id UUID;
BEGIN
  IF tg_op = 'INSERT' THEN
    SELECT posts.attention_cluster_id, posts.user_id
    INTO target_cluster_id, v_post_author_id
    FROM public.posts
    WHERE posts.id = new.post_id AND posts.is_deleted = false;

    actor_user_id := new.user_id;
    score_delta := 0.05;
  ELSIF tg_op = 'DELETE' THEN
    SELECT posts.attention_cluster_id
    INTO target_cluster_id
    FROM public.posts
    WHERE posts.id = old.post_id AND posts.is_deleted = false;

    actor_user_id := old.user_id;
    score_delta := -0.05;
    v_post_author_id := NULL;
  END IF;

  IF target_cluster_id IS NOT NULL THEN
    UPDATE public.attention_clusters
    SET attention_score = greatest(attention_score + score_delta, 0), updated_at = now()
    WHERE id = target_cluster_id;

    IF score_delta > 0 AND actor_user_id IS NOT NULL THEN
      UPDATE public.profiles
      SET mom_energy = mom_energy + score_delta, updated_at = now()
      WHERE id = actor_user_id;

      -- Author royalty (+0.01, if author ≠ reactor)
      IF v_post_author_id IS NOT NULL AND v_post_author_id != actor_user_id THEN
        UPDATE public.profiles
        SET daily_author_royalty = CASE WHEN daily_royalty_date = CURRENT_DATE THEN daily_author_royalty ELSE 0 END,
            daily_royalty_date = CURRENT_DATE
        WHERE id = v_post_author_id;

        IF (SELECT daily_author_royalty FROM public.profiles WHERE id = v_post_author_id) < 40 THEN
          UPDATE public.profiles
          SET mom_energy = mom_energy + 0.01,
              daily_author_royalty = CASE WHEN daily_royalty_date = CURRENT_DATE THEN daily_author_royalty + 0.01 ELSE 0.01 END,
              daily_royalty_date = CURRENT_DATE, updated_at = now()
          WHERE id = v_post_author_id;
        END IF;
      END IF;

      -- Referral share
      PERFORM public.apply_referral_share(actor_user_id, score_delta, target_cluster_id);
    END IF;
  END IF;

  IF tg_op = 'DELETE' THEN RETURN old; END IF;
  RETURN new;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. Referral share helper
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_referral_share(
  p_actor_id UUID,
  p_energy_earned NUMERIC,
  p_cluster_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_share NUMERIC;
  v_daily_shared NUMERIC;
  v_daily_date DATE;
BEGIN
  IF p_energy_earned <= 0 THEN RETURN; END IF;

  -- Check if actor was referred and referral is still active
  SELECT r.referrer_id, r.daily_shared_today, r.daily_shared_date
  INTO v_referrer_id, v_daily_shared, v_daily_date
  FROM public.referrals r
  WHERE r.referred_id = p_actor_id
    AND r.share_expires_at > now()
  LIMIT 1;

  IF v_referrer_id IS NULL THEN RETURN; END IF;

  -- Reset daily counter if new day
  IF v_daily_date != CURRENT_DATE THEN
    v_daily_shared := 0;
  END IF;

  -- Check daily cap (15 MOM)
  IF v_daily_shared >= 15 THEN RETURN; END IF;

  -- 5% share
  v_share := LEAST(ROUND(p_energy_earned * 0.05, 4), 15 - v_daily_shared);
  IF v_share <= 0 THEN RETURN; END IF;

  -- Grant to referrer
  UPDATE public.profiles
  SET mom_energy = mom_energy + v_share, updated_at = now()
  WHERE id = v_referrer_id;

  -- Update referral tracking
  UPDATE public.referrals
  SET daily_shared_today = CASE WHEN daily_shared_date = CURRENT_DATE THEN daily_shared_today + v_share ELSE v_share END,
      daily_shared_date = CURRENT_DATE,
      total_shared = total_shared + v_share
  WHERE referred_id = p_actor_id;

END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 7. Claim referral bonus RPC
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.claim_referral_bonus(p_referral_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_referrer_id UUID;
  v_referrer_count INTEGER;
  v_bonus NUMERIC := 30;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Check not already referred
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = v_user_id) THEN
    RAISE EXCEPTION 'already_referred';
  END IF;

  -- Find referrer
  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE referral_code = p_referral_code AND id != v_user_id;

  IF v_referrer_id IS NULL THEN
    RAISE EXCEPTION 'invalid_referral_code';
  END IF;

  -- Check referrer hasn't exceeded 100 referrals
  SELECT referral_count INTO v_referrer_count
  FROM public.profiles WHERE id = v_referrer_id;

  IF v_referrer_count >= 100 THEN
    RAISE EXCEPTION 'referrer_limit_reached';
  END IF;

  -- Create referral record
  INSERT INTO public.referrals (referrer_id, referred_id, bonus_paid, share_expires_at)
  VALUES (v_referrer_id, v_user_id, true, now() + INTERVAL '60 days');

  -- Grant bonus to both
  UPDATE public.profiles SET mom_energy = mom_energy + v_bonus, referred_by = v_referrer_id, updated_at = now()
  WHERE id = v_user_id;

  UPDATE public.profiles SET mom_energy = mom_energy + v_bonus, referral_count = referral_count + 1, updated_at = now()
  WHERE id = v_referrer_id;

  RETURN jsonb_build_object(
    'success', true,
    'bonus', v_bonus,
    'referrer_id', v_referrer_id,
    'share_expires_at', (now() + INTERVAL '60 days')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_referral_bonus(TEXT) TO authenticated;

COMMIT;
