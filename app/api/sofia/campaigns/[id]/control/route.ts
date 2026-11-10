import { NextResponse } from "next/server";
import { requireAdmissionsAppUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user=await requireAdmissionsAppUser();
  if(user.role!=="admin")return NextResponse.json({error:"Sólo administradores."},{status:403});
  const {id}=await context.params;
  if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Campaña inválida."},{status:400});
  let action:unknown;
  try {({action}=await request.json());}catch{return NextResponse.json({error:"Solicitud inválida."},{status:400});}
  if(!["pause","cancel","resume"].includes(String(action)))
    return NextResponse.json({error:"Acción desconocida."},{status:400});
  const supabase=createSupabaseAdmin();
  const {data:record,error:lookupError}=await supabase.from("milhano_ai_campaigns")
    .select("id,status,dry_run,settings").eq("id",id).maybeSingle();
  if(lookupError||!record)return NextResponse.json({error:"Campaña no encontrada."},{status:404});
  let release:number|null=null;
  let operation=String(action);
  if(operation==="resume"){
    // Remaining contacts may only be released after the one-call pilot was verified.
    if(record.settings?.one_call_pilot_verified!==true)
      return NextResponse.json({error:"Primero debe verificarse la llamada individual de esta campaña."},{status:409});
    const {count,error:countError}=await supabase.from("milhano_ai_campaign_members")
      .select("id",{head:true,count:"exact"}).eq("campaign_id",id);
    if(countError||!count)return NextResponse.json({error:"La campaña no contiene contactos."},{status:409});
    release=count;
    operation="start";
  }
  const {data,error}=await supabase.rpc("milhano_ai_control_campaign",{
    p_campaign_id:id,p_action:operation,p_release_limit:release
  });
  if(error)return NextResponse.json({error:"No se pudo actualizar la campaña."},{status:409});
  if(data?.ok!==true)return NextResponse.json({error:data?.reason??"Acción bloqueada."},{status:409});
  return NextResponse.json({ok:true,...data});
}
