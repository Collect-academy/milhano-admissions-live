import "server-only";
import postgres from "postgres";
import {createSupabaseAdmin} from "@/lib/supabase-admin";

const location="ZzRtp9n8n76ARy99VzJc", pipeline="4dXLlrW0X94LoBMapHIF",calendar="zUokihdMDh6ywYQ8IZ2k";
const formFields:Record<string,string>={"cXp0hmItyV6aSLINivKr":"adultos","KuG94CiTwzCpF9ja3i6v":"personas","7FNdnUHVmQu7wkyWdrgk":"nivel","35CijgbpUYQ5POh86flP":"observaciones"};
const slots=new Set(["07:30","09:00","11:00","12:30","14:00"]);
const localTime=new Intl.DateTimeFormat("en-GB",{timeZone:"America/Merida",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
type Obj=Record<string,any>;
async function readToken(){
 if(process.env.OPEN_HOUSE_GHL_READ_TOKEN)return process.env.OPEN_HOUSE_GHL_READ_TOKEN;
 if(!process.env.DATABASE_URL)throw new Error("No está configurada la conexión privada a Vault.");
 const sql=postgres(process.env.DATABASE_URL,{max:1,connect_timeout:8,prepare:false,ssl:process.env.DATABASE_URL.includes("localhost")?false:"require"});
 try{const r=await sql`select decrypted_secret as token from vault.decrypted_secrets where name='milhano_ghl_api_token' limit 1`;if(!r[0]?.token)throw new Error("Token no disponible.");return String(r[0].token);}finally{await sql.end({timeout:2});}
}
export async function synchronizeOpenHouse(actor:string){
 const token=await readToken();
 const get=async(path:string,body?:Obj)=>{
  const r=await fetch("https://services.leadconnectorhq.com"+path,{method:body?"POST":"GET",headers:{Authorization:"Bearer "+token,Version:"2021-07-28","Content-Type":"application/json",Accept:"application/json"},body:body?JSON.stringify(body):undefined,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(18000)});
  if(!r.ok)throw new Error("GHL devolvió HTTP "+r.status);
  return await r.json() as Obj;
 };
 const opportunities:Obj[]=[];
 let expected:number|null=null;
 for(let page=1;page<=20;page++){
  const data=await get("/opportunities/search",{locationId:location,limit:500,page,filters:[{field:"pipeline_id",operator:"eq",value:pipeline}]});
  if(!Array.isArray(data.opportunities)||!Number.isInteger(Number(data.total)))throw new Error("Respuesta incompleta de oportunidades.");
  if(expected===null)expected=Number(data.total);
  if(Number(data.total)!==expected||data.opportunities.some((o:Obj)=>o.pipelineId!==pipeline||!o.contactId||!o.id))throw new Error("La fuente cambió durante la sincronización.");
  opportunities.push(...data.opportunities);
  if(opportunities.length>=expected)break;
  if(!data.opportunities.length)throw new Error("Paginación incompleta.");
 }
 if(opportunities.length!==expected||new Set(opportunities.map(o=>o.id)).size!==expected)throw new Error("Oportunidades incompletas.");
 const query=new URLSearchParams({locationId:location,calendarId:calendar,startTime:String(Date.parse("2026-11-27T00:00:00-06:00")),endTime:String(Date.parse("2026-11-27T23:59:59-06:00"))});
 const result=await get("/calendars/events?"+query);
 if(!Array.isArray(result.events)||result.events.some((e:Obj)=>e.calendarId!==calendar||!e.contactId||!e.id))throw new Error("Respuesta inválida de calendario.");
 const appointments=result.events.filter((e:Obj)=>["confirmed","new","showed"].includes(e.appointmentStatus)&&!e.deleted);
 const ids=[...new Set<string>([...opportunities.map(o=>String(o.contactId)),...appointments.map((a:Obj)=>String(a.contactId))])];
 if(!ids.length||ids.length>5000)throw new Error("Número de contactos inesperado.");
 const contacts=new Map<string,Obj>();
 for(let i=0;i<ids.length;i+=25){
  const batch=ids.slice(i,i+25);
  const data=await get("/contacts/search",{locationId:location,pageLimit:100,page:1,filters:[{group:"OR",filters:batch.map(id=>({field:"id",operator:"eq",value:id}))}]});
  if(!Array.isArray(data.contacts)||data.contacts.length!==batch.length||data.contacts.some((c:Obj)=>!batch.includes(c.id)))throw new Error("No se recuperaron todos los contactos solicitados.");
  data.contacts.forEach((c:Obj)=>contacts.set(c.id,c));
 }
 if(contacts.size!==ids.length)throw new Error("Contactos incompletos.");
 const rows=ids.map(id=>{
  const c=contacts.get(id)!;
  const a=appointments.filter((a:Obj)=>a.contactId===id);
  const reservation_slots=[...new Set<string>(a.map((x:Obj)=>localTime.format(new Date(x.startTime))))].sort();
  if(reservation_slots.some(s=>!slots.has(s)))throw new Error("GHL devolvió un horario no configurado.");
  const o=opportunities.filter(o=>o.contactId===id).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  const fields=Object.fromEntries((Array.isArray(c.customFields)?c.customFields:[]).filter((x:Obj)=>formFields[x.id]).map((x:Obj)=>[formFields[x.id],x.value]));
  return {ghl_contact_id:id,ghl_opportunity_id:o?.id??null,name:c.name||[c.firstName,c.lastName].filter(Boolean).join(" ")||"Sin nombre",phone:c.phone??"",email:c.email??"",fields,reservation_slots,appointment_ids:[...new Set(a.map((x:Obj)=>x.id))],dnd:c.dnd===true};
 });
 const {data,error}=await createSupabaseAdmin().rpc("milhano_oh_merge_v1",{p_rows:rows,p_actor:actor});
 if(error)throw new Error("No se pudieron guardar los registros.");
 return data;
}
export async function dispatchOpenHouseWelcome(id:string){
 const configured=process.env.OPEN_HOUSE_GHL_WELCOME_WEBHOOK_URL;
 if(!configured)return;
 let url:URL;try{url=new URL(configured);}catch{return;}
 if(url.protocol!=="https:"||url.hostname!=="services.leadconnectorhq.com"||!url.pathname.startsWith("/hooks/")||!url.pathname.includes("/webhook-trigger/"))return;
 const admin=createSupabaseAdmin();
 const claim=await admin.rpc("milhano_oh_notification_v1",{p_action:"claim",p_id:id,p_result:null});
 if(claim.error||!claim.data?.claimed)return;
 let result="review";
 try{
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event_key:claim.data.event_key,attendance_id:claim.data.family_id,contactId:claim.data.contactId,phone:claim.data.phone,email:claim.data.email}),signal:AbortSignal.timeout(5000),cache:"no-store",redirect:"error"});
  if(r.ok)result="submitted";
 }catch{/* Ambiguous delivery: never automatically retry. */}
 await admin.rpc("milhano_oh_notification_v1",{p_action:"finish",p_id:id,p_result:result});
}
