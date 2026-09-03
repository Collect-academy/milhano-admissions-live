"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmissionsAppUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

function value(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function meridaTimestamp(raw: string): string | null {
  return raw ? `${raw}:00-06:00` : null;
}

async function actorAppUserId(
  user: Awaited<ReturnType<typeof requireAdmissionsAppUser>>,
): Promise<string> {
  if (user.id !== "basic-auth-fallback") {
    return user.id;
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

export async function saveSchoolTourDetails(
  formData: FormData,
): Promise<never> {
  const user = await requireAdmissionsAppUser();
  const actorId = await actorAppUserId(user);
  const opportunityId = value(
    formData,
    "ghl_opportunity_id",
  );
  const supabase = createSupabaseAdmin();

  const result = await supabase.rpc(
    "milhano_save_school_tour_details",
    {
      p_ghl_opportunity_id: opportunityId,
      p_actor_app_user_id: actorId,
    p_scheduled_for: meridaTimestamp(value(formData, "scheduled_for")),
    p_attendance_status: value(formData, "attendance_status") || "unknown",
    p_attended_at: meridaTimestamp(value(formData, "attended_at")),
    p_has_objection: formData.get("has_objection") === "on",
    p_objection_summary: value(formData, "objection_summary"),
    p_school_tour_notes: value(formData, "school_tour_notes"),
      p_no_show_reason: value(
        formData,
        "no_show_reason",
      ),
    },
  );

  if (result.error) {
    redirect(
      `/leads/${encodeURIComponent(opportunityId)}?error=${encodeURIComponent(
        result.error.message.slice(0, 220),
      )}`,
    );
  }

  revalidatePath(`/leads/${opportunityId}`);
  revalidatePath("/leads");
  revalidatePath("/");
  redirect(`/leads/${encodeURIComponent(opportunityId)}?saved=1`);
}
