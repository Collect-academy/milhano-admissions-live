import {NextResponse} from "next/server";
import {rateBucket} from "@/lib/open-house";
import {trial} from "@/lib/open-house-trial";
import {createSupabaseAdmin} from "@/lib/supabase-admin";
import {verifiedFamily} from "@/lib/open-house-session";
import {randomUUID} from "node:crypto";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 try{
  const origin=request.headers.get("origin");if(origin&&new URL(origin).host!==new URL(request.url).host)return NextResponse.json({error:"Solicitud no válida."},{status:403});
  const b=await request.json();
  if(!["availability","book","profile"].includes(b.action))return NextResponse.json({error:"Operación inválida."},{status:400});
  if(b.action==="profile"){
   const {data,error}=await createSupabaseAdmin().rpc("milhano_oh_trial_profile_v1",{p_phone:String(b.phone??"").slice(0,25),p_name:String(b.name??"").slice(0,150),p_verified_id:verifiedFamily(request),p_bucket:rateBucket(request)});
   if(error)throw error;
   return NextResponse.json(data,{status:data.error?429:200,headers:{"Cache-Control":"no-store"}});
  }
  const payload:Record<string,unknown>={grade:String(b.grade??"").slice(0,5),bucket:rateBucket(request)};
  if(b.action==="book")Object.assign(payload,{date:String(b.date??"").slice(0,10),request_id:String(b.request_id??"").slice(0,36),child:String(b.child??"").slice(0,150),guardian:String(b.guardian??"").slice(0,150),phone:String(b.phone??"").slice(0,25),email:String(b.email??"").slice(0,254)});
  const d=await trial(b.action,payload);
  if(b.action==="availability"&&!d.error)d.request_id=randomUUID();
  return NextResponse.json(d,{status:d.error?(d.code==="rate"?429:400):200,headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"No se pudo conectar. Intenta de nuevo o acércate a admisiones."},{status:503});}
}
