import { NextResponse } from "next/server";
import { requireAdmissionsAppUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { ELIGIBLE_STAGES, SETTER_PIPELINE_ID, CLOSER_PIPELINE_ID } from "@/lib/sofia-analytics";

type Member = { ghl_contact_id: string; ghl_opportunity_id: string; window_index:number; scheduled_at:string };
type Window = {start_at:string; end_at:string};
const gid = /^[a-zA-Z0-9_-]{8,64}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const user=await requireAdmissionsAppUser();
  if(user.role!=="admin") return NextResponse.json({error:"Solo administradores pueden programar campañas."},{status:403});
  try {
    const body=await request.json();
    const name=typeof body?.name==="string"?body.name.trim():"";
    const windows:Window[]=Array.isArray(body?.windows)?body.windows:[];
    const members:Member[]=Array.isArray(body?.members)?body.members:[];
    if(name.length<3||name.length>90||!uuid.test(user.id)||windows.length<1||windows.length>8||members.length<1||members.length>500)
      return NextResponse.json({error:"Nombre, usuario o número de registros inválido."},{status:400});
    const now=Date.now();
    const orderedWindows=windows.map(w=>({start_at:w?.start_at,end_at:w?.end_at,a:Date.parse(w?.start_at),b:Date.parse(w?.end_at)}));
    if(orderedWindows.some(w=>!Number.isFinite(w.a)||!Number.isFinite(w.b)||w.a<now-60000||w.b<=w.a||w.b>now+90*86400*1000))
      return NextResponse.json({error:"Ventanas inválidas o fuera de los próximos 90 días."},{status:400});
    if(orderedWindows.some((w,i)=>orderedWindows.some((v,j)=>j!==i&&w.a<v.b&&v.a<w.b)))
      return NextResponse.json({error:"Las ventanas no pueden solaparse."},{status:400});
    const dedupContact=new Set<string>(),dedupOpp=new Set<string>();
    for(const m of members) {
      const index=m?.window_index;
      const slot=Date.parse(m?.scheduled_at);
      if(!gid.test(m?.ghl_contact_id)||!gid.test(m?.ghl_opportunity_id)
         ||!Number.isInteger(index)||index<0||index>=windows.length
         ||!Number.isFinite(slot)||slot<orderedWindows[index].a||slot>=orderedWindows[index].b||slot<now-60000
         ||dedupContact.has(m.ghl_contact_id)||dedupOpp.has(m.ghl_opportunity_id))
        return NextResponse.json({error:"Selección duplicada, programación inválida o contacto incompleto."},{status:400});
      dedupContact.add(m.ghl_contact_id);dedupOpp.add(m.ghl_opportunity_id);
    }
    const admin=createSupabaseAdmin();
    // Revalidate live Supabase snapshot; n8n must additionally verify GHL at dispatch time.
    const {data:opportunities,error:lookupError}=await admin.from("milhano_opportunities")
      .select("ghl_opportunity_id,ghl_contact_id,pipeline_id,current_stage,status,phone")
      .in("ghl_opportunity_id",[...dedupOpp]);
    if(lookupError)throw new Error(lookupError.message);
    if(opportunities?.length!==members.length) return NextResponse.json({error:"Algunas oportunidades ya no existen."},{status:409});
    if(opportunities.some(o=>o.pipeline_id!==SETTER_PIPELINE_ID||o.status!=="open"
      ||!(ELIGIBLE_STAGES as readonly string[]).includes(o.current_stage)||!o.phone
      ||!dedupContact.has(o.ghl_contact_id)))
      return NextResponse.json({error:"Una oportunidad cambió de etapa o perdió elegibilidad."},{status:409});
    const {data:closer,error:closerError}=await admin.from("milhano_opportunities")
      .select("ghl_contact_id").eq("pipeline_id",CLOSER_PIPELINE_ID).eq("status","open").in("ghl_contact_id",[...dedupContact]);
    if(closerError)throw new Error(closerError.message);
    if(closer?.length) return NextResponse.json({error:"Un contacto tiene oportunidad abierta en Closer."},{status:409});
    const {data,error}=await admin.rpc("milhano_ai_create_campaign_draft",{
      p_name:name,p_creator:user.id,
      p_windows:windows,p_members:members
    });
    if(error) return NextResponse.json({error:"No se pudo guardar el borrador: "+error.message},{status:409});
    if(body?.activate===true){
      const id=String(data?.campaign_id??"");
      if(!uuid.test(id))return NextResponse.json({error:"El borrador se creó, pero no se confirmó su identificador.",draft:data},{status:503});
      const {data:activated,error:activationError}=await admin.rpc("milhano_ai_control_campaign",{
        p_campaign_id:id,p_action:"start",p_release_limit:members.length
      });
      if(activationError||activated?.ok!==true)
        return NextResponse.json({
          error:"El borrador quedó guardado, pero NO se activó: "+String(activated?.reason??activationError?.message??"Error de aprobación."),
          campaign_id:id,status:"draft",dry_run:true
        },{status:409});
      return NextResponse.json({ok:true,...data,status:"running",dry_run:false,activation:activated});
    }
    return NextResponse.json({ok:true,...data});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"No se pudo procesar la solicitud."},{status:500});
  }
}
