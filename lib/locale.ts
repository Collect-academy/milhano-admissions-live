export type Locale = "en" | "es";

export function tr(locale: Locale, en: string, es: string): string {
  return locale === "es" ? es : en;
}
