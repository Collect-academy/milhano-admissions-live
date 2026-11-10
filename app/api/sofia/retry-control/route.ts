import { NextResponse } from "next/server";
import { requireAdmissionsAppUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:Request) {
 const user=await requireAdmissionsAppUser();
 if(user.role!=="admin")return NextResponse.json({error:"Sólo administradores."},{status:403});
 const origin=request.headers.get("origin");
 if(!origin || new URL(origin).host!==new URL(request.url).host)
  return NextResponse.json({error:"Origen no autorizado."},{status:403});
 let x:unknown;try{x=await request.json();}catch{return NextResponse.json({error:"Solicitud inválida."},{status:400});}
 const body=x as {member_id?:unknown;hold?:unknown};
 if(typeof body.member_id!=="string"||!uuid.test(body.member_id)||typeof body.hold!=="boolean")
  return NextResponse.json({error:"Selección inválida."},{status:400});
 const admin=createSupabaseAdmin();
 const {data,error}=await admin.rpc("milhano_ai_set_retry_hold",{
  p_member_id:body.member_id,p_hold:body.hold,p_override_at:null,
  p_reason:body.hold?"Pausado manualmente desde seguimiento Sofía":"Reactivado manualmente desde seguimiento Sofía",
  p_admin:user.id
 });
 if(error)return NextResponse.json({error:"No se pudo cambiar el reintento."},{status:503});
 if(data?.ok!==true)return NextResponse.json({error:String(data?.reason??"Operación no autorizada")},{status:409});
 return NextResponse.json({ok:true,...data});
}
