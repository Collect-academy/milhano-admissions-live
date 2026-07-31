export function number(value: number | null | undefined): string {
  return Number(value ?? 0).toLocaleString("es-MX");
}

export function percent(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "—"
    : `${Number(value).toFixed(1)}%`;
}

export function decimal(value: number | null | undefined): string {
  return value === null || value === undefined
    ? "—"
    : Number(value).toLocaleString("es-MX", {
        maximumFractionDigits: 2,
      });
}

export function duration(seconds: number | null | undefined): string {
  const value = Math.max(0, Number(seconds ?? 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remaining = Math.round(value % 60);

  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }

  if (minutes > 0) {
    return `${minutes} min ${remaining} s`;
  }

  return `${remaining} s`;
}

export function dateLabel(value: string | null | undefined): string {
  if (!value) return "Sin datos";

  const date = new Date(`${value.slice(0, 10)}T12:00:00`);

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function dateTimeLabel(value: string | null | undefined): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Merida",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
