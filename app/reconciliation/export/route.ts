import { getCurrentAdmissionsAppUser } from "@/lib/auth";
import { getOperationalReconciliation } from "@/lib/cascade";
import { resolveDateRange } from "@/lib/date-range";
import { getDashboardLocale } from "@/lib/i18n";
import { metricLabel } from "@/lib/concepts";
import { tr } from "@/lib/locale";

export const dynamic = "force-dynamic";

const MANUAL_BY_DESIGN = new Set([
  "meaningful_conversations",
  "ads_leads",
  "organic_leads",
  "messages_answered",
  "contacted_reported",
]);

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function pct(value: number | null): string {
  return value === null ? "" : `${value.toFixed(1)}%`;
}

export async function GET(request: Request) {
  const user = await getCurrentAdmissionsAppUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const locale = await getDashboardLocale();
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const range = resolveDateRange(params);
  const metrics = await getOperationalReconciliation(range);

  const headers = [
    tr(locale, "Period Start", "Inicio Periodo"),
    tr(locale, "Period End", "Fin Periodo"),
    tr(locale, "KPI", "KPI"),
    tr(locale, "Tracking Mode", "Modo de Tracking"),
    tr(locale, "GHL / System", "GHL / Sistema"),
    tr(locale, "Reported Total", "Total Reportado"),
    tr(locale, "Verified Outside GHL", "Verificado Fuera de GHL"),
    tr(locale, "Unresolved Gap", "Gap Sin Resolver"),
    tr(locale, "Not Captured in GHL", "No Capturado en GHL"),
    tr(locale, "GHL Capture Rate", "Cobertura GHL"),
    tr(locale, "Reconciliation Status", "Estado Reconciliación"),
  ];

  const rows = metrics
    .filter((metric) => metric.metric_scope !== "today")
    .map((metric) => {
      const system = metric.system_value;
      const reported = metric.reported_value;
      const manualByDesign = MANUAL_BY_DESIGN.has(metric.metric_key) || metric.metric_scope === "manual_only";
      const notCaptured = reported !== null && system !== null
        ? Math.max(reported - system, 0)
        : null;
      const unresolved = metric.gap !== null ? Math.max(metric.gap, 0) : null;
      const captureRate = reported !== null && reported > 0 && system !== null
        ? (system / reported) * 100
        : null;

      return [
        range.start,
        range.end,
        metricLabel(metric.metric_key, locale, metric.label),
        manualByDesign
          ? tr(locale, "Manual by design", "Manual por diseño")
          : tr(locale, "GHL/System expected", "Se espera GHL/Sistema"),
        system,
        reported,
        metric.manual_extra_value,
        unresolved,
        notCaptured,
        pct(captureRate),
        metric.reconciliation_status,
      ];
    });

  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

  const filename = `milhano-ghl-gap-${range.start}_${range.end}.csv`;

  return new Response(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
