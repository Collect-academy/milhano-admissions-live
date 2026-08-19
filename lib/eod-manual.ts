import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { DateRange } from "@/lib/date-range";
import type { EodDashboardRow } from "@/lib/types";

export const MANUAL_EOD_KEYS = [
  "new_leads_received",
  "ads_leads_reported",
  "organic_leads_reported",
  "contacted_reported",
  "responses_reported",
  "meaningful_conversations_reported",
  "qualified_leads",
  "school_tours_scheduled",
  "school_tours_attended",
  "trial_days_booked",
  "trial_days_showed",
  "closed_leads",
] as const;

export type ManualEodMetricKey = (typeof MANUAL_EOD_KEYS)[number];

export type ManualEodValues = Record<ManualEodMetricKey, number | null>;

export type ManualEodRecord = {
  submissionId: string;
  appUserId: string;
  advisorName: string;
  eodDate: string;
  status: string;
  submittedAt: string | null;
  comments: string | null;
  values: ManualEodValues;
};

export type ManualEodTotals = Record<ManualEodMetricKey, number> & {
  eodCount: number;
  reportedDays: number;
};

function emptyValues(): ManualEodValues {
  return Object.fromEntries(
    MANUAL_EOD_KEYS.map((key) => [key, null]),
  ) as ManualEodValues;
}

export function buildManualEodRecords(
  rows: EodDashboardRow[],
): ManualEodRecord[] {
  const groups = new Map<string, ManualEodRecord>();

  for (const row of rows) {
    const current = groups.get(row.submission_id) ?? {
      submissionId: row.submission_id,
      appUserId: row.app_user_id,
      advisorName: row.display_name,
      eodDate: row.eod_date,
      status: row.submission_status,
      submittedAt: row.submitted_at,
      comments: row.submission_comments,
      values: emptyValues(),
    };

    if ((MANUAL_EOD_KEYS as readonly string[]).includes(row.metric_key)) {
      current.values[row.metric_key as ManualEodMetricKey] = row.declared_value;
    }

    groups.set(row.submission_id, current);
  }

  return [...groups.values()].sort((a, b) => {
    const dateCompare = a.eodDate.localeCompare(b.eodDate);
    if (dateCompare !== 0) return dateCompare;
    return a.advisorName.localeCompare(b.advisorName, "es");
  });
}

export function sumManualEodRecords(
  records: ManualEodRecord[],
): ManualEodTotals {
  const totals = Object.fromEntries(
    MANUAL_EOD_KEYS.map((key) => [key, 0]),
  ) as Record<ManualEodMetricKey, number>;

  const reportedDates = new Set<string>();

  for (const record of records) {
    const hasAnyValue = MANUAL_EOD_KEYS.some(
      (key) => record.values[key] !== null,
    );
    if (hasAnyValue) reportedDates.add(record.eodDate);

    for (const key of MANUAL_EOD_KEYS) {
      totals[key] += Number(record.values[key] ?? 0);
    }
  }

  return {
    ...totals,
    eodCount: records.length,
    reportedDays: reportedDates.size,
  };
}

function isoWeekStart(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  const weekday = date.getUTCDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function isoWeekEnd(weekStart: string): string {
  const date = new Date(`${weekStart}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
}

export type ManualEodWeek = {
  weekStart: string;
  weekEnd: string;
  records: ManualEodRecord[];
  totals: ManualEodTotals;
};

export type ManualEodMonth = {
  monthKey: string;
  weeks: ManualEodWeek[];
  totals: ManualEodTotals;
};

export function groupManualEodRecords(
  records: ManualEodRecord[],
): ManualEodMonth[] {
  const monthMap = new Map<string, ManualEodRecord[]>();

  for (const record of records) {
    const monthKey = record.eodDate.slice(0, 7);
    monthMap.set(monthKey, [...(monthMap.get(monthKey) ?? []), record]);
  }

  return [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, monthRecords]) => {
      const weekMap = new Map<string, ManualEodRecord[]>();

      for (const record of monthRecords) {
        const weekStart = isoWeekStart(record.eodDate);
        weekMap.set(weekStart, [...(weekMap.get(weekStart) ?? []), record]);
      }

      const weeks = [...weekMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([weekStart, weekRecords]) => ({
          weekStart,
          weekEnd: isoWeekEnd(weekStart),
          records: weekRecords.sort((a, b) => {
            const dateCompare = a.eodDate.localeCompare(b.eodDate);
            if (dateCompare !== 0) return dateCompare;
            return a.advisorName.localeCompare(b.advisorName, "es");
          }),
          totals: sumManualEodRecords(weekRecords),
        }));

      return {
        monthKey,
        weeks,
        totals: sumManualEodRecords(monthRecords),
      };
    });
}

export async function getManualEodRecords(
  range: DateRange,
): Promise<ManualEodRecord[]> {
  const supabase = createSupabaseAdmin();
  const result = await supabase
    .from("vw_milhano_eod_dashboard")
    .select("*")
    .gte("eod_date", range.start)
    .lte("eod_date", range.end)
    .order("eod_date")
    .order("display_name")
    .order("display_order")
    .limit(5000);

  if (result.error) {
    throw new Error(`Unable to load manual EOD data: ${result.error.message}`);
  }

  return buildManualEodRecords(result.data as EodDashboardRow[]);
}

export async function getSubmittedManualEodTotals(
  range: DateRange,
): Promise<ManualEodTotals> {
  const records = await getManualEodRecords(range);
  return sumManualEodRecords(
    records.filter((record) => ["submitted", "validated"].includes(record.status)),
  );
}
