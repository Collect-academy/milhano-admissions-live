import {NextResponse} from "next/server";
import {openHouseActor} from "@/lib/open-house";
import {trial} from "@/lib/open-house-trial";
export const dynamic="force-dynamic";
const reply=(d:any)=>NextResponse.json(d,{status:d.error?d.code==="forbidden"?403:400:200,headers:{"Cache-Control":"no-store"}});
export async function GET(){try{const a=await openHouseActor();if(!a)return reply({error:"No autorizado",code:"forbidden"});return reply(await trial("list",{},a.id));}catch{return reply({error:"No se pudo cargar la agenda."});}}
export async function POST(request:Request){
 try{const origin=request.headers.get("origin");if(!origin||new URL(origin).host!==new URL(request.url).host)return reply({error:"Origen no autorizado.",code:"forbidden"});const a=await openHouseActor();if(!a||a.role!=="admin")return reply({error:"No autorizado",code:"forbidden"});const b=await request.json();if(!["cancel","block","unblock"].includes(b.action))return reply({error:"Operación inválida."});return reply(await trial(b.action,{id:String(b.id??"").slice(0,36),date:String(b.date??"").slice(0,10),grade:String(b.grade??"").slice(0,5),reason:String(b.reason??"").slice(0,200)},a.id));}catch{return reply({error:"No se pudo guardar."});}
}
