-- =============================================================================
-- Phase 1: User Interest Profiling System
-- Creates user_interests table + update function + triggers on all signal tables
-- =============================================================================

BEGIN;

-- ─── 1. user_interests table ───

CREATE TABLE IF NOT EXISTS public.user_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL DEFAULT 0,
  interaction_count INT NOT NULL DEFAULT 0,
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, topic_id)
);

CREATE INDEX IF NOT EXISTS user_interests_user_score_idx
ON public.user_interests(user_id, score DESC);

CREATE INDEX IF NOT EXISTS user_interests_topic_idx
ON public.user_interests(topic_id);

DROP TRIGGER IF EXISTS user_interests_set_updated_at ON public.user_interests;
CREATE TRIGGER user_interests_set_updated_at
BEFORE UPDATE ON public.user_interests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can read own interests" ON public.user_interests;
CREATE POLICY "users can read own interests"
ON public.user_interests FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "service can manage all interests" ON public.user_interests;
CREATE POLICY "service can manage all interests"
ON public.user_interests FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ─── 2. Core function: update_user_interest ───
-- Upserts a score for user+topic, adding the weighted signal

CREATE OR REPLACE FUNCTION public.update_user_interest(
  p_user_id UUID,
  p_post_id UUID,
  p_signal_weight NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
BEGIN
  -- Find all topics linked to this post
  FOR rec IN
    SELECT topic_id, COALESCE(confidence, 0.8) AS confidence
    FROM public.content_topics
    WHERE target_type = 'post' AND target_id = p_post_id
  LOOP
    INSERT INTO public.user_interests (user_id, topic_id, score, interaction_count, last_interaction_at)
    VALUES (
      p_user_id,
      rec.topic_id,
      p_signal_weight * rec.confidence,
      1,
      now()
    )
    ON CONFLICT (user_id, topic_id)
    DO UPDATE SET
      score = user_interests.score + p_signal_weight * rec.confidence,
      interaction_count = user_interests.interaction_count + 1,
      last_interaction_at = now(),
      updated_at = now();
  END LOOP;
END;
$$;


-- ─── 3. Same for attention clusters ───

CREATE OR REPLACE FUNCTION public.update_user_interest_for_attention(
  p_user_id UUID,
  p_attention_id UUID,
  p_signal_weight NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT topic_id, COALESCE(confidence, 0.8) AS confidence
    FROM public.content_topics
    WHERE target_type = 'attention' AND target_id = p_attention_id
  LOOP
    INSERT INTO public.user_interests (user_id, topic_id, score, interaction_count, last_interaction_at)
    VALUES (
      p_user_id,
      rec.topic_id,
      p_signal_weight * rec.confidence,
      1,
      now()
    )
    ON CONFLICT (user_id, topic_id)
    DO UPDATE SET
      score = user_interests.score + p_signal_weight * rec.confidence,
      interaction_count = user_interests.interaction_count + 1,
      last_interaction_at = now(),
      updated_at = now();
  END LOOP;
END;
$$;


-- ─── 4. Trigger functions ───

-- 4a. post_reactions (likes): weight 2.0
CREATE OR REPLACE FUNCTION public.trg_interest_on_post_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.update_user_interest(NEW.user_id, NEW.post_id, 2.0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS interest_on_post_reaction ON public.post_reactions;
CREATE TRIGGER interest_on_post_reaction
AFTER INSERT ON public.post_reactions
FOR EACH ROW
EXECUTE FUNCTION public.trg_interest_on_post_reaction();


-- 4b. bookmarks: weight 3.0
CREATE OR REPLACE FUNCTION public.trg_interest_on_bookmark()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.target_type = 'post' THEN
    PERFORM public.update_user_interest(NEW.user_id, NEW.target_id, 3.0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS interest_on_bookmark ON public.bookmarks;
CREATE TRIGGER interest_on_bookmark
AFTER INSERT ON public.bookmarks
FOR EACH ROW
EXECUTE FUNCTION public.trg_interest_on_bookmark();


-- 4c. comments: weight 2.5
CREATE OR REPLACE FUNCTION public.trg_interest_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.update_user_interest(NEW.user_id, NEW.post_id, 2.5);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS interest_on_comment ON public.comments;
CREATE TRIGGER interest_on_comment
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.trg_interest_on_comment();


-- 4d. post_unlocks (premium): weight 4.0
CREATE OR REPLACE FUNCTION public.trg_interest_on_post_unlock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.update_user_interest(NEW.user_id, NEW.post_id, 4.0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS interest_on_post_unlock ON public.post_unlocks;
CREATE TRIGGER interest_on_post_unlock
AFTER INSERT ON public.post_unlocks
FOR EACH ROW
EXECUTE FUNCTION public.trg_interest_on_post_unlock();


-- 4e. attention_memberships: weight 3.5
CREATE OR REPLACE FUNCTION public.trg_interest_on_attention_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.update_user_interest_for_attention(NEW.user_id, NEW.attention_cluster_id, 3.5);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS interest_on_attention_join ON public.attention_memberships;
CREATE TRIGGER interest_on_attention_join
AFTER INSERT ON public.attention_memberships
FOR EACH ROW
EXECUTE FUNCTION public.trg_interest_on_attention_join();


-- 4f. content_topics (when LLM tags a post, update the author's interests): weight 3.0
CREATE OR REPLACE FUNCTION public.trg_interest_on_content_topic()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_author_id UUID;
  v_weight NUMERIC;
BEGIN
  -- Only for post tags
  IF NEW.target_type != 'post' THEN
    RETURN NEW;
  END IF;

  -- Get the post author
  SELECT user_id INTO v_author_id
  FROM public.posts
  WHERE id = NEW.target_id;

  IF v_author_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- User-selected topics get higher weight than LLM-tagged
  IF NEW.source = 'user' THEN
    v_weight := 5.0;
  ELSE
    v_weight := 3.0;
  END IF;

  INSERT INTO public.user_interests (user_id, topic_id, score, interaction_count, last_interaction_at)
  VALUES (
    v_author_id,
    NEW.topic_id,
    v_weight * COALESCE(NEW.confidence, 0.8),
    1,
    now()
  )
  ON CONFLICT (user_id, topic_id)
  DO UPDATE SET
    score = user_interests.score + v_weight * COALESCE(NEW.confidence, 0.8),
    interaction_count = user_interests.interaction_count + 1,
    last_interaction_at = now(),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS interest_on_content_topic ON public.content_topics;
CREATE TRIGGER interest_on_content_topic
AFTER INSERT ON public.content_topics
FOR EACH ROW
EXECUTE FUNCTION public.trg_interest_on_content_topic();


-- ─── 5. Score decay function (to be called periodically via cron) ───

CREATE OR REPLACE FUNCTION public.decay_user_interests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Apply 5% daily decay: score *= 0.95^days_since_last_update
  UPDATE public.user_interests
  SET
    score = score * POWER(0.95, EXTRACT(EPOCH FROM (now() - updated_at)) / 86400),
    updated_at = now()
  WHERE score > 0.01;

  -- Remove negligible interests
  DELETE FROM public.user_interests
  WHERE score < 0.01;
END;
$$;


-- ─── 6. Recommended posts function ───

CREATE OR REPLACE FUNCTION public.get_recommended_post_ids(
  p_user_id UUID,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (post_id UUID, relevance_score NUMERIC)
LANGUAGE sql
STABLE
AS $$
  WITH user_topics AS (
    SELECT topic_id, score
    FROM public.user_interests
    WHERE user_id = p_user_id
      AND score > 0.1
    ORDER BY score DESC
    LIMIT 20
  ),
  candidate_posts AS (
    SELECT DISTINCT ct.target_id AS pid,
           SUM(ut.score * COALESCE(ct.confidence, 0.8)) AS topic_score
    FROM public.content_topics ct
    JOIN user_topics ut ON ct.topic_id = ut.topic_id
    WHERE ct.target_type = 'post'
      AND ct.created_at > now() - INTERVAL '7 days'
    GROUP BY ct.target_id
  )
  SELECT cp.pid AS post_id,
         cp.topic_score
         + (1.0 / (1 + EXTRACT(EPOCH FROM now() - p.created_at) / 86400))
         + LN(1 + GREATEST(p.like_count, 0) + GREATEST(p.comment_count, 0) * 2)
         AS relevance_score
  FROM candidate_posts cp
  JOIN public.posts p ON p.id = cp.pid
  WHERE p.is_deleted = false
    AND p.visibility = 'public'
    AND p.user_id != p_user_id
  ORDER BY relevance_score DESC
  LIMIT p_limit;
$$;

COMMIT;
