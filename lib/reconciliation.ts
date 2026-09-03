import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { DateRange } from "@/lib/date-range";

export type ReconciliationEntry = {
  id: string;
  metric_key: string;
  period_start: string;
  period_end: string;
  advisor_app_user_id: string | null;
  reported_value: number | null;
  manual_extra_value: number;
  source_type: "historical_report" | "admin_adjustment";
  note: string | null;
  system_issue_flag: boolean;
  created_by_app_user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ReconciliationUser = {
  id: string;
  display_name: string;
  role: "advisor" | "admin" | "viewer" | "student_staff";
  is_active: boolean;
};

function normalizeNumbers<T extends Record<string, unknown>>(
  rows: T[] | null,
): T[] {
  return (rows ?? []).map((row) => {
    const normalized = { ...row };

    for (const [key, value] of Object.entries(normalized)) {
      if (
        typeof value === "string" &&
        /^-?\d+(\.\d+)?$/.test(value)
      ) {
        normalized[key as keyof T] = Number(
          value,
        ) as T[keyof T];
      }
    }

    return normalized;
  });
}

export async function getReconciliationEntries(
  range: DateRange,
): Promise<ReconciliationEntry[]> {
  const supabase = createSupabaseAdmin();
  const result = await supabase
    .from("milhano_metric_reconciliation_entries")
    .select("*")
    .lte("period_start", range.end)
    .gte("period_end", range.start)
    .order("created_at", { ascending: false })
    .limit(500);

  if (result.error) {
    throw new Error(
      `Unable to load reconciliation history: ${result.error.message}`,
    );
  }

  return normalizeNumbers(
    result.data,
  ) as unknown as ReconciliationEntry[];
}

export async function getReconciliationUsers(): Promise<
  ReconciliationUser[]
> {
  const supabase = createSupabaseAdmin();
  const result = await supabase
    .from("milhano_app_users")
    .select("id, display_name, role, is_active")
    .eq("is_active", true)
    .order("display_name");

  if (result.error) {
    throw new Error(
      `Unable to load dashboard users: ${result.error.message}`,
    );
  }

  return result.data as ReconciliationUser[];
}
