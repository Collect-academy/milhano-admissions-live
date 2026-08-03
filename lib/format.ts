export function number(
  value: number | null | undefined,
): string {
  return Number(value ?? 0).toLocaleString("en-CA");
}

export function percent(
  value: number | null | undefined,
): string {
  return value === null || value === undefined
    ? "—"
    : `${Number(value).toFixed(1)}%`;
}

export function decimal(
  value: number | null | undefined,
): string {
  return value === null || value === undefined
    ? "—"
    : Number(value).toLocaleString("en-CA", {
        maximumFractionDigits: 2,
      });
}

export function duration(
  seconds: number | null | undefined,
): string {
  const value = Math.max(0, Number(seconds ?? 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remaining = Math.round(value % 60);

  if (hours > 0) {
    return `${hours} hr ${minutes} min`;
  }

  if (minutes > 0) {
    return `${minutes} min ${remaining} sec`;
  }

  return `${remaining} sec`;
}

export function dateLabel(
  value: string | null | undefined,
): string {
  if (!value) return "No data";

  const date = new Date(
    `${value.slice(0, 10)}T12:00:00`,
  );

  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function dateTimeLabel(
  value: string | null | undefined,
): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Merida",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function dateTimeInputValue(
  value: string | null | undefined,
): string {
  if (!value) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Merida",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}
