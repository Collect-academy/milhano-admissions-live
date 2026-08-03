export const DATE_RANGE_KEYS = [
  "today",
  "last_7_days",
  "last_30_days",
  "this_month",
  "last_month",
  "this_year",
  "custom",
] as const;

export type DateRangeKey = (typeof DATE_RANGE_KEYS)[number];

export type DateRange = {
  key: DateRangeKey;
  start: string;
  end: string;
  label: string;
};

type SearchParams = Record<
  string,
  string | string[] | undefined
>;

function first(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function datePartsInMerida(): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Merida",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function utcDate(
  year: number,
  month: number,
  day: number,
): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isIsoDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function formatRangeLabel(start: string, end: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  if (start === end) {
    return formatter.format(new Date(`${start}T12:00:00Z`));
  }

  return `${formatter.format(
    new Date(`${start}T12:00:00Z`),
  )} – ${formatter.format(
    new Date(`${end}T12:00:00Z`),
  )}`;
}

export function resolveDateRange(
  params: SearchParams = {},
): DateRange {
  const requested = first(params.range) as DateRangeKey | undefined;
  const key = DATE_RANGE_KEYS.includes(
    requested as DateRangeKey,
  )
    ? (requested as DateRangeKey)
    : "this_month";

  const now = datePartsInMerida();
  const today = utcDate(now.year, now.month, now.day);

  let start = today;
  let end = today;
  let label = "Today";

  if (key === "last_7_days") {
    start = addDays(today, -6);
    label = "Last 7 Days";
  } else if (key === "last_30_days") {
    start = addDays(today, -29);
    label = "Last 30 Days";
  } else if (key === "this_month") {
    start = utcDate(now.year, now.month, 1);
    label = "This Month";
  } else if (key === "last_month") {
    const firstThisMonth = utcDate(now.year, now.month, 1);
    end = addDays(firstThisMonth, -1);
    start = utcDate(
      end.getUTCFullYear(),
      end.getUTCMonth() + 1,
      1,
    );
    label = "Last Month";
  } else if (key === "this_year") {
    start = utcDate(now.year, 1, 1);
    label = "This Year";
  } else if (key === "custom") {
    const customStart = first(params.from);
    const customEnd = first(params.to);

    if (
      isIsoDate(customStart) &&
      isIsoDate(customEnd) &&
      customStart <= customEnd
    ) {
      const customLabel = formatRangeLabel(
        customStart,
        customEnd,
      );

      return {
        key,
        start: customStart,
        end: customEnd,
        label: customLabel,
      };
    }

    start = utcDate(now.year, now.month, 1);
    label = "This Month";
  }

  return {
    key: key === "custom" && label === "This Month"
      ? "this_month"
      : key,
    start: isoDate(start),
    end: isoDate(end),
    label,
  };
}

export function rangeStartTimestamp(range: DateRange): string {
  return `${range.start}T00:00:00-06:00`;
}

export function rangeEndExclusiveTimestamp(
  range: DateRange,
): string {
  const end = new Date(`${range.end}T00:00:00Z`);
  return `${isoDate(addDays(end, 1))}T00:00:00-06:00`;
}

export function dateInRange(
  value: string | null | undefined,
  range: DateRange,
): boolean {
  if (!value) return false;

  const date = value.slice(0, 10);
  return date >= range.start && date <= range.end;
}

export function dateRangeParams(
  range: DateRange,
): Record<string, string> {
  const result: Record<string, string> = {
    range: range.key,
  };

  if (range.key === "custom") {
    result.from = range.start;
    result.to = range.end;
  }

  return result;
}

export function dateRangeQuery(
  range: DateRange,
): string {
  return new URLSearchParams(dateRangeParams(range)).toString();
}
