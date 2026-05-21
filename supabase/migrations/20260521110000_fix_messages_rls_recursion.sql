-- Fix infinite recursion in conversation_members RLS policy
-- The issue: conv_members_select references conversation_members within its own policy

-- 1. Create a SECURITY DEFINER helper function that bypasses RLS
CREATE OR REPLACE FUNCTION public.get_user_conversation_ids(uid UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT conversation_id FROM public.conversation_members WHERE user_id = uid;
$$;

-- 2. Drop the recursive policies
DROP POLICY IF EXISTS "conv_members_select" ON public.conversation_members;
DROP POLICY IF EXISTS "conversations_select_member" ON public.conversations;
DROP POLICY IF EXISTS "dm_select_member" ON public.direct_messages;
DROP POLICY IF EXISTS "dm_insert_member" ON public.direct_messages;

-- 3. Recreate policies using the helper function (no recursion)

-- conversation_members: see members of conversations you belong to
CREATE POLICY "conv_members_select"
  ON public.conversation_members FOR SELECT
  USING (
    conversation_id IN (SELECT public.get_user_conversation_ids(auth.uid()))
  );

-- conversations: see conversations you belong to
CREATE POLICY "conversations_select_member"
  ON public.conversations FOR SELECT
  USING (
    id IN (SELECT public.get_user_conversation_ids(auth.uid()))
  );

-- direct_messages: read messages in conversations you belong to
CREATE POLICY "dm_select_member"
  ON public.direct_messages FOR SELECT
  USING (
    conversation_id IN (SELECT public.get_user_conversation_ids(auth.uid()))
  );

-- direct_messages: send messages only as yourself in conversations you belong to
CREATE POLICY "dm_insert_member"
  ON public.direct_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (SELECT public.get_user_conversation_ids(auth.uid()))
  );
