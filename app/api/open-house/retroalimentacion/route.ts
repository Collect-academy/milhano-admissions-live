import {NextResponse} from "next/server";
import {rateBucket} from "@/lib/open-house";
import {createSupabaseAdmin} from "@/lib/supabase-admin";
import {randomUUID} from "node:crypto";
import {readToken,feedbackSlots,feedbackContact,createFeedbackAppointment,GhlFeedbackError} from "@/lib/open-house-feedback-ghl";
export const dynamic="force-dynamic";
export const maxDuration=60;
type Obj=Record<string,any>;
function reply(data:Obj,status?:number){return NextResponse.json(data,{status:status??(data.error?(data.code==="rate"?429:400):200),headers:{"Cache-Control":"no-store"}});}
export async function POST(request:Request){
 try{
  const origin=request.headers.get("origin");if(origin&&new URL(origin).host!==new URL(request.url).host)return reply({error:"Solicitud no válida."},403);
  const b=await request.json();if(!["profile","availability","book"].includes(b.action))return reply({error:"Operación inválida."});
  const db=createSupabaseAdmin();const bucket=rateBucket(request);
  const phone=String(b.phone??"").slice(0,25);
  if(b.action==="profile"){
   const {data,error}=await db.rpc("milhano_oh_trial_match_v2",{p_phone:phone,p_verified_id:null,p_bucket:bucket});if(error)throw error;
   return reply(data);
  }
  const payload={bucket,phone,grade:String(b.grade??"").slice(0,5),child:String(b.child??"").slice(0,150),mode:String(b.mode??"").slice(0,12),guardian:String(b.guardian??"").slice(0,150),email:String(b.email??"").slice(0,254),family_id:String(b.family_id??"").slice(0,36),date:String(b.date??"").slice(0,10),request_id:String(b.request_id??"").slice(0,36),start_at:String(b.start_at??"").slice(0,40)};
  if(b.action==="availability"){
   const {data,error}=await db.rpc("milhano_oh_feedback_v1",{p_action:"availability",p_payload:payload,p_actor:null});if(error)throw error;if(data.error)return reply(data);
   const token=await readToken();const days=await feedbackSlots(token,data.days.map((d:Obj)=>d.date));
   return reply({days,request_id:randomUUID()});
  }
  const {data:claim,error}=await db.rpc("milhano_oh_feedback_slot_v1",{p_action:"claim",p_payload:payload});if(error)throw error;
  if(!claim.claimed)return reply(claim);
  async function finish(state:string,detail:string,appointment_id?:string){
   const {data,error}=await db.rpc("milhano_oh_feedback_slot_v1",{p_action:"finish",p_payload:{reference:claim.reference,state,detail,appointment_id}});
   return !error&&data?.ok===true;
  }
  let sent=false;
  try{
   const token=await readToken(true);
   const days=await feedbackSlots(token,[claim.date]);
   if(!days.some(d=>d.slots.some(s=>Date.parse(s.start_at)===Date.parse(claim.start_at)))){await finish("rejected","Horario ya no disponible");return reply({error:"Ese horario ya fue ocupado. Selecciona otro.",code:"full"});}
   const contact=await feedbackContact(token,claim);
   if(!contact){await finish("rejected","Contacto no identificado de forma única");return reply({error:"No encontramos un contacto único en admisiones. Acércate al equipo para confirmar tus datos.",code:"contact_missing"});}
   sent=true;
   const id=await createFeedbackAppointment(token,claim,contact);
   if(!await finish("confirmed","GHL confirmó la cita",id))return reply({error:"La cita puede haberse creado. No vuelvas a reservar; acércate a admisiones.",code:"review"},503);
   return reply({ok:true,reference:claim.reference,date:claim.date,grade:claim.grade,start_at:claim.start_at});
  }catch(e){
   const rejected=!sent||(e instanceof GhlFeedbackError&&[400,401,403,409,422].includes(e.status));
   const detail=e instanceof GhlFeedbackError?e.message:"Respuesta no verificable";
   await finish(rejected?"rejected":"review",detail);
   return reply(rejected?{error:"No se pudo confirmar con GHL ("+detail+"). Consulta nuevamente los horarios o acércate a admisiones.",code:"date_unavailable"}:{error:"No pudimos verificar si GHL creó la cita. No vuelvas a reservar; acércate a admisiones.",code:"review"},503);
  }
 }catch{return reply({error:"No se pudo conectar. Intenta de nuevo o acércate a admisiones."},503);}
}
