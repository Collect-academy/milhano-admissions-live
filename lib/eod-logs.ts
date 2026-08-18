import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase-admin";
import type { DateRange } from "@/lib/date-range";

export type EodFieldChange = {
  metric_key: string;
  old_value: number | null;
  new_value: number | null;
};

export type EodChangeLog = {
  id: string;
  submission_id: string;
  created_at: string;
  eod_date: string;
  action_type: "save_draft" | "submit" | "edit_submitted" | "admin_edit";
  status_before: string | null;
  status_after: string | null;
  changed_fields: number;
  changes: EodFieldChange[];
  comments_before: string | null;
  comments_after: string | null;
  actor_app_user_id: string | null;
  actor_name: string | null;
  target_app_user_id: string;
  advisor_name: string;
};

function normalizeChange(value: unknown): EodFieldChange | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.metric_key !== "string") return null;

  const oldValue = row.old_value === null || row.old_value === undefined
    ? null
    : Number(row.old_value);
  const newValue = row.new_value === null || row.new_value === undefined
    ? null
    : Number(row.new_value);

  return {
    metric_key: row.metric_key,
    old_value: Number.isFinite(oldValue as number) ? oldValue : null,
    new_value: Number.isFinite(newValue as number) ? newValue : null,
  };
}

export async function getEodChangeLogs(range: DateRange): Promise<EodChangeLog[]> {
  const supabase = createSupabaseAdmin();
  const result = await supabase
    .from("vw_milhano_eod_change_logs")
    .select("*")
    .gte("eod_date", range.start)
    .lte("eod_date", range.end)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (result.error) {
    throw new Error(`Unable to load EOD logs: ${result.error.message}`);
  }

  return ((result.data ?? []) as Record<string, unknown>[]).map((raw) => {
    const row = raw as Record<string, unknown>;
    const changes = Array.isArray(row.changes)
      ? row.changes.map(normalizeChange).filter((item): item is EodFieldChange => Boolean(item))
      : [];

    return {
      id: String(row.id),
      submission_id: String(row.submission_id),
      created_at: String(row.created_at),
      eod_date: String(row.eod_date),
      action_type: String(row.action_type) as EodChangeLog["action_type"],
      status_before: row.status_before ? String(row.status_before) : null,
      status_after: row.status_after ? String(row.status_after) : null,
      changed_fields: Number(row.changed_fields ?? changes.length),
      changes,
      comments_before: row.comments_before ? String(row.comments_before) : null,
      comments_after: row.comments_after ? String(row.comments_after) : null,
      actor_app_user_id: row.actor_app_user_id ? String(row.actor_app_user_id) : null,
      actor_name: row.actor_name ? String(row.actor_name) : null,
      target_app_user_id: String(row.target_app_user_id),
      advisor_name: String(row.advisor_name ?? "Unknown"),
    };
  });
}
