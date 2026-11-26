import { NextResponse } from "next/server";
import { oh, openHouseActor } from "@/lib/open-house";
import {createSupabaseAdmin} from "@/lib/supabase-admin";
import {dispatchOpenHouseWelcome} from "@/lib/open-house-ghl";
export const dynamic = "force-dynamic";
function reply(data: Record<string,unknown>) { return NextResponse.json(data,{status:data.error?(data.code==="forbidden"?403:400):200,headers:{"Cache-Control":"no-store"}}); }
export async function GET(request:Request) {
  try { const actor=await openHouseActor(); if(!actor) return reply({error:"No autorizado",code:"forbidden"}); if(new URL(request.url).searchParams.get("revision")==="1"){const {data,error}=await createSupabaseAdmin().rpc("milhano_oh_revision_v1",{p_actor:actor.id});if(error)throw error;return reply(data);} return reply(await oh("list",{},actor.id)); } catch {return NextResponse.json({error:"No se pudo cargar la lista."},{status:503});}
}
export async function POST(request: Request) {
  try {
    if (!request.headers.get("origin") || new URL(request.headers.get("origin")!).host!==new URL(request.url).host) return reply({error:"Origen no autorizado.",code:"forbidden"});
    const actor=await openHouseActor(); if(!actor) return reply({error:"No autorizado",code:"forbidden"});
    const b=await request.json();
    if(!["update","create","retry_stage"].includes(b.action)||!b.payload||typeof b.payload!=="object") return reply({error:"Operación inválida."});
    const p=b.payload;
    if(b.action==="retry_stage"){if(actor.role!=="admin")return reply({error:"Solo administración puede reintentar.",code:"forbidden"});const id=String(p.id??"");if(!/^[0-9a-f-]{36}$/i.test(id))return reply({error:"Registro inválido"});return reply({ok:true,stage_sync:await dispatchOpenHouseWelcome(id,actor.id)});}
    if (["actual_adults","actual_children"].some(k=>p[k]!=null&&(!Number.isInteger(p[k])||p[k]<0||p[k]>30))) return reply({error:"Número de asistentes inválido."});
    const data=await oh(b.action,p,actor.id);
    if(data.ok&&data.family_id&& (p.attendance==="present"||b.action==="create")) data.stage_sync=await dispatchOpenHouseWelcome(data.family_id).catch(()=>({status:"review"}));
    return reply(data);
  } catch {return NextResponse.json({error:"No se pudo guardar el cambio."},{status:503});}
}
