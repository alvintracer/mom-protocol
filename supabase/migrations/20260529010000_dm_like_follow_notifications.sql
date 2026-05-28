-- Migration: Add notification triggers for DMs, likes, and follows
-- These notifications appear in the /notifications tab

/* ──────────────────────────────────────────────────────────
   1. DM (DIRECT MESSAGE) NOTIFICATION TRIGGER
   Creates a notification when someone sends you a message
   ────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.handle_dm_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_recipient_id uuid;
  v_sender_name text;
BEGIN
  -- Find the other member in this conversation
  SELECT user_id INTO v_recipient_id
  FROM public.conversation_members
  WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id
  LIMIT 1;

  -- No recipient found or self-message
  IF v_recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get sender display name
  SELECT COALESCE(display_name, handle, 'user')
  INTO v_sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  -- Insert notification
  INSERT INTO public.notifications (user_id, type, actor_id, reference_id, reference_type, title, body, href)
  VALUES (
    v_recipient_id,
    'direct_message',
    NEW.sender_id,
    NEW.conversation_id,
    'conversation',
    v_sender_name || '님이 메시지를 보냈습니다',
    LEFT(NEW.body, 100),
    '/messages?conv=' || NEW.conversation_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS dm_notification_after_insert ON public.direct_messages;
CREATE TRIGGER dm_notification_after_insert
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_dm_notification();


/* ──────────────────────────────────────────────────────────
   2. LIKE NOTIFICATION TRIGGER
   Creates a notification when someone likes your post
   ────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.handle_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_post_author_id uuid;
  v_post_title text;
  v_liker_name text;
BEGIN
  -- Get post author
  SELECT user_id, COALESCE(original_title, LEFT(original_body, 40))
  INTO v_post_author_id, v_post_title
  FROM public.posts
  WHERE id = NEW.post_id AND is_deleted = false;

  -- Don't notify if post not found or self-like
  IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get liker display name
  SELECT COALESCE(display_name, handle, 'user')
  INTO v_liker_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Insert notification
  INSERT INTO public.notifications (user_id, type, actor_id, reference_id, reference_type, title, href)
  VALUES (
    v_post_author_id,
    'like',
    NEW.user_id,
    NEW.post_id::text,
    'post',
    v_liker_name || '님이 좋아요를 눌렀습니다',
    '/posts/' || NEW.post_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS like_notification_after_insert ON public.post_reactions;
CREATE TRIGGER like_notification_after_insert
  AFTER INSERT ON public.post_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_like_notification();


/* ──────────────────────────────────────────────────────────
   3. FOLLOW NOTIFICATION TRIGGER
   Creates a notification when someone follows you
   ────────────────────────────────────────────────────────── */

CREATE OR REPLACE FUNCTION public.handle_follow_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_follower_name text;
  v_follower_handle text;
BEGIN
  -- Get follower display name and handle
  SELECT COALESCE(display_name, handle, 'user'), handle
  INTO v_follower_name, v_follower_handle
  FROM public.profiles
  WHERE id = NEW.follower_id;

  -- Insert notification for the followed user
  INSERT INTO public.notifications (user_id, type, actor_id, reference_id, reference_type, title, href)
  VALUES (
    NEW.following_id,
    'follow',
    NEW.follower_id,
    NEW.follower_id::text,
    'follow',
    v_follower_name || '님이 팔로우했습니다',
    '/u/' || COALESCE(v_follower_handle, NEW.follower_id::text)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS follow_notification_after_insert ON public.user_follows;
CREATE TRIGGER follow_notification_after_insert
  AFTER INSERT ON public.user_follows
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_follow_notification();
