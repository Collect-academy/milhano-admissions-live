"use client";

import { useEffect, useRef, useState } from "react";
import { Check, MonitorCog, Moon, SunMedium, Type } from "lucide-react";

import type { Locale } from "@/lib/locale";

type Theme = "light" | "balanced" | "dark";
type FontSize = "small" | "medium" | "large";

const themes: Array<{ value: Theme; es: string; en: string; icon: typeof SunMedium }> = [
  { value: "light", es: "Claro", en: "Light", icon: SunMedium },
  { value: "balanced", es: "Balanceado", en: "Balanced", icon: MonitorCog },
  { value: "dark", es: "Oscuro", en: "Dark", icon: Moon },
];

const fontSizes: Array<{ value: FontSize; es: string; en: string; sample: string }> = [
  { value: "small", es: "Pequeño", en: "Small", sample: "A" },
  { value: "medium", es: "Mediano", en: "Medium", sample: "A" },
  { value: "large", es: "Grande", en: "Large", sample: "A" },
];

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem("milhano-theme", theme);
}

function applyFontSize(fontSize: FontSize) {
  document.documentElement.dataset.fontSize = fontSize;
  window.localStorage.setItem("milhano-font-size", fontSize);
}

export function DisplayPreferences({ locale = "es" }: { locale?: Locale }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [fontSize, setFontSize] = useState<FontSize>("small");
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const currentTheme = document.documentElement.dataset.theme as Theme | undefined;
    const currentFontSize = document.documentElement.dataset.fontSize as FontSize | undefined;
    if (currentTheme && themes.some((item) => item.value === currentTheme)) setTheme(currentTheme);
    if (currentFontSize && fontSizes.some((item) => item.value === currentFontSize)) setFontSize(currentFontSize);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!detailsRef.current?.open) return;
      if (event.target instanceof Node && !detailsRef.current.contains(event.target)) {
        detailsRef.current.removeAttribute("open");
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const chooseTheme = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  const chooseFontSize = (next: FontSize) => {
    setFontSize(next);
    applyFontSize(next);
  };

  return (
    <details className="display-preferences no-print" ref={detailsRef}>
      <summary aria-label={locale === "es" ? "Apariencia" : "Appearance"}>
        <MonitorCog size={16} />
        <span>{locale === "es" ? "Apariencia" : "Appearance"}</span>
      </summary>
      <div className="display-preferences-popover">
        <div className="display-preferences-heading">
          <strong>{locale === "es" ? "Tema" : "Theme"}</strong>
          <span>{locale === "es" ? "Cambia sólo la apariencia" : "Appearance only"}</span>
        </div>
        <div className="display-theme-grid">
          {themes.map((item) => {
            const Icon = item.icon;
            const selected = theme === item.value;
            return (
              <button
                className={selected ? "display-option display-option-active" : "display-option"}
                key={item.value}
                onClick={() => chooseTheme(item.value)}
                type="button"
              >
                <Icon size={16} />
                <span>{locale === "es" ? item.es : item.en}</span>
                {selected ? <Check className="display-option-check" size={14} /> : null}
              </button>
            );
          })}
        </div>

        <div className="display-preferences-heading display-font-heading">
          <strong><Type size={15} /> {locale === "es" ? "Tamaño de letra" : "Font size"}</strong>
          <span>{locale === "es" ? "El encabezado principal no cambia" : "Main heading stays fixed"}</span>
        </div>
        <div className="display-font-grid">
          {fontSizes.map((item) => {
            const selected = fontSize === item.value;
            return (
              <button
                className={selected ? `display-font-option display-font-${item.value} display-option-active` : `display-font-option display-font-${item.value}`}
                key={item.value}
                onClick={() => chooseFontSize(item.value)}
                type="button"
              >
                <span className="display-font-sample">{item.sample}</span>
                <span>{locale === "es" ? item.es : item.en}</span>
              </button>
            );
          })}
        </div>
      </div>
    </details>
  );
}
