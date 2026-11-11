import { NextResponse } from "next/server";
import { requireAdmissionsAppUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { CLOSER_PIPELINE_ID, ELIGIBLE_STAGES, SETTER_PIPELINE_ID } from "@/lib/sofia-analytics";

export const dynamic = "force-dynamic";

const FEED_URL = "https://collectacademy.app.n8n.cloud/webhook/milhano-ai-feed-individual-9bf29b585b7f5ea3";
const TEST_OPP = "4DAoiAeCm5WBc1VtkJFD";
const TEST_CONTACT = "FBZaamMSEDYI15g7LAjR";
const validId = /^[a-zA-Z0-9_-]{8,64}$/;
const validConversation = /^conv_[A-Za-z0-9]+$/;
const TABLE = "milhano_ai_manual_dispatches";
const BASE_SELECT = "ghl_opportunity_id,ghl_contact_id,pipeline_id,pipeline_stage_id,current_stage,status,phone";

async function signedInAdmin() {
  const user = await requireAdmissionsAppUser();
  return user.role === "admin" ? user : null;
}

export async function GET(request: Request) {
  const user = await signedInAdmin();
  if (!user) return NextResponse.json({error:"Sólo administradores."},{status:403});
  const opportunityId = new URL(request.url).searchParams.get("opportunity_id");
  if (!opportunityId || !validId.test(opportunityId)) return NextResponse.json({error:"Oportunidad inválida."},{status:400});
  const admin = createSupabaseAdmin();
  const {data,error} = await admin.from(TABLE).select("status,provider_status,conversation_id,requested_at")
    .eq("ghl_opportunity_id",opportunityId).maybeSingle();
  if (error) return NextResponse.json({error:"No se pudo consultar el estado."},{status:503});
  return NextResponse.json({record:data ?? null});
}

export async function POST(request: Request) {
  const user = await signedInAdmin();
  if (!user) return NextResponse.json({error:"Sólo administradores."},{status:403});
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== new URL(request.url).host)
    return NextResponse.json({error:"Origen no autorizado."},{status:403});
  const body = await request.json().catch(()=>null);
  const opportunityId = body?.opportunity_id;
  const contactId = body?.contact_id;
  if (body?.confirm !== "ENVIAR_UNA_AUTORIZACION" ||
      typeof opportunityId !== "string" || !validId.test(opportunityId) ||
      typeof contactId !== "string" || !validId.test(contactId))
    return NextResponse.json({error:"Seleccione una oportunidad y confirme el envío."},{status:400});

  const admin = createSupabaseAdmin();
  const {data:opp,error:opErr} = await admin.from("milhano_opportunities")
    .select(BASE_SELECT).eq("ghl_opportunity_id",opportunityId).maybeSingle();
  if (opErr || !opp || opp.ghl_contact_id!==contactId || opp.pipeline_id!==SETTER_PIPELINE_ID ||
      opp.status!=="open" || !(ELIGIBLE_STAGES as readonly string[]).includes(opp.current_stage) || !opp.phone)
    return NextResponse.json({error:"La oportunidad no está disponible en el pipeline Setter."},{status:409});

  // A prior provider-confirmed authorization is permanent, even across opportunities or batches.
  // Also hold ambiguous requests for review rather than risking another WhatsApp request.
  const {data:authorization,error:authorizationError}=await admin
    .from("milhano_ai_contact_authorization_status")
    .select("authorization_status")
    .eq("ghl_contact_id",contactId).maybeSingle();
  if(authorizationError)return NextResponse.json({error:"No se pudo verificar el historial del contacto."},{status:503});
  if(authorization && authorization.authorization_status!=="not_sent")
    return NextResponse.json({error:
      "Este contacto ya tiene una autorización enviada, reservada o por verificar. No se enviará otra solicitud."},{status:409});

  const approvedTest = opportunityId===TEST_OPP && contactId===TEST_CONTACT;
  if (!approvedTest) {
    const [sameSetter,closer,previous,campaigns] = await Promise.all([
      admin.from("milhano_opportunities").select("ghl_opportunity_id")
        .eq("ghl_contact_id",contactId).eq("pipeline_id",SETTER_PIPELINE_ID).eq("status","open"),
      admin.from("milhano_opportunities").select("ghl_opportunity_id")
        .eq("ghl_contact_id",contactId).eq("pipeline_id",CLOSER_PIPELINE_ID).eq("status","open"),
      admin.from("milhano_ai_setter_dispatches").select("conversation_id")
        .eq("ghl_contact_id",contactId).eq("status","dispatched").limit(1),
      admin.from("milhano_ai_campaign_members").select("campaign_id,milhano_ai_campaigns!inner(status)")
        .eq("ghl_contact_id",contactId).in("status",["queued","claimed","dispatched"])
        .in("milhano_ai_campaigns.status",["draft","scheduled","running","paused"]).limit(1)
    ]);
    if (sameSetter.error||closer.error||previous.error||campaigns.error)
      return NextResponse.json({error:"No se pudieron comprobar los bloqueos del contacto."},{status:503});
    if ((sameSetter.data?.length??0)<1 || (closer.data?.length??0)>0 ||
        (previous.data?.length??0)>0 || (campaigns.data?.length??0)>0)
      return NextResponse.json({error:"Este contacto tiene duplicados, campañas previas o seguimiento en Closer."},{status:409});
  }
  // Claim first: even if the HTTP response is lost, never automatically redial.
  const {data:claim,error:claimError} = await admin.from(TABLE)
    .insert({ghl_opportunity_id:opportunityId,ghl_contact_id:contactId,requested_by:user.id,status:"claimed"})
    .select("id").single();
  if (claimError || !claim) {
    if (claimError?.code==="23505") return NextResponse.json({
      error:"Este contacto ya tiene una solicitud registrada. No se reenviará.",
    },{status:409});
    return NextResponse.json({error:"No se pudo reservar el envío. No se llamó desde este endpoint."},{status:503});
  }

  let state:"permission_requested"|"blocked"|"needs_review"="needs_review";
  let conversationId:string|null=null;
  let providerStatus:string|null=null;
  let errorCode:string|null=null;
  try {
    const res = await fetch(FEED_URL,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({contact_id:contactId,opportunity_id:opportunityId,source:"sofia_dashboard_contact_picker"}),
      cache:"no-store",signal:AbortSignal.timeout(45000)
    });
    if (!res.ok) errorCode="N8N_HTTP_"+res.status;
    else {
      const raw=await res.json() as Record<string,unknown>;
      const result=(raw.webhook_response ?? (raw.result as Record<string,unknown>|undefined)?.webhook_response ??
        raw.result ?? raw) as Record<string,unknown>;
      providerStatus=typeof result.status==="string"?result.status:"UNKNOWN";
      const id=typeof result.conversation_id==="string"?result.conversation_id:null;
      if (result.success===true && providerStatus==="DISPATCHED" && id && validConversation.test(id)) {
        state="permission_requested";conversationId=id;
      } else if (result.success===false && ["BLOCKED","INVALID_TRIGGER","DUPLICATE"].includes(providerStatus)) {
        state="blocked";errorCode="WF03_"+providerStatus;
      } else errorCode="UNVERIFIED_N8N_RESULT";
    }
  } catch {errorCode="N8N_NETWORK_OR_TIMEOUT_UNCERTAIN";}
  const {error:saveError}=await admin.from(TABLE).update({
    status:state,conversation_id:conversationId,provider_status:providerStatus,error_code:errorCode,
    updated_at:new Date().toISOString()
  }).eq("id",claim.id).eq("status","claimed");
  if (saveError) return NextResponse.json({error:"Resultado incierto: revisar n8n; no reenviar."},{status:503});
  if (state==="permission_requested") return NextResponse.json({
    ok:true,status:state,conversation_id:conversationId,
    message:"Solicitud aceptada por ElevenLabs. La llamada depende del permiso de WhatsApp."
  });
  return NextResponse.json({ok:false,status:state,error:state==="blocked"?
    "El workflow bloqueó la solicitud. No se reenviará automáticamente.":
    "No se pudo verificar la respuesta. Revisa n8n antes de intentar de nuevo."},{status:409});
}
