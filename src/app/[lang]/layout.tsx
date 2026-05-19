import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { languages, type LanguageCode } from "@/shared/i18n/config";
import { publicUrl, siteName, defaultSeoDescription } from "@/shared/lib/seo";

/* ── Static params for SSG ────────────────────────────────── */

const SUPPORTED_LOCALES = languages.map((l) => l.code);

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((lang) => ({ lang }));
}

/* ── hreflang alternates helper ───────────────────────────── */

function buildAlternates(lang: string, pathname = "") {
  const alternateLanguages: Record<string, string> = {};
  for (const l of SUPPORTED_LOCALES) {
    alternateLanguages[l] = publicUrl(`/${l}${pathname}`);
  }
  return {
    canonical: publicUrl(`/${lang}${pathname}`),
    languages: {
      ...alternateLanguages,
      "x-default": publicUrl(`/ko${pathname}`),
    },
  };
}

/* ── Localized metadata ───────────────────────────────────── */

const seoTitles: Record<string, string> = {
  ko: `${siteName} 놓칠 수 없는 순간`,
  en: `${siteName} moments you can't miss`,
  es: `${siteName} momentos que no puedes perderte`,
};

const seoDescriptions: Record<string, string> = {
  ko: "이벤트 어텐션, 근거, 토론, 그리고 AI 오라클 검증 레이어.",
  en: defaultSeoDescription,
  es: "Atención a eventos, evidencia, discusión y capa de verificación de Oracle con IA.",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;

  const localeMap: Record<string, string> = {
    ko: "ko_KR",
    en: "en_US",
    es: "es_ES",
  };

  return {
    title: {
      default: seoTitles[lang] ?? seoTitles.ko,
      template: `%s | ${siteName}`,
    },
    description: seoDescriptions[lang] ?? seoDescriptions.ko,
    alternates: buildAlternates(lang),
    openGraph: {
      siteName,
      type: "website",
      locale: localeMap[lang] ?? "ko_KR",
      alternateLocale: Object.values(localeMap).filter(
        (v) => v !== (localeMap[lang] ?? "ko_KR"),
      ),
    },
  };
}

/* ── Segment Layout (no <html>/<body> — parent handles that) ─ */

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  if (!SUPPORTED_LOCALES.includes(lang as LanguageCode)) {
    notFound();
  }

  return children;
}
