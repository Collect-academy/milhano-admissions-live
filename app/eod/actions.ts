"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentAppUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

function safeString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function redirectQuery(
  formData: FormData,
  values: Record<string, string>,
): string {
  const params = new URLSearchParams();

  for (const key of ["range", "from", "to"]) {
    const value = safeString(formData.get(key));
    if (value) params.set(key, value);
  }

  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }

  return `/eod?${params.toString()}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 240);
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    return String(error.message).slice(0, 240);
  }

  return "Unable to save the EOD.";
}

function historicalRedirect(
  eodDate: string,
  values: Record<string, string>,
): string {
  const params = new URLSearchParams({
    range: "custom",
    from: eodDate,
    to: eodDate,
    history: "1",
  });

  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }

  return `/eod?${params.toString()}`;
}

function meridaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Merida",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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

export async function openHistoricalEod(
  formData: FormData,
): Promise<never> {
  const currentUser = await requireCurrentAppUser();
  const actorId = await actorAppUserId(currentUser);
  const eodDate = safeString(formData.get("historical_eod_date"));

  if (!isIsoDate(eodDate)) {
    redirect(`/eod?error=${encodeURIComponent("Select a valid EOD date.")}`);
  }

  if (eodDate > meridaToday()) {
    redirect(
      historicalRedirect(eodDate, {
        error: "A future EOD cannot be created.",
      }),
    );
  }

  if (!["advisor", "admin"].includes(currentUser.role)) {
    redirect(
      historicalRedirect(eodDate, {
        error: "Your role cannot create an EOD.",
      }),
    );
  }

  const targetUserId = currentUser.role === "advisor"
    ? currentUser.id
    : safeString(formData.get("historical_advisor_id"));

  if (!targetUserId) {
    redirect(
      historicalRedirect(eodDate, {
        error: "Select an advisor.",
      }),
    );
  }

  const supabase = createSupabaseAdmin();
  const result = await supabase.rpc(
    "milhano_prepare_historical_eod",
    {
      p_target_app_user_id: targetUserId,
      p_eod_date: eodDate,
      p_actor_app_user_id: actorId,
    },
  );

  if (result.error) {
    redirect(
      historicalRedirect(eodDate, {
        error: errorMessage(result.error),
      }),
    );
  }

  revalidatePath("/eod");
  revalidatePath("/logs");
  revalidatePath("/reconciliation");

  redirect(
    historicalRedirect(eodDate, {
      notice: "historical-opened",
    }),
  );
}

export async function saveEodSubmission(
  formData: FormData,
): Promise<never> {
  const currentUser = await requireCurrentAppUser();
  const actorId = await actorAppUserId(currentUser);
  const submissionId = safeString(
    formData.get("submission_id"),
  );
  const intent = safeString(formData.get("intent"));
  const metricKeys = formData
    .getAll("metric_key")
    .map(String)
    .filter(Boolean);

  if (!submissionId) {
    redirect(
      redirectQuery(formData, {
        error: "EOD submission not found.",
      }),
    );
  }

  const metrics = metricKeys.map((metricKey) => ({
    metric_key: metricKey,
    declared_value: safeString(
      formData.get(`declared__${metricKey}`),
    ),
    discrepancy_note: safeString(
      formData.get(`note__${metricKey}`),
    ),
  }));

  const supabase = createSupabaseAdmin();
  const result = await supabase.rpc(
    "milhano_save_eod_submission",
    {
      p_submission_id: submissionId,
      p_actor_app_user_id: actorId,
      p_metrics: metrics,
      p_comments: safeString(formData.get("comments")),
      p_submit: intent === "submit",
    },
  );

  if (result.error) {
    redirect(
      redirectQuery(formData, {
        error: errorMessage(result.error),
      }),
    );
  }

  const payload = result.data as {
    result?: string;
    status?: string;
    missing_or_unconfirmed?: number;
    reported_gaps?: number;
    blocking_mismatches?: number;
  };

  revalidatePath("/eod");
  revalidatePath("/logs");
  revalidatePath("/reconciliation");

  redirect(
    redirectQuery(formData, {
      notice: payload.result ?? "saved",
      status: payload.status ?? "",
      missing: String(
        payload.missing_or_unconfirmed ?? 0,
      ),
      mismatches: String(
        payload.reported_gaps ??
          payload.blocking_mismatches ??
          0,
      ),
    }),
  );
}

export async function validateEodSubmission(
  formData: FormData,
): Promise<never> {
  const currentUser = await requireCurrentAppUser();
  const actorId = await actorAppUserId(currentUser);
  const submissionId = safeString(
    formData.get("submission_id"),
  );
  const comment = safeString(
    formData.get("validation_comment"),
  );

  if (!submissionId) {
    redirect(
      redirectQuery(formData, {
        error: "EOD submission not found.",
      }),
    );
  }

  const supabase = createSupabaseAdmin();
  const result = await supabase.rpc(
    "milhano_validate_eod_submission",
    {
      p_submission_id: submissionId,
      p_actor_app_user_id: actorId,
      p_validation_comment: comment,
    },
  );

  if (result.error) {
    redirect(
      redirectQuery(formData, {
        error: errorMessage(result.error),
      }),
    );
  }

  revalidatePath("/eod");

  redirect(
    redirectQuery(formData, {
      notice: "validated",
      status: "validated",
    }),
  );
}
