"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useI18n } from "@/shared/i18n/LanguageProvider";

type TranslationMap = Record<string, string>;

/**
 * Hook that translates an array of strings from English (or any language)
 * to the user's current language setting.
 *
 * Returns a `tx(text)` function that returns translated text if available,
 * or the original if translation hasn't completed yet.
 *
 * Skips translation entirely if the current language is English.
 *
 * Usage:
 *   const { tx } = useTranslate(["Will BTC exceed 120K?", "Who wins?"]);
 *   return <p>{tx("Will BTC exceed 120K?")}</p>
 */
export function useTranslate(texts: string[]) {
  const { language } = useI18n();
  const [translations, setTranslations] = useState<TranslationMap>({});

  // Create a stable string key from the texts array.
  // useMemo with [texts] won't help because `texts` is a new array ref each render.
  // Instead, we build a string key and use THAT as the stable dependency.
  const uniqueTexts = useMemo(
    () => [...new Set(texts.filter((text) => text.trim()))],
    [texts],
  );
  const batchKey =
    uniqueTexts.length > 0 ? uniqueTexts.slice().sort().join("||") : "";

  useEffect(() => {
    // Skip if language is English — external markets are already in English
    if (language === "en") {
      const timer = window.setTimeout(() => setTranslations({}), 0);
      return () => window.clearTimeout(timer);
    }

    // Skip if nothing to translate
    if (batchKey === "") {
      return;
    }

    const controller = new AbortController();
    const textsToTranslate = batchKey.split("||");

    async function fetchTranslations() {
      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texts: textsToTranslate,
            target: language,
          }),
          signal: controller.signal,
        });

        if (!response.ok) return;

        const data = (await response.json()) as {
          results?: { original: string; translated: string }[];
        };

        if (!data.results) return;

        const map: TranslationMap = {};
        for (const item of data.results) {
          if (item.translated && item.translated !== item.original) {
            map[item.original] = item.translated;
          }
        }

        if (Object.keys(map).length > 0) {
          setTranslations((prev) => ({ ...prev, ...map }));
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Silently fail — show original text
      }
    }

    fetchTranslations();

    return () => {
      controller.abort();
    };
    // batchKey is a PRIMITIVE string → stable comparison, no infinite loops.
    // language is also a primitive string.
  }, [batchKey, language]);

  /**
   * Translate a single text string.
   * Returns translated version if available, otherwise original.
   */
  const tx = useCallback(
    (text: string): string => {
      if (language === "en") return text;
      return translations[text] ?? text;
    },
    [language, translations],
  );

  return { tx, translations };
}
