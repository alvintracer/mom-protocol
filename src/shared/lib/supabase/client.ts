"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/shared/types/database";
import { getSupabaseBrowserEnv } from "@/shared/lib/supabase/env";

export function createClient() {
  const { url, anonKey } = getSupabaseBrowserEnv();

  return createBrowserClient<Database>(url, anonKey);
}
