"use client";

import type { Locale } from "@/lib/locale";

export function LanguageToggle({ locale }: { locale: Locale }) {
  function setLocale(next: Locale) {
    document.cookie = `milhano_lang=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }

  return (
    <div aria-label="Language" className="language-toggle">
      <button
        className={locale === "es" ? "language-active" : ""}
        onClick={() => setLocale("es")}
        type="button"
      >
        ES
      </button>
      <button
        className={locale === "en" ? "language-active" : ""}
        onClick={() => setLocale("en")}
        type="button"
      >
        EN
      </button>
    </div>
  );
}
