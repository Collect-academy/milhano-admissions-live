import { NextResponse } from "next/server";
import { requireAdmissionsAppUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    await requireAdmissionsAppUser();
    const admin = createSupabaseAdmin();
    const campaignId = new URL(request.url).searchParams.get("campaign_id");
    if (campaignId !== null) {
      if (!uuid.test(campaignId)) {
        return NextResponse.json({ error: "Campaña inválida." }, { status: 400 });
      }
      const { data, error } = await admin
        .from("milhano_ai_campaign_member_monitor_v1")
        .select("member_id,campaign_id,ghl_contact_id,ghl_opportunity_id,contact_name,opportunity_name,member_status,display_status,attempts_total,dispatched_at,next_scheduled_at,excluded_reason,conversation_id,last_attempt_status,last_attempt_error,connection_outcome,call_outcome,meaningful_conversation,qualified,call_started_at,call_finished_at,summary_es,transcript_summary,collected_variables,permission_state,permission_requested_at,permission_approved_at,approval_evidence")
        .eq("campaign_id", campaignId)
        .order("contact_name", { ascending: true })
        .limit(500);
      if (error) throw new Error(error.message);
      return NextResponse.json({ members: data ?? [], updated_at: new Date().toISOString() },
        { headers: { "Cache-Control": "no-store" } });
    }
    const { data, error } = await admin
      .from("milhano_ai_campaign_monitor_v1")
      .select("id,name,status,dry_run,concurrency_limit,created_at,updated_at,selected,queued,in_flight,claimed,awaiting_authorization_or_result,completed,review_needed,excluded,cancelled_members,requests_sent,in_progress_members,resolved_members,permission_events,approvals_confirmed,requests_with_permission_event,calls_recorded,answered_contacts,meaningful_contacts,approval_signal,approval_rate_pct,operational_status,next_scheduled_at,last_member_update_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return NextResponse.json({ campaigns: data ?? [], updated_at: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al consultar campañas.";
    return NextResponse.json({ error: message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
