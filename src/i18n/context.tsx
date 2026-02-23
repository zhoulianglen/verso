import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import en from "./en";
import zhCN from "./zh-CN";
import type { TranslationKey, Translations } from "./en";
import type { LocaleSetting } from "../types/note";

export type Locale = "en" | "zh-CN";

const translations: Record<Locale, Translations> = {
  en,
  "zh-CN": zhCN,
};

export type TranslateFn = (key: TranslationKey, params?: Record<string, string | number>) => string;

interface I18nContextType {
  locale: Locale;
  localeSetting: LocaleSetting;
  setLocaleSetting: (setting: LocaleSetting) => void;
  t: TranslateFn;
}

const I18nContext = createContext<I18nContextType | null>(null);

function resolveLocale(systemLocale: string): Locale {
  if (systemLocale.startsWith("zh")) return "zh-CN";
  return "en";
}

function createT(locale: Locale): TranslateFn {
  const dict = translations[locale];
  return (key: TranslationKey, params?: Record<string, string | number>): string => {
    let value: string = dict[key] || en[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return value;
  };
}

interface I18nProviderProps {
  children: ReactNode;
  initialLanguage?: LocaleSetting;
  onLanguageChange?: (setting: LocaleSetting) => void;
}

export function I18nProvider({ children, initialLanguage, onLanguageChange }: I18nProviderProps) {
  const [localeSetting, setLocaleSettingState] = useState<LocaleSetting>(initialLanguage || "auto");
  const [systemLocale, setSystemLocale] = useState<string>("en");

  // Detect system locale
  useEffect(() => {
    (async () => {
      try {
        const { locale: getLocale } = await import("@tauri-apps/plugin-os");
        const loc: string | null = await Promise.resolve(getLocale());
        if (loc) setSystemLocale(loc);
      } catch {
        // Fallback: use navigator.language
        setSystemLocale(navigator.language || "en");
      }
    })();
  }, []);

  // Sync with initialLanguage prop changes (e.g., settings loaded)
  useEffect(() => {
    if (initialLanguage) {
      setLocaleSettingState(initialLanguage);
    }
  }, [initialLanguage]);

  const setLocaleSetting = useCallback((setting: LocaleSetting) => {
    setLocaleSettingState(setting);
    onLanguageChange?.(setting);
  }, [onLanguageChange]);

  const locale: Locale = localeSetting === "auto"
    ? resolveLocale(systemLocale)
    : localeSetting as Locale;

  const t = useMemo(() => createT(locale), [locale]);

  const value = useMemo(
    () => ({ locale, localeSetting, setLocaleSetting, t }),
    [locale, localeSetting, setLocaleSetting, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): TranslateFn {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback for components outside provider (e.g., WelcomePage)
    return createT("en");
  }
  return ctx.t;
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

// Standalone locale detection for use outside the provider (e.g., WelcomePage)
let detectedLocaleCache: Locale | null = null;

export async function detectLocale(): Promise<Locale> {
  if (detectedLocaleCache) return detectedLocaleCache;
  try {
    const { locale: getLocale } = await import("@tauri-apps/plugin-os");
    const loc: string | null = await Promise.resolve(getLocale());
    detectedLocaleCache = resolveLocale(loc || "en");
  } catch {
    detectedLocaleCache = resolveLocale(navigator.language || "en");
  }
  return detectedLocaleCache;
}

export { createT };
