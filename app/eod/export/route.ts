import { NextRequest, NextResponse } from "next/server";

import { requireCurrentAppUser } from "@/lib/auth";
import { resolveDateRange } from "@/lib/date-range";
import {
  getManualEodRecords,
  groupManualEodRecords,
  MANUAL_EOD_KEYS,
  type ManualEodMetricKey,
} from "@/lib/eod-manual";
import { getDashboardLocale } from "@/lib/i18n";
import { tr, type Locale } from "@/lib/locale";

export const dynamic = "force-dynamic";

const LABELS: Record<ManualEodMetricKey, { en: string; es: string }> = {
  new_leads_received: { en: "Total Leads", es: "Leads Totales" },
  ads_leads_reported: { en: "Ads Leads", es: "Leads Ads" },
  organic_leads_reported: { en: "Organic", es: "Orgánico" },
  contacted_reported: { en: "Contacted", es: "Contactados" },
  responses_reported: { en: "Responded", es: "Respondieron" },
  meaningful_conversations_reported: { en: "Meaningful Conversations", es: "Meaningful Conversations" },
  qualified_leads: { en: "Qualified / Fit", es: "Qualified / Fit" },
  school_tours_scheduled: { en: "ST Booked", es: "ST Booked" },
  school_tours_attended: { en: "ST Attended", es: "ST Attended" },
  closed_leads: { en: "Closed", es: "Closed / Inscrito" },
};

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function row(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

function metricLabel(key: ManualEodMetricKey, locale: Locale): string {
  return LABELS[key][locale];
}

export async function GET(request: NextRequest) {
  const currentUser = await requireCurrentAppUser();
  const locale = await getDashboardLocale();
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const range = resolveDateRange(params);
  const allRecords = await getManualEodRecords(range);
  const requestedAdvisor = request.nextUrl.searchParams.get("advisor")?.trim() ?? "";
  const roleScopedRecords = currentUser.role === "advisor"
    ? allRecords.filter((record) => record.appUserId === currentUser.id)
    : allRecords;
  const records = currentUser.role !== "advisor" && requestedAdvisor
    ? roleScopedRecords.filter((record) => record.appUserId === requestedAdvisor)
    : roleScopedRecords;
  const months = groupManualEodRecords(records);

  const headers = [
    tr(locale, "Row Type", "Tipo de fila"),
    tr(locale, "Period", "Periodo"),
    tr(locale, "Date", "Fecha"),
    tr(locale, "Advisor", "Asesora"),
    tr(locale, "Status", "Estado"),
    ...MANUAL_EOD_KEYS.map((key) => metricLabel(key, locale)),
    tr(locale, "Comments", "Comentarios"),
  ];

  const lines = [row(headers)];

  for (const month of months) {
    for (const week of month.weeks) {
      for (const record of week.records) {
        lines.push(row([
          "daily",
          record.eodDate,
          record.eodDate,
          record.advisorName,
          record.status,
          ...MANUAL_EOD_KEYS.map((key) => record.values[key] ?? ""),
          record.comments ?? "",
        ]));
      }

      lines.push(row([
        "weekly_total",
        `${week.weekStart} / ${week.weekEnd}`,
        "",
        currentUser.role === "advisor" ? currentUser.displayName : tr(locale, "Visible team", "Equipo visible"),
        "",
        ...MANUAL_EOD_KEYS.map((key) => week.totals[key]),
        "",
      ]));
    }

    lines.push(row([
      "monthly_total",
      month.monthKey,
      "",
      currentUser.role === "advisor" ? currentUser.displayName : tr(locale, "Visible team", "Equipo visible"),
      "",
      ...MANUAL_EOD_KEYS.map((key) => month.totals[key]),
      "",
    ]));
  }

  const filename = `milhano-eod-manual-${range.start}-${range.end}.csv`;
  return new NextResponse(`\uFEFF${lines.join("\r\n")}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
