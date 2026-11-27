import "server-only";
import {readToken} from "@/lib/open-house-ghl";
const calendarId="Vkw8NTh2ag1QyEzu962b",locationId="ZzRtp9n8n76ARy99VzJc";
type Obj=Record<string,any>;
export class GhlFeedbackError extends Error {constructor(public status:number){super("GHL HTTP "+status);}}
async function request(token:string,path:string,body?:Obj,version="2021-07-28"){
 const r=await fetch("https://services.leadconnectorhq.com"+path,{method:body?"POST":"GET",headers:{Authorization:"Bearer "+token,Version:version,"Content-Type":"application/json",Accept:"application/json"},body:body?JSON.stringify(body):undefined,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(7000)});
 if(!r.ok)throw new GhlFeedbackError(r.status);return await r.json() as Obj;
}
function dayStart(day:string){return Date.parse(day+"T00:00:00-06:00");}
const dayMs=86400000;
function localDay(ms:number){return new Date(ms-21600000).toISOString().slice(0,10);}
function localHour(ms:number){return new Date(ms-21600000).toISOString().slice(11,16);}
export async function feedbackSlots(token:string,allowed:string[]){
 if(!allowed.length)return [];
 const ranges=Array.from(new Set(allowed.map(d=>d.slice(0,7)))).map(month=>{
  const days=allowed.filter(d=>d.startsWith(month)).sort();return [dayStart(days[0]),dayStart(days[days.length-1])+dayMs];
 });
 const chunks=await Promise.all(ranges.map(([start,end])=>request(token,"/calendars/"+calendarId+"/free-slots?"+new URLSearchParams({startDate:String(start),endDate:String(end),timezone:"America/Merida"}))));
 const days=allowed.map(date=>({date,slots:[] as {start_at:string;label:string}[]}));
 for(const day of days){const seen=new Set<number>();for(const chunk of chunks){const entry=chunk[day.date];if(entry===undefined)continue;if(!Array.isArray(entry.slots))throw new Error("Invalid slot response");for(const item of entry.slots){const ms=Date.parse(String(item));if(!Number.isFinite(ms)||ms<=Date.now()||localDay(ms)!==day.date||seen.has(ms))continue;seen.add(ms);day.slots.push({start_at:new Date(ms).toISOString(),label:localHour(ms)});}}day.slots.sort((a,b)=>a.start_at.localeCompare(b.start_at));}
 return days.filter(d=>d.slots.length).map(d=>({...d,remaining:d.slots.length}));
}
function phone10(v:unknown){return String(v??"").replace(/\D/g,"").replace(/^(?:521|52)(?=\d{10}$)/,"");}
export async function feedbackContact(token:string,claim:Obj){
 if(claim.contact_id){
  const d=await request(token,"/contacts/"+encodeURIComponent(claim.contact_id));const c=d.contact;
  if(c?.id===claim.contact_id&&c.locationId===locationId&&phone10(c.phone)===claim.phone)return c;
  return null;
 }
 const d=await request(token,"/contacts/lookup?"+new URLSearchParams({locationId,phone:"+52"+claim.phone,limit:"20"}),undefined,"v3");
 const matches=Array.isArray(d.contacts)?d.contacts.filter((c:Obj)=>c.locationId===locationId&&phone10(c.phone)===claim.phone&&c.id):[];
 return matches.length===1&&!d.nextCursor?matches[0]:null;
}
export async function createFeedbackAppointment(token:string,claim:Obj,contact:Obj){
 const body={calendarId,locationId,contactId:contact.id,startTime:claim.start_at,endTime:claim.end_at,title:("Retroalimentación — "+claim.child+" | "+claim.grade).slice(0,150),description:"Open House 2026 · Referencia "+claim.reference,appointmentStatus:"confirmed",ignoreDateRange:false,ignoreFreeSlotValidation:false,toNotify:false};
 const data=await request(token,"/calendars/events/appointments",body,"v3");const a=data.appointment??data.event??data;
 if(!a.id||a.calendarId!==calendarId||a.contactId!==contact.id||Date.parse(a.startTime)!==Date.parse(claim.start_at)||Date.parse(a.endTime)!==Date.parse(claim.end_at)||!["confirmed","new"].includes(a.appointmentStatus))throw new Error("Unverified appointment");
 return String(a.id);
}
export {readToken};
