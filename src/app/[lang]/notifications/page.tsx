"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RiChat1Line,
  RiCheckDoubleLine,
  RiHeartLine,
  RiMailLine,
  RiNotification4Line,
  RiRepeatLine,
  RiShieldCheckLine,
  RiUserAddLine,
  RiAtLine,
  RiInformationLine,
} from "react-icons/ri";

import { AuthGuard } from "@/shared/components/auth/AuthGuard";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  actor_id: string | null;
  is_read: boolean;
  created_at: string;
  actor_profile?: { display_name: string | null; avatar_url: string | null } | null;
};

type Tab = "all" | "mentions" | "system";

const ICON_MAP: Record<string, typeof RiHeartLine> = {
  like: RiHeartLine,
  comment: RiChat1Line,
  repost: RiRepeatLine,
  follow: RiUserAddLine,
  mention: RiAtLine,
  aio_result: RiShieldCheckLine,
  attention_update: RiNotification4Line,
  system: RiInformationLine,
};

const COLOR_MAP: Record<string, string> = {
  like: "text-rose-500 bg-rose-500/10",
  comment: "text-blue-500 bg-blue-500/10",
  repost: "text-emerald-500 bg-emerald-500/10",
  follow: "text-violet-500 bg-violet-500/10",
  mention: "text-amber-500 bg-amber-500/10",
  aio_result: "text-cyan-500 bg-cyan-500/10",
  attention_update: "text-indigo-500 bg-indigo-500/10",
  system: "text-zinc-500 bg-zinc-500/10",
};

export default function NotificationsPage() {
  return (
    <AuthGuard>
      {(_userId) => <NotificationsContent />}
    </AuthGuard>
  );
}

function NotificationsContent() {
  const { dictionary, t } = useI18n();
  const d = dictionary.notificationsPage;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user || !mounted) {
        setLoading(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("notifications")
        .select("*, actor_profile:profiles!notifications_actor_id_fkey(display_name, avatar_url)")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (mounted) {
        setNotifications((data as Notification[]) ?? []);
        setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  const markAllRead = useCallback(async () => {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userData.user.id)
      .eq("is_read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, []);

  const filtered = notifications.filter((n) => {
    if (tab === "mentions") return n.type === "mention";
    if (tab === "system") return ["system", "aio_result", "attention_update"].includes(n.type);
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: t(d.tabs.all) },
    { key: "mentions", label: t(d.tabs.mentions) },
    { key: "system", label: t(d.tabs.system) },
  ];

  return (
    <div className="flex-1 min-w-0">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black text-foreground tracking-tight">
              {t(d.title)}
            </h1>
            {unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-black text-white">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
            >
              <RiCheckDoubleLine className="size-3.5" />
              {t(d.markAllRead)}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`flex-1 py-2.5 text-[13px] font-bold transition-colors relative ${
                tab === item.key
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
              }`}
            >
              {item.label}
              {tab === item.key && (
                <span className="absolute bottom-0 left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-full bg-blue-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-0">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 border-b border-border px-4 py-4">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800/50">
            <RiNotification4Line className="size-8 text-zinc-400" />
          </div>
          <div className="text-center">
            <p className="text-[15px] font-bold text-foreground">{t(d.noNotifications)}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{t(d.noNotificationsDesc)}</p>
          </div>
        </div>
      ) : (
        <div>
          {filtered.map((n) => {
            const Icon = ICON_MAP[n.type] ?? RiNotification4Line;
            const colors = COLOR_MAP[n.type] ?? COLOR_MAP.system;
            return (
              <a
                key={n.id}
                href={n.href ?? "#"}
                className={`flex items-start gap-3 border-b border-border px-4 py-3.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40 ${
                  !n.is_read ? "bg-blue-50/30 dark:bg-blue-500/5" : ""
                }`}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colors}`}>
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground leading-snug">
                    {n.actor_profile?.display_name && (
                      <span className="font-black">{n.actor_profile.display_name}</span>
                    )}{" "}
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="mt-0.5 text-[12px] text-muted-foreground line-clamp-2">{n.body}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatTimeAgo(n.created_at, t, d)}
                  </p>
                </div>
                {!n.is_read && (
                  <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatTimeAgo(dateStr: string, t: (v: any) => string, d: any): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t(d.now);
  if (minutes < 60) return `${minutes}${t(d.minutesAgo)}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${t(d.hoursAgo)}`;
  const days = Math.floor(hours / 24);
  return `${days}${t(d.daysAgo)}`;
}
