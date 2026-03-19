import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { enMessages } from "./messages/en";
import { koMessages, type MessageCatalog, type MessageKey } from "./messages/ko";

type Locale = "ko" | "en";

type I18nContextValue = {
  locale: Locale;
  t: (key: MessageKey) => string;
};

const catalogs: Record<Locale, MessageCatalog> = {
  ko: koMessages,
  en: enMessages,
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const preferredLocale =
    typeof window !== "undefined" ? window.localStorage.getItem("campuskit.locale") : null;
  const locale: Locale = preferredLocale === "en" ? "en" : "ko";
  const catalog = catalogs[locale];

  return (
    <I18nContext.Provider
      value={{
        locale,
        t: (key) => catalog[key] ?? koMessages[key],
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18nContext() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("I18nProvider is required");
  }

  return context;
}
