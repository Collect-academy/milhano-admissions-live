import { NextResponse } from "next/server";
import { oh, rateBucket } from "@/lib/open-house";
import {dispatchOpenHouseWelcome} from "@/lib/open-house-ghl";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") && new URL(request.headers.get("origin")!).host !== new URL(request.url).host) return NextResponse.json({error:"Solicitud no válida."},{status:403});
    const b = await request.json();
    if (!["lookup","confirm"].includes(b.action)) return NextResponse.json({error:"Operación inválida."},{status:400});
    const data = await oh(b.action,{ id:String(b.id??"").slice(0,36), phone:String(b.phone??"").slice(0,25), email:String(b.email??"").slice(0,254), name:String(b.name??"").slice(0,150), bucket:rateBucket(request) });
    if(b.action==="confirm"&&data.ok&&!data.already) await dispatchOpenHouseWelcome(String(b.id)).catch(()=>{});
    return NextResponse.json(data,{status:data.error ? (data.code==="rate"?429:400) : 200,headers:{"Cache-Control":"no-store"}});
  } catch { return NextResponse.json({error:"No se pudo conectar. Acércate al equipo de registro."},{status:503}); }
}
