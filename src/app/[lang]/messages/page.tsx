"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  RiArrowLeftSLine,
  RiChat1Line,
  RiEmotionHappyLine,
  RiMailLine,
  RiSendPlane2Fill,
  RiSearchLine,
  RiUserLine,
  RiAddLine,
} from "react-icons/ri";

import { AuthGuard } from "@/shared/components/auth/AuthGuard";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";

/* ── Types ──────────────────────────────────────────────────── */

type ConversationPreview = {
  conversation_id: string;
  other_user_id: string;
  other_display_name: string | null;
  other_avatar_url: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
  unread_count: number;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

/* ── Page ───────────────────────────────────────────────────── */

export default function MessagesPage() {
  return (
    <AuthGuard>
      {(_userId) => <MessagesContent />}
    </AuthGuard>
  );
}

function MessagesContent() {
  const { dictionary, t } = useI18n();
  const d = dictionary.messagesPage;
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; display_name: string | null }[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const searchParams = useSearchParams();
  const convParam = searchParams.get("conv");

  // Auto-open conversation from query param
  useEffect(() => {
    if (convParam && !loading) {
      setActiveConv(convParam);
    }
  }, [convParam, loading]);

  // Load conversations
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user || !mounted) {
        setLoading(false);
        return;
      }

      setCurrentUserId(userData.user.id);

      // Get conversations where user is a member
      const { data: memberRows } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", userData.user.id);

      if (!mounted) return;

      const convIds = (memberRows ?? []).map((r: { conversation_id: string }) => r.conversation_id);

      if (convIds.length === 0) {
        setLoading(false);
        return;
      }

      // For each conversation, get the other member and last message
      const previews: ConversationPreview[] = [];

      for (const convId of convIds) {
        // Join with profiles via FK — use explicit type for the join result
        const { data: otherMembers } = await supabase
          .from("conversation_members")
          .select("user_id")
          .eq("conversation_id", convId)
          .neq("user_id", userData.user.id)
          .limit(1);

        const { data: lastMsg } = await supabase
          .from("direct_messages")
          .select("body, created_at")
          .eq("conversation_id", convId)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(1);

        const other = otherMembers?.[0];
        if (other) {
          // Fetch profile separately for the other user
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("id", other.user_id)
            .maybeSingle();

          previews.push({
            conversation_id: convId,
            other_user_id: other.user_id,
            other_display_name: profile?.display_name ?? null,
            other_avatar_url: profile?.avatar_url ?? null,
            last_message_body: lastMsg?.[0]?.body ?? null,
            last_message_at: lastMsg?.[0]?.created_at ?? null,
            unread_count: 0,
          });
        }
      }

      if (mounted) {
        previews.sort((a, b) => {
          const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return tb - ta;
        });
        setConversations(previews);
        setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConv) return;
    let mounted = true;
    const supabase = createClient();

    async function loadMessages() {
      const convId = activeConv;
      if (!convId) return;
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("conversation_id", convId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true })
        .limit(100);

      if (mounted) {
        setMessages((data as Message[]) ?? []);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    }

    loadMessages();

    // Real-time subscription
    const channel = supabase
      .channel(`dm-${activeConv}`)
      .on(
        "postgres_changes" as unknown as "system",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${activeConv}` },
        (payload: { new: Message }) => {
          setMessages((prev) => {
            // Skip if already exists (optimistic or duplicate)
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [activeConv]);

  // Send message
  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || !activeConv || !currentUserId) return;
    const body = newMessage.trim();
    setNewMessage("");

    // Optimistic update — show the message immediately
    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      conversation_id: activeConv,
      sender_id: currentUserId,
      body,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    // Also update conversation list preview
    setConversations((prev) =>
      prev.map((c) =>
        c.conversation_id === activeConv
          ? { ...c, last_message_body: body, last_message_at: optimisticMsg.created_at }
          : c,
      ),
    );

    const supabase = createClient();
    const { data: inserted } = await supabase
      .from("direct_messages")
      .insert({
        conversation_id: activeConv,
        sender_id: currentUserId,
        body,
      })
      .select("*")
      .single();

    // Replace optimistic message with real one (to get real ID)
    if (inserted) {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticMsg.id ? (inserted as Message) : m)),
      );
    }
  }, [activeConv, currentUserId, newMessage]);

  // Search users for new conversation — only followed users
  useEffect(() => {
    if (searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      if (!currentUserId) return;
      const supabase = createClient();

      // Get IDs of users the current user follows
      const { data: followRows } = await supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", currentUserId);

      const followedIds = (followRows ?? []).map((r) => r.following_id);
      if (followedIds.length === 0) {
        setSearchResults([]);
        return;
      }

      // Filter followed users by search query
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", followedIds)
        .ilike("display_name", `%${searchQuery}%`)
        .limit(10);

      setSearchResults(
        (data ?? []) as { id: string; display_name: string | null }[],
      );
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, currentUserId]);

  // Start new conversation
  const startConversation = useCallback(async (otherUserId: string, otherName: string | null) => {
    if (!currentUserId) return;
    const supabase = createClient();

    // Check if conversation already exists
    const existing = conversations.find((c) => c.other_user_id === otherUserId);
    if (existing) {
      setActiveConv(existing.conversation_id);
      setShowNewChat(false);
      setSearchQuery("");
      return;
    }

    // Generate ID client-side to avoid RLS SELECT chicken-and-egg issue
    const convId = crypto.randomUUID();

    // Create conversation + members in sequence
    await supabase
      .from("conversations")
      .insert({ id: convId });

    await supabase
      .from("conversation_members")
      .insert([
        { conversation_id: convId, user_id: currentUserId },
        { conversation_id: convId, user_id: otherUserId },
      ]);

    const newPreview: ConversationPreview = {
      conversation_id: convId,
      other_user_id: otherUserId,
      other_display_name: otherName,
      other_avatar_url: null,
      last_message_body: null,
      last_message_at: null,
      unread_count: 0,
    };

    setConversations((prev) => [newPreview, ...prev]);
    setActiveConv(convId);
    setShowNewChat(false);
    setSearchQuery("");
  }, [conversations, currentUserId]);

  const activeConvData = conversations.find((c) => c.conversation_id === activeConv);

  return (
    <div className="flex flex-1 min-w-0 min-h-[calc(100vh-56px)]">
      {/* Conversation List */}
      <div className={`w-full border-r border-border sm:w-[30%] sm:max-w-[320px] sm:min-w-[240px] shrink-0 flex flex-col ${
        activeConv ? "hidden sm:flex" : "flex"
      }`}>
        {/* List Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h1 className="text-lg font-black text-foreground tracking-tight">
            {t(d.title)}
          </h1>
          <button
            onClick={() => setShowNewChat(!showNewChat)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <RiAddLine className="size-5" />
          </button>
        </div>

        {/* New Chat Search */}
        {showNewChat && (
          <div className="border-b border-border p-3 space-y-2">
            <div className="relative">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t(d.searchUsers)}
                className="w-full rounded-full border border-border bg-zinc-50 py-2 pl-9 pr-4 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none dark:bg-zinc-900/50"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-border bg-background">
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => startConversation(u.id, u.display_name)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
                      <RiUserLine className="size-3.5 text-zinc-500" />
                    </div>
                    <span className="text-[13px] font-semibold text-foreground">
                      {u.display_name ?? u.id.slice(0, 8)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Conversation List */}
        {loading ? (
          <div className="space-y-0 flex-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3.5">
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-3 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800/50">
              <RiMailLine className="size-8 text-zinc-400" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-bold text-foreground">{t(d.empty)}</p>
              <p className="mt-1 text-[13px] text-muted-foreground max-w-[220px]">{t(d.emptyDesc)}</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {conversations.map((conv) => (
              <button
                key={conv.conversation_id}
                onClick={() => setActiveConv(conv.conversation_id)}
                className={`flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40 ${
                  activeConv === conv.conversation_id ? "bg-blue-50/50 dark:bg-blue-500/5" : ""
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  <span className="text-[13px] font-black">
                    {(conv.other_display_name ?? "?")[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-bold text-foreground truncate">
                      {conv.other_display_name ?? conv.other_user_id.slice(0, 8)}
                    </p>
                    {conv.last_message_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                        {formatShortDate(conv.last_message_at)}
                      </span>
                    )}
                  </div>
                  {conv.last_message_body && (
                    <p className="mt-0.5 text-[12px] text-muted-foreground truncate">
                      {conv.last_message_body}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chat View */}
      <div className={`flex-1 flex flex-col min-w-0 ${
        !activeConv ? "hidden sm:flex" : "flex"
      }`}>
        {activeConv && activeConvData ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <button
                onClick={() => setActiveConv(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 sm:hidden"
              >
                <RiArrowLeftSLine className="size-5" />
              </button>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                <span className="text-[11px] font-black">
                  {(activeConvData.other_display_name ?? "?")[0]?.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-[14px] font-bold text-foreground">
                  {activeConvData.other_display_name ?? activeConvData.other_user_id.slice(0, 8)}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <RiChat1Line className="size-10 text-zinc-300 dark:text-zinc-700 mb-3" />
                  <p className="text-[13px] text-muted-foreground">{t(d.emptyDesc)}</p>
                </div>
              )}
              {messages.map((msg) => {
                const isMine = msg.sender_id === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                        isMine
                          ? "bg-blue-600 text-white rounded-br-md"
                          : "bg-zinc-100 text-foreground dark:bg-zinc-800 rounded-bl-md"
                      }`}
                    >
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                        {msg.body}
                      </p>
                      <p className={`mt-1 text-[10px] text-right ${
                        isMine ? "text-blue-200" : "text-muted-foreground"
                      }`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3">
              {/* Emoji Picker */}
              {showEmoji && (
                <div
                  ref={emojiRef}
                  className="mb-2 grid grid-cols-8 gap-1 rounded-xl border border-border bg-background p-2 shadow-lg sm:grid-cols-10"
                >
                  {EMOJI_LIST.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setNewMessage((prev) => prev + emoji);
                        setShowEmoji(false);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowEmoji(!showEmoji)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800"
                >
                  <RiEmotionHappyLine className="size-5" />
                </button>
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onCompositionStart={() => { composingRef.current = true; }}
                  onCompositionEnd={() => { composingRef.current = false; }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !composingRef.current && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={t(d.placeholder)}
                  className="flex-1 rounded-full border border-border bg-zinc-50 px-4 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none dark:bg-zinc-900/50"
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-all hover:bg-blue-700 disabled:opacity-40"
                >
                  <RiSendPlane2Fill className="size-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty state for desktop */
          <div className="hidden sm:flex flex-1 flex-col items-center justify-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800/50">
              <RiMailLine className="size-10 text-zinc-400" />
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-foreground">{t(d.title)}</p>
              <p className="mt-1 text-[13px] text-muted-foreground max-w-[280px]">{t(d.emptyDesc)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const EMOJI_LIST = [
  "😀", "😂", "🥹", "😍", "🤔", "😮", "😢", "🔥",
  "❤️", "👍", "👎", "🎉", "💯", "🙏", "👏", "💪",
  "✨", "⚡", "🚀", "🌟", "💡", "🤝", "😎", "🤣",
  "😱", "🥳", "👀", "💀", "🫡", "🤗", "😈", "🤩",
  "💰", "📈", "📉", "🏆", "⚽", "🎮", "🎵", "📸",
];

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
