"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { RiLoginBoxLine } from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";

type Props = {
  children: (userId: string) => ReactNode;
};

/**
 * AuthGuard — Renders children only when the user is authenticated.
 * Shows a loading spinner while checking, login prompt if not signed in.
 *
 * Uses getUser() (reliable network call) with loading guard to prevent
 * any flash of unauthenticated content.
 */
export function AuthGuard({ children }: Props) {
  const { dictionary, t } = useI18n();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    // getUser() — reliable network check.
    // Spinner stays visible until this resolves.
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) {
        setUserId(data.user?.id ?? null);
        setLoading(false);
      }
    });

    // Listen for subsequent auth changes (sign in/out after initial load).
    // Does NOT touch loading — only getUser() clears it.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUserId(session?.user?.id ?? null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-20 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800/50">
          <RiLoginBoxLine className="size-8 text-zinc-400" />
        </div>
        <div className="text-center">
          <p className="text-[17px] font-black text-foreground">
            {t(dictionary.authGuard.loginRequired)}
          </p>
          <p className="mt-1.5 text-[13px] text-muted-foreground max-w-[280px]">
            {t(dictionary.authGuard.loginDescription)}
          </p>
        </div>
        <Link
          href="/auth"
          className="mt-2 rounded-full bg-blue-600 px-6 py-2.5 text-[13px] font-bold text-white transition-all hover:bg-blue-700 active:scale-95"
        >
          {t(dictionary.authGuard.loginButton)}
        </Link>
      </div>
    );
  }

  return <>{children(userId)}</>;
}
