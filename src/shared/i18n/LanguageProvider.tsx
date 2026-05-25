"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  defaultLanguage,
  languages,
  type LanguageCode,
  type LocalizedText,
} from "@/shared/i18n/config";
import { dictionary, resolveText } from "@/shared/i18n/dictionaries";

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  languages: typeof languages;
  t: (value: LocalizedText) => string;
  dictionary: typeof dictionary;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const storageKey = "momment.language";

export function LanguageProvider({
  children,
  defaultLanguage: initialLanguage,
}: {
  children: ReactNode;
  defaultLanguage?: LanguageCode;
}) {
  const [language, setLanguageState] = useState<LanguageCode>(initialLanguage ?? defaultLanguage);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (isLanguageCode(saved)) {
      window.setTimeout(() => setLanguageState(saved), 0);
      return;
    }

    // No saved preference — detect from browser locale
    const detected = detectBrowserLanguage();
    if (detected && detected !== (initialLanguage ?? defaultLanguage)) {
      window.setTimeout(() => {
        setLanguageState(detected);
        window.localStorage.setItem(storageKey, detected);
        document.documentElement.lang = detected;
      }, 0);
    }
  }, []);

  const setLanguage = (nextLanguage: LanguageCode) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(storageKey, nextLanguage);
    document.documentElement.lang = nextLanguage;
  };

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      languages,
      t: (localized) => resolveText(localized, language),
      dictionary,
    }),
    [language],
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useI18n must be used inside LanguageProvider");
  }
  return context;
}

function isLanguageCode(value: string | null): value is LanguageCode {
  return languages.some((language) => language.code === value);
}

/**
 * Detect the best matching language from navigator.languages.
 * Maps browser locale prefixes to supported languages:
 *   ko* → ko, es* → es, everything else → en
 */
function detectBrowserLanguage(): LanguageCode {
  const browserLangs =
    typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];

  for (const raw of browserLangs) {
    const prefix = raw.split("-")[0].toLowerCase();
    if (prefix === "ko") return "ko";
    if (prefix === "es") return "es";
    if (prefix === "en") return "en";
  }

  // No match — fallback to English for non-Korean/non-Spanish users
  return "en";
}
