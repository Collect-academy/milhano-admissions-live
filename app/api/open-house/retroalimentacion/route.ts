import {NextResponse} from "next/server";
import {rateBucket} from "@/lib/open-house";
import {createSupabaseAdmin} from "@/lib/supabase-admin";
import {randomUUID} from "node:crypto";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 try{
  const origin=request.headers.get("origin");if(origin&&new URL(origin).host!==new URL(request.url).host)return NextResponse.json({error:"Solicitud no válida."},{status:403});
  const b=await request.json();if(!["profile","availability","book"].includes(b.action))return NextResponse.json({error:"Operación inválida."},{status:400});
  const db=createSupabaseAdmin();const bucket=rateBucket(request);
  const phone=String(b.phone??"").slice(0,25);
  if(b.action==="profile"){
   const {data,error}=await db.rpc("milhano_oh_trial_match_v2",{p_phone:phone,p_verified_id:null,p_bucket:bucket});if(error)throw error;
   return NextResponse.json(data,{status:data.error?429:200,headers:{"Cache-Control":"no-store"}});
  }
  const payload={bucket,phone,grade:String(b.grade??"").slice(0,5),child:String(b.child??"").slice(0,150),mode:String(b.mode??"").slice(0,12),guardian:String(b.guardian??"").slice(0,150),email:String(b.email??"").slice(0,254),family_id:String(b.family_id??"").slice(0,36),date:String(b.date??"").slice(0,10),request_id:String(b.request_id??"").slice(0,36)};
  const {data,error}=await db.rpc("milhano_oh_feedback_v1",{p_action:b.action,p_payload:payload,p_actor:null});if(error)throw error;
  if(b.action==="availability"&&!data.error)data.request_id=randomUUID();
  return NextResponse.json(data,{status:data.error?(data.code==="rate"?429:400):200,headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"No se pudo conectar. Intenta de nuevo o acércate a admisiones."},{status:503});}
}
