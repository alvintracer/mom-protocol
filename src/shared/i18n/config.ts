export const languages = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
] as const;

export type LanguageCode = (typeof languages)[number]["code"];

export const defaultLanguage: LanguageCode = "ko";

export type LocalizedText = Record<LanguageCode, string>;

export function text(ko: string, en: string, es: string): LocalizedText {
  return { ko, en, es };
}
