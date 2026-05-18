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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(defaultLanguage);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (isLanguageCode(saved)) {
      window.setTimeout(() => setLanguageState(saved), 0);
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
