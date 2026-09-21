export const MILHANO_TIME_ZONE = "America/Merida";
export const MILHANO_OPPORTUNITY_CUTOFF = "14:30";

type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function localParts(value: string | Date): LocalDateTimeParts | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MILHANO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function isoDateFromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Reporting date for opportunity creation.
 *
 * - Mon-Thu at/after 14:30 -> next day.
 * - Friday at/after 14:30 -> Monday.
 * - Saturday/Sunday -> Monday.
 * - Before 14:30 on a weekday -> that weekday.
 *
 * This is intentionally limited to opportunity/cohort reporting. Appointment
 * dates keep their real calendar date.
 */
export function opportunityOperationalDate(
  value: string | Date | null | undefined,
): string | null {
  if (!value) return null;
  const parts = localParts(value);
  if (!parts) return null;

  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const dayOfWeek = base.getUTCDay(); // 0 Sun ... 6 Sat, based on the Merida date.
  const afterCutoff = parts.hour > 14 || (parts.hour === 14 && parts.minute >= 30);

  let daysToAdd = 0;
  if (dayOfWeek === 6) {
    daysToAdd = 2;
  } else if (dayOfWeek === 0) {
    daysToAdd = 1;
  } else if (afterCutoff) {
    daysToAdd = dayOfWeek === 5 ? 3 : 1;
  }

  base.setUTCDate(base.getUTCDate() + daysToAdd);
  return isoDateFromUtc(base);
}

export function opportunityInOperationalRange(
  value: string | Date | null | undefined,
  start: string,
  end: string,
): boolean {
  const operationalDate = opportunityOperationalDate(value);
  return Boolean(operationalDate && operationalDate >= start && operationalDate <= end);
}

export function formatMeridaDateTime(
  value: string | Date | null | undefined,
  locale: "en" | "es" = "es",
): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    timeZone: MILHANO_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
