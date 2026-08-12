"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentAppUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

function safeString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalInteger(
  value: FormDataEntryValue | null,
): number | null {
  const raw = safeString(value);
  if (!raw) return null;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Values must be non-negative whole numbers.");
  }

  return parsed;
}

function queryFromForm(
  formData: FormData,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams();

  for (const key of ["range", "from", "to", "metric"]) {
    const value = safeString(formData.get(key));
    if (value) params.set(key, value);
  }

  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }

  return params.toString();
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 240);
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message).slice(0, 240);
  }
  return "Unable to save the reconciliation entry.";
}

async function actorAppUserId(
  currentUser: Awaited<ReturnType<typeof requireCurrentAppUser>>,
): Promise<string> {
  if (currentUser.id !== "basic-auth-fallback") {
    return currentUser.id;
  }

  const supabase = createSupabaseAdmin();
  const result = await supabase
    .from("milhano_app_users")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (result.error || !result.data) {
    throw new Error(
      "No active admin account exists to register this action.",
    );
  }

  return result.data.id;
}

export async function saveReconciliationEntry(
  formData: FormData,
): Promise<never> {
  const currentUser = await requireCurrentAppUser();

  if (currentUser.role !== "admin") {
    redirect(
      `/reconciliation?${queryFromForm(formData, {
        error: "Only an admin can create reconciliation adjustments.",
      })}`,
    );
  }

  let saveError = "";

  try {
    const actorId = await actorAppUserId(currentUser);
    const metricKey = safeString(formData.get("metric_key"));
    const periodStart = safeString(formData.get("period_start"));
    const periodEnd = safeString(formData.get("period_end"));
    const advisorId = safeString(
      formData.get("advisor_app_user_id"),
    );
    const reportedValue = optionalInteger(
      formData.get("reported_value"),
    );
    const manualExtraValue =
      optionalInteger(formData.get("manual_extra_value")) ?? 0;
    const sourceType =
      safeString(formData.get("source_type")) ||
      "admin_adjustment";
    const note = safeString(formData.get("note"));
    const systemIssue =
      formData.get("system_issue_flag") === "on";

    if (!metricKey || !periodStart || !periodEnd) {
      throw new Error("Metric and period are required.");
    }

    const supabase = createSupabaseAdmin();
    const result = await supabase.rpc(
      "milhano_save_reconciliation_entry",
      {
        p_actor_app_user_id: actorId,
        p_metric_key: metricKey,
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_advisor_app_user_id: advisorId || null,
        p_reported_value: reportedValue,
        p_manual_extra_value: manualExtraValue,
        p_source_type: sourceType,
        p_note: note || null,
        p_system_issue_flag: systemIssue,
      },
    );

    if (result.error) {
      throw result.error;
    }
  } catch (error) {
    saveError = errorMessage(error);
  }

  if (saveError) {
    redirect(
      `/reconciliation?${queryFromForm(formData, {
        error: saveError,
      })}`,
    );
  }

  revalidatePath("/");
  revalidatePath("/reconciliation");

  redirect(
    `/reconciliation?${queryFromForm(formData, {
      notice: "saved",
    })}`,
  );
}
