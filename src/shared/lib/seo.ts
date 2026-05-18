import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/shared/types/database";

export const siteName = "momment.";
export const defaultSeoDescription =
  "Event attention, evidence, discussion, and AI Oracle Verification layer.";

export function getSiteUrl() {
  const explicitUrl = process.env.NEXT_PUBLIC_APP_URL;
  const vercelUrl = process.env.VERCEL_URL;
  const rawUrl = explicitUrl || (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000");

  return rawUrl.replace(/\/+$/, "");
}

export function publicUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${getSiteUrl()}${normalizedPath}`;
}

export function createSeoSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return createSupabaseClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
    },
  });
}

export function safeDecodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function compactSeoDescription(value: string | null | undefined, fallback = defaultSeoDescription) {
  const source = value?.trim() || fallback;

  return source.replace(/\s+/g, " ").slice(0, 160);
}
