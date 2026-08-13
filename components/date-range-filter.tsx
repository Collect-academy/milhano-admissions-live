import Link from "next/link";
import { CalendarRange } from "lucide-react";

import { type DateRange, type DateRangeKey } from "@/lib/date-range";
import type { Locale } from "@/lib/locale";
import { tr } from "@/lib/locale";

const presets: Array<{
  key: DateRangeKey;
  en: string;
  es: string;
}> = [
  { key: "today", en: "Today", es: "Hoy" },
  { key: "last_7_days", en: "7 Days", es: "7 Días" },
  { key: "last_30_days", en: "30 Days", es: "30 Días" },
  { key: "this_month", en: "This Month", es: "Este Mes" },
  { key: "last_month", en: "Last Month", es: "Mes Anterior" },
  { key: "this_year", en: "This Year", es: "Este Año" },
];

type Props = {
  basePath: string;
  range: DateRange;
  preserve?: Record<string, string | undefined>;
  locale?: Locale;
};

function cleaned(values: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim())),
  );
}

export function DateRangeFilter({ basePath, range, preserve = {}, locale = "en" }: Props) {
  function href(key: DateRangeKey): string {
    const params = new URLSearchParams(cleaned({ ...preserve, range: key }));
    return `${basePath}?${params.toString()}`;
  }

  const hiddenPreserve = Object.entries(preserve).filter(
    ([key, value]) => Boolean(value?.trim()) && !["range", "from", "to", "page"].includes(key),
  );

  return (
    <section className="date-filter-shell">
      <div className="date-filter-heading">
        <CalendarRange size={18} />
        <div>
          <strong>{tr(locale, "Period", "Periodo")}: {range.label}</strong>
          <span>{range.start} → {range.end}</span>
        </div>
      </div>

      <div className="date-preset-row">
        {presets.map((preset) => (
          <Link
            className={range.key === preset.key ? "date-preset date-preset-active" : "date-preset"}
            href={href(preset.key)}
            key={preset.key}
          >
            {locale === "es" ? preset.es : preset.en}
          </Link>
        ))}
      </div>

      <form action={basePath} className="custom-date-form" method="get">
        {hiddenPreserve.map(([key, value]) => (
          <input key={key} name={key} type="hidden" value={value} />
        ))}
        <input name="range" type="hidden" value="custom" />
        <label>
          <span>{tr(locale, "From", "Desde")}</span>
          <input defaultValue={range.start} max={range.end} name="from" required type="date" />
        </label>
        <label>
          <span>{tr(locale, "To", "Hasta")}</span>
          <input defaultValue={range.end} min={range.start} name="to" required type="date" />
        </label>
        <button className="date-custom-button" type="submit">
          {tr(locale, "Custom", "Personalizado")}
        </button>
      </form>
    </section>
  );
}
