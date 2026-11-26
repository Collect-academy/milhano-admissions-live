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
   const {data,error}=await createSupabaseAdmin().rpc("milhano_oh_trial_match_v2",{p_phone:String(b.phone??"").slice(0,25),p_verified_id:verifiedFamily(request),p_bucket:rateBucket(request)});
   if(error)throw error;
   return NextResponse.json(data,{status:data.error?429:200,headers:{"Cache-Control":"no-store"}});
  }
  const payload:Record<string,unknown>={grade:String(b.grade??"").slice(0,5),bucket:rateBucket(request)};
  if(b.action==="book")Object.assign(payload,{date:String(b.date??"").slice(0,10),request_id:String(b.request_id??"").slice(0,36),child:String(b.child??"").slice(0,150),guardian:String(b.guardian??"").slice(0,150),phone:String(b.phone??"").slice(0,25),email:String(b.email??"").slice(0,254)});
  let d;
  if(b.action==="book"&&b.family_id){
   const id=String(b.family_id);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return NextResponse.json({error:"Familia inválida.",code:"family_changed"},{status:400});
   const {data,error}=await createSupabaseAdmin().rpc("milhano_oh_trial_book_family_v2",{p_payload:payload,p_family_id:id});if(error)throw error;d=data;
  }else d=await trial(b.action,payload);
  if(d.error==="La fecha no está disponible. Elige otra.")d.code="date_unavailable";
  if(b.action==="availability"&&!d.error)d.request_id=randomUUID();
  return NextResponse.json(d,{status:d.error?(d.code==="rate"?429:400):200,headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"No se pudo conectar. Intenta de nuevo o acércate a admisiones."},{status:503});}
}
