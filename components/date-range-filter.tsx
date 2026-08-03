import Link from "next/link";
import { CalendarRange } from "lucide-react";

import {
  type DateRange,
  type DateRangeKey,
} from "@/lib/date-range";

const presets: Array<{
  key: DateRangeKey;
  label: string;
}> = [
  { key: "today", label: "Today" },
  { key: "last_7_days", label: "7 Days" },
  { key: "last_30_days", label: "30 Days" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_year", label: "This Year" },
];

type Props = {
  basePath: string;
  range: DateRange;
  preserve?: Record<string, string | undefined>;
};

function cleaned(
  values: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter(
      (entry): entry is [string, string] =>
        Boolean(entry[1]?.trim()),
    ),
  );
}

export function DateRangeFilter({
  basePath,
  range,
  preserve = {},
}: Props) {
  function href(key: DateRangeKey): string {
    const params = new URLSearchParams(
      cleaned({
        ...preserve,
        range: key,
      }),
    );

    return `${basePath}?${params.toString()}`;
  }

  const hiddenPreserve = Object.entries(preserve).filter(
    ([key, value]) =>
      Boolean(value?.trim()) &&
      !["range", "from", "to", "page"].includes(key),
  );

  return (
    <section className="date-filter-shell">
      <div className="date-filter-heading">
        <CalendarRange size={18} />
        <div>
          <strong>Period: {range.label}</strong>
          <span>
            {range.start} → {range.end}
          </span>
        </div>
      </div>

      <div className="date-preset-row">
        {presets.map((preset) => (
          <Link
            className={
              range.key === preset.key
                ? "date-preset date-preset-active"
                : "date-preset"
            }
            href={href(preset.key)}
            key={preset.key}
          >
            {preset.label}
          </Link>
        ))}
      </div>

      <form
        action={basePath}
        className="custom-date-form"
        method="get"
      >
        {hiddenPreserve.map(([key, value]) => (
          <input
            key={key}
            name={key}
            type="hidden"
            value={value}
          />
        ))}
        <input name="range" type="hidden" value="custom" />
        <label>
          <span>From</span>
          <input
            defaultValue={range.start}
            max={range.end}
            name="from"
            required
            type="date"
          />
        </label>
        <label>
          <span>To</span>
          <input
            defaultValue={range.end}
            min={range.start}
            name="to"
            required
            type="date"
          />
        </label>
        <button
          className="date-custom-button"
          type="submit"
        >
          Custom
        </button>
      </form>
    </section>
  );
}
