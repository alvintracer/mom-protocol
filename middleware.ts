import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/shared/lib/supabase/middleware";

/* ── i18n config ──────────────────────────────────────────── */

const SUPPORTED_LOCALES = ["ko", "en", "es"] as const;
const DEFAULT_LOCALE = "ko";

/** Paths that should NOT be locale-prefixed */
const SKIP_LOCALE_PREFIXES = [
  "/_next",
  "/api",
  "/auth",
  "/admin",
  "/favicon",
  "/robots",
  "/sitemap",
  "/ads.txt",
  "/.well-known",
];

function shouldSkipLocale(pathname: string): boolean {
  return SKIP_LOCALE_PREFIXES.some((p) => pathname.startsWith(p)) ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|woff2?)$/i.test(pathname);
}

function pathnameHasLocale(pathname: string): boolean {
  return SUPPORTED_LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
}

/**
 * Parse Accept-Language header to find the best matching supported locale.
 * Does NOT auto-redirect — only used for initial language detection.
 */
function detectLocale(request: NextRequest): string {
  const acceptLang = request.headers.get("accept-language") ?? "";
  // Parse quality values: en-US,en;q=0.9,ko;q=0.8
  const preferred = acceptLang
    .split(",")
    .map((part) => {
      const [lang, qPart] = part.trim().split(";");
      const q = qPart ? parseFloat(qPart.replace("q=", "")) : 1;
      return { lang: lang.trim().toLowerCase(), q };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of preferred) {
    const shortLang = lang.split("-")[0];
    const match = SUPPORTED_LOCALES.find((l) => l === shortLang);
    if (match) return match;
  }

  return DEFAULT_LOCALE;
}

/* ── Middleware ────────────────────────────────────────────── */

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files, API routes, auth, admin
  if (shouldSkipLocale(pathname)) {
    return updateSession(request);
  }

  // If path already has a locale prefix, continue
  if (pathnameHasLocale(pathname)) {
    return updateSession(request);
  }

  // For root/content paths without locale prefix → rewrite (NOT redirect) to locale version
  // This preserves existing URLs while internally routing to [lang] pages
  const locale = detectLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;

  // Use rewrite so the URL in the browser stays clean for backward compatibility
  // But for SEO crawlers, we want the canonical to be the locale-prefixed version
  const response = NextResponse.rewrite(url);
  
  // Run Supabase session update
  const sessionResponse = await updateSession(request);
  
  // Merge cookies from session update
  sessionResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value);
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html)$).*)",
  ],
};
