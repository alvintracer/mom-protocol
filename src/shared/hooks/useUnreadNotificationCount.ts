"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/shared/lib/supabase/client";

/**
 * Returns the number of unread notifications for the current user.
 * Subscribes to Supabase Realtime for live updates.
 */
export function useUnreadNotificationCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user || !mounted) return;

      const userId = userData.user.id;

      // Initial count
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: unread } = await (supabase as any)
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      if (mounted && typeof unread === "number") {
        setCount(unread);
      }

      // Realtime subscription for new notifications
      const channel = supabase
        .channel("unread-notifications")
        .on(
          "postgres_changes" as any,
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            if (mounted) setCount((prev) => prev + 1);
          },
        )
        .on(
          "postgres_changes" as any,
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload: any) => {
            // When marked as read, decrement
            if (payload.new?.is_read === true && payload.old?.is_read === false) {
              if (mounted) setCount((prev) => Math.max(0, prev - 1));
            }
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const cleanup = load();
    return () => {
      mounted = false;
      cleanup?.then((unsub) => unsub?.());
    };
  }, []);

  return count;
}
