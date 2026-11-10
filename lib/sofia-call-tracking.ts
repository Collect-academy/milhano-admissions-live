import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export type SofiaAttemptRow = {
 conversation_id:string;ghl_opportunity_id:string;ghl_contact_id:string;
 contact_name:string;opportunity_name:string|null;phone_last4:string|null;
 sent_at:string;campaign_id:string|null;campaign_member_id:string|null;
 source:string;attempt_number:number;outcome:string;
 started_at:string|null;ended_at:string|null;duration_seconds:number|null;
 transcript_summary:string|null;call_outcome:string|null;termination_reason:string|null;
 credits_consumed:number|null;meaningful_conversation:boolean|null;
 qualified:boolean|null;school_tour_booked_verified:boolean|null;do_not_contact:boolean|null;
 member_status:string|null;next_at:string|null;retry_held:boolean|null;
};

export async function getSofiaCallTracking():Promise<SofiaAttemptRow[]> {
 const admin=createSupabaseAdmin();
 const {data,error}=await admin.from("milhano_ai_batch_call_tracking")
  .select("conversation_id,ghl_opportunity_id,ghl_contact_id,contact_name,opportunity_name,phone_last4,sent_at,campaign_id,campaign_member_id,source,attempt_number,outcome,started_at,ended_at,duration_seconds,transcript_summary,call_outcome,termination_reason,credits_consumed,meaningful_conversation,qualified,school_tour_booked_verified,do_not_contact,member_status,next_at,retry_held")
  .order("sent_at",{ascending:false}).limit(2000);
 if(error)throw new Error("Sofía · seguimiento de llamadas: "+error.message);
 return (data??[]) as SofiaAttemptRow[];
}
