"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { Locale } from "@/lib/locale";

export function LanguageToggle({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [activeLocale, setActiveLocale] = useState<Locale>(locale);
  const [isPending, startTransition] = useTransition();

  function setLocale(next: Locale) {
    if (next === activeLocale) return;

    setActiveLocale(next);
    document.cookie = `milhano_lang=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
    startTransition(() => router.refresh());
  }

  return (
    <div aria-label={activeLocale === "es" ? "Idioma" : "Language"} className="language-toggle" role="group">
      <button
        aria-pressed={activeLocale === "es"}
        className={activeLocale === "es" ? "language-active" : ""}
        disabled={isPending}
        onClick={() => setLocale("es")}
        type="button"
      >
        ES
      </button>
      <button
        aria-pressed={activeLocale === "en"}
        className={activeLocale === "en" ? "language-active" : ""}
        disabled={isPending}
        onClick={() => setLocale("en")}
        type="button"
      >
        EN
      </button>
    </div>
  );
}
