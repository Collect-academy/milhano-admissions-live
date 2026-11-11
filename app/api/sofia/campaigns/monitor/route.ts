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
      if (!uuid.test(campaignId)) return NextResponse.json({ error: "Campaña inválida." }, { status: 400 });
      const { data, error } = await admin.from("milhano_ai_campaign_member_monitor")
        .select("*").eq("campaign_id",campaignId).order("scheduled_at",{ascending:true}).limit(500);
      if (error) throw new Error(error.message);
      const members = (data ?? []).map(m => ({
        member_id:m.member_id,campaign_id:m.campaign_id,ghl_contact_id:m.ghl_contact_id,
        ghl_opportunity_id:m.ghl_opportunity_id,contact_name:m.display_name,opportunity_name:m.display_name,
        member_status:m.member_status,
        display_status:m.member_status==="completed"?"completed":m.member_status==="excluded"?"excluded":
          m.member_status==="cancelled"?"cancelled":m.member_status==="review"?"needs_review":
          m.member_status==="queued"&&m.attempts_total>0?"retry_scheduled":
          m.member_status==="queued"?"scheduled":m.member_status==="claimed"?"sending":
          m.member_status==="dispatched"&&m.call_started_at?"call_observed":
          m.member_status==="dispatched"?"awaiting_authorization_or_result":"unknown",
        attempts_total:m.attempts_total,dispatched_at:m.dispatched_at,
        next_scheduled_at:m.scheduled_at,excluded_reason:m.excluded_reason,
        conversation_id:m.conversation_id,last_attempt_status:m.last_attempt_status,
        last_attempt_error:m.last_attempt_error,connection_outcome:m.connection_outcome,
        call_outcome:m.call_outcome,meaningful_conversation:m.meaningful_conversation,qualified:m.qualified,
        call_started_at:m.call_started_at,call_finished_at:m.call_ended_at,
        summary_es:m.summary_es,transcript_summary:m.transcript_summary,
        collected_variables:null,permission_state:m.permission_state,
        permission_requested_at:m.permission_requested_at,permission_approved_at:m.permission_approved_at,
        approval_evidence:m.opt_in_status==="opted_in"?"confirmed":
          m.opt_in_status==="not_opted_in"?"declined":"not_confirmed",
        opt_in_status:m.opt_in_status,opt_in_evidence:m.opt_in_evidence
      }));
      return NextResponse.json({ members, updated_at:new Date().toISOString() },
        {headers:{"Cache-Control":"no-store"}});
    }
    const { data, error } = await admin.from("milhano_ai_campaign_monitor")
      .select("*").order("created_at",{ascending:false}).limit(500);
    if(error)throw new Error(error.message);
    const campaigns=(data??[]).map(c=>({
      id:c.id,name:c.name,status:c.engine_status,dry_run:c.dry_run,concurrency_limit:c.concurrency_limit,
      created_at:c.created_at,updated_at:c.created_at,
      selected:c.selected,queued:c.queued,in_flight:c.in_flight,
      claimed:c.in_flight-c.awaiting_permission_signal,
      awaiting_authorization_or_result:c.awaiting_permission_signal,
      completed:c.completed,review_needed:c.review_needed,excluded:c.excluded,
      cancelled_members:c.cancelled,in_progress_members:c.outstanding,
      permission_events:0,approvals_confirmed:c.opted_in,
      requests_with_permission_event:0,calls_recorded:c.provider_call_events,
      answered_contacts:c.answered_calls,meaningful_contacts:0,
      approval_signal:"observed",
      approval_rate_pct:c.requests_sent>0?Math.round(c.opted_in*1000/c.requests_sent)/10:null,
      next_scheduled_at:null,last_member_update_at:null,requests_sent:c.requests_sent,
      operational_status:c.display_status==="running"?"in_progress":c.display_status,
      opted_in:c.opted_in,not_opted_in:c.not_opted_in,
      pending_opt_in:c.pending_opt_in,not_sent_opt_in:c.not_sent_opt_in
    }));
    return NextResponse.json({ campaigns,updated_at:new Date().toISOString() },
      {headers:{"Cache-Control":"no-store"}});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Error al consultar campañas"},
      {status:500,headers:{"Cache-Control":"no-store"}});
  }
}
