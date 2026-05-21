-- Messages RLS: conversations, conversation_members, direct_messages
-- Enable RLS on all three tables

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- ── conversations ──────────────────────────────────────────────

-- SELECT: only conversations where the user is a member
CREATE POLICY "conversations_select_member"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = id
        AND cm.user_id = auth.uid()
    )
  );

-- INSERT: any authenticated user can create a conversation
CREATE POLICY "conversations_insert_auth"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── conversation_members ──────────────────────────────────────

-- SELECT: can see members of conversations you belong to
CREATE POLICY "conv_members_select"
  ON public.conversation_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
        AND cm.user_id = auth.uid()
    )
  );

-- INSERT: authenticated users can add members (themselves or others when creating)
CREATE POLICY "conv_members_insert"
  ON public.conversation_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── direct_messages ───────────────────────────────────────────

-- SELECT: can read messages in conversations you belong to
CREATE POLICY "dm_select_member"
  ON public.direct_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = direct_messages.conversation_id
        AND cm.user_id = auth.uid()
    )
  );

-- INSERT: can send messages only as yourself in conversations you belong to
CREATE POLICY "dm_insert_member"
  ON public.direct_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = direct_messages.conversation_id
        AND cm.user_id = auth.uid()
    )
  );

-- UPDATE: only the sender can soft-delete their own messages
CREATE POLICY "dm_update_sender"
  ON public.direct_messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());
